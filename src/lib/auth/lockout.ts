/**
 * Logique pure du verrouillage de compte (5 échecs → 15 minutes).
 */
import { LOCKOUT_MS, MAX_FAILED_LOGINS } from "./constants";

export function isLocked(lockedUntil: Date | null | undefined, now: Date = new Date()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}

/**
 * État après un échec. `failedLogins` est la valeur déjà incrémentée.
 * Au 5e échec : verrouillage 15 min et compteur remis à 0 (un nouveau cycle
 * de 5 essais commence à l'expiration du verrou).
 */
export function afterFailure(
  failedLogins: number,
  now: Date = new Date(),
): { failedLogins: number; lockedUntil: Date | null; locked: boolean } {
  if (failedLogins >= MAX_FAILED_LOGINS) {
    return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MS), locked: true };
  }
  return { failedLogins, lockedUntil: null, locked: false };
}
