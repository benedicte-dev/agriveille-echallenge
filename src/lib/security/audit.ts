import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRequestIp } from "./ip";

/**
 * Journal d'audit (SPEC §8) : obligatoire pour toute action AGENT/ADMIN.
 * Ne lève jamais : un échec d'écriture est journalisé côté serveur et n'interrompt
 * pas l'action métier. Ne pas y mettre de PIN, de jeton ni de photo.
 *
 * Exemples d'actions : "report.confirm", "alert.create", "declaration.validate",
 * "crop.update", "user.role.change", "auth.login", "auth.lockout".
 */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta: Record<string, unknown> = {},
  ip?: string | null,
): Promise<void> {
  try {
    const resolvedIp = ip === undefined ? await getRequestIp() : ip;
    await prisma.auditLog.create({
      data: {
        actorId,
        action: action.slice(0, 100),
        entity: entity.slice(0, 60),
        entityId: entityId ?? null,
        meta: sanitizeMeta(meta) as Prisma.InputJsonValue,
        ip: resolvedIp === "unknown" ? null : resolvedIp,
      },
    });
  } catch (err) {
    console.error("[audit] écriture impossible", { action, entity, entityId }, err);
  }
}

const SENSITIVE = /pin|password|token|secret|hash|photo/i;

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE.test(k)) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (v === undefined || typeof v === "function" || typeof v === "symbol") continue;
    else if (typeof v === "bigint") out[k] = v.toString();
    else out[k] = v;
  }
  return out;
}
