/**
 * Client de l'API 229langues (traduction, synthèse vocale, transcription).
 *
 * Ce module n'importe ni `server-only` ni Prisma : il est utilisé par
 * `client.ts` (runtime serveur Next) et par les scripts `scripts/i18n/`.
 * Il ne lit jamais `process.env` lui-même : la configuration est injectée.
 *
 * Contraintes de l'API (doc officielle + essais) :
 * - Space Hugging Face : le premier appel peut prendre ~60 s (réveil du modèle).
 * - 5 requêtes / minute / jeton (429 au-delà).
 * - translate : 5 000 caractères max ; batch : 100 textes max ; tts : 1 000 caractères max.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

/* ------------------------------------------------------------------ types */

/** Délai de la synthèse vocale : tient dans maxDuration = 60 s de /api/voice/tts. */
const TTS_TIMEOUT_MS = 50_000;

/** Langues cibles de la traduction (codes de l'API : fon, yo). */
export type TargetLang = "fon" | "yo";
/** Langues vocales côté application (mappées vers fon / yoruba pour l'API). */
export type VoiceLang = "fon" | "yo";

export const MAX_TRANSLATE_CHARS = 5000;
export const MAX_BATCH_TEXTS = 100;
export const MAX_TTS_CHARS = 1000;
export const MAX_STT_BYTES = 10 * 1024 * 1024;

const API_VOICE_LANG: Record<VoiceLang, "fon" | "yoruba"> = { fon: "fon", yo: "yoruba" };

export type LanguesErrorCode =
  | "CONFIG" // variables d'environnement absentes
  | "INPUT" // entrée refusée avant tout appel réseau
  | "TIMEOUT"
  | "NETWORK"
  | "RATE_LIMITED" // HTTP 429
  | "UNAUTHORIZED" // HTTP 401 / 403
  | "HTTP" // autre statut non 2xx
  | "BAD_RESPONSE"; // 2xx mais corps inattendu

export class LanguesError extends Error {
  readonly code: LanguesErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  /** Délai conseillé par le serveur (Retry-After), en ms. */
  readonly retryAfterMs?: number;

  constructor(
    code: LanguesErrorCode,
    message: string,
    opts: { status?: number; retryable?: boolean; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "LanguesError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/** Cache de traductions. Clé = sha256(lang + texte) (= TranslationCache.sourceHash). */
export interface TranslationCacheStore {
  get(key: string): Promise<string | null>;
  set(entry: { key: string; lang: TargetLang; source: string; text: string }): Promise<void>;
}

/** Cache audio. Clé = sha256(lang + texte) (= AudioCache.key). */
export interface AudioCacheStore {
  get(key: string): Promise<{ mime: string; data: Buffer } | null>;
  set(entry: { key: string; lang: VoiceLang; mime: string; data: Buffer }): Promise<void>;
}

export interface LanguesCache {
  translations?: TranslationCacheStore;
  audio?: AudioCacheStore;
}

export interface LanguesConfig {
  baseUrl: string;
  apiKey: string;
  hfToken: string;
  /** Délai max par tentative (ms). Défaut 25 000 (runtime) ; scripts : 90 000. */
  timeoutMs?: number;
  /** Nombre de nouvelles tentatives après la première. Défaut 2. */
  retries?: number;
  /** Base du backoff exponentiel (ms). Défaut 1 000. */
  backoffMs?: number;
  /** Plafond d'attente sur un 429 avec Retry-After (ms). Défaut 5 000. */
  maxRetryAfterMs?: number;
  cache?: LanguesCache;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Journal opérateur (jamais de secret dedans). Défaut : console.warn. */
  log?: (event: string, meta: Record<string, unknown>) => void;
}

export interface TtsResult {
  mime: "audio/wav" | "audio/mpeg";
  data: Buffer;
}

export interface FallbackResult {
  text: string;
  lang: TargetLang | "fr";
  fallback: boolean;
}

/* ---------------------------------------------------------------- schémas */

const translateResponse = z.object({
  success: z.literal(true),
  data: z.object({ text: z.string() }),
});

const batchResponse = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      success: z.boolean(),
      translated_text: z.string().optional().nullable(),
    }),
  ),
});

const sttResponse = z.object({
  success: z.literal(true),
  data: z.object({ transcription: z.string() }),
});

const errorBody = z
  .object({ error: z.unknown().optional(), message: z.unknown().optional() })
  .passthrough();

/* ---------------------------------------------------------------- helpers */

export function cacheKey(lang: string, text: string): string {
  return createHash("sha256").update(lang + text).digest("hex");
}

/** Reconnaît le format réel par la signature, pas par l'en-tête annoncé. */
export function sniffAudio(data: Uint8Array): TtsResult["mime"] | null {
  if (data.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(0, 3) === "ID3") return "audio/mpeg";
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "audio/mpeg"; // trame MPEG sans ID3
  return null;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function describeBody(text: string): string {
  try {
    const parsed = errorBody.safeParse(JSON.parse(text));
    if (parsed.success) {
      const msg = parsed.data.error ?? parsed.data.message;
      if (typeof msg === "string") return msg.slice(0, 200);
    }
  } catch {
    /* corps non JSON */
  }
  return text.slice(0, 200);
}

function requireText(text: unknown, max: number, what: string): string {
  if (typeof text !== "string") throw new LanguesError("INPUT", `${what} : texte attendu`);
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new LanguesError("INPUT", `${what} : texte vide`);
  if (trimmed.length > max) {
    throw new LanguesError("INPUT", `${what} : ${trimmed.length} caractères (max ${max})`);
  }
  return trimmed;
}

function requireTarget(to: unknown): TargetLang {
  if (to !== "fon" && to !== "yo") throw new LanguesError("INPUT", "langue cible inconnue");
  return to;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------- client */

export type LanguesClient = ReturnType<typeof createLanguesClient>;

export function createLanguesClient(config: LanguesConfig) {
  if (!config.baseUrl || !config.apiKey || !config.hfToken) {
    throw new LanguesError("CONFIG", "API 229langues non configurée");
  }
  const base = config.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? 25_000;
  const retries = config.retries ?? 2;
  const backoffMs = config.backoffMs ?? 1_000;
  const maxRetryAfterMs = config.maxRetryAfterMs ?? 5_000;
  const doFetch = config.fetch ?? globalThis.fetch;
  const sleep = config.sleep ?? defaultSleep;
  const log =
    config.log ??
    ((event: string, meta: Record<string, unknown>) => console.warn(`[langues] ${event}`, meta));
  const cache = config.cache ?? {};

  const authHeaders = {
    Authorization: `Bearer ${config.hfToken}`,
    "X-API-Key": config.apiKey,
  };

  /** Une tentative : délai, statut, classement de l'erreur. */
  async function attempt(path: string, init: RequestInit, callTimeoutMs = timeoutMs): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        ...init,
        headers: { ...authHeaders, ...(init.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(callTimeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new LanguesError("TIMEOUT", `délai dépassé (${callTimeoutMs} ms) sur ${path}`, {
          retryable: true,
          cause: err,
        });
      }
      throw new LanguesError("NETWORK", `échec réseau sur ${path}`, { retryable: true, cause: err });
    }
    if (res.ok) return res;

    const detail = describeBody(await res.text().catch(() => ""));
    if (res.status === 429) {
      throw new LanguesError("RATE_LIMITED", `limite de débit atteinte sur ${path}`, {
        status: 429,
        retryable: true,
        retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new LanguesError("UNAUTHORIZED", `accès refusé par l'API (${res.status})`, {
        status: res.status,
      });
    }
    throw new LanguesError("HTTP", `HTTP ${res.status} sur ${path} : ${detail}`, {
      status: res.status,
      retryable: res.status >= 500 || res.status === 408,
    });
  }

  /** Tentatives avec backoff exponentiel + gigue. */
  async function request(
    path: string,
    init: () => RequestInit,
    opts: { timeoutMs?: number; retries?: number } = {},
  ): Promise<Response> {
    const maxRetries = opts.retries ?? retries;
    let lastErr: unknown;
    for (let i = 0; i <= maxRetries; i++) {
      const started = Date.now();
      try {
        return await attempt(path, init(), opts.timeoutMs);
      } catch (err) {
        lastErr = err;
        const le = err instanceof LanguesError ? err : null;
        log("call_failed", {
          path,
          attempt: i + 1,
          code: le?.code ?? "UNKNOWN",
          status: le?.status,
          ms: Date.now() - started,
        });
        if (!le?.retryable || i === maxRetries) break;
        const exp = backoffMs * 2 ** i + Math.floor(Math.random() * backoffMs);
        const wait =
          le.code === "RATE_LIMITED" && le.retryAfterMs !== undefined
            ? Math.min(le.retryAfterMs, maxRetryAfterMs)
            : exp;
        await sleep(wait);
      }
    }
    throw lastErr;
  }

  async function readJson(res: Response, path: string): Promise<unknown> {
    try {
      return await res.json();
    } catch (err) {
      throw new LanguesError("BAD_RESPONSE", `réponse non JSON sur ${path}`, { cause: err });
    }
  }

  function parseOr<T>(schema: z.ZodType<T>, body: unknown, path: string): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new LanguesError("BAD_RESPONSE", `réponse inattendue sur ${path}`, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  async function cacheGetText(key: string): Promise<string | null> {
    if (!cache.translations) return null;
    try {
      return await cache.translations.get(key);
    } catch (err) {
      log("cache_read_failed", { kind: "translation", error: String(err) });
      return null;
    }
  }

  async function cacheSetText(key: string, lang: TargetLang, source: string, text: string) {
    if (!cache.translations) return;
    try {
      await cache.translations.set({ key, lang, source, text });
    } catch (err) {
      log("cache_write_failed", { kind: "translation", error: String(err) });
    }
  }

  /** Traduit un texte français vers fon ou yoruba. */
  async function translate(text: string, to: TargetLang): Promise<string> {
    const lang = requireTarget(to);
    const source = requireText(text, MAX_TRANSLATE_CHARS, "translate");
    const key = cacheKey(lang, source);
    const hit = await cacheGetText(key);
    if (hit !== null) return hit;

    const path = "/api/v1/translate";
    const res = await request(path, () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: source, from_lang: "fr", to_lang: lang }),
    }));
    const out = parseOr(translateResponse, await readJson(res, path), path).data.text.trim();
    if (out.length === 0) throw new LanguesError("BAD_RESPONSE", "traduction vide");
    await cacheSetText(key, lang, source, out);
    return out;
  }

  /**
   * Traduit plusieurs textes. Découpe en lots de 100. Renvoie un tableau aligné
   * sur l'entrée : `null` pour un élément que l'API n'a pas su traduire.
   * Une panne de tout l'appel lève une LanguesError.
   */
  async function translateBatch(texts: readonly string[], to: TargetLang): Promise<(string | null)[]> {
    const lang = requireTarget(to);
    if (!Array.isArray(texts)) throw new LanguesError("INPUT", "translateBatch : tableau attendu");
    const sources = texts.map((t) => requireText(t, MAX_TRANSLATE_CHARS, "translateBatch"));
    const results: (string | null)[] = new Array(sources.length).fill(null);

    const missing: number[] = [];
    for (let i = 0; i < sources.length; i++) {
      const hit = await cacheGetText(cacheKey(lang, sources[i]));
      if (hit !== null) results[i] = hit;
      else missing.push(i);
    }

    const path = "/api/v1/translate/batch";
    for (let start = 0; start < missing.length; start += MAX_BATCH_TEXTS) {
      const chunk = missing.slice(start, start + MAX_BATCH_TEXTS);
      const res = await request(path, () => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: chunk.map((i) => sources[i]), from_lang: "fr", to_lang: lang }),
      }));
      const body = parseOr(batchResponse, await readJson(res, path), path);
      for (const item of body.data) {
        if (item.index >= chunk.length) continue; // index hors lot : ignoré
        const text = item.translated_text?.trim();
        if (!item.success || !text) continue;
        const i = chunk[item.index];
        results[i] = text;
        await cacheSetText(cacheKey(lang, sources[i]), lang, sources[i], text);
      }
    }
    return results;
  }

  /** Traduction qui ne lève jamais : repli sur le français, marqué `fallback`. */
  async function translateWithFallback(text: string, to: TargetLang): Promise<FallbackResult> {
    try {
      return { text: await translate(text, to), lang: to, fallback: false };
    } catch (err) {
      log("translate_fallback", {
        to,
        code: err instanceof LanguesError ? err.code : "UNKNOWN",
      });
      return { text, lang: "fr", fallback: true };
    }
  }

  /** Synthèse vocale. `text` doit déjà être dans la langue demandée. */
  async function tts(text: string, lang: VoiceLang): Promise<TtsResult> {
    if (lang !== "fon" && lang !== "yo") throw new LanguesError("INPUT", "langue vocale inconnue");
    const source = requireText(text, MAX_TTS_CHARS, "tts");
    const key = cacheKey(lang, source);
    if (cache.audio) {
      try {
        const hit = await cache.audio.get(key);
        if (hit) return { mime: hit.mime === "audio/mpeg" ? "audio/mpeg" : "audio/wav", data: hit.data };
      } catch (err) {
        log("cache_read_failed", { kind: "audio", error: String(err) });
      }
    }

    const path = "/api/v1/tts";
    // La synthèse fon prend souvent 15 à 40 s : une seule tentative longue tient dans les
    // 60 s de la fonction ; plusieurs tentatives courtes échouaient toutes.
    const res = await request(
      path,
      () => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source, language: API_VOICE_LANG[lang] }),
      }),
      { timeoutMs: TTS_TIMEOUT_MS, retries: 0 },
    );
    const data = Buffer.from(await res.arrayBuffer());
    const mime = sniffAudio(data);
    if (!mime) {
      throw new LanguesError(
        "BAD_RESPONSE",
        `réponse TTS non audio (${res.headers.get("content-type") ?? "?"}, ${data.length} octets)`,
      );
    }
    if (cache.audio) {
      try {
        await cache.audio.set({ key, lang, mime, data });
      } catch (err) {
        log("cache_write_failed", { kind: "audio", error: String(err) });
      }
    }
    return { mime, data };
  }

  /** Transcription d'un enregistrement (wav, mp3, ogg, webm…). */
  async function stt(audio: Blob | Buffer | Uint8Array, mime: string, lang: VoiceLang): Promise<{ text: string }> {
    if (lang !== "fon" && lang !== "yo") throw new LanguesError("INPUT", "langue vocale inconnue");
    if (!/^audio\/[a-z0-9.+-]+(;.*)?$/i.test(mime)) throw new LanguesError("INPUT", "type audio invalide");
    const blob =
      audio instanceof Blob ? audio : new Blob([new Uint8Array(audio)], { type: mime });
    if (blob.size === 0) throw new LanguesError("INPUT", "audio vide");
    if (blob.size > MAX_STT_BYTES) throw new LanguesError("INPUT", "audio trop volumineux");
    const ext = mimeToExt(mime);

    const path = "/api/v1/stt";
    const res = await request(path, () => {
      const form = new FormData();
      form.append("audio", blob, `enregistrement.${ext}`);
      form.append("language", API_VOICE_LANG[lang]);
      return { method: "POST", body: form };
    });
    const body = parseOr(sttResponse, await readJson(res, path), path);
    return { text: body.data.transcription.trim() };
  }

  return { translate, translateBatch, translateWithFallback, tts, stt };
}

function mimeToExt(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "audio/wav":
    case "audio/x-wav":
    case "audio/wave":
      return "wav";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/webm":
      return "webm";
    case "audio/mp4":
    case "audio/aac":
    case "audio/x-m4a":
      return "m4a";
    default:
      return "bin";
  }
}
