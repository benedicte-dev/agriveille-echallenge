import "server-only";
/**
 * Aides de traduction pour les pages M3 (Server Components).
 */
import { getLocale } from "@/lib/i18n/server";
import { getMessages, t, type Vars } from "@/lib/i18n";
import { audioUrlFor } from "@/lib/i18n/audio";
import { pickLocalized } from "@/server/market/format";

export type Loc = "fr" | "fon" | "yo";
export type Tr = (key: string, vars?: Vars) => string;

export async function pageI18n(): Promise<{ locale: Loc; tr: Tr; listenLabels: Record<string, string>; audio: (key: string) => string | null }> {
  const locale = await getLocale();
  const m = getMessages(locale);
  const tr: Tr = (key, vars) => t(m, key, vars);
  return {
    locale,
    tr,
    listenLabels: {
      listen: tr("common.listen"),
      stop: tr("common.stop"),
      loading: tr("common.loading"),
      error: tr("error.voice_unavailable"),
    },
    audio: (key) => audioUrlFor(locale, key),
  };
}

/** Nom d'une culture dans la langue courante (repli français). */
export function cropName(locale: Loc, crop: { nameFr: string; nameFon: string | null; nameYo: string | null }): string {
  return pickLocalized(locale, crop.nameFr, crop.nameFon, crop.nameYo);
}

/** Balise Intl des dates (fon/yo non couverts partout : repli fr-FR). */
export function dateLocale(locale: Loc): string {
  return locale === "yo" ? "yo-NG" : "fr-FR";
}
