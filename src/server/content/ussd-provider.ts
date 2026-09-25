import "server-only";

import { prisma } from "@/lib/db";
import { parseForecast } from "@/lib/monitoring";
import { audit } from "@/lib/security/audit";
import type { UssdProvider } from "./ussd";

/**
 * Fournisseur Prisma du simulateur USSD *229*1# (DÉMO, /agent/sms). Les
 * données viennent réellement de la base pour le numéro de démo choisi par
 * l'agent ; aucun SMS n'est envoyé (SPEC : SmsOutbox est un journal, pas un
 * envoi réel).
 */
export function ussdProviderFor(farmerId: string): UssdProvider {
  return {
    async alerts() {
      const rows = await prisma.alertDelivery.findMany({
        where: { userId: farmerId, channel: "IN_APP", alert: { validUntil: { gte: new Date() } } },
        orderBy: { sentAt: "desc" },
        take: 20,
        select: { status: true, alert: { select: { id: true, titleFr: true, messageFr: true, severity: true } } },
      });
      return rows.map((r) => ({
        id: r.alert.id,
        title: r.alert.titleFr,
        message: r.alert.messageFr,
        severity: r.alert.severity,
        acknowledged: r.status === "ACKNOWLEDGED",
      }));
    },

    async acknowledge(alertId: string) {
      const now = new Date();
      const { count } = await prisma.alertDelivery.updateMany({
        where: { alertId, userId: farmerId, channel: "IN_APP", status: { not: "ACKNOWLEDGED" } },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: now, readAt: now },
      });
      if (count > 0) await audit(farmerId, "alert.acknowledge", "Alert", alertId, { channel: "USSD_SIM" });
      return count > 0;
    },

    async parcels() {
      const rows = await prisma.parcel.findMany({ where: { ownerId: farmerId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
      return rows;
    },

    async weather(parcelId: string) {
      const parcel = await prisma.parcel.findFirst({ where: { id: parcelId, ownerId: farmerId }, select: { id: true } });
      if (!parcel) return null;
      const snapshot = await prisma.weatherSnapshot.findFirst({
        where: { parcelId },
        orderBy: { fetchedAt: "desc" },
        select: { fetchedAt: true, payload: true },
      });
      if (!snapshot) return null;
      try {
        const forecast = parseForecast(snapshot.payload);
        return { fetchedAt: snapshot.fetchedAt, days: forecast.days.map((d) => ({ date: d.date, tmax: d.tmax, tmin: d.tmin, precipMm: d.precipMm })) };
      } catch {
        return null;
      }
    },

    async crops() {
      const rows = await prisma.crop.findMany({ orderBy: { nameFr: "asc" }, take: 30, select: { id: true, nameFr: true } });
      return rows.map((c) => ({ id: c.id, name: c.nameFr }));
    },

    async prices(cropId: string) {
      const rows = await prisma.referencePrice.findMany({
        where: { cropId },
        orderBy: { observedAt: "desc" },
        take: 40,
        select: { market: true, pricePerKgFcfa: true, commune: { select: { name: true } } },
      });
      // Le plus récent par (marché, lieu) : les relevés plus anciens sont redondants sur un même écran.
      const seen = new Set<string>();
      const out: { market: "LOCAL" | "EXPORT"; price: number; place: string | null }[] = [];
      for (const r of rows) {
        const key = `${r.market}:${r.commune?.name ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ market: r.market, price: r.pricePerKgFcfa, place: r.commune?.name ?? null });
      }
      return out;
    },

    async pests() {
      const rows = await prisma.pest.findMany({ orderBy: { nameFr: "asc" }, take: 30, select: { id: true, nameFr: true } });
      return rows.map((p) => ({ id: p.id, name: p.nameFr }));
    },

    async report(parcelId: string, pestId: string | null) {
      const parcel = await prisma.parcel.findFirst({ where: { id: parcelId, ownerId: farmerId }, select: { id: true, lat: true, lon: true, communeId: true } });
      if (!parcel) return { ok: false };
      const created = await prisma.pestReport.create({
        data: {
          reporterId: farmerId,
          parcelId: parcel.id,
          communeId: parcel.communeId,
          lat: parcel.lat,
          lon: parcel.lon,
          pestId,
          description: "Signalement envoyé depuis le simulateur USSD (démo).",
        },
        select: { id: true },
      });
      await audit(farmerId, "report.create", "PestReport", created.id, { channel: "USSD_SIM" });
      return { ok: true, ref: created.id.slice(-6).toUpperCase() };
    },
  };
}

/** Fermiers utilisables comme numéro de démo (téléphone + nom, pour le sélecteur agent). */
export async function listDemoFarmers() {
  return prisma.user.findMany({
    where: { role: "FARMER", isActive: true },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, phone: true, fullName: true },
  });
}
