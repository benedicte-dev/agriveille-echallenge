"use client";

import { useEffect } from "react";
import { Button, Callout, useOnline } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

/** Erreur du parcours « Signaler » : message simple, rien de technique, Réessayer. */
export default function SignalerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const online = useOnline();
  useEffect(() => {
    console.error("[signaler]", error.digest ?? error.message);
  }, [error]);
  return (
    <Callout
      tone={online ? "critical" : "offline"}
      role="alert"
      title={online ? t("error.generic") : t("offline.title")}
      action={
        <Button onClick={reset} size="md">
          {t("common.retry")}
        </Button>
      }
    >
      {online ? t("rep.error_load") : t("offline.message")}
    </Callout>
  );
}
