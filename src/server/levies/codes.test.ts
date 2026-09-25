import { describe, expect, it } from "vitest";
import {
  formatReceiptNumber,
  generateVerificationCode,
  nextReceiptSeq,
  normalizeVerificationCode,
  parseReceiptNumber,
  VERIFICATION_ALPHABET,
} from "./codes";
import { aggregateRevenue, monthRange } from "./stats";
import { beninYear, formatFcfa, maskName, monthKey, publicName } from "@/server/market/format";

describe("code de vérification", () => {
  it("12 caractères de l'alphabet sans ambiguïté", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateVerificationCode();
      expect(c).toMatch(/^[A-Z2-9]{12}$/);
      for (const ch of c) expect(VERIFICATION_ALPHABET).toContain(ch);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });
  it("utilise la source d'aléa fournie (crypto par défaut)", () => {
    expect(generateVerificationCode(() => 0)).toBe("AAAAAAAAAAAA");
    expect(generateVerificationCode((max) => max - 1)).toBe("999999999999");
  });
  it("pas de doublon sur 5 000 tirages", () => {
    const set = new Set(Array.from({ length: 5000 }, () => generateVerificationCode()));
    expect(set.size).toBe(5000);
  });
  it("normalise la saisie et accepte le code de démo", () => {
    expect(normalizeVerificationCode("demoav2026qr")).toBe("DEMOAV2026QR");
    expect(normalizeVerificationCode(" ABCD-EFGH-JKMN ")).toBe("ABCDEFGHJKMN");
    expect(normalizeVerificationCode("TROPCOURT")).toBeNull();
    expect(normalizeVerificationCode("ABCDEFGHJKMN1")).toBeNull();
    expect(normalizeVerificationCode("ABCDEF'OR'1=1")).toBeNull();
    expect(normalizeVerificationCode(12)).toBeNull();
    expect(normalizeVerificationCode("A".repeat(100))).toBeNull();
  });
});

describe("numéro de quittance", () => {
  it("format AV-<année>-<6 chiffres>", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("AV-2026-000001");
    expect(formatReceiptNumber(2026, 123)).toBe("AV-2026-000123");
    expect(formatReceiptNumber(2026, 999_999)).toBe("AV-2026-999999");
    expect(() => formatReceiptNumber(2026, 0)).toThrow();
    expect(() => formatReceiptNumber(2026, 1_000_000)).toThrow();
    expect(() => formatReceiptNumber(2026, 1.5)).toThrow();
  });
  it("séquence suivante", () => {
    expect(nextReceiptSeq(null)).toBe(1);
    expect(nextReceiptSeq("AV-2026-000001")).toBe(2);
    expect(nextReceiptSeq("AV-2026-000999")).toBe(1000);
    expect(parseReceiptNumber("AV-2026-00001")).toBeNull();
  });
  it("l'ordre lexicographique suit l'ordre numérique (tri du dernier numéro en base)", () => {
    const nums = [9, 10, 100, 99_999, 100_000].map((n) => formatReceiptNumber(2026, n));
    expect([...nums].sort()).toEqual(nums);
  });
  it("année dans le fuseau du Bénin (UTC+1)", () => {
    expect(beninYear(new Date("2026-12-31T22:59:00Z"))).toBe(2026);
    expect(beninYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
  });
});

describe("formatage", () => {
  it("FCFA en fr-FR", () => {
    expect(formatFcfa(12500)).toBe("12 500 FCFA");
    expect(formatFcfa(0)).toBe("0 FCFA");
    expect(formatFcfa(1_250_000)).toBe("1 250 000 FCFA");
  });
  it("nom masqué et nom public", () => {
    expect(maskName("Ablawa Hounkpè")).toBe("Ab**** H.");
    expect(maskName("Jo")).toBe("Jo**");
    expect(maskName("  ")).toBe("***");
    expect(maskName("Ablawa Hounkpè")).not.toContain("Hounkpè");
    expect(publicName("Ablawa Hounkpè Dossou")).toBe("Ablawa H. D.");
  });
});

describe("agrégation des recettes", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const base = { levyLabel: "Kg", levyRateId: "L1", communeId: "C1", communeName: "Bohicon", createdAt: now };
  const rows = [
    { ...base, status: "PAID" as const, amountDueFcfa: 1000, paidAt: new Date("2026-09-10T10:00:00Z") },
    { ...base, status: "VALIDATED" as const, amountDueFcfa: 500, paidAt: new Date("2026-08-02T10:00:00Z") },
    { ...base, status: "SUBMITTED" as const, amountDueFcfa: 700, paidAt: null },
    { ...base, status: "REJECTED" as const, amountDueFcfa: 9000, paidAt: new Date("2026-09-01T10:00:00Z") },
    {
      ...base,
      levyRateId: "L2",
      levyLabel: "Forfait",
      communeId: null,
      communeName: null,
      status: "PAID" as const,
      amountDueFcfa: 200,
      paidAt: new Date("2026-09-12T10:00:00Z"),
    },
  ];
  const s = aggregateRevenue(rows, { now, months: 3, noCommuneLabel: "Sans commune" });

  it("totaux : seules les déclarations payées ou validées comptent", () => {
    expect(s.collectedFcfa).toBe(1700);
    expect(s.receiptsCount).toBe(3);
    expect(s.awaitingPaymentCount).toBe(1);
    expect(s.awaitingValidationCount).toBe(2);
    expect(s.rejectedCount).toBe(1);
  });
  it("par barème et par commune, triés par montant", () => {
    expect(s.byLevy.map((b) => [b.key, b.totalFcfa, b.count])).toEqual([
      ["L1", 1500, 2],
      ["L2", 200, 1],
    ]);
    expect(s.byCommune.map((b) => [b.label, b.totalFcfa])).toEqual([
      ["Bohicon", 1500],
      ["Sans commune", 200],
    ]);
  });
  it("par mois continus, mois vides inclus", () => {
    expect(s.byMonth.map((b) => [b.key, b.totalFcfa])).toEqual([
      ["2026-07", 0],
      ["2026-08", 500],
      ["2026-09", 1200],
    ]);
  });
  it("monthRange passe l'année", () => {
    expect(monthRange(new Date("2026-02-10T00:00:00Z"), 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthKey(new Date("2026-01-31T23:30:00Z"))).toBe("2026-02");
  });
});
