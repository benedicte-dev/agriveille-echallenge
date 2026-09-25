/**
 * Calcul du montant d'une redevance (module pur, testé). Seule source de vérité du montant :
 * le serveur recalcule toujours ; le client n'affiche qu'un aperçu obtenu par la même fonction.
 *
 * - PER_KG : `rate` FCFA par kg × quantité (kg).
 * - PERCENT_VALUE : `rate` en points de base (100 = 1 %) × valeur déclarée, arrondi au FCFA supérieur.
 * - FLAT : `rate` FCFA, quelle que soit la quantité.
 * Tout est entier ; arithmétique en BigInt pour éviter toute perte de précision.
 */
import type { LevyBasis } from "@prisma/client";

export const MAX_QUANTITY_KG = 10_000_000;
export const MAX_DECLARED_VALUE_FCFA = 10_000_000_000;
/** Plafond de taux par base (garde-fou contre une saisie CMS aberrante). */
export const MAX_RATE: Record<LevyBasis, number> = {
  PER_KG: 100_000, // FCFA/kg
  PERCENT_VALUE: 10_000, // 100 %
  FLAT: 10_000_000, // FCFA
};
/** Montant maximal représentable dans une colonne Int PostgreSQL. */
export const MAX_AMOUNT_FCFA = 2_147_483_647;

export type LevyErrorCode =
  | "lev.err.rate_invalid"
  | "lev.err.quantity_required"
  | "lev.err.value_required"
  | "lev.err.amount_too_large";

export class LevyComputationError extends Error {
  constructor(readonly code: LevyErrorCode) {
    super(code);
    this.name = "LevyComputationError";
  }
}

export interface LevyRateLike {
  basis: LevyBasis;
  rate: number;
}

export interface LevyInput {
  quantityKg?: number | null;
  declaredValueFcfa?: number | null;
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
}

/** Champs requis selon la base (pour le formulaire). */
export function requiredInputFor(basis: LevyBasis): "quantityKg" | "declaredValueFcfa" | null {
  if (basis === "PER_KG") return "quantityKg";
  if (basis === "PERCENT_VALUE") return "declaredValueFcfa";
  return null;
}

export function computeAmountDue(levyRate: LevyRateLike, input: LevyInput): number {
  const { basis, rate } = levyRate;
  if (!(basis in MAX_RATE) || !isIntIn(rate, 0, MAX_RATE[basis])) throw new LevyComputationError("lev.err.rate_invalid");

  let amount: bigint;
  switch (basis) {
    case "PER_KG": {
      if (!isIntIn(input.quantityKg, 1, MAX_QUANTITY_KG)) throw new LevyComputationError("lev.err.quantity_required");
      amount = BigInt(rate) * BigInt(input.quantityKg);
      break;
    }
    case "PERCENT_VALUE": {
      if (!isIntIn(input.declaredValueFcfa, 1, MAX_DECLARED_VALUE_FCFA)) {
        throw new LevyComputationError("lev.err.value_required");
      }
      const num = BigInt(rate) * BigInt(input.declaredValueFcfa);
      amount = (num + BigInt(9_999)) / BigInt(10_000); // plafond entier : arrondi au FCFA supérieur
      break;
    }
    case "FLAT":
      amount = BigInt(rate);
      break;
  }
  if (amount > BigInt(MAX_AMOUNT_FCFA)) throw new LevyComputationError("lev.err.amount_too_large");
  return Number(amount);
}

/** Variante sans exception pour l'aperçu client : null si le calcul est impossible. */
export function previewAmountDue(levyRate: LevyRateLike, input: LevyInput): number | null {
  try {
    return computeAmountDue(levyRate, input);
  } catch {
    return null;
  }
}
