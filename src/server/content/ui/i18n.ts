import "server-only";
import { cookies } from "next/headers";
import { getLocale } from "@/lib/i18n/server";
import { getMessages, t, type Locale, type Vars } from "@/lib/i18n";
import { audioUrlFor } from "@/lib/i18n/audio";
import { CONTRAST_COOKIE } from "@/components/ui/ContrastToggle";

export type Translator = (key: string, vars?: Vars) => string;

/** Langue courante + traducteur lié (repli fr puis clé), pour les Server Components. */
export async function getTranslator(): Promise<{ locale: Locale; tr: Translator; audio: (key: string) => string | null }> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return {
    locale,
    tr: (key, vars) => t(messages, key, vars),
    audio: (key) => audioUrlFor(locale, key),
  };
}

export async function isHighContrast(): Promise<boolean> {
  return (await cookies()).get(CONTRAST_COOKIE)?.value === "high";
}

/** Libellés du bouton Écouter dans la langue courante. */
export function listenLabels(tr: Translator) {
  return {
    listen: tr("common.listen"),
    stop: tr("common.stop"),
    loading: tr("common.loading"),
    error: tr("error.voice_unavailable"),
  };
}
