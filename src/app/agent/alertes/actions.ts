"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { t, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { audit, rateLimit } from "@/lib/security";
import { fieldErrorsOf, formDataToObject, idSchema, optionalText, radiusKmSchema, requiredText } from "@/lib/validation";
import { CommuneNotFoundError, issueManualAlert, runMonitoring } from "@/server/monitoring";
import { newClientKey } from "./client-key";

/** Budget de l'analyse lancée à la main (la page exporte maxDuration = 60 s). */
const RUN_BUDGET_MS = 45_000;
const RUN_LIMIT = { limit: 3, windowMs: 10 * 60_000 };
const MANUAL_LIMIT = { limit: 20, windowMs: 60 * 60_000 };

export type RunState =
  | { ok: true; parcels: number; analyzed: number; created: number; duplicates: number; deliveries: number; deferred: number; errors: number; noWeather: number; durationMs: number }
  | { ok: false; error: string };

export async function runMonitoringAction(): Promise<RunState> {
  const user = await requireRole("AGENT");
  const messages = getMessages(await getLocale());
  const rl = await rateLimit(`mon.run:${user.id}`, RUN_LIMIT);
  if (!rl.allowed) return { ok: false, error: t(messages, "error.too_many") };
  try {
    const r = await runMonitoring({ budgetMs: RUN_BUDGET_MS });
    await audit(user.id, "monitoring.run", "Alert", null, {
      parcels: r.parcels,
      analyzed: r.analyzed,
      alertsCreated: r.alertsCreated,
      duplicatesSkipped: r.duplicatesSkipped,
      deliveries: r.deliveries,
      deferred: r.deferred,
      errors: r.errors.length,
      durationMs: r.durationMs,
    });
    revalidatePath("/agent", "layout");
    return {
      ok: true,
      parcels: r.parcels,
      analyzed: r.analyzed,
      created: r.alertsCreated,
      duplicates: r.duplicatesSkipped,
      deliveries: r.deliveries,
      deferred: r.deferred,
      errors: r.errors.length,
      noWeather: r.noWeather,
      durationMs: r.durationMs,
    };
  } catch (err) {
    console.error("[agent/alertes] analyse", err);
    await audit(user.id, "monitoring.run.failed", "Alert", null, {});
    return { ok: false, error: t(messages, "error.generic") };
  }
}

const ALERT_TYPES = ["DROUGHT", "HEAVY_RAIN", "HEAT", "WIND", "PEST_RISK", "PEST_OUTBREAK", "SOWING_WINDOW", "HARVEST_WINDOW"] as const;
const SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;

const manualSchema = z.object({
  type: z.enum(ALERT_TYPES, { error: "Type invalide." }),
  severity: z.enum(SEVERITIES, { error: "Sévérité invalide." }),
  communeId: idSchema,
  radiusKm: radiusKmSchema,
  validDays: z.coerce.number().int().min(1).max(30),
  titleFr: requiredText(5, 120),
  messageFr: requiredText(10, 600),
  adviceFr: optionalText(400),
  clientKey: idSchema,
});

export type ManualState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Jeton du prochain envoi (un nouvel envoi = une nouvelle alerte). */
  nextKey?: string;
  result?: { created: boolean; recipients: number; parcels: number; deliveries: number; commune: string };
};

export async function manualAlertAction(_prev: ManualState | undefined, formData: FormData): Promise<ManualState> {
  const user = await requireRole("AGENT");
  const messages = getMessages(await getLocale());
  const parsed = manualSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: t(messages, "error.invalid"), fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const d = parsed.data;
  const rl = await rateLimit(`mon.manual:${user.id}`, MANUAL_LIMIT);
  if (!rl.allowed) return { ok: false, error: t(messages, "error.too_many") };
  try {
    const r = await issueManualAlert({
      agentId: user.id,
      type: d.type,
      severity: d.severity,
      zone: { mode: "radius", communeId: d.communeId, radiusKm: d.radiusKm },
      titleFr: d.titleFr,
      messageFr: d.messageFr,
      adviceFr: d.adviceFr ?? null,
      validDays: d.validDays,
      clientKey: d.clientKey,
    });
    await audit(user.id, r.created ? "alert.create" : "alert.create.duplicate", "Alert", r.alertId, {
      source: "AGENT_MANUAL",
      type: d.type,
      severity: d.severity,
      communeId: d.communeId,
      radiusKm: d.radiusKm,
      recipients: r.recipients,
      deliveries: r.deliveries,
    });
    revalidatePath("/agent", "layout");
    return {
      ok: true,
      nextKey: newClientKey(),
      result: { created: r.created, recipients: r.recipients, parcels: r.parcels, deliveries: r.deliveries, commune: r.communeName },
    };
  } catch (err) {
    if (err instanceof CommuneNotFoundError) {
      return { ok: false, error: t(messages, "error.invalid"), fieldErrors: { communeId: t(messages, "mon.agent.commune_unknown") } };
    }
    console.error("[agent/alertes] alerte manuelle", { agentId: user.id }, err);
    return { ok: false, error: t(messages, "error.generic") };
  }
}
