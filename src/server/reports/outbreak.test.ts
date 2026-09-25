import { describe, expect, it } from "vitest";
import {
  boundingBox,
  buildOutbreakTexts,
  nearestCommune,
  outbreakDedupKey,
  outbreakSeverity,
  outbreakValidUntil,
  outbreakWindowStart,
  OUTBREAK_CRITICAL_COUNT,
  OUTBREAK_WINDOW_DAYS,
} from "./outbreak";

describe("outbreakSeverity", () => {
  it("passe CRITICAL à partir du seuil, WARNING en dessous", () => {
    expect(outbreakSeverity(1)).toBe("WARNING");
    expect(outbreakSeverity(OUTBREAK_CRITICAL_COUNT - 1)).toBe("WARNING");
    expect(outbreakSeverity(OUTBREAK_CRITICAL_COUNT)).toBe("CRITICAL");
    expect(outbreakSeverity(OUTBREAK_CRITICAL_COUNT + 5)).toBe("CRITICAL");
  });
});

describe("outbreakDedupKey", () => {
  it("est stable et propre à un signalement", () => {
    expect(outbreakDedupKey("abc123")).toBe("PEST_OUTBREAK:abc123");
    expect(outbreakDedupKey("abc123")).not.toBe(outbreakDedupKey("xyz789"));
  });
});

describe("fenêtre temporelle", () => {
  it("outbreakWindowStart et outbreakValidUntil encadrent `now` de OUTBREAK_WINDOW_DAYS", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const dayMs = 24 * 60 * 60 * 1000;
    expect(outbreakWindowStart(now).getTime()).toBe(now.getTime() - OUTBREAK_WINDOW_DAYS * dayMs);
    expect(outbreakValidUntil(now).getTime()).toBe(now.getTime() + OUTBREAK_WINDOW_DAYS * dayMs);
  });
});

describe("boundingBox", () => {
  it("produit une boîte qui contient le centre et s'élargit avec le rayon", () => {
    const center = { lat: 7.19, lon: 2.07 };
    const box = boundingBox(center, 15);
    expect(box.latMin).toBeLessThan(center.lat);
    expect(box.latMax).toBeGreaterThan(center.lat);
    expect(box.lonMin).toBeLessThan(center.lon);
    expect(box.lonMax).toBeGreaterThan(center.lon);
    const bigger = boundingBox(center, 30);
    expect(bigger.latMax - bigger.latMin).toBeGreaterThan(box.latMax - box.latMin);
  });

  it("ne divise jamais par zéro près des pôles (cosinus borné)", () => {
    const box = boundingBox({ lat: 89.9, lon: 0 }, 10);
    expect(Number.isFinite(box.lonMin)).toBe(true);
    expect(Number.isFinite(box.lonMax)).toBe(true);
  });
});

describe("nearestCommune", () => {
  const communes = [
    { id: "a", lat: 7.19, lon: 2.07 },
    { id: "b", lat: 9.36, lon: 2.6 },
    { id: "c", lat: 6.4, lon: 2.4 },
  ];

  it("retourne la commune la plus proche avec sa distance", () => {
    const nearest = nearestCommune({ lat: 7.2, lon: 2.08 }, communes);
    expect(nearest?.id).toBe("a");
    expect(nearest?.distanceKm).toBeGreaterThanOrEqual(0);
    expect(nearest?.distanceKm).toBeLessThan(5);
  });

  it("renvoie null pour une liste vide", () => {
    expect(nearestCommune({ lat: 7.2, lon: 2.08 }, [])).toBeNull();
  });
});

describe("buildOutbreakTexts", () => {
  const pest = {
    nameFr: "Chenille légionnaire d'automne",
    kind: "PEST" as const,
    symptomsFr: "Trous dans les feuilles.",
    preventionFr: "Rotation des cultures.",
    treatmentFr: "Traitement biologique ciblé.",
  };

  it("mentionne le ravageur, la commune et le rayon", () => {
    const texts = buildOutbreakTexts(pest, { communeName: "Bohicon", radiusKm: 15, severity: "WARNING", confirmedNearby: 1 });
    expect(texts.titleFr).toContain(pest.nameFr);
    expect(texts.messageFr).toContain("Bohicon");
    expect(texts.messageFr).toContain("15");
    expect(texts.messageFr).not.toContain("foyers confirmés");
    expect(texts.adviceFr).toContain(pest.preventionFr);
    expect(texts.adviceFr).toContain(pest.treatmentFr);
  });

  it("ajoute le nombre de foyers en cas de sévérité CRITICAL", () => {
    const texts = buildOutbreakTexts(pest, { communeName: "Bohicon", radiusKm: 15, severity: "CRITICAL", confirmedNearby: 4 });
    expect(texts.messageFr).toContain("4 foyers confirmés");
  });

  it("distingue Ravageur et Maladie", () => {
    const disease = buildOutbreakTexts({ ...pest, kind: "DISEASE" }, { communeName: "Bohicon", radiusKm: 10, severity: "WARNING", confirmedNearby: 1 });
    expect(disease.titleFr).toMatch(/^Maladie/);
    const insect = buildOutbreakTexts(pest, { communeName: "Bohicon", radiusKm: 10, severity: "WARNING", confirmedNearby: 1 });
    expect(insect.titleFr).toMatch(/^Ravageur/);
  });

  it("formate un rayon non entier avec une virgule", () => {
    const texts = buildOutbreakTexts(pest, { communeName: "Bohicon", radiusKm: 12.5, severity: "WARNING", confirmedNearby: 1 });
    expect(texts.messageFr).toContain("12,5");
  });
});
