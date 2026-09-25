/**
 * Logique pure de limitation de débit à fenêtre fixe.
 * La persistance (table RateLimit) est dans rate-limit.ts ; ce module est testé seul.
 */

export interface RateLimitRule {
  /** Nombre maximal d'événements autorisés dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre en millisecondes. */
  windowMs: number;
}

export interface RateLimitState {
  count: number;
  windowStart: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Événements restants dans la fenêtre courante (≥ 0). */
  remaining: number;
  /** Délai avant réouverture si refusé, sinon 0. */
  retryAfterMs: number;
  /** État à persister. */
  next: RateLimitState;
}

/**
 * Consomme un événement. Si la fenêtre est expirée (ou absente), elle est
 * réinitialisée à `now`. Refus quand le compteur après incrément dépasse la limite.
 */
export function consumeFixedWindow(
  state: RateLimitState | null,
  now: Date,
  rule: RateLimitRule,
): RateLimitResult {
  if (rule.limit < 1 || rule.windowMs < 1) throw new Error("Règle de limitation invalide");
  const expired = !state || now.getTime() - state.windowStart.getTime() >= rule.windowMs;
  const next: RateLimitState = expired
    ? { count: 1, windowStart: now }
    : { count: state.count + 1, windowStart: state.windowStart };
  return evaluate(next, now, rule);
}

/** Interprète un état déjà incrémenté (tel que renvoyé par l'upsert SQL atomique). */
export function evaluate(next: RateLimitState, now: Date, rule: RateLimitRule): RateLimitResult {
  const allowed = next.count <= rule.limit;
  const windowEnd = next.windowStart.getTime() + rule.windowMs;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - next.count),
    retryAfterMs: allowed ? 0 : Math.max(0, windowEnd - now.getTime()),
    next,
  };
}

/** Règles partagées (SPEC §8 : login, signalement, STT). */
export const RATE_LIMITS = {
  /** Tentatives de connexion par IP. Le verrouillage par compte (5 échecs) est géré à part. */
  loginIp: { limit: 20, windowMs: 15 * 60_000 },
  /** Inscriptions par IP. */
  registerIp: { limit: 5, windowMs: 60 * 60_000 },
  /** Signalements par utilisateur. */
  report: { limit: 10, windowMs: 60 * 60_000 },
  /** Transcriptions vocales par utilisateur. */
  stt: { limit: 30, windowMs: 60 * 60_000 },
  /** Synthèse vocale par IP. */
  tts: { limit: 120, windowMs: 60 * 60_000 },
  /** Offres par acheteur. */
  offer: { limit: 30, windowMs: 60 * 60_000 },
  /** Synchronisation hors ligne par utilisateur. */
  offlineSync: { limit: 60, windowMs: 15 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof RATE_LIMITS;
