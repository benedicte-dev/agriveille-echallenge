import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { limitScope, MAX_STORED_PHOTO_BYTES, MAX_UPLOAD_BYTES } from "@/lib/security";
import { formDataToObject, idSchema } from "@/lib/validation";
import { markDelivery } from "@/server/alerts/deliver";
import { prisma } from "@/lib/db";
import { clientIdSchema, createReport, isReportError, REPORT_ERROR_STATUS, ReportError, reportErrorMessage } from "@/server/reports";

/**
 * POST /api/offline/sync — rejeu de la file hors ligne (docs/uml/04).
 * Corps : multipart/form-data (photo en fichier) ou JSON (photo en base64,
 * 300 Ko au plus). Discriminé par `kind` : "report" | "ack". Idempotent :
 * même clientId = même signalement ; un accusé déjà posé n'est pas réécrit.
 *
 * Statuts : 200/201 succès ; 401 session ; 413 trop gros ; 415 type ; 422
 * invalide ; 429 quota (Retry-After). La file garde l'élément sur 401/429/5xx.
 */
export const dynamic = "force-dynamic";

/** Photo (2 Mo) + champs texte et enveloppe multipart. */
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
/** Base64 d'une photo déjà compressée (≤ 300 Ko) + champs. */
const MAX_BASE64_CHARS = Math.ceil((MAX_STORED_PHOTO_BYTES * 4) / 3) + 4;
const MAX_JSON_BYTES = MAX_BASE64_CHARS + 32 * 1024;

const reportEnvelope = z.looseObject({
  kind: z.literal("report"),
  clientId: clientIdSchema,
  photoBase64: z
    .string()
    .max(MAX_BASE64_CHARS, { error: "Photo trop lourde." })
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, { error: "Photo illisible." })
    .optional(),
});
const ackEnvelope = z.object({ kind: z.literal("ack"), alertId: idSchema });
const syncSchema = z.discriminatedUnion("kind", [reportEnvelope, ackEnvelope]);

const REPORT_FIELDS = [
  "clientId",
  "parcelId",
  "communeId",
  "lat",
  "lon",
  "pestId",
  "description",
  "voiceTranscript",
  "voiceLang",
] as const;

function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, error, message, ...extra }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function fromReportError(err: ReportError) {
  const status = REPORT_ERROR_STATUS[err.code];
  const headers: Record<string, string> = {};
  if (err.code === "RATE_LIMITED") headers["Retry-After"] = String(Math.max(1, Math.ceil((err.retryAfterMs ?? 60_000) / 1000)));
  return fail(status, err.code, err.message, err.fields ? { fields: err.fields } : {}, headers);
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // requêtes same-origin sans Origin (anciens navigateurs) : le cookie SameSite=Lax protège
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Lit le corps en refusant au-delà de `max` octets, avant tout parsing (E1). */
async function readBounded(req: NextRequest, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(req.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail(401, "UNAUTHENTICATED", reportErrorMessage("UNAUTHENTICATED"));
  if (!sameOrigin(req)) return fail(403, "FORBIDDEN", reportErrorMessage("FORBIDDEN"));

  const limit = await limitScope("offlineSync", user.id);
  if (!limit.allowed) {
    return fail(429, "RATE_LIMITED", "Trop d'envois. Attendez un peu.", {}, {
      "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
    });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");
  const isJson = contentType.startsWith("application/json");
  if (!isMultipart && !isJson) return fail(415, "UNSUPPORTED", "Format d'envoi non accepté.");

  const body = await readBounded(req, isMultipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES);
  if (!body) return fail(413, "PHOTO_TOO_LARGE", reportErrorMessage("PHOTO_TOO_LARGE"));

  let raw: Record<string, unknown>;
  let photo: Blob | null = null;
  try {
    if (isMultipart) {
      const fd = await new Response(body, { headers: { "content-type": contentType } }).formData();
      raw = formDataToObject(fd);
      const file = fd.get("photo");
      if (file instanceof Blob) photo = file;
      else if (typeof file === "string" && file !== "") return fail(422, "INVALID", reportErrorMessage("INVALID"));
    } else {
      const parsedJson: unknown = JSON.parse(new TextDecoder().decode(body));
      if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
        return fail(422, "INVALID", reportErrorMessage("INVALID"));
      }
      raw = parsedJson as Record<string, unknown>;
    }
  } catch {
    return fail(422, "INVALID", reportErrorMessage("INVALID"));
  }

  const envelope = syncSchema.safeParse(raw);
  if (!envelope.success) return fail(422, "INVALID", reportErrorMessage("INVALID"));

  try {
    if (envelope.data.kind === "ack") {
      const { alertId } = envelope.data;
      const delivery = await prisma.alertDelivery.findFirst({
        where: { alertId, userId: user.id, channel: "IN_APP" },
        select: { status: true },
      });
      // Contrôle de propriété : pas de livraison pour cet utilisateur = introuvable.
      if (!delivery) return fail(404, "NOT_FOUND", "Alerte introuvable.");
      if (delivery.status === "ACKNOWLEDGED") {
        return NextResponse.json({ ok: true, kind: "ack", alertId, duplicate: true }, { headers: { "Cache-Control": "no-store" } });
      }
      const ok = await markDelivery(user.id, alertId, "ACKNOWLEDGED");
      if (!ok) return fail(404, "NOT_FOUND", "Alerte introuvable.");
      return NextResponse.json({ ok: true, kind: "ack", alertId, duplicate: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const { photoBase64 } = envelope.data;
    if (photoBase64) {
      if (photo) return fail(422, "INVALID", reportErrorMessage("INVALID"));
      photo = new Blob([Buffer.from(photoBase64, "base64")]);
    }
    const input: Record<string, unknown> = {};
    for (const key of REPORT_FIELDS) {
      const v = raw[key];
      if (typeof v === "string" || typeof v === "number") input[key] = v;
    }
    const result = await createReport(user, { ...input, photo });
    return NextResponse.json(
      { ok: true, kind: "report", clientId: envelope.data.clientId, reportId: result.id, duplicate: !result.created },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (isReportError(err)) return fromReportError(err);
    console.error("[offline/sync] échec", { userId: user.id, kind: envelope.data.kind }, err);
    return fail(500, "INTERNAL", "Un problème est arrivé. Réessayez.");
  }
}
