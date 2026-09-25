import "server-only";

import { prisma } from "@/lib/db";
import {
  configureLanguesCache,
  translateWithFallback,
  tts,
  stt,
  type LanguesCache,
} from "@/lib/langues/client";

/**
 * Point d'entrée serveur unique vers l'API 229langues : branche le cache
 * persistant (tables TranslationCache / AudioCache) une seule fois, puis
 * ré-exporte le client. Tout le code applicatif importe d'ici, jamais
 * directement de `@/lib/langues/client`.
 */
const prismaCache: LanguesCache = {
  translations: {
    async get(key) {
      const row = await prisma.translationCache.findUnique({ where: { sourceHash: key } });
      return row?.text ?? null;
    },
    async set({ key, lang, source, text }) {
      await prisma.translationCache.upsert({
        where: { sourceHash: key },
        create: { sourceHash: key, lang, source, text },
        update: { text },
      });
    },
  },
  audio: {
    async get(key) {
      const row = await prisma.audioCache.findUnique({ where: { key } });
      return row ? { mime: row.mime, data: Buffer.from(row.data) } : null;
    },
    async set({ key, lang, mime, data }) {
      await prisma.audioCache.upsert({
        where: { key },
        create: { key, lang, mime, data: new Uint8Array(data) },
        update: { mime, data: new Uint8Array(data) },
      });
    },
  },
};

configureLanguesCache(prismaCache);

export type Trilingual = { fr: string; fon: string | null; yo: string | null };

/** Traduit un texte français vers fon et yoruba ; null pour une langue en échec (repli fr à l'affichage). */
export async function toTrilingual(fr: string): Promise<Trilingual> {
  const [fon, yo] = await Promise.all([
    translateWithFallback(fr, "fon"),
    translateWithFallback(fr, "yo"),
  ]);
  return {
    fr,
    fon: fon.fallback ? null : fon.text,
    yo: yo.fallback ? null : yo.text,
  };
}

export { translateWithFallback, tts, stt };
