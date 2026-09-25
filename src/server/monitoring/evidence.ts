/**
 * Mise en mots des chiffres qui ont déclenché une alerte automatique
 * (`CandidateAlert.evidence`, conservé dans le journal d'audit à la création).
 * Pure : la page fournit la fonction de traduction et le format de date.
 */

export type Evidence = Record<string, number | string>;
type Translate = (key: string, vars?: Record<string, string | number>) => string;
type FormatDate = (isoDate: string) => string;
type FormatNumber = (n: number) => string;

function num(ev: Evidence, key: string): number | null {
  const v = ev[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(ev: Evidence, key: string): string | null {
  const v = ev[key];
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Valide un meta Json d'audit et en extrait `evidence` (ou null). */
export function parseEvidence(meta: unknown): Evidence | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const ev = (meta as Record<string, unknown>).evidence;
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return null;
  const out: Evidence = {};
  for (const [k, v] of Object.entries(ev as Record<string, unknown>)) {
    if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Lignes lisibles (au plus 3) pour un type d'alerte. Les clés inconnues sont
 * ignorées : une evidence partielle donne simplement moins de lignes.
 */
export function evidenceLines(
  type: string,
  ev: Evidence,
  t: Translate,
  fmtDate: FormatDate,
  fmtNum: FormatNumber,
): string[] {
  const lines: string[] = [];
  const push = (key: string, vars: Record<string, string | number>) => lines.push(t(key, vars));

  switch (type) {
    case "HEAVY_RAIN": {
      const v = num(ev, "maxPrecipMm");
      const d = str(ev, "maxPrecipDate");
      if (v !== null && d) push("mon.ev.max_rain", { value: fmtNum(v), date: fmtDate(d) });
      const th = num(ev, "thresholdMm");
      if (th !== null) push("mon.ev.threshold_rain_day", { value: fmtNum(th) });
      break;
    }
    case "HEAT": {
      const v = num(ev, "maxTempC");
      const d = str(ev, "maxTempDate");
      if (v !== null && d) push("mon.ev.max_temp", { value: fmtNum(v), date: fmtDate(d) });
      const th = num(ev, "thresholdC");
      if (th !== null) push("mon.ev.threshold_temp", { value: fmtNum(th) });
      break;
    }
    case "WIND": {
      const v = num(ev, "maxWindKmh");
      const d = str(ev, "maxWindDate");
      if (v !== null && d) push("mon.ev.max_wind", { value: fmtNum(v), date: fmtDate(d) });
      const th = num(ev, "thresholdKmh");
      if (th !== null) push("mon.ev.threshold_wind", { value: fmtNum(th) });
      break;
    }
    case "DROUGHT": {
      const rain = num(ev, "rainTotalMm");
      const days = num(ev, "days") ?? 7;
      if (rain !== null) push("mon.ev.rain_total", { value: fmtNum(rain), days });
      const et0 = num(ev, "et0TotalMm");
      if (et0 !== null) push("mon.ev.et0_total", { value: fmtNum(et0), days });
      const th = num(ev, "rainThresholdMm");
      if (th !== null) push("mon.ev.threshold_drought", { value: fmtNum(th) });
      break;
    }
    case "PEST_RISK": {
      const fav = num(ev, "favourableDays");
      const win = num(ev, "windowDays") ?? 7;
      if (fav !== null) push("mon.ev.pest_days", { value: fav, total: win });
      const tmin = num(ev, "riskTempMin");
      const tmax = num(ev, "riskTempMax");
      if (tmin !== null && tmax !== null) push("mon.ev.pest_temp", { min: fmtNum(tmin), max: fmtNum(tmax) });
      const hum = num(ev, "riskHumidityMin");
      if (hum !== null) push("mon.ev.pest_humidity", { value: fmtNum(hum) });
      break;
    }
    case "SOWING_WINDOW": {
      const rain = num(ev, "rainTotalMm");
      if (rain !== null) push("mon.ev.rain_total", { value: fmtNum(rain), days: 7 });
      const th = num(ev, "rainThresholdMm");
      if (th !== null) push("mon.ev.threshold_sowing", { value: fmtNum(th) });
      break;
    }
    case "HARVEST_WINDOW": {
      const dry = num(ev, "dryDays");
      const from = str(ev, "dryFrom");
      const until = str(ev, "dryUntil");
      if (dry !== null && from && until) push("mon.ev.dry_run", { value: dry, from: fmtDate(from), until: fmtDate(until) });
      const inDays = num(ev, "daysToHarvest");
      if (inDays !== null) {
        push(inDays >= 0 ? "mon.ev.harvest_in" : "mon.ev.harvest_late", { value: Math.abs(inDays) });
      }
      break;
    }
    default:
      break;
  }
  return lines.slice(0, 3);
}
