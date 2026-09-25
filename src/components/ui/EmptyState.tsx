import type { ReactNode } from "react";
import { cx } from "./cx";

export type EmptyStateProps = {
  /**
   * "first-use" : rien n'a encore été créé (ex. aucun champ) → invite à la première action.
   * "no-results" : un filtre ou une recherche ne donne rien → propose d'élargir.
   */
  kind?: "first-use" | "no-results";
  /** Pictogramme 48 px, ex. <IconChamp size={48} />. */
  icon: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  /** Action principale (Button). Recommandée pour "first-use". */
  action?: ReactNode;
  /** Bouton Écouter (écrans fermier). */
  listen?: ReactNode;
  className?: string;
};

/** État vide : pictogramme, phrase, une action. Jamais une zone blanche muette. */
export function EmptyState({ kind = "first-use", icon, title, message, action, listen, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-xl px-5 py-8 text-center",
        kind === "first-use" ? "border-2 border-dashed border-line-strong bg-surface" : "bg-sunken",
        className,
      )}
    >
      <span
        className={cx(
          "flex size-20 items-center justify-center rounded-full",
          kind === "first-use" ? "bg-primary-soft text-primary" : "bg-surface text-ink-muted",
        )}
      >
        {icon}
      </span>
      <p className="text-lg font-bold text-ink">{title}</p>
      {message ? <p className="max-w-prose text-base text-ink-muted">{message}</p> : null}
      {listen}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
