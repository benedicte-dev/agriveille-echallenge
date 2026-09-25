import "server-only";
import { prisma } from "@/lib/db";
import { evaluate, RATE_LIMITS, type RateLimitResult, type RateLimitRule, type RateLimitScope } from "./rate-limit-core";

export { RATE_LIMITS, consumeFixedWindow } from "./rate-limit-core";
export type { RateLimitResult, RateLimitRule, RateLimitScope } from "./rate-limit-core";

/**
 * Consomme un événement pour `key` de façon atomique (un seul INSERT … ON CONFLICT,
 * pas de lecture-puis-écriture concurrente). En cas d'erreur base, on laisse passer
 * (fail-open) et on journalise : la disponibilité prime pour un agriculteur au champ,
 * les verrous de compte restent actifs.
 */
export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = Math.floor(rule.windowMs);
  try {
    const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart", "updatedAt")
      VALUES (${key}, 1, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" <= ${now}::timestamp - make_interval(secs => ${windowMs / 1000}::double precision)
          THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" <= ${now}::timestamp - make_interval(secs => ${windowMs / 1000}::double precision)
          THEN ${now}::timestamp ELSE "RateLimit"."windowStart" END,
        "updatedAt" = ${now}
      RETURNING "count", "windowStart"`;
    const row = rows[0];
    return evaluate({ count: Number(row.count), windowStart: new Date(row.windowStart) }, now, rule);
  } catch (err) {
    console.error("[rate-limit] échec, requête autorisée par défaut", err);
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0, next: { count: 0, windowStart: now } };
  }
}

/** Raccourci : `limitScope("report", user.id)`. */
export function limitScope(scope: RateLimitScope, identifier: string): Promise<RateLimitResult> {
  return rateLimit(`${scope}:${identifier}`, RATE_LIMITS[scope]);
}

/** Réinitialise un compteur (ex. après une connexion réussie). */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** Purge des compteurs anciens (à appeler depuis le cron quotidien). */
export async function purgeRateLimits(olderThanMs = 24 * 60 * 60_000): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - olderThanMs) } },
  });
  return count;
}
