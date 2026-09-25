import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone =
  | "neutral"
  | "primary"
  | "earth"
  | "sun"
  | "info"
  | "warning"
  | "critical"
  | "critical-strong"
  | "success";

/** Couples fond / texte mesurés ≥ 4.5:1 sur les deux thèmes (docs/DESIGN.md §Contrastes). */
export const toneClasses: Record<Tone, string> = {
  neutral: "bg-sunken text-ink border-line-strong",
  primary: "bg-primary-soft text-primary border-primary",
  earth: "bg-earth-soft text-earth border-earth",
  sun: "bg-sun-soft text-sun-ink border-sun-ink",
  info: "bg-info-soft text-info border-info",
  warning: "bg-warning-soft text-warning border-warning",
  critical: "bg-critical-soft text-critical border-critical",
  /** Plein : réservé à la sévérité CRITICAL (se distingue aussi par le remplissage). */
  "critical-strong": "bg-critical text-on-critical border-critical",
  success: "bg-success-soft text-success border-success",
};

export type BadgeProps = {
  tone?: Tone;
  /** Pictogramme décoratif avant le mot (le mot reste obligatoire). */
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

/** Étiquette de statut : toujours un mot, jamais une pastille de couleur seule. */
export function Badge({ tone = "neutral", icon, size = "sm", className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-sm" : "px-3 py-1 text-base",
        toneClasses[tone],
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

/** Compteur rond (ex. alertes non lues). Le nombre est lu via `label` (ex. « 3 nouvelles alertes »). */
export function CountBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cx(
        "inline-flex min-w-7 items-center justify-center rounded-full border-2 border-surface bg-critical px-1.5",
        "text-sm leading-6 font-bold text-on-critical tabular-nums",
        className,
      )}
    >
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
