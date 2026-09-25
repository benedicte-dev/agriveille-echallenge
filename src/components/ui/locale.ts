/** Locales d'interface (SPEC §5). Dupliqué ici pour que l'UI ne dépende pas de l'i18n. */
export type UiLocale = "fr" | "fon" | "yo";

export const UI_LOCALES: readonly UiLocale[] = ["fr", "fon", "yo"] as const;

/** Valeur de l'attribut HTML `lang` (BCP 47) : fr, fon (ISO 639-3), yo (ISO 639-1). */
export function htmlLang(locale: UiLocale | string | null | undefined): string {
  return locale === "fon" || locale === "yo" ? locale : "fr";
}

/** Balise Intl pour dates et nombres. Intl ne connaît ni fon ni yo partout : repli fr-BJ. */
export function intlLocale(locale: UiLocale | string | null | undefined): string {
  if (locale === "yo") return "yo-NG";
  return "fr-BJ";
}
