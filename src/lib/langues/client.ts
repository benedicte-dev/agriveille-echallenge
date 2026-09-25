/**
 * Point d'entrée serveur de l'API 229langues. Les secrets sont lus dans
 * process.env à la première utilisation et ne quittent jamais le serveur.
 *
 * Branchement du cache (orchestrateur) :
 *   configureLanguesCache({ translations: prismaTranslationStore, audio: prismaAudioStore })
 */
import "server-only";
import {
  createLanguesClient,
  type FallbackResult,
  type LanguesCache,
  type LanguesClient,
  type TargetLang,
  type TtsResult,
  type VoiceLang,
} from "./core";

export {
  LanguesError,
  cacheKey,
  type AudioCacheStore,
  type FallbackResult,
  type LanguesCache,
  type LanguesErrorCode,
  type TargetLang,
  type TranslationCacheStore,
  type TtsResult,
  type VoiceLang,
} from "./core";

let cache: LanguesCache | undefined;
let instance: LanguesClient | undefined;

/** Injecte le cache persistant (tables TranslationCache / AudioCache). */
export function configureLanguesCache(next: LanguesCache | undefined): void {
  cache = next;
  instance = undefined;
}

function client(): LanguesClient {
  instance ??= createLanguesClient({
    baseUrl: process.env.LANGUES_API_BASE ?? "",
    apiKey: process.env.LANGUES_API_KEY ?? "",
    hfToken: process.env.LANGUES_HF_TOKEN ?? "",
    timeoutMs: 25_000,
    retries: 1,
    backoffMs: 800,
    cache,
  });
  return instance;
}

export function translate(text: string, to: TargetLang): Promise<string> {
  return client().translate(text, to);
}

export function translateBatch(texts: readonly string[], to: TargetLang): Promise<(string | null)[]> {
  return client().translateBatch(texts, to);
}

/** Ne lève jamais : renvoie le français avec `fallback: true` en cas d'échec (y compris config absente). */
export async function translateWithFallback(text: string, to: TargetLang): Promise<FallbackResult> {
  try {
    return await client().translateWithFallback(text, to);
  } catch {
    return { text, lang: "fr", fallback: true };
  }
}

export function tts(text: string, lang: VoiceLang): Promise<TtsResult> {
  return client().tts(text, lang);
}

export function stt(audio: Blob | Buffer, mime: string, lang: VoiceLang): Promise<{ text: string }> {
  return client().stt(audio, mime, lang);
}
