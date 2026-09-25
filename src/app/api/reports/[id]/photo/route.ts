import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getReportPhoto, isReportError } from "@/server/reports";

/**
 * GET /api/reports/[id]/photo — photo d'un signalement, servie depuis la base
 * (jamais depuis public/). Déclarant ou AGENT/ADMIN ; sinon 404 (on ne
 * confirme pas l'existence). Type recalculé depuis la signature des octets.
 */
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
} as const;

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return textResponse(401, "Session expirée.");
  const { id } = await ctx.params;
  try {
    const { bytes, mime } = await getReportPhoto(user, id);
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    return new Response(bytes, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": mime,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="signalement-${id}.${ext}"`,
      },
    });
  } catch (err) {
    if (isReportError(err)) return textResponse(404, "Photo introuvable.");
    console.error("[reports/photo] échec", { id }, err);
    return textResponse(500, "Un problème est arrivé.");
  }
}
