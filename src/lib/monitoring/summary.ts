/**
 * Résumé d'une prévision pour l'affichage (page parcelle, SMS). Fonction pure.
 */
import { THRESHOLDS } from './rules';
import type { DailyForecast, Forecast } from './types';

/** Pluie « utile » la veille d'un semis : le sol est humide sur plusieurs centimètres. */
export const SOWING_USEFUL_RAIN_MM = 10;

export interface ForecastSummary {
  days: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Cumul de pluie sur la période (7 jours au plus), en mm, arrondi à 0,1. */
  rainTotalMm: number;
  /** Cumul d'ET0, en mm. */
  et0TotalMm: number;
  /** Bilan hydrique simple : pluie − ET0, en mm. Négatif = le sol s'assèche. */
  waterBalanceMm: number;
  /** Plus longue série de jours secs consécutifs (< 1 mm). */
  maxConsecutiveDryDays: number;
  /** Nombre total de jours secs. */
  dryDays: number;
  tmaxMax: number | null;
  tmaxMaxDate: string | null;
  tminMin: number | null;
  /** Jour le plus favorable à la récolte : le plus sec, puis le moins humide, puis le plus tôt. */
  bestHarvestDay: string | null;
  /**
   * Jour conseillé pour semer : le premier jour qui suit une pluie ≥ 10 mm,
   * sans pluie violente ce jour-là. `null` si aucune pluie utile n'est prévue.
   */
  bestSowingDay: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeForecast(forecast: Forecast, maxDays: number = THRESHOLDS.windowDays): ForecastSummary {
  const days: DailyForecast[] = [...forecast.days]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, maxDays);
  const dryMax = THRESHOLDS.HARVEST_WINDOW.dryDayMaxMm;

  if (days.length === 0) {
    return {
      days: 0, firstDate: null, lastDate: null, rainTotalMm: 0, et0TotalMm: 0, waterBalanceMm: 0,
      maxConsecutiveDryDays: 0, dryDays: 0, tmaxMax: null, tmaxMaxDate: null, tminMin: null,
      bestHarvestDay: null, bestSowingDay: null,
    };
  }

  const rain = days.reduce((s, d) => s + d.precipMm, 0);
  const et0 = days.reduce((s, d) => s + d.et0Mm, 0);

  let run = 0;
  let maxRun = 0;
  let dryDays = 0;
  for (const d of days) {
    if (d.precipMm < dryMax) {
      run++;
      dryDays++;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
  }

  const hottest = days.reduce((best, d) => (d.tmax > best.tmax ? d : best));
  const tminMin = Math.min(...days.map((d) => d.tmin));

  const bestHarvest = days.reduce((best, d) =>
    d.precipMm < best.precipMm || (d.precipMm === best.precipMm && d.humidityMean < best.humidityMean) ? d : best,
  );

  let bestSowingDay: string | null = null;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1].precipMm >= SOWING_USEFUL_RAIN_MM && days[i].precipMm < THRESHOLDS.HEAVY_RAIN.warningMm) {
      bestSowingDay = days[i].date;
      break;
    }
  }

  return {
    days: days.length,
    firstDate: days[0].date,
    lastDate: days[days.length - 1].date,
    rainTotalMm: r1(rain),
    et0TotalMm: r1(et0),
    waterBalanceMm: r1(rain - et0),
    maxConsecutiveDryDays: maxRun,
    dryDays,
    tmaxMax: hottest.tmax,
    tmaxMaxDate: hottest.date,
    tminMin,
    bestHarvestDay: bestHarvest.date,
    bestSowingDay,
  };
}
