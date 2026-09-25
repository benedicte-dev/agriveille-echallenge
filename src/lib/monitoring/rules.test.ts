import { describe, expect, it } from 'vitest';
import bohicon from './__fixtures__/open-meteo-bohicon.json';
import { parseOpenMeteoResponse } from './open-meteo';
import { THRESHOLDS, evaluate, filterAlreadyActive, firstDryRun, isFavourableDay } from './rules';
import type { CandidateAlert, DailyForecast, Forecast, PestInput, PlantingInput } from './types';

const TODAY = '2026-09-25';
const DATES = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];

/** Journée « neutre » : ne déclenche aucune règle météo. */
function day(i: number, over: Partial<DailyForecast> = {}): DailyForecast {
  return { date: DATES[i], tmax: 31, tmin: 23, precipMm: 3, humidityMean: 70, windMaxKmh: 15, et0Mm: 3, ...over };
}
function forecast(overs: Array<Partial<DailyForecast>> = []): Forecast {
  return {
    lat: 7.178,
    lon: 2.067,
    fetchedAt: '2026-09-25T06:00:00.000Z',
    days: DATES.map((_, i) => day(i, overs[i] ?? {})),
  };
}
function planting(over: Partial<PlantingInput> = {}): PlantingInput {
  return {
    plantingId: 'pl1',
    parcelId: 'p1',
    cropSlug: 'mais',
    cropName: 'maïs',
    status: 'GROWING',
    sowingDate: '2026-08-01',
    expectedHarvestDate: '2026-11-15',
    sowingMonths: [4, 5, 9],
    ...over,
  };
}
const faw: PestInput = {
  pestId: 'pest-faw',
  slug: 'chenille-legionnaire',
  nameFr: "la chenille légionnaire d'automne",
  kind: 'PEST',
  cropSlugs: ['mais', 'sorgho'],
  riskTempMin: 24,
  riskTempMax: 32,
  riskHumidityMin: 70,
  preventionFr: 'Retirez les œufs et les jeunes chenilles à la main.',
};
const mildiou: PestInput = {
  pestId: 'pest-mildiou',
  slug: 'mildiou',
  nameFr: 'le mildiou',
  kind: 'DISEASE',
  cropSlugs: ['tomate'],
  riskTempMin: 15,
  riskTempMax: 25,
  riskHumidityMin: 85,
};

function only(alerts: CandidateAlert[], type: CandidateAlert['type']) {
  return alerts.filter((a) => a.type === type);
}
function run(f: Forecast, plantings: PlantingInput[] = [planting()], pests: PestInput[] = [], today = TODAY) {
  return evaluate({ forecast: f, plantings, pests, today });
}

describe('baseline', () => {
  it('neutral weather produces no alert', () => {
    expect(run(forecast())).toEqual([]);
  });
  it('stale forecast (all days before today) produces no alert', () => {
    expect(run(forecast([{ precipMm: 120 }]), [planting()], [], '2026-10-05')).toEqual([]);
  });
});

describe('DROUGHT', () => {
  const dry = (rainDay0: number, et0 = 3.6) =>
    forecast(DATES.map((_, i) => ({ precipMm: i === 0 ? rainDay0 : 0, et0Mm: et0 })));

  it('WARNING when rain < 10 mm and ET0 > 25 mm on a GROWING crop', () => {
    const [a] = only(run(dry(9.9)), 'DROUGHT');
    expect(a.severity).toBe('WARNING');
    expect(a.evidence.rainTotalMm).toBe(9.9);
    expect(a.evidence.et0TotalMm).toBe(25.2);
    expect(a.dedupKey).toBe('DROUGHT:p1:2026-09-25');
    expect(a.messageFr).toContain('maïs');
    expect(a.adviceFr).toContain('Paillez le sol et arrosez tôt le matin');
  });
  it('not triggered at exactly 10 mm (strict <)', () => {
    expect(only(run(dry(10)), 'DROUGHT')).toHaveLength(0);
  });
  it('not triggered when ET0 is exactly 25 mm (strict >)', () => {
    const f = forecast(DATES.map((_, i) => ({ precipMm: 0, et0Mm: i < 5 ? 5 : 0 })));
    expect(only(run(f), 'DROUGHT')).toHaveLength(0);
  });
  it('CRITICAL below 3 mm, WARNING at exactly 3 mm', () => {
    expect(only(run(dry(2.9)), 'DROUGHT')[0].severity).toBe('CRITICAL');
    expect(only(run(dry(3)), 'DROUGHT')[0].severity).toBe('WARNING');
  });
  it('requires a GROWING crop', () => {
    expect(only(run(dry(0), [planting({ status: 'PLANNED' })]), 'DROUGHT')).toHaveLength(0);
    expect(only(run(dry(0), [planting({ status: 'HARVESTED' })]), 'DROUGHT')).toHaveLength(0);
  });
  it('skipped when fewer than minDays of forecast remain', () => {
    const f = dry(0, 8);
    const today = DATES[7 - THRESHOLDS.DROUGHT.minDays + 1]; // 4 jours restants
    expect(only(run(f, [planting()], [], today), 'DROUGHT')).toHaveLength(0);
  });
});

describe('HEAVY_RAIN', () => {
  it('not triggered at 49.9 mm', () => {
    expect(only(run(forecast([{}, { precipMm: 49.9 }])), 'HEAVY_RAIN')).toHaveLength(0);
  });
  it('WARNING at exactly 50 mm', () => {
    const [a] = only(run(forecast([{}, { precipMm: 50 }])), 'HEAVY_RAIN');
    expect(a.severity).toBe('WARNING');
    expect(a.dedupKey).toBe('HEAVY_RAIN:p1:2026-09-26');
    expect(a.evidence).toMatchObject({ maxPrecipMm: 50, maxPrecipDate: '2026-09-26', heavyDays: 1 });
  });
  it('CRITICAL at exactly 80 mm, keeps highest severity across days, single alert', () => {
    const alerts = only(run(forecast([{}, { precipMm: 55 }, {}, { precipMm: 80 }])), 'HEAVY_RAIN');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(alerts[0].evidence.heavyDays).toBe(2);
    expect(alerts[0].dedupKey).toBe('HEAVY_RAIN:p1:2026-09-26');
    expect(alerts[0].validFrom.toISOString()).toBe('2026-09-25T23:00:00.000Z');
    expect(alerts[0].validUntil.toISOString()).toBe('2026-09-28T22:59:59.999Z');
  });
  it('emitted for a parcel without planting when listed in parcelIds', () => {
    const alerts = evaluate({ forecast: forecast([{ precipMm: 60 }]), plantings: [], pests: [], today: TODAY, parcelIds: ['empty'] });
    expect(alerts.map((a) => a.dedupKey)).toEqual(['HEAVY_RAIN:empty:2026-09-25']);
  });
});

describe('HEAT', () => {
  it('not triggered at 37.9 °C', () => {
    expect(only(run(forecast([{ tmax: 37.9 }])), 'HEAT')).toHaveLength(0);
  });
  it('WARNING at exactly 38 °C', () => {
    expect(only(run(forecast([{ tmax: 38 }])), 'HEAT')[0].severity).toBe('WARNING');
  });
  it('CRITICAL at exactly 40 °C', () => {
    const [a] = only(run(forecast([{ tmax: 38.5 }, { tmax: 40 }])), 'HEAT');
    expect(a.severity).toBe('CRITICAL');
    expect(a.evidence).toMatchObject({ maxTempC: 40, maxTempDate: '2026-09-26', hotDays: 2 });
    expect(a.messageFr).toContain('40 degrés');
  });
});

describe('WIND', () => {
  it('not triggered at 49.9 km/h', () => {
    expect(only(run(forecast([{ windMaxKmh: 49.9 }])), 'WIND')).toHaveLength(0);
  });
  it('WARNING at exactly 50 km/h', () => {
    const [a] = only(run(forecast([{}, {}, { windMaxKmh: 50 }, { windMaxKmh: 62.4 }])), 'WIND');
    expect(a.severity).toBe('WARNING');
    expect(a.evidence).toMatchObject({ maxWindKmh: 62.4, windyDays: 2 });
    expect(a.dedupKey).toBe('WIND:p1:2026-09-27');
  });
});

describe('PEST_RISK', () => {
  // (tmax+tmin)/2 = 27 °C, humidité 80 % → favorable à la chenille légionnaire.
  const warmHumid = { tmax: 31, tmin: 23, humidityMean: 80 };

  it('WARNING with 3 favourable days in window, names pest, crop and prevention', () => {
    const f = forecast([{}, warmHumid, {}, warmHumid, warmHumid]);
    const [a] = only(run(f, [planting()], [faw]), 'PEST_RISK');
    expect(a.severity).toBe('WARNING');
    expect(a.pestId).toBe('pest-faw');
    expect(a.dedupKey).toBe('PEST_RISK:p1:pest-faw:2026-09-26');
    expect(a.titleFr).toContain("chenille légionnaire d'automne");
    expect(a.messageFr).toContain("chenille légionnaire d'automne");
    expect(a.messageFr).toContain('maïs');
    expect(a.adviceFr).toContain('Retirez les œufs');
    expect(a.evidence).toMatchObject({ favourableDays: 3, firstFavourableDate: '2026-09-26', riskHumidityMin: 70 });
    expect(a.validUntil.toISOString()).toBe('2026-09-29T22:59:59.999Z');
  });
  it('not triggered with only 2 favourable days', () => {
    const f = forecast([{}, warmHumid, {}, warmHumid]);
    expect(only(run(f, [planting()], [faw]), 'PEST_RISK')).toHaveLength(0);
  });
  it('humidity boundary is inclusive (exactly 70 % counts, 69.9 % does not)', () => {
    const at = { ...warmHumid, humidityMean: 70 };
    const below = { ...warmHumid, humidityMean: 69.9 };
    expect(only(run(forecast([at, at, at]), [planting()], [faw]), 'PEST_RISK')).toHaveLength(1);
    expect(only(run(forecast([below, below, below]), [planting()], [faw]), 'PEST_RISK')).toHaveLength(0);
  });
  it('temperature window bounds are inclusive on mean temperature', () => {
    const d = { date: '2026-09-25', precipMm: 0, windMaxKmh: 0, et0Mm: 0, humidityMean: 90 };
    expect(isFavourableDay({ ...d, tmax: 36, tmin: 28 }, faw)).toBe(true); // 32
    expect(isFavourableDay({ ...d, tmax: 36.2, tmin: 28 }, faw)).toBe(false); // 32.1
    expect(isFavourableDay({ ...d, tmax: 28, tmin: 20 }, faw)).toBe(true); // 24
    expect(isFavourableDay({ ...d, tmax: 27.8, tmin: 20 }, faw)).toBe(false); // 23.9
  });
  it('only counts days inside the 7-day window starting today', () => {
    // Deux jours favorables avant "today" ne comptent pas.
    const f = forecast([warmHumid, warmHumid, {}, warmHumid, warmHumid]);
    expect(only(run(f, [planting()], [faw], '2026-09-27'), 'PEST_RISK')).toHaveLength(0);
    expect(only(run(f, [planting()], [faw], '2026-09-25'), 'PEST_RISK')).toHaveLength(1);
  });
  it('requires a GROWING host crop', () => {
    const f = forecast([warmHumid, warmHumid, warmHumid]);
    expect(only(run(f, [planting({ cropSlug: 'manioc', cropName: 'manioc' })], [faw]), 'PEST_RISK')).toHaveLength(0);
    expect(only(run(f, [planting({ status: 'PLANNED' })], [faw]), 'PEST_RISK')).toHaveLength(0);
  });
  it('mildiou on tomato with default disease advice', () => {
    const cool = { tmax: 26, tmin: 20, humidityMean: 90 };
    const f = forecast([cool, cool, cool]);
    const [a] = only(run(f, [planting({ cropSlug: 'tomate', cropName: 'tomate' })], [mildiou, faw]), 'PEST_RISK');
    expect(a.pestId).toBe('pest-mildiou');
    expect(a.messageFr).toContain('le mildiou');
    expect(a.messageFr).toContain('tomate');
    expect(a.adviceFr).toContain('Retirez les feuilles malades');
  });
  it('pest without climate data or with incoherent bounds is ignored', () => {
    const f = forecast([warmHumid, warmHumid, warmHumid]);
    const noModel: PestInput = { ...faw, pestId: 'x', riskTempMin: null, riskTempMax: null, riskHumidityMin: null };
    const bad: PestInput = { ...faw, pestId: 'y', riskTempMin: 30, riskTempMax: 20 };
    expect(only(run(f, [planting()], [noModel, bad]), 'PEST_RISK')).toHaveLength(0);
  });
  it('one alert per (parcel, pest) even with two host crops', () => {
    const f = forecast([warmHumid, warmHumid, warmHumid]);
    const alerts = only(
      run(f, [planting(), planting({ plantingId: 'pl2', cropSlug: 'sorgho', cropName: 'sorgho' })], [faw]),
      'PEST_RISK',
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].messageFr).toContain('maïs et sorgho');
  });
});

describe('SOWING_WINDOW', () => {
  const wet = forecast([{ precipMm: 12 }, { precipMm: 8 }, { precipMm: 0 }, { precipMm: 0 }, { precipMm: 0 }, { precipMm: 0 }, { precipMm: 0 }]);
  const planned = planting({ status: 'PLANNED', sowingMonths: [9, 10] });

  it('INFO when month is a sowing month and ≥ 20 mm forecast (boundary inclusive)', () => {
    const [a] = only(run(wet, [planned]), 'SOWING_WINDOW');
    expect(a.severity).toBe('INFO');
    expect(a.titleFr).toBe('Bon moment pour semer');
    expect(a.evidence).toMatchObject({ rainTotalMm: 20, month: 9 });
    expect(a.dedupKey).toBe('SOWING_WINDOW:p1:2026-09-25');
  });
  it('not triggered under 20 mm', () => {
    const f = forecast([{ precipMm: 12 }, { precipMm: 7.9 }, ...Array(5).fill({ precipMm: 0 })]);
    expect(only(run(f, [planned]), 'SOWING_WINDOW')).toHaveLength(0);
  });
  it('depends on the current month', () => {
    expect(only(run(wet, [planting({ status: 'PLANNED', sowingMonths: [4, 5] })]), 'SOWING_WINDOW')).toHaveLength(0);
    // Même prévision, "today" en octobre : fenêtre réduite mais mois éligible (10).
    const oct = forecast(DATES.map((_, i) => ({ precipMm: i === 6 ? 25 : 0 })));
    expect(only(run(oct, [planned], [], '2026-10-01'), 'SOWING_WINDOW')[0].evidence.month).toBe(10);
  });
  it('only for PLANNED plantings', () => {
    expect(only(run(wet, [planting({ sowingMonths: [9] })]), 'SOWING_WINDOW')).toHaveLength(0);
  });
});

describe('HARVEST_WINDOW', () => {
  const dryRun = forecast([{ precipMm: 5 }, { precipMm: 0 }, { precipMm: 0.9 }, { precipMm: 0 }, { precipMm: 6 }]);

  it('INFO when harvest in ≤ 10 days and 3 consecutive dry days', () => {
    const [a] = only(run(dryRun, [planting({ expectedHarvestDate: '2026-10-05' })]), 'HARVEST_WINDOW');
    expect(a.severity).toBe('INFO');
    expect(a.titleFr).toBe('Récoltez ces jours-là');
    expect(a.dedupKey).toBe('HARVEST_WINDOW:p1:2026-09-26');
    expect(a.evidence).toMatchObject({ dryDays: 3, dryFrom: '2026-09-26', dryUntil: '2026-09-28', daysToHarvest: 10 });
    expect(a.messageFr).toContain('samedi 26 septembre');
    expect(a.messageFr).toContain('lundi 28 septembre');
  });
  it('not triggered when harvest is 11 days away', () => {
    expect(only(run(dryRun, [planting({ expectedHarvestDate: '2026-10-06' })]), 'HARVEST_WINDOW')).toHaveLength(0);
  });
  it('accepts Prisma Date values and overdue harvests within 30 days', () => {
    const late = planting({ expectedHarvestDate: new Date('2026-08-26T00:00:00.000Z') }); // 30 j de retard
    expect(only(run(dryRun, [late]), 'HARVEST_WINDOW')).toHaveLength(1);
    const tooLate = planting({ expectedHarvestDate: new Date('2026-08-25T00:00:00.000Z') });
    expect(only(run(dryRun, [tooLate]), 'HARVEST_WINDOW')).toHaveLength(0);
  });
  it('not triggered with only 2 consecutive dry days (1 mm is not dry)', () => {
    const f = forecast([{ precipMm: 5 }, { precipMm: 0 }, { precipMm: 1 }, { precipMm: 0 }, { precipMm: 0 }, { precipMm: 4 }, { precipMm: 4 }]);
    expect(only(run(f, [planting({ expectedHarvestDate: '2026-09-30' })]), 'HARVEST_WINDOW')).toHaveLength(0);
  });
  it('not for HARVESTED plantings', () => {
    expect(
      only(run(dryRun, [planting({ status: 'HARVESTED', expectedHarvestDate: '2026-09-30' })]), 'HARVEST_WINDOW'),
    ).toHaveLength(0);
  });
  it('firstDryRun returns a run ending the window', () => {
    const days = forecast([{ precipMm: 3 }, { precipMm: 3 }, { precipMm: 3 }, { precipMm: 3 }, { precipMm: 0 }, { precipMm: 0 }, { precipMm: 0 }]).days;
    expect(firstDryRun(days, 3, 1)?.map((d) => d.date)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});

describe('deduplication, severity, determinism', () => {
  const stormy = forecast([{ precipMm: 60, windMaxKmh: 55 }, { precipMm: 90, tmax: 39 }, { tmax: 41 }]);

  it('duplicate plantings and repeated parcels do not duplicate alerts', () => {
    const p = planting();
    const alerts = evaluate({ forecast: stormy, plantings: [p, p, { ...p }], pests: [], today: TODAY, parcelIds: ['p1', 'p1'] });
    const keys = alerts.map((a) => a.dedupKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(alerts.filter((a) => a.parcelId === 'p1' && a.type === 'HEAVY_RAIN')).toHaveLength(1);
  });
  it('one alert per rule per parcel, sorted by severity', () => {
    const alerts = evaluate({
      forecast: stormy,
      plantings: [planting(), planting({ plantingId: 'pl9', parcelId: 'p2' })],
      pests: [],
      today: TODAY,
    });
    expect(alerts.map((a) => `${a.severity}:${a.dedupKey}`)).toEqual([
      'CRITICAL:HEAVY_RAIN:p1:2026-09-25',
      'CRITICAL:HEAVY_RAIN:p2:2026-09-25',
      'CRITICAL:HEAT:p1:2026-09-26',
      'CRITICAL:HEAT:p2:2026-09-26',
      'WARNING:WIND:p1:2026-09-25',
      'WARNING:WIND:p2:2026-09-25',
    ]);
  });
  it('is deterministic and does not mutate input', () => {
    const input = { forecast: stormy, plantings: [planting()], pests: [faw], today: TODAY };
    const snapshot = JSON.stringify(input);
    expect(evaluate(input)).toEqual(evaluate(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('today as Date is converted to the Benin calendar day', () => {
    // 23:30 UTC le 24 = 00:30 le 25 à Porto-Novo.
    const a = evaluate({ forecast: forecast([{ precipMm: 60 }]), plantings: [planting()], pests: [], today: new Date('2026-09-24T23:30:00Z') });
    expect(a[0].dedupKey).toBe('HEAVY_RAIN:p1:2026-09-25');
  });
  it('every alert has source AUTO_WEATHER and a key matching validFrom', () => {
    for (const a of evaluate({ forecast: stormy, plantings: [planting()], pests: [], today: TODAY })) {
      expect(a.source).toBe('AUTO_WEATHER');
      const local = new Date(a.validFrom.getTime() + 3600_000).toISOString().slice(0, 10);
      expect(a.dedupKey.endsWith(local)).toBe(true);
      expect(a.validUntil.getTime()).toBeGreaterThan(a.validFrom.getTime());
    }
  });
});

describe('filterAlreadyActive', () => {
  const now = new Date('2026-09-26T08:00:00Z');
  const drought = only(
    run(forecast(DATES.map(() => ({ precipMm: 0, et0Mm: 4 }))), [planting()], [], '2026-09-25'),
    'DROUGHT',
  );
  it('drops a candidate covered by an active alert of equal or higher severity', () => {
    const active = [{ type: 'DROUGHT', parcelId: 'p1', pestId: null, severity: 'CRITICAL' as const, validUntil: new Date('2026-09-30T00:00:00Z') }];
    expect(filterAlreadyActive(drought, active, now)).toHaveLength(0);
  });
  it('keeps escalations and alerts whose previous copy has expired', () => {
    const lower = [{ type: 'DROUGHT', parcelId: 'p1', severity: 'WARNING' as const, validUntil: new Date('2026-09-30T00:00:00Z') }];
    const expired = [{ type: 'DROUGHT', parcelId: 'p1', severity: 'CRITICAL' as const, validUntil: new Date('2026-09-26T07:59:59Z') }];
    expect(drought[0].severity).toBe('CRITICAL');
    expect(filterAlreadyActive(drought, lower, now)).toHaveLength(1);
    expect(filterAlreadyActive(drought, expired, now)).toHaveLength(1);
  });
});

describe('plain French messages', () => {
  const everything = forecast([
    { precipMm: 90, windMaxKmh: 60, tmax: 41, humidityMean: 80, tmin: 23 },
    { precipMm: 0, humidityMean: 80 },
    { precipMm: 0, humidityMean: 80 },
    { precipMm: 0, humidityMean: 80 },
  ]);
  const alerts = evaluate({
    forecast: everything,
    plantings: [
      planting({ expectedHarvestDate: '2026-09-30' }),
      planting({ plantingId: 'pl2', status: 'PLANNED', cropSlug: 'niebe', cropName: 'niébé', sowingMonths: [9] }),
    ],
    pests: [{ ...faw, preventionFr: null }],
    today: TODAY,
  });

  it('covers several rule types in one run', () => {
    expect(new Set(alerts.map((a) => a.type))).toEqual(
      new Set(['HEAVY_RAIN', 'HEAT', 'WIND', 'PEST_RISK', 'SOWING_WINDOW', 'HARVEST_WINDOW']),
    );
  });
  it('every sentence has fewer than 15 words', () => {
    for (const a of alerts) {
      for (const text of [a.titleFr, a.messageFr, a.adviceFr]) {
        for (const sentence of text.split(/(?<=[.!?])\s+/)) {
          const words = sentence.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
          expect(words.length, `${a.type}: « ${sentence} »`).toBeLessThan(15);
        }
      }
    }
  });
  it('advice is present for every alert', () => {
    for (const a of alerts) expect(a.adviceFr.length).toBeGreaterThan(10);
  });
});

describe('real Bohicon fixture (2026-09-25)', () => {
  const f = parseOpenMeteoResponse(bohicon, 7.178, 2.067, new Date('2026-09-25T13:13:00Z'));
  it('rainy season forecast: sowing window for PLANNED maize in September, no weather hazard', () => {
    const alerts = evaluate({
      forecast: f,
      today: '2026-09-25',
      plantings: [
        planting({ plantingId: 'a', parcelId: 'bohicon-1', status: 'PLANNED', sowingMonths: [3, 4, 8, 9] }),
        planting({ plantingId: 'b', parcelId: 'bohicon-2', cropSlug: 'mais', cropName: 'maïs' }),
      ],
      pests: [faw],
    });
    expect(alerts.map((a) => a.dedupKey)).toEqual([
      'PEST_RISK:bohicon-2:pest-faw:2026-09-25',
      'SOWING_WINDOW:bohicon-1:2026-09-25',
    ]);
    expect(only(alerts, 'SOWING_WINDOW')[0].evidence.rainTotalMm).toBe(57.6);
  });
});
