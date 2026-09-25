import "server-only";

import type { AlertSeverity, AlertSource, AlertType, Locale } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toTrilingual } from "@/server/langues";

/**
 * Création et livraison d'une alerte — module partagé par le monitoring
 * climatique (AUTO_WEATHER), la validation des signalements (PEST_REPORT)
 * et les alertes manuelles des agents (AGENT_MANUAL).
 *
 * Idempotent : l'alerte est identifiée par `dedupKey` ; une seconde
 * publication avec la même clé met à jour la sévérité si elle s'aggrave
 * et ne crée aucune livraison en double (unique alertId+userId+channel).
 */
export interface PublishAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  source: AlertSource;
  dedupKey: string;
  titleFr: string;
  messageFr: string;
  adviceFr?: string | null;
  parcelId?: string | null;
  communeId?: string | null;
  lat?: number | null;
  lon?: number | null;
  radiusKm?: number | null;
  pestId?: string | null;
  reportId?: string | null;
  validFrom?: Date;
  validUntil: Date;
  createdById?: string | null;
  /** Destinataires (FARMER). */
  recipientIds: string[];
  /** Ajoute une copie dans le simulateur SMS (DÉMO). Défaut : true. */
  sms?: boolean;
  /** Traduire en fon/yoruba (API 229langues, repli fr). Défaut : true. */
  translate?: boolean;
}

export interface PublishAlertResult {
  alertId: string;
  created: boolean;
  deliveries: number;
  sms: number;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

export async function publishAlert(input: PublishAlertInput): Promise<PublishAlertResult> {
  const existing = await prisma.alert.findUnique({ where: { dedupKey: input.dedupKey } });

  let alertId: string;
  let created = false;

  if (existing) {
    alertId = existing.id;
    if (SEVERITY_RANK[input.severity] > SEVERITY_RANK[existing.severity]) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: { severity: input.severity, validUntil: input.validUntil },
      });
    }
  } else {
    const doTranslate = input.translate !== false;
    const [title, message, advice] = doTranslate
      ? await Promise.all([
          toTrilingual(input.titleFr),
          toTrilingual(input.messageFr),
          input.adviceFr ? toTrilingual(input.adviceFr) : Promise.resolve(null),
        ])
      : [
          { fr: input.titleFr, fon: null, yo: null },
          { fr: input.messageFr, fon: null, yo: null },
          input.adviceFr ? { fr: input.adviceFr, fon: null, yo: null } : null,
        ];

    const alert = await prisma.alert.create({
      data: {
        type: input.type,
        severity: input.severity,
        source: input.source,
        dedupKey: input.dedupKey,
        titleFr: title.fr,
        titleFon: title.fon,
        titleYo: title.yo,
        messageFr: message.fr,
        messageFon: message.fon,
        messageYo: message.yo,
        adviceFr: advice?.fr ?? null,
        adviceFon: advice?.fon ?? null,
        adviceYo: advice?.yo ?? null,
        parcelId: input.parcelId ?? null,
        communeId: input.communeId ?? null,
        lat: input.lat ?? null,
        lon: input.lon ?? null,
        radiusKm: input.radiusKm ?? null,
        pestId: input.pestId ?? null,
        reportId: input.reportId ?? null,
        validFrom: input.validFrom ?? new Date(),
        validUntil: input.validUntil,
        createdById: input.createdById ?? null,
      },
    });
    alertId = alert.id;
    created = true;
  }

  const recipientIds = [...new Set(input.recipientIds)];
  if (recipientIds.length === 0) return { alertId, created, deliveries: 0, sms: 0 };

  const inApp = await prisma.alertDelivery.createMany({
    data: recipientIds.map((userId) => ({ alertId, userId, channel: "IN_APP" as const })),
    skipDuplicates: true,
  });

  let sms = 0;
  if (input.sms !== false) {
    const smsDeliveries = await prisma.alertDelivery.createMany({
      data: recipientIds.map((userId) => ({ alertId, userId, channel: "SMS_SIM" as const })),
      skipDuplicates: true,
    });
    // Une ligne d'outbox seulement pour les livraisons SMS nouvellement créées.
    if (smsDeliveries.count > 0) {
      const alert = await prisma.alert.findUniqueOrThrow({ where: { id: alertId } });
      const users = await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, phone: true, locale: true },
      });
      const already = await prisma.smsOutbox.findMany({
        where: { alertId, toPhone: { in: users.map((u) => u.phone) } },
        select: { toPhone: true },
      });
      const done = new Set(already.map((r) => r.toPhone));
      const rows = users
        .filter((u) => !done.has(u.phone))
        .map((u) => ({
          toPhone: u.phone,
          lang: u.locale,
          alertId,
          body: smsBody(alert, u.locale),
        }));
      if (rows.length) sms = (await prisma.smsOutbox.createMany({ data: rows })).count;
    }
  }

  return { alertId, created, deliveries: inApp.count, sms };
}

type AlertTexts = {
  titleFr: string;
  titleFon: string | null;
  titleYo: string | null;
  messageFr: string;
  messageFon: string | null;
  messageYo: string | null;
};

/** Texte localisé d'une alerte, repli sur le français. */
export function localizedAlert(alert: AlertTexts, locale: Locale): { title: string; message: string } {
  if (locale === "fon")
    return { title: alert.titleFon ?? alert.titleFr, message: alert.messageFon ?? alert.messageFr };
  if (locale === "yo")
    return { title: alert.titleYo ?? alert.titleFr, message: alert.messageYo ?? alert.messageFr };
  return { title: alert.titleFr, message: alert.messageFr };
}

/** SMS ≤ 160 caractères : « AgriVeille: <titre>. <message> ». */
export function smsBody(alert: AlertTexts, locale: Locale): string {
  const { title, message } = localizedAlert(alert, locale);
  const body = `AgriVeille: ${title}. ${message}`;
  return body.length <= 160 ? body : `${body.slice(0, 157)}...`;
}

/** Marque une livraison lue / acquittée — contrôle de propriété inclus. */
export async function markDelivery(
  userId: string,
  alertId: string,
  status: "READ" | "ACKNOWLEDGED",
): Promise<boolean> {
  const now = new Date();
  const res = await prisma.alertDelivery.updateMany({
    where: { alertId, userId, channel: "IN_APP", ...(status === "READ" ? { status: "SENT" } : {}) },
    data:
      status === "READ"
        ? { status: "READ", readAt: now }
        : { status: "ACKNOWLEDGED", acknowledgedAt: now },
  });
  if (status === "ACKNOWLEDGED" && res.count > 0) {
    await prisma.alertDelivery.updateMany({
      where: { alertId, userId, channel: "IN_APP", readAt: null },
      data: { readAt: now },
    });
  }
  return res.count > 0;
}
