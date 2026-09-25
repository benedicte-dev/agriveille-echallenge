import "server-only";

import { LanguesError } from "@/lib/langues/core";

/** Réponses JSON génériques des proxys vocaux : jamais de détail interne ni de secret. */
const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(status: number, error: string, extra: Record<string, string> = {}): Response {
  return Response.json({ error }, { status, headers: { ...NO_STORE, ...extra } });
}

/** Traduit une erreur du client 229langues en réponse HTTP générique (log serveur détaillé). */
export function voiceFailure(scope: "tts" | "stt", err: unknown): Response {
  if (err instanceof LanguesError) {
    console.error(`[voice:${scope}] 229langues`, { code: err.code, status: err.status, message: err.message });
    if (err.code === "INPUT") return jsonError(400, "invalid_input");
    if (err.code === "RATE_LIMITED") {
      const retry = Math.ceil((err.retryAfterMs ?? 30_000) / 1000);
      return jsonError(503, "voice_unavailable", { "Retry-After": String(retry) });
    }
    return jsonError(503, "voice_unavailable");
  }
  console.error(`[voice:${scope}] erreur inattendue`, err);
  return jsonError(503, "voice_unavailable");
}

export function tooMany(retryAfterMs: number): Response {
  return jsonError(429, "too_many_requests", { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) });
}
