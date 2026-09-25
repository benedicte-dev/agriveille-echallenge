import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

export type CardProps = {
  /** Élément racine : section, article, li, div (défaut). */
  as?: ElementType;
  /** Titre facultatif (h2 par défaut, niveau réglable). */
  title?: ReactNode;
  titleAs?: "h2" | "h3" | "h4";
  /** Zone à droite du titre (badge, bouton Écouter…). */
  actions?: ReactNode;
  /** Bande de couleur à gauche, pour relier la carte à une sévérité (en plus du badge). */
  accent?: "primary" | "earth" | "info" | "warning" | "critical";
  padding?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  id?: string;
  "aria-labelledby"?: string;
};

const accents = {
  primary: "border-l-primary",
  earth: "border-l-earth",
  info: "border-l-info",
  warning: "border-l-warning",
  critical: "border-l-critical",
} as const;

const pads = { sm: "p-3", md: "p-4 sm:p-5", lg: "p-5 sm:p-6" } as const;

/** Surface blanche, bord 1 px, une seule élévation. */
export function Card({
  as: Tag = "div",
  title,
  titleAs: H = "h2",
  actions,
  accent,
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx(
        "rounded-xl border border-line bg-surface text-ink shadow-card",
        accent && cx("border-l-4", accents[accent]),
        pads[padding],
        className,
      )}
      {...rest}
    >
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          {title ? <H className="text-lg">{title}</H> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
