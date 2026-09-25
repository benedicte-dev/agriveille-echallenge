/**
 * Types d'entrée / sortie du module de monitoring (SPEC §4).
 *
 * Module en TypeScript pur : aucune dépendance à Prisma. L'orchestrateur
 * convertit les lignes de base en ces interfaces, appelle `evaluate`, puis
 * persiste les `CandidateAlert` (upsert sur `dedupKey`).
 */

/** Une journée de prévision, dans le fuseau Africa/Porto-Novo (UTC+1, sans heure d'été). */
export interface DailyForecast {
  /** Jour local au format YYYY-MM-DD. */
  date: string;
  /** Température maximale à 2 m, en °C. */
  tmax: number;
  /** Température minimale à 2 m, en °C. */
  tmin: number;
  /** Cumul de précipitations du jour, en mm. */
  precipMm: number;
  /** Humidité relative moyenne du jour, en %. */
  humidityMean: number;
  /** Vent maximal à 10 m, en km/h. */
  windMaxKmh: number;
  /** Évapotranspiration de référence FAO-56, en mm. */
  et0Mm: number;
}

/** Prévision 7 jours pour un point (une parcelle). Sérialisable en JSON (payload de WeatherSnapshot). */
export interface Forecast {
  lat: number;
  lon: number;
  /** Horodatage ISO 8601 (UTC) de la récupération. */
  fetchedAt: string;
  days: DailyForecast[];
}

export type PlantingStatus = 'PLANNED' | 'GROWING' | 'HARVESTED';

export interface PlantingInput {
  plantingId: string;
  parcelId: string;
  cropSlug: string;
  cropName: string;
  status: PlantingStatus;
  /** Date (Prisma DateTime) ou chaîne YYYY-MM-DD / ISO. */
  sowingDate: Date | string;
  /** Date (Prisma DateTime) ou chaîne YYYY-MM-DD / ISO. */
  expectedHarvestDate: Date | string;
  /** Mois de semis recommandés, 1 = janvier … 12 = décembre. */
  sowingMonths: number[];
}

export type PestKind = 'PEST' | 'DISEASE';

export interface PestInput {
  pestId: string;
  slug: string;
  nameFr: string;
  kind: PestKind;
  /** Slugs des cultures hôtes. */
  cropSlugs: string[];
  /** Borne basse de température moyenne journalière favorable, en °C. */
  riskTempMin?: number | null;
  /** Borne haute de température moyenne journalière favorable, en °C. */
  riskTempMax?: number | null;
  /** Humidité relative moyenne minimale favorable, en %. */
  riskHumidityMin?: number | null;
  /**
   * Geste de prévention (champ CMS `Pest.preventionFr`). Optionnel : à défaut,
   * un conseil générique selon `kind` est utilisé.
   */
  preventionFr?: string | null;
}

/** Valeurs de l'enum `AlertType` (SPEC §3). */
export type AlertType =
  | 'DROUGHT'
  | 'HEAVY_RAIN'
  | 'HEAT'
  | 'WIND'
  | 'PEST_RISK'
  | 'PEST_OUTBREAK'
  | 'SOWING_WINDOW'
  | 'HARVEST_WINDOW';

/** Valeurs de l'enum `Severity` (SPEC §3). */
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

/** Types produits par le moteur météo (PEST_OUTBREAK vient des signalements confirmés). */
export type WeatherAlertType = Exclude<AlertType, 'PEST_OUTBREAK'>;

export interface CandidateAlert {
  type: WeatherAlertType;
  severity: Severity;
  source: 'AUTO_WEATHER';
  parcelId: string;
  pestId?: string;
  titleFr: string;
  messageFr: string;
  adviceFr: string;
  /** Début de validité : 00:00 heure du Bénin du premier jour concerné. */
  validFrom: Date;
  /** Fin de validité : 23:59:59.999 heure du Bénin du dernier jour concerné. */
  validUntil: Date;
  /** `TYPE:parcelId[:pestId]:YYYY-MM-DD` (date = jour de `validFrom`). */
  dedupKey: string;
  /** Chiffres qui ont déclenché l'alerte (transparence, démo). */
  evidence: Record<string, number | string>;
}

export interface EvaluateInput {
  forecast: Forecast;
  plantings: PlantingInput[];
  pests: PestInput[];
  /** Jour de référence : YYYY-MM-DD (heure du Bénin) ou instant converti en date béninoise. */
  today: string | Date;
  /**
   * Parcelles couvertes par cette prévision. Les alertes météo générales
   * (HEAVY_RAIN, HEAT, WIND) sont émises pour chacune, même sans culture.
   * Par défaut : les parcelles présentes dans `plantings`.
   */
  parcelIds?: string[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
}
