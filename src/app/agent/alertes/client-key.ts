import "server-only";
import { randomUUID } from "node:crypto";

/** Jeton d'envoi du formulaire, au format cuid (c + 32 caractères) accepté par idSchema. */
export function newClientKey(): string {
  return `c${randomUUID().replace(/-/g, "")}`;
}
