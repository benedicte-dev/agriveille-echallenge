import { describe, expect, it } from "vitest";
import {
  checkActiveChange,
  checkRoleChange,
  cropSchema,
  formToObject,
  levyRateSchema,
  normalizeCropIcon,
  pestSchema,
  referencePriceSchema,
  regulationSchema,
} from "./schemas";

function fd(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("formToObject", () => {
  it("regroupe les clés multiples et garde la première valeur des autres", () => {
    const o = formToObject(fd([["a", "1"], ["a", "2"], ["m", "3"], ["m", "4"]]), ["m", "vide"]);
    expect(o).toEqual({ a: "1", m: ["3", "4"], vide: [] });
  });
});

describe("cropSchema", () => {
  const valid = {
    slug: "mais",
    nameFr: "Maïs",
    nameFon: "",
    icon: "maize",
    cycleDays: "100",
    sowingMonths: ["4", "3", "3"],
    harvestMonths: ["7"],
    minRainMm: "500",
    optimalTempMin: "18",
    optimalTempMax: "32,5",
    autoTranslate: "on",
  };
  it("accepte, trie les mois, convertit l'ancienne clé d'icône et la virgule décimale", () => {
    const r = cropSchema.parse(valid);
    expect(r.sowingMonths).toEqual([3, 4]);
    expect(r.icon).toBe("mais");
    expect(r.optimalTempMax).toBe(32.5);
    expect(r.nameFon).toBeUndefined();
    expect(r.autoTranslate).toBe(true);
  });
  it("refuse min > max, mois vides, mois hors 1..12, slug invalide", () => {
    expect(cropSchema.safeParse({ ...valid, optimalTempMin: "40" }).success).toBe(false);
    expect(cropSchema.safeParse({ ...valid, sowingMonths: [] }).success).toBe(false);
    expect(cropSchema.safeParse({ ...valid, harvestMonths: ["13"] }).success).toBe(false);
    expect(cropSchema.safeParse({ ...valid, slug: "Maïs !" }).success).toBe(false);
    expect(cropSchema.safeParse({ ...valid, cycleDays: "10.5" }).success).toBe(false);
  });
  it("case décochée = false", () => {
    const { autoTranslate: _a, ...rest } = valid;
    void _a;
    expect(cropSchema.parse(rest).autoTranslate).toBe(false);
  });
});

describe("normalizeCropIcon", () => {
  it("résout les clés françaises, anglaises et inconnues", () => {
    expect(normalizeCropIcon("mais")).toBe("mais");
    expect(normalizeCropIcon("cassava")).toBe("manioc");
    expect(normalizeCropIcon("???")).toBe("generique");
    expect(normalizeCropIcon(null)).toBe("generique");
  });
});

describe("pestSchema", () => {
  const valid = {
    slug: "criquet",
    kind: "PEST",
    nameFr: "Criquet",
    cropIds: [],
    symptomsFr: "Feuilles mangées en bordure.",
    preventionFr: "Surveiller les bordures de champ.",
    treatmentFr: "Prévenir l'agent de la commune.",
    riskTempMin: "",
    riskTempMax: "35",
    riskHumidityMin: "",
  };
  it("seuils facultatifs : vide → null", () => {
    const r = pestSchema.parse(valid);
    expect(r.riskTempMin).toBeNull();
    expect(r.riskTempMax).toBe(35);
  });
  it("refuse une humidité > 100 % et des bornes inversées", () => {
    expect(pestSchema.safeParse({ ...valid, riskHumidityMin: "120" }).success).toBe(false);
    expect(pestSchema.safeParse({ ...valid, riskTempMin: "36" }).success).toBe(false);
  });
  it("refuse un identifiant de culture non cuid (injection)", () => {
    expect(pestSchema.safeParse({ ...valid, cropIds: ["' OR 1=1 --"] }).success).toBe(false);
  });
});

describe("regulationSchema", () => {
  it("sourceRef vide → undefined (on n'invente pas de référence)", () => {
    const r = regulationSchema.parse({
      slug: "test-fiche",
      category: "PHYTO",
      titleFr: "Une fiche test",
      summaryFr: "Résumé de la fiche.",
      bodyFr: "## Titre\n\nUn corps assez long.",
      sourceRef: "  ",
      published: "on",
    });
    expect(r.sourceRef).toBeUndefined();
    expect(r.published).toBe(true);
  });
});

describe("referencePriceSchema", () => {
  it("refuse une date future et un prix non entier", () => {
    const base = { cropId: "ckxxxxxxxxxxxxxxxxxxxxxxx", market: "LOCAL", pricePerKgFcfa: "250", observedAt: "2026-01-10" };
    expect(referencePriceSchema.safeParse(base).success).toBe(true);
    expect(referencePriceSchema.safeParse({ ...base, observedAt: "2999-01-01" }).success).toBe(false);
    expect(referencePriceSchema.safeParse({ ...base, pricePerKgFcfa: "2.5" }).success).toBe(false);
  });
});

describe("levyRateSchema", () => {
  const base = { code: "marche-kg", labelFr: "Redevance kg", basis: "PER_KG", rate: "2", active: "on" };
  it("normalise le code en majuscules", () => {
    expect(levyRateSchema.parse(base).code).toBe("MARCHE-KG");
  });
  it("un pourcentage ne dépasse pas 10 000 points de base", () => {
    expect(levyRateSchema.safeParse({ ...base, basis: "PERCENT_VALUE", rate: "10001" }).success).toBe(false);
    expect(levyRateSchema.safeParse({ ...base, basis: "PERCENT_VALUE", rate: "100" }).success).toBe(true);
  });
});

describe("garde-fous utilisateurs", () => {
  const admin = { actorId: "a", targetId: "a", currentRole: "ADMIN" as const, activeAdminCount: 2 };
  it("un ADMIN ne peut pas se rétrograder lui-même", () => {
    expect(checkRoleChange({ ...admin, nextRole: "AGENT" })).toEqual({ ok: false, reason: "self_demote" });
  });
  it("on ne retire pas le dernier ADMIN", () => {
    expect(checkRoleChange({ ...admin, targetId: "b", nextRole: "FARMER", activeAdminCount: 1 })).toEqual({
      ok: false,
      reason: "last_admin",
    });
  });
  it("promotion d'un agent : autorisée", () => {
    expect(checkRoleChange({ actorId: "a", targetId: "b", currentRole: "AGENT", nextRole: "ADMIN", activeAdminCount: 1 })).toEqual({ ok: true });
  });
  it("pas d'auto-désactivation", () => {
    expect(checkActiveChange({ actorId: "a", targetId: "a", targetRole: "ADMIN", nextActive: false, activeAdminCount: 3 })).toEqual({
      ok: false,
      reason: "self_deactivate",
    });
    expect(checkActiveChange({ actorId: "a", targetId: "b", targetRole: "FARMER", nextActive: false, activeAdminCount: 1 })).toEqual({ ok: true });
  });
});
