"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { markDelivery } from "@/server/alerts/deliver";

export type AlertActionResult = { ok: true } | { ok: false; error: "invalid" | "not_found" | "generic" };

/**
 * « J'ai compris » : passe la livraison IN_APP de l'utilisateur à ACKNOWLEDGED.
 * Contrôle de propriété dans la requête (userId de la session). Idempotent :
 * rejouable par la file hors ligne sans effet de bord.
 */
export async function acknowledgeAlertAction(alertId: unknown): Promise<AlertActionResult> {
  const user = await requireRole("FARMER");
  const parsed = idSchema.safeParse(alertId);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const done = await markDelivery(user.id, parsed.data, "ACKNOWLEDGED");
    if (!done) return { ok: false, error: "not_found" };
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[alertes] accusé de réception", { alertId: parsed.data }, err);
    return { ok: false, error: "generic" };
  }
}

const idsSchema = z.array(idSchema).min(1).max(100);

/**
 * Affichage des alertes : SENT → READ pour les livraisons de l'utilisateur
 * (sans effet sur celles déjà lues ou acquittées, ni sur celles d'autrui).
 */
export async function markAlertsReadAction(alertIds: unknown): Promise<AlertActionResult> {
  const user = await requireRole("FARMER");
  const parsed = idsSchema.safeParse(alertIds);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const now = new Date();
    await prisma.alertDelivery.updateMany({
      where: { userId: user.id, channel: "IN_APP", status: "SENT", alertId: { in: [...new Set(parsed.data)] } },
      data: { status: "READ", readAt: now },
    });
    return { ok: true };
  } catch (err) {
    console.error("[alertes] lecture", err);
    return { ok: false, error: "generic" };
  }
}
