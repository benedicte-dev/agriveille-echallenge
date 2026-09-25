import { severityIcons } from "@/components/icons";
import { Badge, type Tone } from "./Badge";

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export const severityTone: Record<Severity, Tone> = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical-strong",
};

export const DEFAULT_SEVERITY_LABELS: Record<Severity, string> = {
  INFO: "Information",
  WARNING: "Attention",
  CRITICAL: "Danger",
};

export type SeverityBadgeProps = {
  severity: Severity;
  /** Libellés traduits (clé i18n côté page). Défaut : français. */
  labels?: Partial<Record<Severity, string>>;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Sévérité d'alerte = forme + mot + couleur. La couleur n'est jamais seule :
 * cercle « i » (INFO), triangle « ! » (WARNING), octogone « ! » sur fond plein (CRITICAL).
 */
export function SeverityBadge({ severity, labels, size = "sm", className }: SeverityBadgeProps) {
  const Icon = severityIcons[severity];
  const label = labels?.[severity] ?? DEFAULT_SEVERITY_LABELS[severity];
  return (
    <Badge
      tone={severityTone[severity]}
      size={size}
      icon={<Icon size={size === "sm" ? 18 : 22} />}
      className={className}
    >
      {label}
    </Badge>
  );
}
