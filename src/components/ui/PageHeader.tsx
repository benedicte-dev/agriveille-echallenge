import Link from "next/link";
import type { ReactNode } from "react";
import { IconRetour } from "@/components/icons";
import { ListenButton, type ListenButtonProps } from "./ListenButton";
import { cx } from "./cx";

export type PageHeaderProps = {
  title: ReactNode;
  /** Pictogramme du thème de la page (48 px conseillé côté fermier). */
  icon?: ReactNode;
  /** Sous-titre court. */
  subtitle?: ReactNode;
  /** Lien retour (toujours visible, libellé + flèche). */
  backHref?: string;
  backLabel?: string;
  /** Props du bouton Écouter : lit le titre + la consigne de la page. */
  listen?: Pick<ListenButtonProps, "text" | "lang" | "audioSrc" | "labels">;
  /** Actions à droite (desktop) ou sous le titre (mobile). */
  actions?: ReactNode;
  className?: string;
};

/** En-tête de page : retour, pictogramme, titre h1, bouton Écouter. Un seul h1 par page. */
export function PageHeader({ title, icon, subtitle, backHref, backLabel = "Retour", listen, actions, className }: PageHeaderProps) {
  return (
    <header className={cx("flex flex-col gap-3 pb-4", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-touch w-fit items-center gap-2 rounded-lg px-2 font-semibold text-primary no-underline hover:bg-primary-soft"
        >
          <IconRetour size={24} />
          <span>{backLabel}</span>
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {icon ? (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-base text-ink-muted">{subtitle}</p> : null}
        </div>
        {listen || actions ? (
          <div className="flex flex-wrap items-center gap-2">
            {listen ? <ListenButton {...listen} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
