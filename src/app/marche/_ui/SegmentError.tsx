"use client";

/**
 * État erreur des pages M3 (utilisé par les error.tsx) : message simple, rien de technique,
 * bouton « Réessayer » qui relance le rendu du segment.
 */
import { useEffect } from "react";
import { Button, Callout } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

export function SegmentError({ error, reset, titleKey = "error.generic" }: { error: Error & { digest?: string }; reset: () => void; titleKey?: string }) {
  const t = useT();
  useEffect(() => {
    // Le détail reste côté serveur (digest) ; rien d'autre n'est affiché.
    console.error("[m3] erreur de rendu", error.digest ?? "");
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Callout
        tone="critical"
        role="alert"
        title={t(titleKey)}
        action={
          <Button onClick={reset} size="sm">
            {t("common.retry")}
          </Button>
        }
      />
    </div>
  );
}
