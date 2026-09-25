import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { limitScope } from "@/lib/security/rate-limit";
import { stt } from "@/server/langues";
import { sniffAudioUpload } from "../_lib/sniff";
import { jsonError, tooMany, voiceFailure } from "../_lib/respond";

/**
 * Proxy de transcription 229langues (SPEC §5).
 * POST multipart/form-data : `audio` (fichier ≤ 2 Mo) + `lang` ("fon"|"yo") → JSON {text}.
 * La taille est contrôlée avant l'analyse du corps ; le format est vérifié par signature.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
/** Enveloppe multipart (limites, en-têtes de parties, champ lang). */
const MULTIPART_OVERHEAD = 16 * 1024;

const langSchema = z.enum(["fon", "yo"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "unauthorized");

  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) return jsonError(415, "unsupported_media_type");

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader === null) return jsonError(411, "length_required");
  const declared = Number(lengthHeader);
  if (!Number.isFinite(declared) || declared <= 0) return jsonError(400, "invalid_input");
  if (declared > MAX_AUDIO_BYTES + MULTIPART_OVERHEAD) return jsonError(413, "payload_too_large");

  const limit = await limitScope("stt", user.id);
  if (!limit.allowed) return tooMany(limit.retryAfterMs);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "invalid_input");
  }

  const lang = langSchema.safeParse(form.get("lang"));
  const file = form.get("audio");
  if (!lang.success || !(file instanceof Blob)) return jsonError(400, "invalid_input");
  if (file.size === 0) return jsonError(400, "invalid_input");
  if (file.size > MAX_AUDIO_BYTES) return jsonError(413, "payload_too_large");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffAudioUpload(bytes);
  if (!mime) return jsonError(415, "unsupported_media_type");

  try {
    const { text } = await stt(Buffer.from(bytes), mime, lang.data);
    return Response.json({ text: text.slice(0, 2000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return voiceFailure("stt", err);
  }
}
