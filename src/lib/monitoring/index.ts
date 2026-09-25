export type {
  AlertType,
  CandidateAlert,
  DailyForecast,
  EvaluateInput,
  Forecast,
  GeoPoint,
  PestInput,
  PestKind,
  PlantingInput,
  PlantingStatus,
  Severity,
  WeatherAlertType,
} from './types';

export {
  OPEN_METEO_DAILY_FIELDS,
  OPEN_METEO_TIMEOUT_MS,
  OPEN_METEO_URL,
  WeatherUnavailableError,
  buildForecastUrl,
  fetchForecast,
  parseForecast,
  parseOpenMeteoResponse,
} from './open-meteo';
export type { FetchForecastOptions, WeatherUnavailableReason } from './open-meteo';

export { THRESHOLDS, evaluate, filterAlreadyActive, forecastWindow, isFavourableDay, severityRank } from './rules';
export type { ActiveAlertRef } from './rules';

export { EARTH_RADIUS_KM, haversineKm, isValidPoint, parcelsWithinRadius } from './geo';

export { SOWING_USEFUL_RAIN_MM, summarizeForecast } from './summary';
export type { ForecastSummary } from './summary';

export { formatDayFr, toBeninDate, todayInBenin } from './dates';
