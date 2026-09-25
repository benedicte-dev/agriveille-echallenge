/**
 * Contrat d'erreur commun aux services marché et redevances (module pur).
 * Les services renvoient un `Result` ; les Server Actions le traduisent en
 * message utilisateur via `errorMessageKey`. Jamais de détail technique côté client.
 */
import type { Role } from "@prisma/client";

export type ErrorCode =
  | "invalid" // entrée refusée par zod ou incohérente
  | "forbidden" // rôle non autorisé
  | "not_found" // objet absent OU appartenant à un autre (anti-IDOR : même réponse)
  | "conflict" // état incompatible (annonce déjà réservée, offre déjà traitée…)
  | "rate_limited"
  | "unavailable"; // erreur serveur / base

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: ErrorCode; reason?: string; fieldErrors?: Record<string, string> };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const err = (code: ErrorCode, reason?: string, fieldErrors?: Record<string, string>): Err => ({
  ok: false,
  code,
  ...(reason ? { reason } : {}),
  ...(fieldErrors ? { fieldErrors } : {}),
});

/** Acteur authentifié (fourni par la Server Action, jamais par le client). */
export interface Actor {
  id: string;
  role: Role;
}

/** Contexte d'appel d'un service. */
export interface ServiceContext {
  actor: Actor;
  /** IP client (limitation, audit). */
  ip?: string | null;
}

/** Clé i18n du message générique associé à un code (raisons précises : `mkt.err.*`, `lev.err.*`). */
export function errorMessageKey(e: Err): string {
  if (e.reason) return e.reason;
  switch (e.code) {
    case "invalid":
      return "error.invalid";
    case "forbidden":
      return "error.forbidden";
    case "not_found":
      return "mkt.err.not_found";
    case "conflict":
      return "mkt.err.conflict";
    case "rate_limited":
      return "error.too_many";
    case "unavailable":
      return "error.generic";
  }
}

/** Erreur Prisma « contrainte unique violée ». */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === "P2002";
}
