import { intlLocale } from "@/components/ui";

const TZ = "Africa/Porto-Novo";

export function fmtDateTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(d);
}

export function fmtDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TZ }).format(d);
}

export function fmtInt(n: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

/** Libellés des 12 mois (janv., févr., …) dans la langue d'affichage. */
export function monthLabels(locale: string): string[] {
  const f = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2026, i, 15))));
}

/** Aujourd'hui (AAAA-MM-JJ) au fuseau du Bénin. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
