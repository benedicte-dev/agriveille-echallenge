/**
 * Jetons de session : 32 octets aléatoires (base64url) remis au navigateur ;
 * seul le SHA-256 (hex) est stocké dans Session.tokenHash.
 */
import { createHash, randomBytes } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Forme attendue d'un jeton (43 caractères base64url) : filtre les cookies forgés avant la requête SQL. */
export function isWellFormedToken(token: string | undefined | null): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
