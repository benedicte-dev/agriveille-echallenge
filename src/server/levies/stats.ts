/**
 * Agrégation des recettes (module pur, testé). Entrée : déclarations minimales ; sortie : totaux
 * par barème, par commune et par mois. « Encaissé » = PAID ou VALIDATED (REJECTED exclu).
 */
import type { DeclarationStatus } from "@prisma/client";
import { monthKey } from "@/server/market/format";

export interface RevenueRow {
  status: DeclarationStatus;
  amountDueFcfa: number;
  paidAt: Date | null;
  createdAt: Date;
  levyRateId: string;
  levyLabel: string;
  communeId: string | null;
  communeName: string | null;
}

export interface Bucket {
  key: string;
  label: string;
  totalFcfa: number;
  count: number;
}

export interface RevenueStats {
  collectedFcfa: number;
  receiptsCount: number;
  /** Déclarées, pas encore payées. */
  awaitingPaymentCount: number;
  /** Payées, en attente de validation par un agent. */
  awaitingValidationCount: number;
  rejectedCount: number;
  byLevy: Bucket[];
  byCommune: Bucket[];
  /** Mois continus (du plus ancien au plus récent), mois vides inclus. */
  byMonth: Bucket[];
}

const isCollected = (s: DeclarationStatus) => s === "PAID" || s === "VALIDATED";

function add(map: Map<string, Bucket>, key: string, label: string, amount: number) {
  const b = map.get(key) ?? { key, label, totalFcfa: 0, count: 0 };
  b.totalFcfa += amount;
  b.count += 1;
  map.set(key, b);
}

/** Liste des clés de mois « AAAA-MM » se terminant au mois de `now`. */
export function monthRange(now: Date, months: number): string[] {
  const end = monthKey(now);
  let y = Number(end.slice(0, 4));
  let m = Number(end.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < months; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function aggregateRevenue(
  rows: readonly RevenueRow[],
  opts: { now: Date; months: number; noCommuneLabel?: string },
): RevenueStats {
  const byLevy = new Map<string, Bucket>();
  const byCommune = new Map<string, Bucket>();
  const months = monthRange(opts.now, opts.months);
  const byMonth = new Map<string, Bucket>(months.map((k) => [k, { key: k, label: k, totalFcfa: 0, count: 0 }]));

  let collectedFcfa = 0;
  let receiptsCount = 0;
  let awaitingPaymentCount = 0;
  let awaitingValidationCount = 0;
  let rejectedCount = 0;

  for (const r of rows) {
    if (r.status === "SUBMITTED") awaitingPaymentCount += 1;
    if (r.status === "PAID") awaitingValidationCount += 1;
    if (r.status === "REJECTED") rejectedCount += 1;
    if (!isCollected(r.status)) continue;

    collectedFcfa += r.amountDueFcfa;
    receiptsCount += 1;
    add(byLevy, r.levyRateId, r.levyLabel, r.amountDueFcfa);
    add(byCommune, r.communeId ?? "none", r.communeName ?? opts.noCommuneLabel ?? "Sans commune", r.amountDueFcfa);
    const mk = monthKey(r.paidAt ?? r.createdAt);
    const mb = byMonth.get(mk);
    if (mb) {
      mb.totalFcfa += r.amountDueFcfa;
      mb.count += 1;
    }
  }

  const desc = (a: Bucket, b: Bucket) => b.totalFcfa - a.totalFcfa || a.label.localeCompare(b.label, "fr");
  return {
    collectedFcfa,
    receiptsCount,
    awaitingPaymentCount,
    awaitingValidationCount,
    rejectedCount,
    byLevy: [...byLevy.values()].sort(desc),
    byCommune: [...byCommune.values()].sort(desc),
    byMonth: months.map((k) => byMonth.get(k)!),
  };
}
