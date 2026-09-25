import "server-only";

import type { AlertSeverity, AlertType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parcelsWithinRadius } from "@/lib/monitoring";
import { publishAlert, type PublishAlertResult } from "@/server/alerts/deliver";
import { ALERT_TEXT_ROW_SELECT, applyTranslations, fullyTranslated, translateTexts } from "./translate";

/** Échéance de la traduction d'une alerte manuelle (formulaire agent). */
const MANUAL_TRANSLATE_DEADLINE_MS = 45_000;

/**
 * Alerte manuelle d'un agent (source AGENT_MANUAL), pour une commune entière
 * ou un rayon autour du centre d'une commune. Destinataires : les FARMER actifs
 * ayant au moins une parcelle dans la zone.
 */

export type ManualZone =
  | { mode: "commune"; communeId: string }
  | { mode: "radius"; communeId: string; radiusKm: number };

export interface ManualAlertInput {
  agentId: string;
  type: AlertType;
  severity: AlertSeverity;
  zone: ManualZone;
  titleFr: string;
  messageFr: string;
  adviceFr?: string | null;
  validDays: number;
  /** Jeton unique du formulaire : une double soumission ne crée qu'une alerte. */
  clientKey: string;
}

export class CommuneNotFoundError extends Error {
  constructor() {
    super("Commune inconnue");
    this.name = "CommuneNotFoundError";
  }
}

const MAX_PARCELS_SCANNED = 20_000;

/** Propriétaires FARMER actifs d'une parcelle dans la zone (dédoublonnés). */
export async function recipientsForZone(zone: ManualZone): Promise<{
  commune: { id: string; name: string; lat: number; lon: number };
  recipientIds: string[];
  parcels: number;
}> {
  const commune = await prisma.commune.findUnique({
    where: { id: zone.communeId },
    select: { id: true, name: true, lat: true, lon: true },
  });
  if (!commune) throw new CommuneNotFoundError();

  const ownerFilter = { owner: { role: "FARMER" as const, isActive: true } };

  if (zone.mode === "commune") {
    const parcels = await prisma.parcel.findMany({
      where: { communeId: commune.id, ...ownerFilter },
      select: { ownerId: true },
      take: MAX_PARCELS_SCANNED,
    });
    return { commune, recipientIds: [...new Set(parcels.map((p) => p.ownerId))], parcels: parcels.length };
  }

  // Pré-filtre par boîte englobante (index lat/lon non requis, liste bornée), puis haversine exacte.
  const dLat = zone.radiusKm / 111;
  const dLon = zone.radiusKm / (111 * Math.max(0.1, Math.cos((commune.lat * Math.PI) / 180)));
  const candidates = await prisma.parcel.findMany({
    where: {
      ...ownerFilter,
      lat: { gte: commune.lat - dLat, lte: commune.lat + dLat },
      lon: { gte: commune.lon - dLon, lte: commune.lon + dLon },
    },
    select: { ownerId: true, lat: true, lon: true },
    take: MAX_PARCELS_SCANNED,
  });
  const inside = parcelsWithinRadius({ lat: commune.lat, lon: commune.lon }, zone.radiusKm, candidates);
  return { commune, recipientIds: [...new Set(inside.map((p) => p.ownerId))], parcels: inside.length };
}

export async function issueManualAlert(
  input: ManualAlertInput,
  now: Date = new Date(),
): Promise<PublishAlertResult & { recipients: number; parcels: number; communeName: string }> {
  const { commune, recipientIds, parcels } = await recipientsForZone(input.zone);
  const validUntil = new Date(now.getTime() + input.validDays * 24 * 60 * 60 * 1000);
  const dedupKey = `AGENT_MANUAL:${input.agentId}:${input.clientKey}`;
  const texts = [input.titleFr, input.messageFr, input.adviceFr ?? null];
  // Double soumission : l'alerte existe déjà, inutile de retraduire.
  const exists = await prisma.alert.findUnique({ where: { dedupKey }, select: { id: true } });
  const translations = exists
    ? new Map()
    : await translateTexts(texts.filter((t): t is string => Boolean(t)), MANUAL_TRANSLATE_DEADLINE_MS);
  const complete = !exists && fullyTranslated(translations, texts);
  const result = await publishAlert({
    type: input.type,
    severity: input.severity,
    source: "AGENT_MANUAL",
    // Préfixé par l'agent : un jeton ne peut jamais viser l'alerte d'un autre.
    dedupKey,
    titleFr: input.titleFr,
    messageFr: input.messageFr,
    adviceFr: input.adviceFr ?? null,
    communeId: commune.id,
    lat: commune.lat,
    lon: commune.lon,
    radiusKm: input.zone.mode === "radius" ? input.zone.radiusKm : null,
    validFrom: now,
    validUntil,
    createdById: input.agentId,
    recipientIds,
    // Lot déjà traduit et en cache → relu sans appel ; sinon repli fr complété ci-dessous.
    translate: complete,
  });
  if (result.created && !complete) {
    const row = await prisma.alert.findUnique({ where: { id: result.alertId }, select: ALERT_TEXT_ROW_SELECT });
    if (row) await applyTranslations([row], translations);
  }
  return { ...result, recipients: recipientIds.length, parcels, communeName: commune.name };
}
