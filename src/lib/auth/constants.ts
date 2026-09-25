/**
 * Constantes d'authentification partagées (module pur : importable par
 * src/proxy.ts, les composants et les tests).
 */
export type AppRole = "FARMER" | "BUYER" | "AGENT" | "ADMIN";

export const SESSION_COOKIE = "av_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Espaces protégés : le proxy redirige vers /connexion sans cookie. */
export const PROTECTED_PREFIXES = ["/app", "/acheteur", "/agent", "/admin"] as const;
export const LOGIN_PATH = "/connexion";

/** Page d'accueil de chaque rôle après connexion. */
export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "FARMER":
      return "/app";
    case "BUYER":
      return "/acheteur";
    case "AGENT":
      return "/agent";
    case "ADMIN":
      return "/admin";
  }
}

/** Message unique pour tout échec de connexion (pas d'énumération de comptes). */
export const GENERIC_LOGIN_ERROR =
  "Numéro ou code PIN incorrect, ou compte bloqué pour 15 minutes après plusieurs essais.";
