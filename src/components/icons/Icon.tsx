import type { ReactNode, SVGProps } from "react";

/**
 * Pictogrammes AgriVeille : grille 24×24, trait 2 px, extrémités arrondies, currentColor.
 * - Sans `title` : décoratif (aria-hidden), le libellé visible porte le sens.
 * - Avec `title` : role="img" + aria-label, pour une icône seule porteuse de sens.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Taille en px (largeur = hauteur). Défaut 24. */
  size?: number;
  /** Nom accessible. Si absent, l'icône est décorative. */
  title?: string;
};

export type IconComponent = ((props: IconProps) => ReactNode) & { displayName?: string };

export function createIcon(displayName: string, glyph: ReactNode): IconComponent {
  function Icon({ size = 24, title, strokeWidth = 2, ...rest }: IconProps) {
    const a11y = title
      ? { role: "img" as const, "aria-label": title }
      : { "aria-hidden": true as const, focusable: "false" as const };
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...a11y}
        {...rest}
      >
        {glyph}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/** Petit élément plein (graines, taches, points) : même couleur que le trait. */
export function Dot({ cx, cy, r = 1 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
}
