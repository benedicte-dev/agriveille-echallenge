import "server-only";

import type { AlertSeverity, AlertSource, AlertType, DeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseEvidence, type Evidence } from "./evidence";

/**
 * Lectures du monitoring pour les pages. Toutes filtrent par `userId` quand il
 * s'agit de données personnelles (anti-IDOR) et sont bornées (`take`).
 */

const SEVERITY_ORDER: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export const ALERT_TEXT_SELECT = {
  id: true,
  type: true,
  severity: true,
  source: true,
  titleFr: true,
  titleFon: true,
  titleYo: true,
  messageFr: true,
  messageFon: true,
  messageYo: true,
  adviceFr: true,
  adviceFon: true,
  adviceYo: true,
  parcelId: true,
  communeId: true,
  validFrom: true,
  validUntil: true,
  createdAt: true,
  radiusKm: true,
  parcel: { select: { name: true } },
  commune: { select: { name: true } },
} as const;

export type AlertText = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  source: AlertSource;
  titleFr: string;
  titleFon: string | null;
  titleYo: string | null;
  messageFr: string;
  messageFon: string | null;
  messageYo: string | null;
  adviceFr: string | null;
  adviceFon: string | null;
  adviceYo: string | null;
  parcelId: string | null;
  communeId: string | null;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
  radiusKm: number | null;
  parcel: { name: string } | null;
  commune: { name: string } | null;
};

export type UserAlert = {
  alert: AlertText;
  status: DeliveryStatus;
  readAt: Date | null;
  acknowledgedAt: Date | null;
  active: boolean;
};

/** Tri d'affichage : actives d'abord, puis CRITICAL → WARNING → INFO, puis la plus récente. */
export function compareUserAlerts(a: UserAlert, b: UserAlert): number {
  return (
    Number(b.active) - Number(a.active) ||
    SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] ||
    b.alert.createdAt.getTime() - a.alert.createdAt.getTime()
  );
}

/** Alertes livrées à l'utilisateur (canal IN_APP), triées. */
export async function listUserAlerts(userId: string, opts: { take?: number; now?: Date } = {}): Promise<UserAlert[]> {
  const now = opts.now ?? new Date();
  const rows = await prisma.alertDelivery.findMany({
    where: { userId, channel: "IN_APP" },
    orderBy: { sentAt: "desc" },
    take: Math.min(opts.take ?? 60, 200),
    select: { status: true, readAt: true, acknowledgedAt: true, alert: { select: ALERT_TEXT_SELECT } },
  });
  return rows
    .map((r) => ({
      alert: r.alert,
      status: r.status,
      readAt: r.readAt,
      acknowledgedAt: r.acknowledgedAt,
      active: r.alert.validUntil.getTime() >= now.getTime(),
    }))
    .sort(compareUserAlerts);
}

/** Une alerte, seulement si elle a été livrée à cet utilisateur. */
export async function getUserAlert(userId: string, alertId: string, now: Date = new Date()): Promise<UserAlert | null> {
  const row = await prisma.alertDelivery.findUnique({
    where: { alertId_userId_channel: { alertId, userId, channel: "IN_APP" } },
    select: { status: true, readAt: true, acknowledgedAt: true, alert: { select: ALERT_TEXT_SELECT } },
  });
  if (!row) return null;
  return {
    alert: row.alert,
    status: row.status,
    readAt: row.readAt,
    acknowledgedAt: row.acknowledgedAt,
    active: row.alert.validUntil.getTime() >= now.getTime(),
  };
}

/** Nombre d'alertes encore valides non acquittées (badge). */
export async function countUnacknowledged(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.alertDelivery.count({
    where: { userId, channel: "IN_APP", status: { not: "ACKNOWLEDGED" }, alert: { validUntil: { gte: now } } },
  });
}

/** Evidence (chiffres déclencheurs) des alertes automatiques, par id d'alerte. */
export async function evidenceByAlert(alertIds: string[]): Promise<Map<string, Evidence>> {
  const out = new Map<string, Evidence>();
  const ids = [...new Set(alertIds)].slice(0, 200);
  if (ids.length === 0) return out;
  const rows = await prisma.auditLog.findMany({
    where: { action: "monitoring.alert.create", entity: "Alert", entityId: { in: ids } },
    select: { entityId: true, meta: true },
    take: ids.length,
  });
  for (const r of rows) {
    const ev = r.entityId ? parseEvidence(r.meta) : null;
    if (r.entityId && ev) out.set(r.entityId, ev);
  }
  return out;
}

export type RecentAlertStat = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  source: AlertSource;
  titleFr: string;
  createdAt: Date;
  validUntil: Date;
  place: string | null;
  delivered: number;
  read: number;
  acknowledged: number;
};

/** Alertes récentes (toutes sources) avec comptes de livraisons IN_APP par statut. */
export async function recentAlertStats(take = 30): Promise<RecentAlertStat[]> {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 100),
    select: {
      id: true,
      type: true,
      severity: true,
      source: true,
      titleFr: true,
      createdAt: true,
      validUntil: true,
      parcel: { select: { name: true, commune: { select: { name: true } } } },
      commune: { select: { name: true } },
    },
  });
  if (alerts.length === 0) return [];
  const groups = await prisma.alertDelivery.groupBy({
    by: ["alertId", "status"],
    where: { alertId: { in: alerts.map((a) => a.id) }, channel: "IN_APP" },
    _count: { _all: true },
  });
  const counts = new Map<string, Record<DeliveryStatus, number>>();
  for (const g of groups) {
    const c = counts.get(g.alertId) ?? { SENT: 0, READ: 0, ACKNOWLEDGED: 0 };
    c[g.status] = g._count._all;
    counts.set(g.alertId, c);
  }
  return alerts.map((a) => {
    const c = counts.get(a.id) ?? { SENT: 0, READ: 0, ACKNOWLEDGED: 0 };
    return {
      id: a.id,
      type: a.type,
      severity: a.severity,
      source: a.source,
      titleFr: a.titleFr,
      createdAt: a.createdAt,
      validUntil: a.validUntil,
      place: a.commune?.name ?? a.parcel?.commune.name ?? null,
      delivered: c.SENT + c.READ + c.ACKNOWLEDGED,
      read: c.READ + c.ACKNOWLEDGED,
      acknowledged: c.ACKNOWLEDGED,
    };
  });
}

/** Taux global d'accusés de réception (IN_APP) sur les `days` derniers jours. */
export async function ackRate(days = 30): Promise<{ delivered: number; acknowledged: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [delivered, acknowledged] = await Promise.all([
    prisma.alertDelivery.count({ where: { channel: "IN_APP", sentAt: { gte: since } } }),
    prisma.alertDelivery.count({ where: { channel: "IN_APP", sentAt: { gte: since }, status: "ACKNOWLEDGED" } }),
  ]);
  return { delivered, acknowledged };
}
