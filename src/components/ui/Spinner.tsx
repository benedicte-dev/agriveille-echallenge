import { cx } from "./cx";

/**
 * Indicateur de chargement. Décoratif : le texte « Chargement… » est porté par le parent
 * (aria-busy + libellé). Sous prefers-reduced-motion, la rotation est coupée (globals.css) :
 * il reste un arc statique, et le libellé textuel reste présent.
 */
export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cx("animate-spin shrink-0", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
