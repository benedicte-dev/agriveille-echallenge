import type { ReactNode } from "react";
import {
  IconGoutte,
  IconMeteoNuage,
  IconMeteoOrage,
  IconMeteoPluie,
  IconMeteoSoleil,
  IconVent,
  severityIcons,
  type IconComponent,
} from "@/components/icons";
import type { Severity } from "./SeverityBadge";
import { cx } from "./cx";

export type WeatherCondition = "sun" | "cloud" | "rain" | "storm";

const conditionIcon: Record<WeatherCondition, IconComponent> = {
  sun: IconMeteoSoleil,
  cloud: IconMeteoNuage,
  rain: IconMeteoPluie,
  storm: IconMeteoOrage,
};

export const DEFAULT_CONDITION_LABELS: Record<WeatherCondition, string> = {
  sun: "Soleil",
  cloud: "Nuages",
  rain: "Pluie",
  storm: "Orage",
};

/**
 * Condition dominante déduite des cumuls journaliers Open-Meteo (pas de code météo stocké) :
 * ≥ 20 mm ou vent ≥ 50 km/h avec pluie → orage ; ≥ 1 mm → pluie ; humidité ≥ 80 % → nuages ; sinon soleil.
 */
export function weatherCondition(d: { rainMm: number; windKmh?: number; humidity?: number }): WeatherCondition {
  if (d.rainMm >= 20 || (d.rainMm >= 5 && (d.windKmh ?? 0) >= 50)) return "storm";
  if (d.rainMm >= 1) return "rain";
  if ((d.humidity ?? 0) >= 80) return "cloud";
  return "sun";
}

export type WeatherDayProps = {
  /** Jour court déjà formaté, ex. « Auj. », « Mar. 14 ». */
  dayLabel: string;
  /** Date complète pour les lecteurs d'écran, ex. « mardi 14 octobre ». */
  dateLabel?: string;
  condition: WeatherCondition;
  tMax: number;
  tMin: number;
  rainMm: number;
  windKmh?: number;
  /** Sévérité d'une alerte qui touche ce jour (pictogramme + liseré). */
  alert?: Severity;
  today?: boolean;
  labels?: Partial<Record<WeatherCondition, string>> & { rain?: string; wind?: string; alert?: string };
  className?: string;
};

/**
 * Colonne météo d'un jour (fiche parcelle, bande de 7 jours défilable). Tout est aussi en texte :
 * condition en mot (sr-only), températures, pluie en mm, vent.
 */
export function WeatherDay({
  dayLabel,
  dateLabel,
  condition,
  tMax,
  tMin,
  rainMm,
  windKmh,
  alert,
  today = false,
  labels,
  className,
}: WeatherDayProps) {
  const Icon = conditionIcon[condition];
  const condLabel = labels?.[condition] ?? DEFAULT_CONDITION_LABELS[condition];
  const AlertIcon = alert ? severityIcons[alert] : null;
  const alertColor = alert === "CRITICAL" ? "text-critical" : alert === "WARNING" ? "text-warning" : "text-info";
  const iconColor = condition === "sun" ? "text-sun-ink" : condition === "cloud" ? "text-ink-muted" : "text-info";
  return (
    <div
      className={cx(
        "relative flex w-22 shrink-0 flex-col items-center gap-1 rounded-xl border-2 bg-surface px-2 py-3 text-center",
        today ? "border-primary" : "border-line",
        alert === "CRITICAL" && "border-critical",
        alert === "WARNING" && "border-warning",
        className,
      )}
    >
      <p className="text-sm font-bold text-ink">
        {dayLabel}
        {dateLabel ? <span className="sr-only"> ({dateLabel})</span> : null}
      </p>
      <Icon size={36} className={iconColor} />
      <p className="sr-only">{condLabel}</p>
      <p className="text-lg leading-none font-bold text-ink tabular-nums">
        {Math.round(tMax)}°<span className="sr-only"> max</span>
      </p>
      <p className="text-sm text-ink-muted tabular-nums">
        {Math.round(tMin)}°<span className="sr-only"> min</span>
      </p>
      <p className="mt-1 inline-flex items-center gap-0.5 text-sm font-semibold text-info tabular-nums">
        <IconGoutte size={16} />
        <span className="sr-only">{labels?.rain ?? "Pluie"} </span>
        {Math.round(rainMm)} mm
      </p>
      {windKmh !== undefined ? (
        <p className="inline-flex items-center gap-0.5 text-sm text-ink-muted tabular-nums">
          <IconVent size={16} />
          <span className="sr-only">{labels?.wind ?? "Vent"} </span>
          {Math.round(windKmh)}
        </p>
      ) : null}
      {AlertIcon ? (
        <span className={cx("absolute -top-2.5 -right-2 rounded-full bg-surface", alertColor)}>
          <AlertIcon size={22} title={labels?.alert ?? "Alerte ce jour"} />
        </span>
      ) : null}
    </div>
  );
}

/** Bande de 7 jours : défilement horizontal sur mobile, grille sur bureau. */
export function WeatherStrip({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <section aria-label={label} className={cx("-mx-4 overflow-x-auto px-4 pt-3 pb-2", className)}>
      <div className="flex gap-2 md:grid md:grid-cols-7 md:*:w-auto">{children}</div>
    </section>
  );
}
