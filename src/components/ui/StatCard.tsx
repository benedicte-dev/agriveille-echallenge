import type { ReactNode } from "react";
import { cx } from "./cx";

export type StatCardProps = {
  label: string;
  /** Valeur déjà formatée (Intl côté page), ex. « 1 250 000 ». */
  value: ReactNode;
  /** Unité affichée après la valeur, ex. « FCFA », « % ». */
  unit?: string;
  icon?: ReactNode;
  /** Ligne de contexte, ex. « 12 sur 18 accusés » ou « +8 % sur 7 jours ». */
  hint?: ReactNode;
  tone?: "primary" | "earth" | "info" | "warning" | "critical";
  className?: string;
};

const chip = {
  primary: "bg-primary-soft text-primary",
  earth: "bg-earth-soft text-earth",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
} as const;

/** Indicateur clé (tableau de bord agent). Le libellé précède la valeur dans l'ordre de lecture. */
export function StatCard({ label, value, unit, icon, hint, tone = "primary", className }: StatCardProps) {
  return (
    <dl className={cx("flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 shadow-card", className)}>
      <dt className="flex items-center gap-3 text-sm font-semibold text-ink-muted">
        {icon ? (
          <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", chip[tone])}>{icon}</span>
        ) : null}
        <span>{label}</span>
      </dt>
      <dd className="text-2xl font-bold whitespace-nowrap text-ink tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-base font-semibold text-ink-muted">{unit}</span> : null}
      </dd>
      {hint ? <dd className="text-sm text-ink-muted">{hint}</dd> : null}
    </dl>
  );
}
