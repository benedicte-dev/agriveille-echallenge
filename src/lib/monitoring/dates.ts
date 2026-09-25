/**
 * Utilitaires de dates déterministes pour le Bénin (Africa/Porto-Novo = UTC+1,
 * pas d'heure d'été). Aucune dépendance à Intl ni au fuseau de la machine.
 */

const BENIN_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Vrai si `s` est une date calendaire valide au format YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}

/** Jour calendaire béninois (YYYY-MM-DD) d'un instant. */
export function beninDateOf(instant: Date): string {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Date invalide');
  return new Date(instant.getTime() + BENIN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Date du jour au Bénin. */
export function todayInBenin(now: Date = new Date()): string {
  return beninDateOf(now);
}

/**
 * Normalise une date d'entrée : une chaîne YYYY-MM-DD est prise telle quelle,
 * un instant (Date ou ISO complet) est converti en jour béninois.
 */
export function toBeninDate(value: Date | string): string {
  if (typeof value === 'string') {
    if (isIsoDate(value)) return value;
    return beninDateOf(new Date(value));
  }
  return beninDateOf(value);
}

function utcMidnight(date: string): number {
  if (!isIsoDate(date)) throw new RangeError(`Date invalide : ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

/** Début du jour béninois (00:00 UTC+1). */
export function startOfBeninDay(date: string): Date {
  return new Date(utcMidnight(date) - BENIN_OFFSET_MS);
}

/** Fin du jour béninois (23:59:59.999 UTC+1). */
export function endOfBeninDay(date: string): Date {
  return new Date(utcMidnight(date) - BENIN_OFFSET_MS + DAY_MS - 1);
}

/** Mois (1–12) d'une date YYYY-MM-DD. */
export function monthOf(date: string): number {
  utcMidnight(date);
  return Number(date.slice(5, 7));
}

/** « samedi 27 septembre » : lisible à voix haute. */
export function formatDayFr(date: string): string {
  const t = new Date(utcMidnight(date));
  const day = t.getUTCDate();
  return `${WEEKDAYS_FR[t.getUTCDay()]} ${day === 1 ? '1er' : day} ${MONTHS_FR[t.getUTCMonth()]}`;
}
