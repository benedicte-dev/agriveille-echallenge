import { cx } from "./cx";

/** Bloc gris qui pulse (arrêté sous prefers-reduced-motion). Décoratif. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("block animate-pulse rounded-md bg-sunken", className)} />;
}

export type LoadingBlockProps = {
  /** Texte lu (et visible pour les lecteurs d'écran), ex. « Chargement de la météo… ». */
  label?: string;
  /** Forme approximative du contenu attendu : lignes de texte, cartes, jours météo. */
  shape?: "lines" | "cards" | "weather";
  count?: number;
  className?: string;
};

/**
 * État « chargement » : squelette à la forme du contenu (pas de saut de mise en page)
 * + libellé textuel annoncé (role="status"). Au-delà de ~10 s, la page affiche plutôt
 * un Callout d'attente (réseau 2G).
 */
export function LoadingBlock({ label = "Chargement…", shape = "lines", count = 3, className }: LoadingBlockProps) {
  return (
    <div role="status" aria-live="polite" className={cx("w-full", className)}>
      <span className="sr-only">{label}</span>
      {shape === "lines" ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className={cx("h-5", i === count - 1 ? "w-3/5" : "w-full")} />
          ))}
        </div>
      ) : shape === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className="h-36 w-22 shrink-0 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}
