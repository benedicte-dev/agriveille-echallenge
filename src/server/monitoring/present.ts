import "server-only";

import type { Locale } from "@prisma/client";
import { audioUrlFor, frMessages, getMessages, t, type Messages } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { intlLocale } from "@/components/ui/locale";
import type { ListenButtonLabels } from "@/components/ui/ListenButton";
import { localizedAlert } from "@/server/alerts/deliver";
import { evidenceLines } from "./evidence";

/**
 * Aides de présentation des pages du monitoring : traduction, props du bouton
 * « Écouter », formats de date. Côté serveur uniquement (dictionnaire complet).
 */

export type Listen = { text: string; lang: Locale; audioSrc?: string | null; labels: Partial<ListenButtonLabels> };

const TZ = "Africa/Porto-Novo";

export interface PageI18n {
  locale: Locale;
  messages: Messages;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  /**
   * Props d'écoute pour une ou plusieurs clés. Si une clé n'est pas encore
   * traduite dans la langue courante, tout est lu en français (jamais un texte
   * français prononcé par une voix fon ou yoruba).
   */
  listen: (keys: string[], vars?: Record<string, string | number>, extra?: string[]) => Listen;
  /** Comme `listen`, avec des variables propres à chaque clé. */
  listenParts: (parts: Array<[string, Record<string, string | number>?]>) => Listen;
  /** Props d'écoute pour un texte libre déjà dans `lang`. */
  listenText: (text: string, lang: Locale) => Listen;
  listenLabels: Partial<ListenButtonLabels>;
  fmtDate: (d: Date, opts?: Intl.DateTimeFormatOptions) => string;
  /** YYYY-MM-DD (jour béninois) → « samedi 27 septembre ». */
  fmtIsoDay: (iso: string) => string;
  fmtNum: (n: number, digits?: number) => string;
  fmtTime: (d: Date) => string;
}

export async function pageI18n(): Promise<PageI18n> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = (key: string, vars?: Record<string, string | number>) => t(messages, key, vars);
  const listenLabels: Partial<ListenButtonLabels> = {
    listen: tr("common.listen"),
    stop: tr("common.stop"),
    loading: tr("common.loading"),
    error: tr("error.voice_unavailable"),
  };
  const intl = intlLocale(locale);
  const has = (key: string) => typeof messages[key] === "string" && messages[key].length > 0;

  const listen: PageI18n["listen"] = (keys, vars, extra = []) => {
    const own = locale === "fr" || keys.every(has);
    const lang: Locale = own ? locale : "fr";
    const dict = own ? messages : frMessages;
    const text = [...keys.map((k) => t(dict, k, vars)), ...extra].filter(Boolean).join(". ");
    const audioSrc = own && keys.length === 1 && !vars && extra.length === 0 ? audioUrlFor(locale, keys[0]) : null;
    return { text, lang, audioSrc, labels: listenLabels };
  };

  const listenParts: PageI18n["listenParts"] = (parts) => {
    const own = locale === "fr" || parts.every(([k]) => has(k));
    const dict = own ? messages : frMessages;
    const text = parts.map(([k, v]) => t(dict, k, v)).join(". ");
    return { text, lang: own ? locale : "fr", labels: listenLabels };
  };

  const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
    new Intl.DateTimeFormat(intl, { timeZone: TZ, ...opts }).format(d);

  return {
    locale,
    messages,
    tr,
    listen,
    listenParts,
    listenText: (text, lang) => ({ text, lang, labels: listenLabels }),
    listenLabels,
    fmtDate,
    fmtIsoDay: (iso) => fmtDate(new Date(`${iso}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long" }),
    fmtNum: (n, digits = 1) => new Intl.NumberFormat(intl, { maximumFractionDigits: digits }).format(n),
    fmtTime: (d) => new Intl.DateTimeFormat(intl, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d),
  };
}

type AlertTexts = Parameters<typeof localizedAlert>[0] & {
  adviceFr: string | null;
  adviceFon: string | null;
  adviceYo: string | null;
};

/** Titre, message et conseil dans la langue, avec la langue réelle du texte (repli fr). */
export function alertInLocale(alert: AlertTexts, locale: Locale) {
  const { title, message } = localizedAlert(alert, locale);
  const advice =
    locale === "fon" ? (alert.adviceFon ?? alert.adviceFr) : locale === "yo" ? (alert.adviceYo ?? alert.adviceFr) : alert.adviceFr;
  const translated =
    locale === "fr" ||
    (locale === "fon" ? Boolean(alert.titleFon && alert.messageFon) : Boolean(alert.titleYo && alert.messageYo));
  return { title, message, advice, lang: (translated ? locale : "fr") as Locale, translated };
}

/** Lignes « Pourquoi cette alerte ? » d'une alerte automatique (vide sinon). */
export function evidenceFor(
  alert: { id: string; type: string },
  evidence: Map<string, Record<string, number | string>>,
  i: PageI18n,
): string[] {
  const ev = evidence.get(alert.id);
  return ev ? evidenceLines(alert.type, ev, i.tr, i.fmtIsoDay, (n) => i.fmtNum(n)) : [];
}
