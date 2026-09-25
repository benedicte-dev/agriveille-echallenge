import "server-only";
/**
 * Lectures des redevances. Propriété vérifiée dans la requête elle-même (where farmerId = acteur) :
 * la quittance d'un autre fermier est introuvable, jamais « interdite » (pas de fuite d'existence).
 */
import type { DeclarationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "@/server/market/result";
import { pickLocalized } from "@/server/market/format";
import { aggregateRevenue, type RevenueStats } from "./stats";

type Loc = "fr" | "fon" | "yo";

/** Barèmes actifs (formulaire de déclaration). */
export async function activeLevyRates() {
  return prisma.levyRate.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    take: 50,
    select: { id: true, code: true, labelFr: true, labelFon: true, labelYo: true, basis: true, rate: true },
  });
}

const DECLARATION_SELECT = {
  id: true,
  receiptNumber: true,
  verificationCode: true,
  status: true,
  amountDueFcfa: true,
  quantityKg: true,
  declaredValueFcfa: true,
  createdAt: true,
  paidAt: true,
  levyRate: { select: { code: true, labelFr: true, labelFon: true, labelYo: true, basis: true, rate: true } },
  crop: { select: { slug: true, icon: true, nameFr: true, nameFon: true, nameYo: true } },
} as const;

/** Quittances du fermier connecté (50 plus récentes). */
export async function myDeclarations(actor: Actor) {
  if (actor.role !== "FARMER") return [];
  return prisma.declaration.findMany({
    where: { farmerId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: DECLARATION_SELECT,
  });
}

export type MyDeclaration = Awaited<ReturnType<typeof myDeclarations>>[number];

/** Quittance du propriétaire uniquement ; null sinon (la page répond 404). */
export async function getDeclarationForOwner(actor: Actor, id: string) {
  if (actor.role !== "FARMER") return null;
  return prisma.declaration.findFirst({
    where: { id, farmerId: actor.id },
    select: {
      ...DECLARATION_SELECT,
      farmer: { select: { fullName: true, commune: { select: { name: true } } } },
    },
  });
}

/** Déclarations à traiter par l'agent (déclarées ou payées), les plus anciennes d'abord. */
export async function declarationsToReview(actor: Actor, locale: Loc, take = 50) {
  if (actor.role !== "AGENT" && actor.role !== "ADMIN") return [];
  const rows = await prisma.declaration.findMany({
    where: { status: { in: ["SUBMITTED", "PAID"] satisfies DeclarationStatus[] } },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(take, 1), 100),
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      amountDueFcfa: true,
      createdAt: true,
      paidAt: true,
      levyRate: { select: { labelFr: true, labelFon: true, labelYo: true } },
      farmer: { select: { fullName: true, commune: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    status: r.status,
    amountDueFcfa: r.amountDueFcfa,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
    levyLabel: pickLocalized(locale, r.levyRate.labelFr, r.levyRate.labelFon, r.levyRate.labelYo),
    farmerName: r.farmer.fullName,
    communeName: r.farmer.commune?.name ?? null,
  }));
}

export type ReviewRow = Awaited<ReturnType<typeof declarationsToReview>>[number];

/** Borne de sécurité : au-delà, l'agrégation passerait en SQL (GROUP BY). */
export const REVENUE_ROW_CAP = 20_000;

/**
 * Recettes sur les `months` derniers mois : totaux par barème, par commune (du fermier) et par mois.
 * Réservé AGENT / ADMIN.
 */
export async function revenueStats(
  actor: Actor,
  opts: { months: number; locale: Loc; noCommuneLabel?: string; now?: Date },
): Promise<(RevenueStats & { truncated: boolean }) | null> {
  if (actor.role !== "AGENT" && actor.role !== "ADMIN") return null;
  const now = opts.now ?? new Date();
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - opts.months);
  since.setUTCDate(1);
  const rows = await prisma.declaration.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: REVENUE_ROW_CAP + 1,
    select: {
      status: true,
      amountDueFcfa: true,
      paidAt: true,
      createdAt: true,
      levyRateId: true,
      levyRate: { select: { labelFr: true, labelFon: true, labelYo: true } },
      farmer: { select: { communeId: true, commune: { select: { name: true } } } },
    },
  });
  const truncated = rows.length > REVENUE_ROW_CAP;
  const stats = aggregateRevenue(
    rows.slice(0, REVENUE_ROW_CAP).map((r) => ({
      status: r.status,
      amountDueFcfa: r.amountDueFcfa,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      levyRateId: r.levyRateId,
      levyLabel: pickLocalized(opts.locale, r.levyRate.labelFr, r.levyRate.labelFon, r.levyRate.labelYo),
      communeId: r.farmer.communeId,
      communeName: r.farmer.commune?.name ?? null,
    })),
    { now, months: opts.months, noCommuneLabel: opts.noCommuneLabel },
  );
  return { ...stats, truncated };
}
