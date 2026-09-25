import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { limitScope } from "@/lib/security/rate-limit";
import { tts } from "@/server/langues";
import { jsonError, tooMany, voiceFailure } from "../_lib/respond";

/**
 * Proxy de synthèse vocale 229langues (SPEC §5). Contrat ListenButton :
 * POST {text ≤ 1000, lang: "fon"|"yo"} → octets audio bruts (audio/wav ou audio/mpeg).
 * Toute erreur est un JSON générique non 2xx : le bouton affiche « Voix pas disponible ».
 */
export const dynamic = "force-dynamic";
// Premier appel 229langues : jusqu'à 60 s (démarrage à froid du modèle).
export const maxDuration = 60;

const MAX_BODY_BYTES = 8 * 1024;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(1000),
  lang: z.enum(["fon", "yo"]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return jsonError(413, "payload_too_large");

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, "invalid_input");
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return jsonError(413, "payload_too_large");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError(400, "invalid_input");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError(400, "invalid_input");

  const limit = await limitScope("tts", user.id);
  if (!limit.allowed) return tooMany(limit.retryAfterMs);

  try {
    const audio = await tts(parsed.data.text, parsed.data.lang);
    return new Response(new Uint8Array(audio.data), {
      status: 200,
      headers: {
        "Content-Type": audio.mime,
        "Content-Length": String(audio.data.length),
        // Privé : la réponse suit une session ; le navigateur peut la réutiliser un jour.
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    return voiceFailure("tts", err);
  }
}
