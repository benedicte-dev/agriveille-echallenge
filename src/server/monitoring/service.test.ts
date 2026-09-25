import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, publishAlert, audit, tr } = vi.hoisted(() => ({
  prismaMock: {
    parcel: { findUnique: vi.fn(), findMany: vi.fn() },
    weatherSnapshot: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    pest: { findMany: vi.fn() },
    alert: { findMany: vi.fn(), findUnique: vi.fn() },
  },
  publishAlert: vi.fn(),
  audit: vi.fn(),
  tr: { translateTexts: vi.fn(), fillMissingTranslations: vi.fn(), applyTranslations: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/server/alerts/deliver", () => ({ publishAlert }));
vi.mock("@/lib/security/audit", () => ({ audit }));
vi.mock("./translate", async () => {
  const actual = await vi.importActual<typeof import("./translate")>("./translate");
  return { ...actual, ...tr };
});

import { ParcelNotFoundError, analyzeParcel, refreshParcel, runMonitoring, type WeatherResult } from "./service";
import type { Forecast } from "@/lib/monitoring";

const NOW = new Date("2026-09-25T08:00:00Z"); // 09:00 au Bénin
const DATES = ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];

function forecast(over: Partial<{ precip: number[]; tmax: number[] }> = {}): Forecast {
  return {
    lat: 7.19,
    lon: 2.07,
    fetchedAt: NOW.toISOString(),
    days: DATES.map((date, i) => ({
      date,
      tmax: over.tmax?.[i] ?? 31,
      tmin: 23,
      precipMm: over.precip?.[i] ?? 5,
      humidityMean: 50,
      windMaxKmh: 15,
      et0Mm: 3,
    })),
  };
}

/** Réponse Open-Meteo brute équivalente. */
function openMeteoBody(f: Forecast) {
  return {
    daily: {
      time: f.days.map((d) => d.date),
      temperature_2m_max: f.days.map((d) => d.tmax),
      temperature_2m_min: f.days.map((d) => d.tmin),
      precipitation_sum: f.days.map((d) => d.precipMm),
      relative_humidity_2m_mean: f.days.map((d) => d.humidityMean),
      wind_speed_10m_max: f.days.map((d) => d.windMaxKmh),
      et0_fao_evapotranspiration: f.days.map((d) => d.et0Mm),
    },
  };
}

const okFetch = (f: Forecast) =>
  vi.fn(async () => new Response(JSON.stringify(openMeteoBody(f)), { status: 200 })) as unknown as typeof fetch;
const failingFetch = () => vi.fn(async () => new Response("oops", { status: 502 })) as unknown as typeof fetch;

const PARCEL_ROW = {
  id: "cparcel000000001",
  ownerId: "cowner0000000001",
  communeId: "ccommune00000001",
  lat: 7.19,
  lon: 2.07,
  owner: { role: "FARMER", isActive: true },
  plantings: [
    {
      id: "cplant000000001",
      parcelId: "cparcel000000001",
      cropId: "ccropmais0000001",
      status: "GROWING",
      sowingDate: new Date("2026-08-10T00:00:00Z"),
      expectedHarvestDate: new Date("2026-11-20T00:00:00Z"),
      crop: { slug: "mais", nameFr: "maïs", sowingMonths: [4, 5, 8] },
    },
  ],
};

/** Traduction groupée simulée : tout est traduit. */
function allTranslated(texts: string[]) {
  return new Map(texts.map((t) => [t.trim(), { fon: `fon:${t}`, yo: `yo:${t}` }]));
}

beforeEach(() => {
  vi.clearAllMocks();
  tr.translateTexts.mockImplementation(async (texts: string[]) => allTranslated(texts));
  tr.fillMissingTranslations.mockResolvedValue(0);
  tr.applyTranslations.mockResolvedValue(1);
  prismaMock.alert.findUnique.mockResolvedValue({ id: "row" });
  prismaMock.parcel.findUnique.mockImplementation(async (args: { select?: { owner?: unknown } }) =>
    args.select?.owner ? PARCEL_ROW : { id: PARCEL_ROW.id, lat: PARCEL_ROW.lat, lon: PARCEL_ROW.lon },
  );
  prismaMock.weatherSnapshot.findFirst.mockResolvedValue(null);
  prismaMock.weatherSnapshot.create.mockResolvedValue({ id: "csnap" });
  prismaMock.weatherSnapshot.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.pest.findMany.mockResolvedValue([]);
  prismaMock.alert.findMany.mockResolvedValue([]);
  publishAlert.mockImplementation(async (input: { dedupKey: string }) => ({
    alertId: `alert-${input.dedupKey}`,
    created: true,
    deliveries: 1,
    sms: 1,
  }));
});

describe("refreshParcel", () => {
  it("sert le snapshot en cache s'il n'a pas expiré, sans appel réseau", async () => {
    const f = forecast();
    prismaMock.weatherSnapshot.findFirst.mockResolvedValue({
      id: "s1",
      fetchedAt: new Date(NOW.getTime() - 60 * 60_000),
      expiresAt: new Date(NOW.getTime() + 2 * 60 * 60_000),
      payload: f,
    });
    const fetchImpl = okFetch(f);
    const r = await refreshParcel(PARCEL_ROW.id, { now: NOW, fetchImpl });
    expect(r.fromCache).toBe(true);
    expect(r.stale).toBe(false);
    expect(r.forecast?.days).toHaveLength(7);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("interroge Open-Meteo et enregistre un snapshot de 3 h si le cache a expiré", async () => {
    prismaMock.weatherSnapshot.findFirst.mockResolvedValue({
      id: "s1",
      fetchedAt: new Date(NOW.getTime() - 4 * 60 * 60_000),
      expiresAt: new Date(NOW.getTime() - 60 * 60_000),
      payload: forecast(),
    });
    const fetchImpl = okFetch(forecast({ precip: [0, 0, 0, 0, 0, 0, 0] }));
    const r = await refreshParcel(PARCEL_ROW.id, { now: NOW, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(r.fromCache).toBe(false);
    const data = prismaMock.weatherSnapshot.create.mock.calls[0][0].data;
    expect(data.parcelId).toBe(PARCEL_ROW.id);
    expect(data.expiresAt.getTime() - NOW.getTime()).toBe(3 * 60 * 60_000);
    expect(data.payload.days[0].precipMm).toBe(0);
  });

  it("force l'appel, sauf si le snapshot a moins de 5 minutes", async () => {
    const fetchImpl = okFetch(forecast());
    prismaMock.weatherSnapshot.findFirst.mockResolvedValue({
      id: "s1",
      fetchedAt: new Date(NOW.getTime() - 2 * 60_000),
      expiresAt: new Date(NOW.getTime() + 3 * 60 * 60_000),
      payload: forecast(),
    });
    await refreshParcel(PARCEL_ROW.id, { now: NOW, fetchImpl, force: true });
    expect(fetchImpl).not.toHaveBeenCalled();

    prismaMock.weatherSnapshot.findFirst.mockResolvedValue({
      id: "s1",
      fetchedAt: new Date(NOW.getTime() - 30 * 60_000),
      expiresAt: new Date(NOW.getTime() + 2 * 60 * 60_000),
      payload: forecast(),
    });
    await refreshParcel(PARCEL_ROW.id, { now: NOW, fetchImpl, force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("garde le dernier snapshot et le signale si Open-Meteo échoue", async () => {
    const old = new Date(NOW.getTime() - 26 * 60 * 60_000);
    prismaMock.weatherSnapshot.findFirst.mockResolvedValue({
      id: "s1",
      fetchedAt: old,
      expiresAt: new Date(old.getTime() + 3 * 60 * 60_000),
      payload: forecast(),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await refreshParcel(PARCEL_ROW.id, { now: NOW, fetchImpl: failingFetch() });
    warn.mockRestore();
    expect(r.stale).toBe(true);
    expect(r.error).toBe("http");
    expect(r.fetchedAt).toEqual(old);
    expect(r.forecast?.days).toHaveLength(7);
    expect(prismaMock.weatherSnapshot.create).not.toHaveBeenCalled();
  });

  it("renvoie forecast null si Open-Meteo échoue sans aucun snapshot", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await refreshParcel(PARCEL_ROW.id, { now: NOW, fetchImpl: failingFetch() });
    warn.mockRestore();
    expect(r.forecast).toBeNull();
    expect(r.stale).toBe(false);
    expect(r.error).toBe("http");
  });

  it("lève ParcelNotFoundError pour une parcelle inconnue", async () => {
    prismaMock.parcel.findUnique.mockResolvedValue(null);
    await expect(refreshParcel("cinconnue000001", { now: NOW })).rejects.toBeInstanceOf(ParcelNotFoundError);
  });
});

describe("analyzeParcel", () => {
  const weather = (f: Forecast): WeatherResult => ({ forecast: f, fetchedAt: NOW, fromCache: true, stale: false });

  it("publie une alerte CRITICAL au propriétaire, source AUTO_WEATHER, validUntil de la candidate", async () => {
    const r = await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ precip: [5, 5, 92, 5, 5, 5, 5] })) });
    expect(publishAlert).toHaveBeenCalledTimes(1);
    const input = publishAlert.mock.calls[0][0];
    expect(input).toMatchObject({
      type: "HEAVY_RAIN",
      severity: "CRITICAL",
      source: "AUTO_WEATHER",
      parcelId: PARCEL_ROW.id,
      communeId: PARCEL_ROW.communeId,
      recipientIds: [PARCEL_ROW.ownerId],
      dedupKey: `HEAVY_RAIN:${PARCEL_ROW.id}:2026-09-27`,
    });
    // Fin du 27 septembre, heure du Bénin (UTC+1).
    expect(input.validUntil.toISOString()).toBe("2026-09-27T22:59:59.999Z");
    expect(r).toMatchObject({ candidates: 1, created: 1, skipped: 0, deliveries: 1 });
    expect(audit).toHaveBeenCalledWith(
      null,
      "monitoring.alert.create",
      "Alert",
      input.dedupKey.replace(/^/, "alert-"),
      expect.objectContaining({ evidence: expect.objectContaining({ maxPrecipMm: 92 }) }),
      null,
    );
  });

  it("traduit en un lot et publie avec translate:true quand tout est en cache", async () => {
    await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ tmax: [39, 31, 31, 31, 31, 31, 31] })) });
    expect(tr.translateTexts).toHaveBeenCalledTimes(1);
    const texts = tr.translateTexts.mock.calls[0][0] as string[];
    expect(texts).toHaveLength(3);
    expect(publishAlert.mock.calls[0][0].translate).toBe(true);
    expect(tr.applyTranslations).not.toHaveBeenCalled();
  });

  it("repli fr sans appel unitaire si la traduction groupée échoue, puis complète ce qui existe", async () => {
    tr.translateTexts.mockResolvedValue(new Map());
    await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ tmax: [39, 31, 31, 31, 31, 31, 31] })) });
    expect(publishAlert.mock.calls[0][0].translate).toBe(false);
    expect(tr.applyTranslations).toHaveBeenCalledTimes(1);
  });

  it("ne retraduit pas une candidate dont la dedupKey existe déjà", async () => {
    prismaMock.alert.findMany.mockImplementation(async (args: { where: { dedupKey?: unknown } }) =>
      args.where.dedupKey ? [{ dedupKey: `HEAT:${PARCEL_ROW.id}:2026-09-25` }] : [],
    );
    publishAlert.mockResolvedValue({ alertId: "a1", created: false, deliveries: 0, sms: 0 });
    await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ tmax: [39, 31, 31, 31, 31, 31, 31] })) });
    expect(tr.translateTexts.mock.calls[0][0]).toEqual([]);
    expect(tr.fillMissingTranslations).toHaveBeenCalledWith(expect.objectContaining({ parcelId: PARCEL_ROW.id }));
  });

  it("n'émet rien si une alerte équivalente est encore active (pas de doublon)", async () => {
    prismaMock.alert.findMany.mockResolvedValueOnce([
      {
        type: "HEAVY_RAIN",
        parcelId: PARCEL_ROW.id,
        pestId: null,
        severity: "CRITICAL",
        validUntil: new Date(NOW.getTime() + 24 * 60 * 60_000),
      },
    ]);
    const r = await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ precip: [5, 5, 92, 5, 5, 5, 5] })) });
    expect(publishAlert).not.toHaveBeenCalled();
    expect(r).toMatchObject({ candidates: 1, created: 0, skipped: 1 });
  });

  it("compte comme doublon une candidate dont la dedupKey existe déjà", async () => {
    publishAlert.mockResolvedValue({ alertId: "a1", created: false, deliveries: 0, sms: 0 });
    const r = await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ tmax: [39, 31, 31, 31, 31, 31, 31] })) });
    expect(r).toMatchObject({ created: 0, skipped: 1 });
    expect(audit).not.toHaveBeenCalled();
  });

  it("ne livre à personne si le propriétaire est désactivé", async () => {
    prismaMock.parcel.findUnique.mockResolvedValue({ ...PARCEL_ROW, owner: { role: "FARMER", isActive: false } });
    await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast({ tmax: [41, 31, 31, 31, 31, 31, 31] })) });
    expect(publishAlert.mock.calls[0][0].recipientIds).toEqual([]);
  });

  it("transmet les ravageurs des cultures au moteur (PEST_RISK)", async () => {
    prismaMock.pest.findMany.mockResolvedValue([
      {
        id: "cpest00000000001",
        slug: "chenille-legionnaire",
        nameFr: "chenille légionnaire",
        kind: "PEST",
        riskTempMin: 20,
        riskTempMax: 32,
        riskHumidityMin: 40,
        preventionFr: "Inspectez les cornets.",
        crops: [{ slug: "mais" }],
      },
    ]);
    await analyzeParcel(PARCEL_ROW.id, { now: NOW, weather: weather(forecast()) });
    const input = publishAlert.mock.calls.find((c) => c[0].type === "PEST_RISK")?.[0];
    expect(input).toMatchObject({ pestId: "cpest00000000001", severity: "WARNING" });
    expect(prismaMock.pest.findMany.mock.calls[0][0].where).toEqual({ crops: { some: { id: { in: ["ccropmais0000001"] } } } });
  });

  it("n'analyse pas sans météo", async () => {
    const r = await analyzeParcel(PARCEL_ROW.id, {
      now: NOW,
      weather: { forecast: null, fetchedAt: null, fromCache: false, stale: false, error: "timeout" },
    });
    expect(r.candidates).toBe(0);
    expect(publishAlert).not.toHaveBeenCalled();
  });
});

describe("runMonitoring", () => {
  it("analyse les parcelles éligibles et agrège le rapport, erreurs comprises", async () => {
    prismaMock.parcel.findMany.mockResolvedValue([{ id: PARCEL_ROW.id }, { id: "cparcelgone00001" }]);
    prismaMock.parcel.findUnique.mockImplementation(async (args: { where: { id: string }; select?: { owner?: unknown } }) => {
      if (args.where.id !== PARCEL_ROW.id) return null;
      return args.select?.owner ? PARCEL_ROW : { id: PARCEL_ROW.id, lat: 7.19, lon: 2.07 };
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await runMonitoring({ now: NOW, fetchImpl: okFetch(forecast({ precip: [0, 0, 55, 0, 0, 0, 0] })) });
    err.mockRestore();
    expect(prismaMock.parcel.findMany.mock.calls[0][0].where).toEqual({
      plantings: { some: { status: { in: ["PLANNED", "GROWING"] } } },
    });
    expect(report).toMatchObject({ parcels: 2, analyzed: 1, alertsCreated: 1, deliveries: 1, deferred: 0 });
    expect(report.errors).toEqual([{ parcelId: "cparcelgone00001", reason: "ParcelNotFoundError" }]);
  });

  it("filtre par commune, borne la liste et diffère les parcelles hors budget", async () => {
    prismaMock.parcel.findMany.mockResolvedValue([{ id: PARCEL_ROW.id }]);
    const report = await runMonitoring({ now: NOW, communeId: "ccommune00000001", limit: 10_000, budgetMs: -1 });
    const args = prismaMock.parcel.findMany.mock.calls[0][0];
    expect(args.where.communeId).toBe("ccommune00000001");
    expect(args.take).toBe(500);
    expect(report).toMatchObject({ parcels: 1, analyzed: 0, deferred: 1 });
    expect(publishAlert).not.toHaveBeenCalled();
  });

  it("compte les parcelles sans météo", async () => {
    prismaMock.parcel.findMany.mockResolvedValue([{ id: PARCEL_ROW.id }]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const report = await runMonitoring({ now: NOW, fetchImpl: failingFetch() });
    warn.mockRestore();
    expect(report).toMatchObject({ analyzed: 0, noWeather: 1 });
    expect(report.errors[0].reason).toBe("weather:http");
  });
});
