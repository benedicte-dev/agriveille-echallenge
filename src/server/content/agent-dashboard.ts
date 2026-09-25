import "server-only";

import { prisma } from "@/lib/db";
import type { AlertSeverity, Role } from "@prisma/client";

/** Acteur autorisé (staff) : layout /agent garantit déjà AGENT ou ADMIN. */
export type StaffActor = { id: string; role: Role };
import { ackRate } from "@/server/monitoring";
import { countPendingReports, listReports } from "@/server/reports";
import { revenueStats } from "@/server/levies/queries";
import type { ContentLocale } from "./localize";

/** Centre approximatif du Bénin (repli si aucune donnée géolocalisée). */
export const BENIN_CENTER: [number, number] = [9.3, 2.3];

export interface AgentKpis {
  parcelsTracked: number;
  activeAlerts: Record<AlertSeverity, number>;
  activeAlertsTotal: number;
  pendingReports: number;
  ackRate7d: { delivered: number; acknowledged: number; percent: number | null };
  revenueThisMonthFcfa: number | null;
}

export interface MapParcel {
  id: string;
  name: string;
  lat: number;
  lon: number;
  communeName: string;
}

export interface MapAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  lat: number | null;
  lon: number | null;
  radiusKm: number | null;
  place: string | null;
  validUntil: Date;
}

export interface MapReport {
  id: string;
  lat: number;
  lon: number;
  communeName: string;
  pestName: string | null;
  createdAt: Date;
}

export interface AgentMapData {
  parcels: MapParcel[];
  alerts: MapAlert[];
  reports: MapReport[];
}

/** Indicateurs du tableau de bord agent (docs/DESIGN.md §9.4). Lecture seule, agrégats simples. */
export async function getAgentKpis(actor: StaffActor, locale: ContentLocale): Promise<AgentKpis> {
  const now = new Date();
  const [parcelsTracked, bySeverity, pendingReports, ack, revenue] = await Promise.all([
    prisma.parcel.count(),
    prisma.alert.groupBy({ by: ["severity"], where: { validUntil: { gte: now } }, _count: { _all: true } }),
    countPendingReports(actor),
    ackRate(7),
    revenueStats(actor, { months: 1, locale, now }),
  ]);

  const severityCounts: Record<AlertSeverity, number> = { INFO: 0, WARNING: 0, CRITICAL: 0 };
  let activeAlertsTotal = 0;
  for (const row of bySeverity) {
    severityCounts[row.severity] = row._count._all;
    activeAlertsTotal += row._count._all;
  }

  return {
    parcelsTracked,
    activeAlerts: severityCounts,
    activeAlertsTotal,
    pendingReports,
    ackRate7d: {
      delivered: ack.delivered,
      acknowledged: ack.acknowledged,
      percent: ack.delivered > 0 ? Math.round((ack.acknowledged / ack.delivered) * 100) : null,
    },
    revenueThisMonthFcfa: revenue ? (revenue.byMonth.at(-1)?.totalFcfa ?? 0) : null,
  };
}

/** Données géolocalisées pour la carte agent, avec repli sur la commune si l'alerte n'a pas ses propres coordonnées. */
export async function getAgentMapData(actor: StaffActor): Promise<AgentMapData> {
  const now = new Date();
  const [parcelRows, alertRows, reportPage] = await Promise.all([
    prisma.parcel.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, lat: true, lon: true, commune: { select: { name: true } } },
    }),
    prisma.alert.findMany({
      where: { validUntil: { gte: now } },
      take: 300,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        severity: true,
        titleFr: true,
        lat: true,
        lon: true,
        radiusKm: true,
        validUntil: true,
        parcel: { select: { lat: true, lon: true, name: true } },
        commune: { select: { lat: true, lon: true, name: true } },
      },
    }),
    listReports(actor, { status: "PENDING", pageSize: 200 }),
  ]);

  const alerts: MapAlert[] = alertRows.map((a) => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.titleFr,
    lat: a.lat ?? a.parcel?.lat ?? a.commune?.lat ?? null,
    lon: a.lon ?? a.parcel?.lon ?? a.commune?.lon ?? null,
    radiusKm: a.radiusKm,
    place: a.commune?.name ?? a.parcel?.name ?? null,
    validUntil: a.validUntil,
  }));

  const reports: MapReport[] = reportPage.items
    .filter((r) => typeof r.lat === "number" && typeof r.lon === "number")
    .map((r) => ({
      id: r.id,
      lat: r.lat,
      lon: r.lon,
      communeName: r.communeName,
      pestName: r.pest?.nameFr ?? null,
      createdAt: r.createdAt,
    }));

  return {
    parcels: parcelRows.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, communeName: p.commune.name })),
    alerts,
    reports,
  };
}

/** Dernières alertes (toutes sources), pour le bloc « Dernières alertes » du tableau de bord. */
export { recentAlertStats } from "@/server/monitoring/queries";
