import Link from "next/link";
import { Children, type ReactNode } from "react";
import { CountBadge } from "./Badge";
import { cx } from "./cx";

export type TileTone = "primary" | "earth" | "sun" | "info" | "critical" | "neutral";

const chip: Record<TileTone, string> = {
  primary: "bg-primary-soft text-primary",
  earth: "bg-earth-soft text-earth",
  sun: "bg-sun-soft text-sun-ink",
  info: "bg-info-soft text-info",
  critical: "bg-critical-soft text-critical",
  neutral: "bg-sunken text-ink",
};

export type IconTileProps = {
  href: string;
  /** Pictogramme en élément, ex. <IconChamp size={48} />. */
  icon: ReactNode;
  /** Libellé court (1 à 2 mots), toujours visible. */
  label: string;
  /** Ligne d'aide facultative (ex. « 3 champs »). */
  hint?: string;
  /** Compteur (alertes non lues). 0 ou absent : pas de badge. */
  badge?: number;
  /** Texte lu pour le badge, ex. « 3 nouvelles alertes ». Obligatoire si badge > 0. */
  badgeLabel?: string;
  /** Couleur du médaillon : aide à la mémorisation, jamais seule porteuse du sens. */
  tone?: TileTone;
  className?: string;
};

/**
 * Grande tuile de navigation fermier : pictogramme 48 px + mot, cible ≥ 144 px de haut.
 * Un seul lien par tuile (un geste). Le badge est inclus dans le nom accessible.
 */
export function IconTile({ href, icon, label, hint, badge = 0, badgeLabel, tone = "primary", className }: IconTileProps) {
  return (
    <Link
      href={href}
      className={cx(
        "group relative flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl border-2 border-line",
        "bg-surface p-4 text-center text-ink no-underline shadow-card transition-colors",
        "hover:border-primary active:bg-sunken",
        className,
      )}
    >
      <span className={cx("relative flex size-20 items-center justify-center rounded-full", chip[tone])}>
        {icon}
        {badge > 0 ? (
          <CountBadge
            count={badge}
            label={badgeLabel ?? String(badge)}
            className="absolute -top-1 -right-2"
          />
        ) : null}
      </span>
      <span className="text-lg leading-tight font-bold">{label}</span>
      {hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
    </Link>
  );
}

/** Grille 2 colonnes (mobile) → 3 colonnes (≥ 640 px) pour les tuiles. */
export function TileGrid({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {Children.toArray(children).map((child, i) => (
          <li key={i} className="flex *:w-full">
            {child}
          </li>
        ))}
      </ul>
    </nav>
  );
}
