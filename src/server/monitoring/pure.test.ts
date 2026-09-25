import { describe, expect, it } from "vitest";
import { mapWithConcurrency, toPestInput, toPlantingInput } from "./convert";
import { isAuthorizedBearer } from "./cron-auth";
import { evidenceLines, parseEvidence } from "./evidence";
import { sniffAudioUpload } from "@/app/api/voice/_lib/sniff";

describe("mapWithConcurrency", () => {
  it("respecte la limite, garde l'ordre et isole les erreurs", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (n === 5) throw new Error("boom");
      return n * 2;
    });
    expect(peak).toBe(4);
    expect(out[0]).toEqual({ ok: true, value: 2 });
    expect(out[4].ok).toBe(false);
    expect(out[8]).toEqual({ ok: true, value: 18 });
  });

  it("gère une liste vide", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});

describe("conversions Prisma → moteur", () => {
  it("convertit une plantation et un ravageur", () => {
    const p = toPlantingInput({
      id: "p1",
      parcelId: "par1",
      status: "GROWING",
      sowingDate: new Date("2026-08-01"),
      expectedHarvestDate: new Date("2026-11-01"),
      crop: { slug: "mais", nameFr: "maïs", sowingMonths: [4, 5] },
    });
    expect(p).toMatchObject({ plantingId: "p1", cropSlug: "mais", cropName: "maïs", sowingMonths: [4, 5] });
    const pest = toPestInput({
      id: "x",
      slug: "mildiou",
      nameFr: "mildiou",
      kind: "DISEASE",
      riskTempMin: 18,
      riskTempMax: 27,
      riskHumidityMin: 85,
      preventionFr: null,
      crops: [{ slug: "tomate" }, { slug: "piment" }],
    });
    expect(pest.cropSlugs).toEqual(["tomate", "piment"]);
    expect(pest.pestId).toBe("x");
  });
});

describe("isAuthorizedBearer", () => {
  const secret = "s3cr3t-cron-value-0123456789";
  it("accepte le bon secret", () => {
    expect(isAuthorizedBearer(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("refuse secret faux, absent, mal formé ou préfixe", () => {
    expect(isAuthorizedBearer(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedBearer(secret, secret)).toBe(false);
    expect(isAuthorizedBearer(`bearer ${secret}`, secret)).toBe(false);
    expect(isAuthorizedBearer(null, secret)).toBe(false);
    expect(isAuthorizedBearer("Bearer ", secret)).toBe(false);
  });
  it("ferme la route si le secret serveur est absent ou trop court", () => {
    expect(isAuthorizedBearer("Bearer ", "")).toBe(false);
    expect(isAuthorizedBearer("Bearer short", "short")).toBe(false);
    expect(isAuthorizedBearer("Bearer x", undefined)).toBe(false);
  });
});

describe("evidence", () => {
  const t = (key: string, vars?: Record<string, string | number>) => `${key}|${JSON.stringify(vars ?? {})}`;
  const d = (s: string) => `D(${s})`;
  const n = (x: number) => String(x).replace(".", ",");

  it("met en mots les chiffres d'une sécheresse", () => {
    const lines = evidenceLines("DROUGHT", { rainTotalMm: 2.4, et0TotalMm: 31.5, days: 7, rainThresholdMm: 3 }, t, d, n);
    expect(lines).toEqual([
      'mon.ev.rain_total|{"value":"2,4","days":7}',
      'mon.ev.et0_total|{"value":"31,5","days":7}',
      'mon.ev.threshold_drought|{"value":"3"}',
    ]);
  });

  it("formate les dates et ignore les champs invalides", () => {
    expect(evidenceLines("HEAVY_RAIN", { maxPrecipMm: 92, maxPrecipDate: "2026-09-27", thresholdMm: 80 }, t, d, n)[0]).toBe(
      'mon.ev.max_rain|{"value":"92","date":"D(2026-09-27)"}',
    );
    expect(evidenceLines("HEAT", { maxTempC: "chaud" }, t, d, n)).toEqual([]);
    expect(evidenceLines("INCONNU", { a: 1 }, t, d, n)).toEqual([]);
  });

  it("récolte en retard vs à venir", () => {
    expect(evidenceLines("HARVEST_WINDOW", { daysToHarvest: -3 }, t, d, n)).toEqual(['mon.ev.harvest_late|{"value":3}']);
    expect(evidenceLines("HARVEST_WINDOW", { daysToHarvest: 6 }, t, d, n)).toEqual(['mon.ev.harvest_in|{"value":6}']);
  });

  it("parseEvidence n'accepte qu'un objet de nombres et chaînes", () => {
    expect(parseEvidence({ evidence: { a: 1, b: "x", c: { z: 1 }, d: null } })).toEqual({ a: 1, b: "x" });
    expect(parseEvidence(null)).toBeNull();
    expect(parseEvidence({ evidence: [1] })).toBeNull();
    expect(parseEvidence("x")).toBeNull();
  });
});

describe("sniffAudioUpload", () => {
  const pad = (head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)]);
  it("reconnaît webm, ogg, wav, mp3, mp4", () => {
    expect(sniffAudioUpload(pad([0x1a, 0x45, 0xdf, 0xa3]))).toBe("audio/webm");
    expect(sniffAudioUpload(pad([0x4f, 0x67, 0x67, 0x53]))).toBe("audio/ogg");
    expect(sniffAudioUpload(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBe("audio/wav");
    expect(sniffAudioUpload(pad([0x49, 0x44, 0x33]))).toBe("audio/mpeg");
    expect(sniffAudioUpload(pad([0xff, 0xfb]))).toBe("audio/mpeg");
    expect(sniffAudioUpload(pad([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe("audio/mp4");
  });
  it("refuse un fichier non audio ou trop court", () => {
    expect(sniffAudioUpload(pad([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(sniffAudioUpload(new Uint8Array([0x1a, 0x45]))).toBeNull();
  });
});
