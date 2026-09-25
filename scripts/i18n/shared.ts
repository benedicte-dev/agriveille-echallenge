/**
 * Outils communs aux scripts i18n : chargement de .env, client API réglé pour
 * les scripts (timeouts longs, débit limité à 5 req/min), cache disque, mesures.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLanguesClient,
  type AudioCacheStore,
  type TranslationCacheStore,
} from "../../src/lib/langues/core";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CACHE_DIR = join(ROOT, "scripts/i18n/.cache");
export const MESSAGES_DIR = join(ROOT, "src/lib/i18n/messages");

export function loadEnv(): void {
  const envPath = join(ROOT, ".env");
  if (!process.env.LANGUES_API_BASE && existsSync(envPath)) process.loadEnvFile(envPath);
  for (const k of ["LANGUES_API_BASE", "LANGUES_API_KEY", "LANGUES_HF_TOKEN"]) {
    if (!process.env[k]) throw new Error(`variable ${k} absente (.env)`);
  }
}

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

/** Cache disque des traductions (clé = sha256(lang+texte), comme en base). */
export function diskTranslationCache(file: string): TranslationCacheStore & { size(): number } {
  const data = readJson<Record<string, { lang: string; source: string; text: string }>>(file, {});
  return {
    async get(key) {
      return data[key]?.text ?? null;
    },
    async set({ key, lang, source, text }) {
      data[key] = { lang, source, text };
      writeJson(file, data);
    },
    size: () => Object.keys(data).length,
  };
}

/** Cache disque de l'audio brut renvoyé par l'API (avant conversion). */
export function diskAudioCache(dir: string): AudioCacheStore {
  mkdirSync(dir, { recursive: true });
  return {
    async get(key) {
      const meta = join(dir, `${key}.json`);
      if (!existsSync(meta)) return null;
      const { mime } = JSON.parse(readFileSync(meta, "utf8")) as { mime: string };
      return { mime, data: readFileSync(join(dir, `${key}.bin`)) };
    },
    async set({ key, mime, data }) {
      writeFileSync(join(dir, `${key}.bin`), data);
      writeFileSync(join(dir, `${key}.json`), JSON.stringify({ mime }));
    },
  };
}

export interface CallStat {
  path: string;
  status: number | "error";
  ms: number;
}

/**
 * fetch instrumenté : espace les appels (limite 5/min du jeton) et mesure
 * chaque appel. Aucun en-tête n'est journalisé.
 */
export function throttledFetch(minGapMs: number, stats: CallStat[]): typeof fetch {
  let last = 0;
  return async (input, init) => {
    const wait = last + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url).pathname;
    const started = Date.now();
    try {
      const res = await fetch(input, init);
      stats.push({ path, status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      stats.push({ path, status: "error", ms: Date.now() - started });
      throw err;
    }
  };
}

export function scriptClient(opts: {
  stats: CallStat[];
  translations?: TranslationCacheStore;
  audio?: AudioCacheStore;
}) {
  return createLanguesClient({
    baseUrl: process.env.LANGUES_API_BASE!,
    apiKey: process.env.LANGUES_API_KEY!,
    hfToken: process.env.LANGUES_HF_TOKEN!,
    timeoutMs: 90_000,
    retries: 4,
    backoffMs: 5_000,
    maxRetryAfterMs: 65_000,
    cache: { translations: opts.translations, audio: opts.audio },
    fetch: throttledFetch(Number(process.env.LANGUES_MIN_GAP_MS ?? 12_500), opts.stats),
    log: (event, meta) => console.warn(`  [api] ${event}`, JSON.stringify(meta)),
  });
}

export function summarize(stats: CallStat[]) {
  const ok = stats.filter((s) => s.status === 200);
  const avg = ok.length ? Math.round(ok.reduce((a, s) => a + s.ms, 0) / ok.length) : 0;
  const max = ok.length ? Math.max(...ok.map((s) => s.ms)) : 0;
  return { calls: stats.length, ok: ok.length, avgMs: avg, maxMs: max };
}

/**
 * Ajoute les mesures de cette exécution à .cache/api-stats.json et renvoie le
 * cumul par catégorie (une relance servie par le cache ne fait aucun appel :
 * sans cumul, le rapport perdrait la latence réellement mesurée).
 */
export function recordStats(kind: "translate" | "tts", stats: CallStat[]) {
  const file = join(CACHE_DIR, "api-stats.json");
  const all = readJson<Record<string, CallStat[]>>(file, {});
  all[kind] = [...(all[kind] ?? []), ...stats];
  writeJson(file, all);
  return summarize(all[kind]);
}
