/**
 * Formatage pur, utilisable côté serveur et côté client (aucun secret, aucune I/O).
 */

/** Espaces insécables de fr-FR (U+202F, U+00A0) remplacés par une espace simple, plus robuste à l'impression. */
function plainSpaces(s: string): string {
  return s.replace(/[  ]/g, " ");
}

const INT_FR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 12500 → « 12 500 » (fr-FR). */
export function formatInt(value: number): string {
  return plainSpaces(INT_FR.format(Math.round(value)));
}

/** 12500 → « 12 500 FCFA ». */
export function formatFcfa(value: number): string {
  return `${formatInt(value)} FCFA`;
}

/** 1500 → « 1 500 kg ». */
export function formatKg(value: number): string {
  return `${formatInt(value)} kg`;
}

/** Fuseau du Bénin (UTC+1, sans heure d'été). */
export const BENIN_TZ = "Africa/Porto-Novo";

/** Date lisible, ex. « 12 septembre 2026 ». */
export function formatDate(date: Date | string, locale = "fr-FR"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: BENIN_TZ }).format(d);
}

/** Date + heure, ex. « 12 sept. 2026, 14:05 ». */
export function formatDateTime(date: Date | string, locale = "fr-FR"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BENIN_TZ,
  }).format(d);
}

/** Clé de mois « 2026-09 » dans le fuseau du Bénin. */
export function monthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: BENIN_TZ }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

/** Année civile au Bénin (numérotation des quittances). */
export function beninYear(date: Date): number {
  return Number(monthKey(date).slice(0, 4));
}

/** « 2026-09 » → « sept. 2026 ». */
export function formatMonthKey(key: string, locale = "fr-FR"): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

type Loc = "fr" | "fon" | "yo";

/** Champ multilingue avec repli français. */
export function pickLocalized(locale: Loc, fr: string, fon?: string | null, yo?: string | null): string {
  if (locale === "fon" && fon) return fon;
  if (locale === "yo" && yo) return yo;
  return fr;
}

/**
 * Nom partiellement masqué (vie privée) : « Ablawa Hounkpè » → « Ab**** H. ».
 * Le premier mot garde ses 2 premières lettres, les suivants leur initiale.
 */
export function maskName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "***";
  const [first, ...rest] = words;
  const chars = Array.from(first);
  const head = chars.slice(0, Math.min(2, chars.length)).join("");
  const firstMasked = head + "*".repeat(Math.max(2, chars.length - head.length));
  const initials = rest.map((w) => `${Array.from(w)[0].toUpperCase()}.`);
  return [firstMasked, ...initials].join(" ");
}

/** Nom public d'un vendeur sur le marché : prénom + initiale (« Ablawa H. »). */
export function publicName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const [first, ...rest] = words;
  return [first, ...rest.map((w) => `${Array.from(w)[0].toUpperCase()}.`)].join(" ");
}
