import { describe, expect, it } from 'vitest';
import bohicon from './__fixtures__/open-meteo-bohicon.json';
import { endOfBeninDay, formatDayFr, startOfBeninDay, toBeninDate, todayInBenin } from './dates';
import { parseOpenMeteoResponse } from './open-meteo';
import { summarizeForecast } from './summary';
import type { Forecast } from './types';

function fc(rain: number[], tmax: number[] = rain.map(() => 30), hum: number[] = rain.map(() => 70)): Forecast {
  return {
    lat: 7,
    lon: 2,
    fetchedAt: '2026-09-25T00:00:00.000Z',
    days: rain.map((p, i) => ({
      date: `2026-09-${String(25 + i).padStart(2, '0')}`,
      tmax: tmax[i],
      tmin: 22,
      precipMm: p,
      humidityMean: hum[i],
      windMaxKmh: 10,
      et0Mm: 4,
    })),
  };
}

describe('summarizeForecast', () => {
  it('summarises the real Bohicon fixture', () => {
    const s = summarizeForecast(parseOpenMeteoResponse(bohicon, 7.178, 2.067));
    expect(s).toMatchObject({
      days: 7,
      firstDate: '2026-09-25',
      lastDate: '2026-10-01',
      rainTotalMm: 57.6,
      et0TotalMm: 22.1,
      waterBalanceMm: 35.5,
      maxConsecutiveDryDays: 0,
      dryDays: 0,
      tmaxMax: 30,
      tmaxMaxDate: '2026-09-25',
      tminMin: 22,
      bestHarvestDay: '2026-10-01',
      bestSowingDay: '2026-09-28',
    });
  });
  it('counts consecutive dry days (< 1 mm) and picks the driest, least humid day', () => {
    const s = summarizeForecast(fc([0, 0.5, 2, 0, 0, 0, 1], [30, 32, 35, 33, 31, 30, 29], [80, 60, 70, 55, 65, 70, 70]));
    expect(s.maxConsecutiveDryDays).toBe(3);
    expect(s.dryDays).toBe(5);
    expect(s.tmaxMax).toBe(35);
    expect(s.tmaxMaxDate).toBe('2026-09-27');
    expect(s.bestHarvestDay).toBe('2026-09-28'); // 0 mm et 55 %
    expect(s.bestSowingDay).toBeNull();
  });
  it('best sowing day follows a useful rain but not during a violent one', () => {
    expect(summarizeForecast(fc([0, 12, 60, 3, 0, 0, 0])).bestSowingDay).toBe('2026-09-28');
    expect(summarizeForecast(fc([0, 10, 2, 0, 0, 0, 0])).bestSowingDay).toBe('2026-09-27');
  });
  it('handles an empty forecast', () => {
    const s = summarizeForecast({ lat: 0, lon: 0, fetchedAt: '2026-09-25T00:00:00.000Z', days: [] });
    expect(s.days).toBe(0);
    expect(s.tmaxMax).toBeNull();
    expect(s.bestHarvestDay).toBeNull();
  });
  it('limits to 7 days', () => {
    expect(summarizeForecast(fc([1, 1, 1, 1, 1, 1, 1, 50])).rainTotalMm).toBe(7);
  });
});

describe('dates (Africa/Porto-Novo, UTC+1)', () => {
  it('converts instants to Benin calendar days', () => {
    expect(todayInBenin(new Date('2026-09-24T22:59:59Z'))).toBe('2026-09-24');
    expect(todayInBenin(new Date('2026-09-24T23:00:00Z'))).toBe('2026-09-25');
    expect(toBeninDate('2026-09-25')).toBe('2026-09-25');
    expect(toBeninDate('2026-09-25T23:30:00Z')).toBe('2026-09-26');
  });
  it('day bounds', () => {
    expect(startOfBeninDay('2026-09-25').toISOString()).toBe('2026-09-24T23:00:00.000Z');
    expect(endOfBeninDay('2026-09-25').toISOString()).toBe('2026-09-25T22:59:59.999Z');
    expect(() => startOfBeninDay('2026-02-30')).toThrow(RangeError);
  });
  it('French spoken dates', () => {
    expect(formatDayFr('2026-09-25')).toBe('vendredi 25 septembre');
    expect(formatDayFr('2026-10-01')).toBe('jeudi 1er octobre');
  });
});
