import { createHash, timingSafeEqual } from "node:crypto";

/** Longueur minimale exigée du secret : un secret court ou vide ferme la route. */
export const MIN_CRON_SECRET_LENGTH = 16;

/**
 * Vérifie `Authorization: Bearer <secret>` en temps constant. Les deux valeurs
 * sont hachées (SHA-256) avant comparaison : la durée ne dépend ni du contenu
 * ni de la longueur de l'en-tête reçu.
 */
export function isAuthorizedBearer(header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return false;
  const value = typeof header === "string" ? header : "";
  const match = /^Bearer (.+)$/.exec(value);
  const token = match ? match[1] : "";
  const a = createHash("sha256").update(token, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b) && match !== null;
}
