/**
 * Numéros de quittance et codes de vérification (module pur hormis l'aléa crypto).
 */
import { randomInt } from "node:crypto";

/** Alphabet sans caractères ambigus à l'œil ou au téléphone : pas de 0/O, 1/I/L. 31 symboles. */
export const VERIFICATION_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const VERIFICATION_LENGTH = 12;

/** 12 caractères tirés uniformément (crypto.randomInt, sans biais de modulo) : ≈ 59 bits d'entropie. */
export function generateVerificationCode(rand: (max: number) => number = randomInt): string {
  let out = "";
  for (let i = 0; i < VERIFICATION_LENGTH; i++) out += VERIFICATION_ALPHABET[rand(VERIFICATION_ALPHABET.length)];
  return out;
}

/**
 * Normalise un code saisi ou scanné : majuscules, sans espaces ni tirets.
 * Accepte [A-Z0-9]{12} (le code de démonstration du seed contient 0 et O) ; sinon null.
 */
export function normalizeVerificationCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 64) return null;
  const v = raw.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{12}$/.test(v) ? v : null;
}

export const RECEIPT_MAX_SEQ = 999_999;

/** AV-2026-000123 */
export function formatReceiptNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError("année invalide");
  if (!Number.isInteger(seq) || seq < 1 || seq > RECEIPT_MAX_SEQ) throw new RangeError("séquence hors bornes");
  return `AV-${year}-${String(seq).padStart(6, "0")}`;
}

export function parseReceiptNumber(value: string): { year: number; seq: number } | null {
  const m = /^AV-(\d{4})-(\d{6})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), seq: Number(m[2]) };
}

/** Préfixe de l'année, pour chercher le dernier numéro émis. */
export function receiptPrefix(year: number): string {
  return `AV-${year}-`;
}

/** Numéro suivant à partir du dernier émis de l'année (null s'il n'y en a pas). */
export function nextReceiptSeq(lastNumber: string | null): number {
  if (!lastNumber) return 1;
  const parsed = parseReceiptNumber(lastNumber);
  return parsed ? parsed.seq + 1 : 1;
}
