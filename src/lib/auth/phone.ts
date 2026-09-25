/**
 * Téléphone béninois. Depuis la migration du plan de numérotation (fin 2024),
 * un numéro mobile compte 10 chiffres commençant par « 01 ». Forme normalisée
 * stockée en base : « +229XXXXXXXXXX ».
 *
 * Module pur (pas de dépendance serveur) : utilisable côté client pour le
 * retour immédiat, mais la validation qui fait foi reste côté serveur.
 */

export const BENIN_PHONE_REGEX = /^\+22901\d{8}$/;

/**
 * Normalise une saisie libre. Accepte notamment :
 *   « 0197000001 », « 01 97 00 00 01 », « +229 01 97 00 00 01 »,
 *   « 00229 0197000001 », « 2290197000001 »,
 *   et l'ancien format à 8 chiffres « 97000001 » (préfixe 01 ajouté, règle officielle de migration).
 * Renvoie null si le numéro n'est pas un numéro béninois valide.
 */
export function normalizeBeninPhone(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  // Seuls chiffres, espaces, points, tirets, parenthèses et un « + » initial sont tolérés.
  if (!/^\+?[\d\s.\-()]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("229")) return null;
    digits = digits.slice(3);
  } else if (digits.startsWith("00229")) {
    digits = digits.slice(5);
  } else if (digits.length === 13 && digits.startsWith("229")) {
    digits = digits.slice(3);
  }

  if (digits.length === 8) digits = `01${digits}`;
  if (digits.length !== 10 || !digits.startsWith("01")) return null;

  const normalized = `+229${digits}`;
  return BENIN_PHONE_REGEX.test(normalized) ? normalized : null;
}

export function isValidBeninPhone(input: string | null | undefined): boolean {
  return normalizeBeninPhone(input) !== null;
}

/** Affichage lisible : « +229 01 97 00 00 01 ». */
export function formatBeninPhone(normalized: string): string {
  if (!BENIN_PHONE_REGEX.test(normalized)) return normalized;
  const d = normalized.slice(4);
  return `+229 ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

/** Masque pour les journaux et l'affichage agent : « +229 01 •• •• •• 01 ». */
export function maskBeninPhone(normalized: string): string {
  if (!BENIN_PHONE_REGEX.test(normalized)) return "•••";
  const d = normalized.slice(4);
  return `+229 ${d.slice(0, 2)} •• •• •• ${d.slice(8, 10)}`;
}
