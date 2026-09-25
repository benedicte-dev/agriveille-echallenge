/**
 * Client Open-Meteo (gratuit, sans clé). SPEC §4.
 *
 * - Timeout 8 s (AbortController), combiné au `signal` éventuel de l'appelant.
 * - Réponse validée par zod ; toute anomalie devient `WeatherUnavailableError`.
 * - `parseForecast` revalide un payload déjà stocké (WeatherSnapshot.payload est du Json).
 */
import { z } from 'zod';
import { isIsoDate } from './dates';
import type { DailyForecast, Forecast } from './types';

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_TIMEOUT_MS = 8_000;
export const OPEN_METEO_DAILY_FIELDS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'relative_humidity_2m_mean',
  'wind_speed_10m_max',
  'et0_fao_evapotranspiration',
] as const;

export type WeatherUnavailableReason =
  | 'invalid_input'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http'
  | 'invalid_response';

/** Météo indisponible. `reason` sert au log serveur ; ne pas exposer `message` au client. */
export class WeatherUnavailableError extends Error {
  readonly reason: WeatherUnavailableReason;
  readonly status?: number;

  constructor(reason: WeatherUnavailableReason, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'WeatherUnavailableError';
    this.reason = reason;
    this.status = options?.status;
  }
}

const isoDate = z.string().refine(isIsoDate, 'date YYYY-MM-DD attendue');
/** Open-Meteo renvoie parfois `null` pour une valeur manquante. */
const series = z.array(z.number().finite().nullable());

const openMeteoResponseSchema = z.object({
  daily: z.object({
    time: z.array(isoDate).min(1),
    temperature_2m_max: series,
    temperature_2m_min: series,
    precipitation_sum: series,
    relative_humidity_2m_mean: series,
    wind_speed_10m_max: series,
    et0_fao_evapotranspiration: series,
  }),
});

const dailyForecastSchema = z.object({
  date: isoDate,
  tmax: z.number().finite(),
  tmin: z.number().finite(),
  precipMm: z.number().finite().min(0),
  humidityMean: z.number().finite().min(0).max(100),
  windMaxKmh: z.number().finite().min(0),
  et0Mm: z.number().finite().min(0),
});

const forecastSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  fetchedAt: z.string().datetime({ offset: true }),
  days: z.array(dailyForecastSchema).max(16),
});

/**
 * Convertit une réponse brute Open-Meteo en `Forecast`.
 * Les jours incomplets (valeur `null`) sont écartés ; s'il n'en reste aucun, erreur.
 */
export function parseOpenMeteoResponse(raw: unknown, lat: number, lon: number, fetchedAt: Date = new Date()): Forecast {
  const parsed = openMeteoResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new WeatherUnavailableError('invalid_response', 'Réponse Open-Meteo invalide', { cause: parsed.error });
  }
  const d = parsed.data.daily;
  const n = d.time.length;
  for (const field of OPEN_METEO_DAILY_FIELDS) {
    if (d[field].length !== n) {
      throw new WeatherUnavailableError('invalid_response', `Série ${field} de longueur incohérente`);
    }
  }

  const days: DailyForecast[] = [];
  for (let i = 0; i < n; i++) {
    const candidate = {
      date: d.time[i],
      tmax: d.temperature_2m_max[i],
      tmin: d.temperature_2m_min[i],
      precipMm: d.precipitation_sum[i],
      humidityMean: d.relative_humidity_2m_mean[i],
      windMaxKmh: d.wind_speed_10m_max[i],
      et0Mm: d.et0_fao_evapotranspiration[i],
    };
    const day = dailyForecastSchema.safeParse(candidate);
    if (day.success) days.push(day.data);
  }
  if (days.length === 0) {
    throw new WeatherUnavailableError('invalid_response', 'Aucun jour de prévision exploitable');
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { lat, lon, fetchedAt: fetchedAt.toISOString(), days };
}

/** Revalide un `Forecast` relu depuis la base (payload Json non typé). */
export function parseForecast(payload: unknown): Forecast {
  const parsed = forecastSchema.safeParse(payload);
  if (!parsed.success) {
    throw new WeatherUnavailableError('invalid_response', 'Prévision stockée invalide', { cause: parsed.error });
  }
  return parsed.data;
}

export function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: OPEN_METEO_DAILY_FIELDS.join(','),
    timezone: 'Africa/Porto-Novo',
    forecast_days: '7',
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
}

export interface FetchForecastOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Surcharge du délai (tests). Défaut 8 000 ms. */
  timeoutMs?: number;
  /** Horloge injectable (tests). */
  now?: () => Date;
}

/** Récupère la prévision 7 jours d'un point. Lève `WeatherUnavailableError` en cas d'échec. */
export async function fetchForecast(lat: number, lon: number, options: FetchForecastOptions = {}): Promise<Forecast> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new WeatherUnavailableError('invalid_input', 'Coordonnées invalides');
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? OPEN_METEO_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());

  if (options.signal?.aborted) {
    throw new WeatherUnavailableError('aborted', 'Requête météo annulée');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetchImpl(buildForecastUrl(lat, lon), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) throw new WeatherUnavailableError('timeout', `Open-Meteo n'a pas répondu en ${timeoutMs} ms`, { cause: err });
      if (options.signal?.aborted) throw new WeatherUnavailableError('aborted', 'Requête météo annulée', { cause: err });
      throw new WeatherUnavailableError('network', 'Open-Meteo injoignable', { cause: err });
    }

    if (!res.ok) {
      throw new WeatherUnavailableError('http', `Open-Meteo a répondu ${res.status}`, { status: res.status });
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      if (timedOut) throw new WeatherUnavailableError('timeout', `Open-Meteo n'a pas répondu en ${timeoutMs} ms`, { cause: err });
      throw new WeatherUnavailableError('invalid_response', 'Réponse Open-Meteo non JSON', { cause: err });
    }
    return parseOpenMeteoResponse(body, lat, lon, now());
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
