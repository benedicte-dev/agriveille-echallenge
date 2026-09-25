/**
 * Moteur de règles de monitoring (SPEC §4). Fonction pure et déterministe :
 * mêmes entrées → mêmes sorties, aucun accès réseau, horloge ou base.
 *
 * Entrée : prévision d'un point + cultures des parcelles couvertes + ravageurs.
 * Sortie : alertes candidates avec `dedupKey` stable, à upserter par l'orchestrateur.
 * PEST_OUTBREAK n'est pas produit ici (il naît de la confirmation d'un signalement).
 */
import {
  daysBetween,
  endOfBeninDay,
  formatDayFr,
  monthOf,
  startOfBeninDay,
  toBeninDate,
} from './dates';
import type {
  CandidateAlert,
  DailyForecast,
  EvaluateInput,
  PestInput,
  PlantingInput,
  Severity,
  WeatherAlertType,
} from './types';

/**
 * Seuils agronomiques. Valeurs de la SPEC §4, justifiées brièvement.
 * Toutes les comparaisons sont documentées : « ≥ » inclut le seuil, « < » l'exclut.
 */
export const THRESHOLDS = {
  /** Horizon d'analyse : la prévision Open-Meteo demandée couvre 7 jours. */
  windowDays: 7,
  DROUGHT: {
    /** < 10 mm en 7 j : une pluie inférieure à ~10 mm n'humidifie que la surface (pluie « non utile »). */
    rainMaxMm: 10,
    /** < 3 mm en 7 j : pratiquement aucune recharge du sol → CRITICAL. */
    criticalRainMaxMm: 3,
    /** ET0 cumulée > 25 mm (≈ 3,6 mm/j) : forte demande évaporative typique de saison sèche. */
    et0MinMm: 25,
    /** Cumuls non calculés sur moins de 5 jours (snapshot trop vieux) pour éviter une fausse sécheresse. */
    minDays: 5,
  },
  HEAVY_RAIN: {
    /** ≥ 50 mm/j : ruissellement, érosion, engorgement des bas-fonds. */
    warningMm: 50,
    /** ≥ 80 mm/j : risque d'inondation des parcelles et de pertes de récolte. */
    criticalMm: 80,
  },
  HEAT: {
    /** ≥ 38 °C : stress thermique, avortement des fleurs (maïs, niébé, tomate). */
    warningC: 38,
    /** ≥ 40 °C : brûlures foliaires, échec de la pollinisation. */
    criticalC: 40,
  },
  WIND: {
    /** ≥ 50 km/h : verse du maïs, casse des jeunes plants, dérive des pulvérisations. */
    warningKmh: 50,
  },
  PEST_RISK: {
    /** ≥ 3 jours favorables (température moyenne et humidité) : assez pour un cycle d'infestation / d'infection. */
    minFavourableDays: 3,
  },
  SOWING_WINDOW: {
    /** ≥ 20 mm en 7 j : humidité suffisante pour la levée des semis en pluvial. */
    minRainMm: 20,
  },
  HARVEST_WINDOW: {
    /** Récolte attendue dans ≤ 10 jours. */
    maxDaysAhead: 10,
    /** Récolte en retard de 30 jours au plus : au-delà, la date saisie est jugée périmée. */
    maxDaysLate: 30,
    /** Jour sec : < 1 mm (définition OMM), le grain et les tubercules sèchent. */
    dryDayMaxMm: 1,
    /** 3 jours secs consécutifs : récolter puis sécher avant stockage. */
    minConsecutiveDryDays: 3,
  },
} as const;

const SEVERITY_RANK: Record<Severity, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}

// ---------------------------------------------------------------------------
// Formatage (français simple, lisible à voix haute : unités en toutes lettres)
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 12.34 → « 12,3 » ; 40 → « 40 ». */
export function formatNumberFr(n: number): string {
  return String(round1(n)).replace('.', ',');
}

/** « maïs », « maïs et soja », « maïs, soja et riz », « maïs, soja, riz et autres ». */
function listFr(items: string[]): string {
  const unique = [...new Set(items)];
  if (unique.length <= 1) return unique[0] ?? '';
  if (unique.length > 3) return `${unique.slice(0, 3).join(', ')} et autres`;
  return `${unique.slice(0, -1).join(', ')} et ${unique[unique.length - 1]}`;
}

function mm(n: number): string {
  return `${formatNumberFr(n)} millimètres`;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

function makeKey(type: WeatherAlertType, parcelId: string, startDate: string, pestId?: string): string {
  return pestId ? `${type}:${parcelId}:${pestId}:${startDate}` : `${type}:${parcelId}:${startDate}`;
}

interface Draft {
  type: WeatherAlertType;
  severity: Severity;
  parcelId: string;
  pestId?: string;
  titleFr: string;
  messageFr: string;
  adviceFr: string;
  fromDate: string;
  untilDate: string;
  evidence: Record<string, number | string>;
}

function build(d: Draft): CandidateAlert {
  const alert: CandidateAlert = {
    type: d.type,
    severity: d.severity,
    source: 'AUTO_WEATHER',
    parcelId: d.parcelId,
    titleFr: d.titleFr,
    messageFr: d.messageFr,
    adviceFr: d.adviceFr,
    validFrom: startOfBeninDay(d.fromDate),
    validUntil: endOfBeninDay(d.untilDate),
    dedupKey: makeKey(d.type, d.parcelId, d.fromDate, d.pestId),
    evidence: d.evidence,
  };
  if (d.pestId) alert.pestId = d.pestId;
  return alert;
}

/** Jours de la prévision à partir de `today`, triés, au plus `windowDays`. */
export function forecastWindow(days: DailyForecast[], today: string): DailyForecast[] {
  return [...days]
    .filter((d) => d.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, THRESHOLDS.windowDays);
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function maxBy(days: DailyForecast[], pick: (d: DailyForecast) => number): DailyForecast {
  // Premier jour atteignant le maximum (déterministe).
  return days.reduce((best, d) => (pick(d) > pick(best) ? d : best));
}

// ---------------------------------------------------------------------------
// Règles météo générales, par parcelle
// ---------------------------------------------------------------------------

function heavyRain(window: DailyForecast[], parcelId: string): CandidateAlert | null {
  const t = THRESHOLDS.HEAVY_RAIN;
  const hits = window.filter((d) => d.precipMm >= t.warningMm);
  if (hits.length === 0) return null;
  const peak = maxBy(hits, (d) => d.precipMm);
  const critical = peak.precipMm >= t.criticalMm;
  return build({
    type: 'HEAVY_RAIN',
    severity: critical ? 'CRITICAL' : 'WARNING',
    parcelId,
    titleFr: critical ? 'Pluie très forte' : 'Forte pluie',
    messageFr: `Forte pluie prévue ${formatDayFr(peak.date)}. Jusqu'à ${mm(peak.precipMm)} en un jour.`,
    adviceFr: critical
      ? "Dégagez les rigoles pour évacuer l'eau. Mettez récoltes et semences à l'abri. Ne semez pas ces jours-là."
      : "Dégagez les rigoles pour évacuer l'eau. Ne semez pas et ne traitez pas ces jours-là.",
    fromDate: hits[0].date,
    untilDate: hits[hits.length - 1].date,
    evidence: {
      maxPrecipMm: round1(peak.precipMm),
      maxPrecipDate: peak.date,
      heavyDays: hits.length,
      thresholdMm: critical ? t.criticalMm : t.warningMm,
    },
  });
}

function heat(window: DailyForecast[], parcelId: string): CandidateAlert | null {
  const t = THRESHOLDS.HEAT;
  const hits = window.filter((d) => d.tmax >= t.warningC);
  if (hits.length === 0) return null;
  const peak = maxBy(hits, (d) => d.tmax);
  const critical = peak.tmax >= t.criticalC;
  return build({
    type: 'HEAT',
    severity: critical ? 'CRITICAL' : 'WARNING',
    parcelId,
    titleFr: critical ? 'Chaleur extrême' : 'Forte chaleur',
    messageFr: `Jusqu'à ${formatNumberFr(peak.tmax)} degrés prévus ${formatDayFr(peak.date)}. Les plants vont souffrir.`,
    adviceFr: critical
      ? 'Arrosez tôt le matin ou le soir. Paillez le sol. Ne travaillez pas aux heures chaudes.'
      : 'Arrosez tôt le matin ou le soir. Ne travaillez pas aux heures chaudes.',
    fromDate: hits[0].date,
    untilDate: hits[hits.length - 1].date,
    evidence: {
      maxTempC: round1(peak.tmax),
      maxTempDate: peak.date,
      hotDays: hits.length,
      thresholdC: critical ? t.criticalC : t.warningC,
    },
  });
}

function wind(window: DailyForecast[], parcelId: string): CandidateAlert | null {
  const t = THRESHOLDS.WIND;
  const hits = window.filter((d) => d.windMaxKmh >= t.warningKmh);
  if (hits.length === 0) return null;
  const peak = maxBy(hits, (d) => d.windMaxKmh);
  return build({
    type: 'WIND',
    severity: 'WARNING',
    parcelId,
    titleFr: 'Vent fort',
    messageFr: `Vent fort prévu ${formatDayFr(peak.date)}. Jusqu'à ${formatNumberFr(peak.windMaxKmh)} kilomètres par heure.`,
    adviceFr: 'Attachez les jeunes plants aux tuteurs. Ne pulvérisez aucun produit ces jours-là.',
    fromDate: hits[0].date,
    untilDate: hits[hits.length - 1].date,
    evidence: {
      maxWindKmh: round1(peak.windMaxKmh),
      maxWindDate: peak.date,
      windyDays: hits.length,
      thresholdKmh: t.warningKmh,
    },
  });
}

// ---------------------------------------------------------------------------
// Règles liées aux cultures
// ---------------------------------------------------------------------------

function drought(window: DailyForecast[], parcelId: string, growing: PlantingInput[]): CandidateAlert | null {
  const t = THRESHOLDS.DROUGHT;
  if (growing.length === 0 || window.length < t.minDays) return null;
  const rain = sum(window.map((d) => d.precipMm));
  const et0 = sum(window.map((d) => d.et0Mm));
  if (!(rain < t.rainMaxMm && et0 > t.et0MinMm)) return null;
  const critical = rain < t.criticalRainMaxMm;
  const crops = listFr(growing.map((p) => p.cropName));
  return build({
    type: 'DROUGHT',
    severity: critical ? 'CRITICAL' : 'WARNING',
    parcelId,
    titleFr: critical ? 'Sécheresse grave' : 'Risque de sécheresse',
    messageFr: `Seulement ${mm(rain)} de pluie en ${window.length} jours. Votre ${crops} va manquer d'eau.`,
    adviceFr: critical
      ? "Paillez le sol et arrosez tôt le matin. Gardez l'eau pour les plants les plus jeunes."
      : 'Paillez le sol et arrosez tôt le matin. Arrosez au pied des plants.',
    fromDate: window[0].date,
    untilDate: window[window.length - 1].date,
    evidence: {
      rainTotalMm: round1(rain),
      et0TotalMm: round1(et0),
      days: window.length,
      rainThresholdMm: critical ? t.criticalRainMaxMm : t.rainMaxMm,
      et0ThresholdMm: t.et0MinMm,
      crops: growing.map((p) => p.cropSlug).join(','),
    },
  });
}

function hasClimateModel(p: PestInput): boolean {
  const hasAny = p.riskTempMin != null || p.riskTempMax != null || p.riskHumidityMin != null;
  const coherent = p.riskTempMin == null || p.riskTempMax == null || p.riskTempMin <= p.riskTempMax;
  return hasAny && coherent;
}

/** Jour favorable : température moyenne (tmax+tmin)/2 dans [min, max] et humidité moyenne ≥ seuil. Bornes absentes = ouvertes. */
export function isFavourableDay(day: DailyForecast, pest: PestInput): boolean {
  const tMean = (day.tmax + day.tmin) / 2;
  if (pest.riskTempMin != null && tMean < pest.riskTempMin) return false;
  if (pest.riskTempMax != null && tMean > pest.riskTempMax) return false;
  if (pest.riskHumidityMin != null && day.humidityMean < pest.riskHumidityMin) return false;
  return true;
}

const DEFAULT_PREVENTION: Record<PestInput['kind'], string> = {
  PEST: 'Retirez et détruisez les ravageurs trouvés.',
  DISEASE: 'Retirez les feuilles malades et aérez les plants.',
};

function pestRisk(window: DailyForecast[], parcelId: string, growing: PlantingInput[], pests: PestInput[]): CandidateAlert[] {
  const out: CandidateAlert[] = [];
  const t = THRESHOLDS.PEST_RISK;
  const sortedPests = [...pests].sort((a, b) => (a.pestId < b.pestId ? -1 : a.pestId > b.pestId ? 1 : 0));
  for (const pest of sortedPests) {
    if (!hasClimateModel(pest)) continue;
    const hosts = growing.filter((p) => pest.cropSlugs.includes(p.cropSlug));
    if (hosts.length === 0) continue;
    const favourable = window.filter((d) => isFavourableDay(d, pest));
    if (favourable.length < t.minFavourableDays) continue;
    const crops = listFr(hosts.map((p) => p.cropName));
    const prevention = pest.preventionFr?.trim() || DEFAULT_PREVENTION[pest.kind];
    const evidence: Record<string, number | string> = {
      favourableDays: favourable.length,
      windowDays: window.length,
      firstFavourableDate: favourable[0].date,
      minFavourableDays: t.minFavourableDays,
      crops: hosts.map((p) => p.cropSlug).join(','),
      pest: pest.slug,
    };
    if (pest.riskTempMin != null) evidence.riskTempMin = pest.riskTempMin;
    if (pest.riskTempMax != null) evidence.riskTempMax = pest.riskTempMax;
    if (pest.riskHumidityMin != null) evidence.riskHumidityMin = pest.riskHumidityMin;
    out.push(
      build({
        type: 'PEST_RISK',
        severity: 'WARNING',
        parcelId,
        pestId: pest.pestId,
        titleFr: `Risque : ${pest.nameFr}`,
        messageFr: `Le temps favorise ${pest.nameFr} sur votre ${crops}. ${favourable.length} jours à risque dès ${formatDayFr(favourable[0].date)}.`,
        adviceFr: `Inspectez votre ${crops} tous les deux jours. ${prevention}`,
        fromDate: favourable[0].date,
        untilDate: favourable[favourable.length - 1].date,
        evidence,
      }),
    );
  }
  return out;
}

function sowingWindow(window: DailyForecast[], parcelId: string, planned: PlantingInput[], today: string): CandidateAlert | null {
  const t = THRESHOLDS.SOWING_WINDOW;
  if (window.length === 0) return null;
  const month = monthOf(today);
  const eligible = planned.filter((p) => p.sowingMonths.includes(month));
  if (eligible.length === 0) return null;
  const rain = sum(window.map((d) => d.precipMm));
  if (rain < t.minRainMm) return null;
  const crops = listFr(eligible.map((p) => p.cropName));
  return build({
    type: 'SOWING_WINDOW',
    severity: 'INFO',
    parcelId,
    titleFr: 'Bon moment pour semer',
    messageFr: `${mm(rain)} de pluie prévus cette semaine. C'est le bon mois pour semer : ${crops}.`,
    adviceFr: 'Préparez le sol maintenant. Semez juste après une bonne pluie.',
    fromDate: window[0].date,
    untilDate: window[window.length - 1].date,
    evidence: {
      rainTotalMm: round1(rain),
      rainThresholdMm: t.minRainMm,
      month,
      crops: eligible.map((p) => p.cropSlug).join(','),
    },
  });
}

/** Première série d'au moins `min` jours secs consécutifs (renvoie toute la série). */
export function firstDryRun(window: DailyForecast[], min: number, dryMaxMm: number): DailyForecast[] | null {
  let run: DailyForecast[] = [];
  for (const d of window) {
    if (d.precipMm < dryMaxMm) {
      run.push(d);
    } else {
      if (run.length >= min) return run;
      run = [];
    }
  }
  return run.length >= min ? run : null;
}

function harvestWindow(window: DailyForecast[], parcelId: string, growing: PlantingInput[], today: string): CandidateAlert | null {
  const t = THRESHOLDS.HARVEST_WINDOW;
  const due = growing
    .map((p) => ({ p, harvest: toBeninDate(p.expectedHarvestDate) }))
    .map((x) => ({ ...x, inDays: daysBetween(today, x.harvest) }))
    .filter((x) => x.inDays <= t.maxDaysAhead && x.inDays >= -t.maxDaysLate);
  if (due.length === 0) return null;
  const run = firstDryRun(window, t.minConsecutiveDryDays, t.dryDayMaxMm);
  if (!run) return null;
  const crops = listFr(due.map((x) => x.p.cropName));
  const soonest = due.reduce((a, b) => (b.inDays < a.inDays ? b : a));
  const from = run[0].date;
  const until = run[run.length - 1].date;
  return build({
    type: 'HARVEST_WINDOW',
    severity: 'INFO',
    parcelId,
    titleFr: 'Récoltez ces jours-là',
    messageFr: `Temps sec du ${formatDayFr(from)} au ${formatDayFr(until)}. C'est le moment de récolter : ${crops}.`,
    adviceFr: 'Récoltez pendant ces jours secs. Séchez la récolte avant de la stocker.',
    fromDate: from,
    untilDate: until,
    evidence: {
      dryDays: run.length,
      dryFrom: from,
      dryUntil: until,
      dryDayMaxMm: t.dryDayMaxMm,
      rainInDryRunMm: round1(sum(run.map((d) => d.precipMm))),
      expectedHarvestDate: soonest.harvest,
      daysToHarvest: soonest.inDays,
      crops: due.map((x) => x.p.cropSlug).join(','),
    },
  });
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

const TYPE_ORDER: WeatherAlertType[] = ['HEAVY_RAIN', 'HEAT', 'WIND', 'DROUGHT', 'PEST_RISK', 'HARVEST_WINDOW', 'SOWING_WINDOW'];

function compareAlerts(a: CandidateAlert, b: CandidateAlert): number {
  return (
    severityRank(b.severity) - severityRank(a.severity) ||
    TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
    (a.parcelId < b.parcelId ? -1 : a.parcelId > b.parcelId ? 1 : 0) ||
    (a.dedupKey < b.dedupKey ? -1 : a.dedupKey > b.dedupKey ? 1 : 0)
  );
}

/**
 * Évalue toutes les règles météo pour les parcelles couvertes par `forecast`.
 * Garanties : une seule alerte par (règle, parcelle[, ravageur]) sur la fenêtre,
 * sévérité la plus haute retenue, ordre de sortie stable (sévérité décroissante).
 */
export function evaluate(input: EvaluateInput): CandidateAlert[] {
  const today = toBeninDate(input.today);
  const window = forecastWindow(input.forecast.days, today);
  if (window.length === 0) return [];

  const byParcel = new Map<string, PlantingInput[]>();
  for (const id of input.parcelIds ?? []) byParcel.set(id, []);
  for (const p of input.plantings) {
    const list = byParcel.get(p.parcelId) ?? [];
    // Une même plantation transmise deux fois ne compte qu'une fois.
    if (!list.some((x) => x.plantingId === p.plantingId)) list.push(p);
    byParcel.set(p.parcelId, list);
  }

  const candidates: CandidateAlert[] = [];
  const parcelIds = [...byParcel.keys()].sort();
  for (const parcelId of parcelIds) {
    const plantings = byParcel.get(parcelId) ?? [];
    const growing = plantings.filter((p) => p.status === 'GROWING');
    const planned = plantings.filter((p) => p.status === 'PLANNED');

    for (const a of [
      heavyRain(window, parcelId),
      heat(window, parcelId),
      wind(window, parcelId),
      drought(window, parcelId, growing),
      harvestWindow(window, parcelId, growing, today),
      sowingWindow(window, parcelId, planned, today),
    ]) {
      if (a) candidates.push(a);
    }
    candidates.push(...pestRisk(window, parcelId, growing, input.pests));
  }

  // Filet de sécurité : une alerte par (type, parcelle, ravageur), la plus sévère.
  const unique = new Map<string, CandidateAlert>();
  for (const c of candidates) {
    const slot = `${c.type}:${c.parcelId}:${c.pestId ?? ''}`;
    const prev = unique.get(slot);
    if (!prev || severityRank(c.severity) > severityRank(prev.severity)) unique.set(slot, c);
  }
  return [...unique.values()].sort(compareAlerts);
}

/** Alerte déjà en base, réduite à ce qu'il faut pour la comparaison. */
export interface ActiveAlertRef {
  type: string;
  parcelId: string | null;
  pestId?: string | null;
  severity: Severity;
  validUntil: Date;
}

/**
 * Évite de réémettre chaque jour une alerte qui court encore (ex. sécheresse
 * dont la date de début glisse). Une candidate est écartée si une alerte
 * active du même type, même parcelle, même ravageur, de sévérité ≥, est encore
 * valide à `now`. Une aggravation (WARNING → CRITICAL) passe toujours.
 */
export function filterAlreadyActive(candidates: CandidateAlert[], active: ActiveAlertRef[], now: Date): CandidateAlert[] {
  return candidates.filter(
    (c) =>
      !active.some(
        (a) =>
          a.type === c.type &&
          a.parcelId === c.parcelId &&
          (a.pestId ?? undefined) === c.pestId &&
          a.validUntil.getTime() >= now.getTime() &&
          severityRank(a.severity) >= severityRank(c.severity),
      ),
  );
}
