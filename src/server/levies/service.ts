import "server-only";
/**
 * Redevances : déclaration, paiement de démonstration, encaissement au guichet, validation,
 * vérification publique d'une quittance.
 *
 * Paiement (décision 4b) : aucun flux réel. `payDemo` est une SIMULATION étiquetée comme telle
 * dans l'interface ; `markPaidAtCounter` enregistre un encaissement déclaré par un agent.
 */
import type { DeclarationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fieldErrorsOf } from "@/lib/validation";
import { audit } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { err, isUniqueViolation, ok, type Result, type ServiceContext } from "@/server/market/result";
import { beninYear, maskName, pickLocalized } from "@/server/market/format";
import { computeAmountDue, LevyComputationError } from "./compute";
import {
  formatReceiptNumber,
  generateVerificationCode,
  nextReceiptSeq,
  normalizeVerificationCode,
  RECEIPT_MAX_SEQ,
  receiptPrefix,
} from "./codes";
import { createDeclarationSchema, declarationIdSchema, validateDeclarationSchema } from "./schemas";

/** Fenêtre d'idempotence : une déclaration identique dans ce délai renvoie la même quittance. */
const DUPLICATE_WINDOW_MS = 2 * 60_000;
const CREATE_ATTEMPTS = 5;

/** Vérification publique : 30 requêtes / 15 min / IP (pas de portée dédiée dans RATE_LIMITS). */
export const VERIFY_RATE_LIMIT = { limit: 30, windowMs: 15 * 60_000 } as const;

/** AGENT, et ADMIN qui peut tout ce qu'AGENT peut (SPEC §2). */
function isStaff(role: ServiceContext["actor"]["role"]) {
  return role === "AGENT" || role === "ADMIN";
}

// ── Déclarer ──────────────────────────────────────────────────────────────

export interface CreatedDeclaration {
  id: string;
  receiptNumber: string;
  amountDueFcfa: number;
  /** true si une déclaration identique venait d'être créée (double envoi) : c'est elle qui est renvoyée. */
  duplicate: boolean;
}

export async function createDeclaration(ctx: ServiceContext, input: unknown): Promise<Result<CreatedDeclaration>> {
  if (ctx.actor.role !== "FARMER") return err("forbidden");
  const parsed = createDeclarationSchema.safeParse(input);
  if (!parsed.success) return err("invalid", undefined, fieldErrorsOf(parsed.error));
  const d = parsed.data;

  try {
    const levy = await prisma.levyRate.findFirst({
      where: { id: d.levyRateId, active: true },
      select: { id: true, basis: true, rate: true },
    });
    if (!levy) return err("invalid", "lev.err.rate_unknown", { levyRateId: "Barème inconnu." });
    if (d.cropId) {
      const crop = await prisma.crop.findUnique({ where: { id: d.cropId }, select: { id: true } });
      if (!crop) return err("invalid", undefined, { cropId: "Culture inconnue." });
    }

    let amountDueFcfa: number;
    try {
      amountDueFcfa = computeAmountDue(levy, d);
    } catch (e) {
      if (e instanceof LevyComputationError) {
        const field = e.code === "lev.err.quantity_required" ? "quantityKg" : e.code === "lev.err.value_required" ? "declaredValueFcfa" : "_form";
        return err("invalid", e.code, { [field]: e.code });
      }
      throw e;
    }

    // Quantité et valeur sont conservées si fournies (informatives hors de leur base de calcul).
    const quantityKg = d.quantityKg ?? null;
    const declaredValueFcfa = d.declaredValueFcfa ?? null;

    for (let attempt = 1; attempt <= CREATE_ATTEMPTS; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          const now = new Date();
          const year = beninYear(now);
          const prefix = receiptPrefix(year);
          // Sérialise l'attribution des numéros de l'année (verrou transactionnel, libéré au commit).
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"receipt:" + prefix}))`;

          const dup = await tx.declaration.findFirst({
            where: {
              farmerId: ctx.actor.id,
              levyRateId: levy.id,
              cropId: d.cropId ?? null,
              quantityKg,
              declaredValueFcfa,
              status: "SUBMITTED",
              createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
            },
            select: { id: true, receiptNumber: true, amountDueFcfa: true },
          });
          if (dup) return { ...dup, duplicate: true };

          const last = await tx.declaration.findFirst({
            where: { receiptNumber: { startsWith: prefix } },
            orderBy: { receiptNumber: "desc" },
            select: { receiptNumber: true },
          });
          const seq = nextReceiptSeq(last?.receiptNumber ?? null);
          if (seq > RECEIPT_MAX_SEQ) throw new Error("séquence de quittances épuisée pour l'année");

          const row = await tx.declaration.create({
            data: {
              farmerId: ctx.actor.id,
              levyRateId: levy.id,
              cropId: d.cropId ?? null,
              quantityKg,
              declaredValueFcfa,
              amountDueFcfa,
              status: "SUBMITTED",
              receiptNumber: formatReceiptNumber(year, seq),
              verificationCode: generateVerificationCode(),
            },
            select: { id: true, receiptNumber: true, amountDueFcfa: true },
          });
          return { ...row, duplicate: false };
        });
        return ok(created);
      } catch (e) {
        // Collision (code de vérification, ou numéro émis hors verrou) : on retente avec de nouvelles valeurs.
        if (isUniqueViolation(e) && attempt < CREATE_ATTEMPTS) continue;
        throw e;
      }
    }
    return err("unavailable");
  } catch (e) {
    console.error("[levies] createDeclaration", e);
    return err("unavailable");
  }
}

// ── Payer (démo) ──────────────────────────────────────────────────────────

/** SIMULATION : marque la déclaration du fermier comme payée. Aucun argent n'est prélevé. */
export async function payDemo(ctx: ServiceContext, input: unknown): Promise<Result<{ id: string; paidAt: Date }>> {
  if (ctx.actor.role !== "FARMER") return err("forbidden");
  const parsed = declarationIdSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const { declarationId } = parsed.data;
  try {
    const paidAt = new Date();
    const changed = await prisma.declaration.updateMany({
      where: { id: declarationId, farmerId: ctx.actor.id, status: "SUBMITTED" },
      data: { status: "PAID", paidAt },
    });
    if (changed.count !== 1) {
      const mine = await prisma.declaration.findFirst({
        where: { id: declarationId, farmerId: ctx.actor.id },
        select: { id: true },
      });
      return mine ? err("conflict", "lev.err.already_paid") : err("not_found");
    }
    await audit(ctx.actor.id, "declaration.pay_demo", "Declaration", declarationId, { simulated: true }, ctx.ip ?? null);
    return ok({ id: declarationId, paidAt });
  } catch (e) {
    console.error("[levies] payDemo", e);
    return err("unavailable");
  }
}

// ── Agent : encaissement au guichet, validation ───────────────────────────

/** L'agent déclare avoir encaissé le montant au guichet (SUBMITTED → PAID). */
export async function markPaidAtCounter(ctx: ServiceContext, input: unknown): Promise<Result<{ id: string }>> {
  if (!isStaff(ctx.actor.role)) return err("forbidden");
  const parsed = declarationIdSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const { declarationId } = parsed.data;
  try {
    const changed = await prisma.declaration.updateMany({
      where: { id: declarationId, status: "SUBMITTED" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (changed.count !== 1) {
      const exists = await prisma.declaration.findUnique({ where: { id: declarationId }, select: { id: true } });
      return exists ? err("conflict", "lev.err.already_paid") : err("not_found");
    }
    await audit(ctx.actor.id, "declaration.counter_payment", "Declaration", declarationId, {}, ctx.ip ?? null);
    return ok({ id: declarationId });
  } catch (e) {
    console.error("[levies] markPaidAtCounter", e);
    return err("unavailable");
  }
}

/** Statuts de départ admis pour chaque décision. */
export const VALIDATION_FROM: Record<"VALIDATED" | "REJECTED", DeclarationStatus[]> = {
  VALIDATED: ["PAID"],
  REJECTED: ["SUBMITTED", "PAID"],
};

export async function validateDeclaration(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ id: string; status: "VALIDATED" | "REJECTED" }>> {
  if (!isStaff(ctx.actor.role)) return err("forbidden");
  const parsed = validateDeclarationSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const { declarationId, decision } = parsed.data;
  try {
    const before = await prisma.declaration.findUnique({
      where: { id: declarationId },
      select: { status: true, amountDueFcfa: true, receiptNumber: true },
    });
    if (!before) return err("not_found");
    const changed = await prisma.declaration.updateMany({
      where: { id: declarationId, status: { in: VALIDATION_FROM[decision] } },
      data: { status: decision, validatedById: ctx.actor.id },
    });
    if (changed.count !== 1) {
      return err("conflict", decision === "VALIDATED" ? "lev.err.validate_needs_paid" : "lev.err.already_decided");
    }
    await audit(
      ctx.actor.id,
      decision === "VALIDATED" ? "declaration.validate" : "declaration.reject",
      "Declaration",
      declarationId,
      { from: before.status, to: decision, receiptNumber: before.receiptNumber, amountDueFcfa: before.amountDueFcfa },
      ctx.ip ?? null,
    );
    return ok({ id: declarationId, status: decision });
  } catch (e) {
    console.error("[levies] validateDeclaration", e);
    return err("unavailable");
  }
}

// ── Vérification publique ─────────────────────────────────────────────────

export interface VerifiedReceipt {
  receiptNumber: string;
  /** Date de paiement, sinon de déclaration. */
  date: Date;
  levyLabel: string;
  amountDueFcfa: number;
  status: DeclarationStatus;
  holder: string;
}

/**
 * Public, limité par IP. Renvoie le strict minimum ; un code mal formé et un code inconnu
 * donnent la même réponse (`null`), pour ne rien révéler.
 */
export async function verifyReceipt(
  code: unknown,
  opts: { ip: string; locale?: "fr" | "fon" | "yo" },
): Promise<Result<VerifiedReceipt | null>> {
  const limit = await rateLimit(`verifyIp:${opts.ip}`, VERIFY_RATE_LIMIT);
  if (!limit.allowed) return err("rate_limited");
  const normalized = normalizeVerificationCode(code);
  if (!normalized) return ok(null);
  try {
    const row = await prisma.declaration.findUnique({
      where: { verificationCode: normalized },
      select: {
        receiptNumber: true,
        createdAt: true,
        paidAt: true,
        amountDueFcfa: true,
        status: true,
        levyRate: { select: { labelFr: true, labelFon: true, labelYo: true } },
        farmer: { select: { fullName: true } },
      },
    });
    if (!row) return ok(null);
    const locale = opts.locale ?? "fr";
    return ok({
      receiptNumber: row.receiptNumber,
      date: row.paidAt ?? row.createdAt,
      levyLabel: pickLocalized(locale, row.levyRate.labelFr, row.levyRate.labelFon, row.levyRate.labelYo),
      amountDueFcfa: row.amountDueFcfa,
      status: row.status,
      holder: maskName(row.farmer.fullName),
    });
  } catch (e) {
    console.error("[levies] verifyReceipt", e);
    return err("unavailable");
  }
}

/** Une quittance est « valide » quand elle a été payée (ou validée) et non rejetée. */
export function isReceiptValid(status: DeclarationStatus): boolean {
  return status === "PAID" || status === "VALIDATED";
}
