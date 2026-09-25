import "server-only";

// Import pour effet : branche le cache Prisma (TranslationCache) sur le client 229langues.
import "@/server/langues";
import type { Prisma } from "@prisma/client";
import { translateBatch } from "@/lib/langues/client";
import { prisma } from "@/lib/db";

/**
 * Traduction groupée des alertes. L'API 229langues limite fortement le débit
 * d'appels unitaires (HTTP 429 constaté au-delà de quelques appels par minute) :
 * on envoie donc tous les textes nouveaux en UN appel batch par langue, avec
 * une échéance. Les réussites alimentent le cache persistant ; `publishAlert`
 * les retrouve ensuite sans appel réseau. Les échecs restent en repli français
 * et sont retentés par `fillMissingTranslations` au passage suivant.
 */

export type TextTranslations = Map<string, { fon: string | null; yo: string | null }>;

async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  if (ms <= 0) {
    promise.catch(() => {});
    return null;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    // L'appel continue en arrière-plan si l'échéance tombe : son résultat ira quand même au cache.
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function batchOne(texts: string[], lang: "fon" | "yo", deadlineMs: number): Promise<(string | null)[]> {
  const call = translateBatch(texts, lang).catch((err: unknown) => {
    console.warn("[monitoring] traduction groupée échouée", { lang, count: texts.length, error: err instanceof Error ? err.message : String(err) });
    return null;
  });
  const out = await withDeadline(call, deadlineMs);
  if (out === null) {
    console.warn("[monitoring] traduction groupée non terminée à l'échéance", { lang, count: texts.length, deadlineMs });
    return texts.map(() => null);
  }
  return out;
}

/** Traduit une liste de textes français vers fon et yo (deux appels en parallèle). */
export async function translateTexts(texts: readonly string[], deadlineMs: number): Promise<TextTranslations> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter((t) => t.length > 0))];
  const out: TextTranslations = new Map();
  if (unique.length === 0) return out;
  const [fon, yo] = await Promise.all([batchOne(unique, "fon", deadlineMs), batchOne(unique, "yo", deadlineMs)]);
  unique.forEach((text, i) => out.set(text, { fon: fon[i] ?? null, yo: yo[i] ?? null }));
  return out;
}

/** Vrai si tous les textes ont leurs deux traductions. */
export function fullyTranslated(map: TextTranslations, texts: Array<string | null | undefined>): boolean {
  return texts.every((t) => {
    if (!t) return true;
    const tr = map.get(t.trim());
    return Boolean(tr?.fon && tr?.yo);
  });
}

const MISSING_WHERE: Prisma.AlertWhereInput = {
  OR: [
    { titleFon: null },
    { titleYo: null },
    { messageFon: null },
    { messageYo: null },
    { AND: [{ adviceFr: { not: null } }, { OR: [{ adviceFon: null }, { adviceYo: null }] }] },
  ],
};

/**
 * Complète les traductions manquantes des alertes encore valides (repli
 * français lors de la création). Renvoie le nombre d'alertes mises à jour.
 */
export async function fillMissingTranslations(opts: {
  parcelId?: string;
  alertIds?: string[];
  deadlineMs: number;
  take?: number;
  now?: Date;
}): Promise<number> {
  const now = opts.now ?? new Date();
  const alerts = await prisma.alert.findMany({
    where: {
      validUntil: { gte: now },
      ...(opts.parcelId ? { parcelId: opts.parcelId } : {}),
      ...(opts.alertIds ? { id: { in: opts.alertIds } } : {}),
      ...MISSING_WHERE,
    },
    select: {
      id: true,
      titleFr: true,
      titleFon: true,
      titleYo: true,
      messageFr: true,
      messageFon: true,
      messageYo: true,
      adviceFr: true,
      adviceFon: true,
      adviceYo: true,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 40, 100),
  });
  if (alerts.length === 0) return 0;

  const texts = alerts.flatMap((a) => [a.titleFr, a.messageFr, a.adviceFr ?? ""]);
  const map = await translateTexts(texts, opts.deadlineMs);
  return applyTranslations(alerts, map);
}

type AlertTextRow = {
  id: string;
  titleFr: string;
  titleFon: string | null;
  titleYo: string | null;
  messageFr: string;
  messageFon: string | null;
  messageYo: string | null;
  adviceFr: string | null;
  adviceFon: string | null;
  adviceYo: string | null;
};

/** Écrit les traductions connues dans les champs encore vides. Renvoie le nombre d'alertes modifiées. */
export async function applyTranslations(alerts: AlertTextRow[], map: TextTranslations): Promise<number> {
  let updated = 0;
  for (const a of alerts) {
    const tr = (s: string | null) => (s ? map.get(s.trim()) : undefined);
    const data: Prisma.AlertUpdateInput = {};
    const t = tr(a.titleFr);
    const m = tr(a.messageFr);
    const adv = tr(a.adviceFr);
    if (!a.titleFon && t?.fon) data.titleFon = t.fon;
    if (!a.titleYo && t?.yo) data.titleYo = t.yo;
    if (!a.messageFon && m?.fon) data.messageFon = m.fon;
    if (!a.messageYo && m?.yo) data.messageYo = m.yo;
    if (a.adviceFr && !a.adviceFon && adv?.fon) data.adviceFon = adv.fon;
    if (a.adviceFr && !a.adviceYo && adv?.yo) data.adviceYo = adv.yo;
    if (Object.keys(data).length > 0) {
      await prisma.alert.update({ where: { id: a.id }, data, select: { id: true } });
      updated++;
    }
  }
  return updated;
}

export const ALERT_TEXT_ROW_SELECT = {
  id: true,
  titleFr: true,
  titleFon: true,
  titleYo: true,
  messageFr: true,
  messageFon: true,
  messageYo: true,
  adviceFr: true,
  adviceFon: true,
  adviceYo: true,
} as const;
