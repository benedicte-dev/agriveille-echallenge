/**
 * Choix du champ localisé avec repli français (module pur).
 *   pick(locale, row, "title") → row.titleFon ?? row.titleFr (si locale = fon)
 */
export type ContentLocale = "fr" | "fon" | "yo";

type Localized<K extends string> = { [P in `${K}Fr`]: string } & {
  [P in `${K}Fon` | `${K}Yo`]?: string | null;
};

export interface Picked {
  text: string;
  /** Langue réelle du texte renvoyé (fr si repli). */
  lang: ContentLocale;
  fallback: boolean;
}

export function pickLocalized<K extends string>(locale: ContentLocale, row: Localized<K>, key: K): Picked {
  const fr = (row as Record<string, string>)[`${key}Fr`];
  if (locale === "fr") return { text: fr, lang: "fr", fallback: false };
  const suffix = locale === "fon" ? "Fon" : "Yo";
  const v = (row as Record<string, string | null | undefined>)[`${key}${suffix}`];
  if (typeof v === "string" && v.trim().length > 0) return { text: v, lang: locale, fallback: false };
  return { text: fr, lang: "fr", fallback: true };
}

/** Raccourci : texte seul. */
export function pick<K extends string>(locale: ContentLocale, row: Localized<K>, key: K): string {
  return pickLocalized(locale, row, key).text;
}
