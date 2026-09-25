import type { ReactNode } from "react";
import { IconCheck, IconHorsLigne, severityIcons } from "@/components/icons";
import { toneClasses } from "./Badge";
import { cx } from "./cx";

export type CalloutTone = "info" | "warning" | "critical" | "success" | "offline";

const icons = {
  info: severityIcons.INFO,
  warning: severityIcons.WARNING,
  critical: severityIcons.CRITICAL,
  success: IconCheck,
  offline: IconHorsLigne,
} as const;

export type CalloutProps = {
  tone?: CalloutTone;
  title: ReactNode;
  children?: ReactNode;
  /** Bouton ou lien d'action (Réessayer, Voir…). */
  action?: ReactNode;
  /** Remplace le pictogramme par défaut. */
  icon?: ReactNode;
  /**
   * Annonce aux lecteurs d'écran : "status" (poli, succès / info) ou "alert" (immédiat, erreur).
   * Omettre pour un encadré statique déjà présent au chargement.
   */
  role?: "status" | "alert";
  className?: string;
};

/** Encadré de message : états succès, erreur, hors ligne, conseil. Pictogramme + titre + texte. */
export function Callout({ tone = "info", title, children, action, icon, role, className }: CalloutProps) {
  const Icon = icons[tone];
  const toneCls = tone === "offline" ? toneClasses.neutral : toneClasses[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-xl border-2 p-4", toneCls, className)}>
      <span className="mt-0.5 shrink-0">{icon ?? <Icon size={28} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">{title}</p>
        {children ? <div className="mt-1 text-base text-ink">{children}</div> : null}
        {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
