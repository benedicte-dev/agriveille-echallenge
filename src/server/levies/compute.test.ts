import { describe, expect, it } from "vitest";
import {
  computeAmountDue,
  LevyComputationError,
  MAX_AMOUNT_FCFA,
  MAX_DECLARED_VALUE_FCFA,
  MAX_QUANTITY_KG,
  previewAmountDue,
  requiredInputFor,
} from "./compute";

const perKg = { basis: "PER_KG" as const, rate: 2 };
const pct = { basis: "PERCENT_VALUE" as const, rate: 100 }; // 1 %
const flat = { basis: "FLAT" as const, rate: 200 };

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof LevyComputationError ? e.code : "other";
  }
  return undefined;
}

describe("computeAmountDue — PER_KG", () => {
  it("multiplie le taux par la quantité", () => {
    expect(computeAmountDue(perKg, { quantityKg: 600 })).toBe(1200);
    expect(computeAmountDue(perKg, { quantityKg: 1 })).toBe(2);
  });
  it("ignore la valeur déclarée", () => {
    expect(computeAmountDue(perKg, { quantityKg: 10, declaredValueFcfa: 999_999 })).toBe(20);
  });
  it("exige une quantité entière entre 1 et le maximum", () => {
    expect(code(() => computeAmountDue(perKg, {}))).toBe("lev.err.quantity_required");
    expect(code(() => computeAmountDue(perKg, { quantityKg: 0 }))).toBe("lev.err.quantity_required");
    expect(code(() => computeAmountDue(perKg, { quantityKg: -5 }))).toBe("lev.err.quantity_required");
    expect(code(() => computeAmountDue(perKg, { quantityKg: 1.5 }))).toBe("lev.err.quantity_required");
    expect(code(() => computeAmountDue(perKg, { quantityKg: Number.NaN }))).toBe("lev.err.quantity_required");
    expect(code(() => computeAmountDue(perKg, { quantityKg: MAX_QUANTITY_KG + 1 }))).toBe("lev.err.quantity_required");
    expect(computeAmountDue(perKg, { quantityKg: MAX_QUANTITY_KG })).toBe(20_000_000);
  });
});

describe("computeAmountDue — PERCENT_VALUE (points de base)", () => {
  it("1 % de 150 000 = 1 500 (quittance de démo du seed)", () => {
    expect(computeAmountDue(pct, { declaredValueFcfa: 150_000 })).toBe(1500);
  });
  it("arrondit au FCFA supérieur", () => {
    expect(computeAmountDue(pct, { declaredValueFcfa: 1 })).toBe(1); // 0,01 → 1
    expect(computeAmountDue(pct, { declaredValueFcfa: 101 })).toBe(2); // 1,01 → 2
    expect(computeAmountDue(pct, { declaredValueFcfa: 100 })).toBe(1); // exact
    expect(computeAmountDue({ basis: "PERCENT_VALUE", rate: 250 }, { declaredValueFcfa: 1_000 })).toBe(25); // 2,5 %
    expect(computeAmountDue({ basis: "PERCENT_VALUE", rate: 1 }, { declaredValueFcfa: 10_001 })).toBe(2);
  });
  it("taux nul → 0", () => {
    expect(computeAmountDue({ basis: "PERCENT_VALUE", rate: 0 }, { declaredValueFcfa: 5_000 })).toBe(0);
  });
  it("valeur maximale sans perte de précision", () => {
    expect(computeAmountDue(pct, { declaredValueFcfa: MAX_DECLARED_VALUE_FCFA })).toBe(100_000_000);
  });
  it("exige une valeur entière positive", () => {
    expect(code(() => computeAmountDue(pct, { quantityKg: 100 }))).toBe("lev.err.value_required");
    expect(code(() => computeAmountDue(pct, { declaredValueFcfa: 0 }))).toBe("lev.err.value_required");
    expect(code(() => computeAmountDue(pct, { declaredValueFcfa: 10.5 }))).toBe("lev.err.value_required");
    expect(code(() => computeAmountDue(pct, { declaredValueFcfa: MAX_DECLARED_VALUE_FCFA + 1 }))).toBe(
      "lev.err.value_required",
    );
  });
});

describe("computeAmountDue — FLAT", () => {
  it("forfait indépendant des entrées", () => {
    expect(computeAmountDue(flat, {})).toBe(200);
    expect(computeAmountDue(flat, { quantityKg: 5000, declaredValueFcfa: 1 })).toBe(200);
  });
});

describe("computeAmountDue — garde-fous", () => {
  it("rejette un taux négatif, décimal ou hors plafond", () => {
    expect(code(() => computeAmountDue({ basis: "FLAT", rate: -1 }, {}))).toBe("lev.err.rate_invalid");
    expect(code(() => computeAmountDue({ basis: "PER_KG", rate: 1.5 }, { quantityKg: 1 }))).toBe("lev.err.rate_invalid");
    expect(code(() => computeAmountDue({ basis: "PERCENT_VALUE", rate: 10_001 }, { declaredValueFcfa: 1 }))).toBe(
      "lev.err.rate_invalid",
    );
    expect(code(() => computeAmountDue({ basis: "BOGUS" as never, rate: 1 }, {}))).toBe("lev.err.rate_invalid");
  });
  it("refuse un montant qui ne tient pas dans un Int PostgreSQL", () => {
    expect(code(() => computeAmountDue({ basis: "PER_KG", rate: 100_000 }, { quantityKg: MAX_QUANTITY_KG }))).toBe(
      "lev.err.amount_too_large",
    );
    expect(MAX_AMOUNT_FCFA).toBe(2_147_483_647);
  });
  it("renvoie toujours un entier", () => {
    for (const v of [1, 7, 99, 12_345, 987_654_321]) {
      expect(Number.isInteger(computeAmountDue({ basis: "PERCENT_VALUE", rate: 333 }, { declaredValueFcfa: v }))).toBe(true);
    }
  });
});

describe("aides", () => {
  it("previewAmountDue renvoie null au lieu de lever", () => {
    expect(previewAmountDue(perKg, {})).toBeNull();
    expect(previewAmountDue(perKg, { quantityKg: 3 })).toBe(6);
  });
  it("requiredInputFor", () => {
    expect(requiredInputFor("PER_KG")).toBe("quantityKg");
    expect(requiredInputFor("PERCENT_VALUE")).toBe("declaredValueFcfa");
    expect(requiredInputFor("FLAT")).toBeNull();
  });
});
