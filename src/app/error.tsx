"use client";

import { Button } from "@/components/ui";
import { IconAccueil, IconDanger } from "@/components/icons";
import { useT } from "@/lib/i18n/provider";

/**
 * Erreur inattendue d'un segment. Message simple, jamais de détail technique
 * (Next ne transmet d'ailleurs qu'un identifiant pour les erreurs serveur).
 * Next 16 : `retry()` re-récupère le segment ; `reset()` reste en repli.
 */
export default function ErrorPage({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const tr = useT();
  const again = retry ?? reset;
  return (
    <main id="contenu" tabIndex={-1} className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-12 text-center outline-none">
      <span className="flex size-20 items-center justify-center rounded-full bg-critical-soft text-critical">
        <IconDanger size={48} />
      </span>
      <h1 className="text-xl sm:text-2xl">{tr("error.generic")}</h1>
      <p className="max-w-prose text-base text-ink-muted">{tr("pub.error.text")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {again ? (
          <Button type="button" onClick={() => again()}>
            {tr("common.retry")}
          </Button>
        ) : null}
        <Button href="/" variant="secondary" icon={<IconAccueil size={24} />}>
          {tr("nav.home")}
        </Button>
      </div>
      {error.digest ? (
        <p className="text-sm text-ink-muted">
          {tr("pub.error.ref")} <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </main>
  );
}
