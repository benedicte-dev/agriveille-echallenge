/**
 * Configuration des langues d'interface. Module pur : importable côté serveur
 * comme côté client (aucun secret, aucune API Node).
 */

export const LOCALES = ["fr", "fon", "yo"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Cookie qui porte la langue choisie (lisible par le serveur). */
export const LOCALE_COOKIE = "av_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an, en secondes

/** Noms affichés dans le sélecteur de langue, chacun dans sa propre langue. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  fon: "Fɔngbe",
  yo: "Yorùbá",
};

/** Attribut HTML `lang` (BCP 47). */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  fr: "fr",
  fon: "fon",
  yo: "yo",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Normalise une valeur quelconque (cookie, param) vers une Locale valide. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
