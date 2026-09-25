"use client";

import { useEffect } from "react";
import { IconHorsLigne } from "@/components/icons";
import { Button, Callout, LoadingBlock, useOnline } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

/**
 * États partagés des segments du monitoring (fermier et agent) :
 * chargement (squelette + libellé traduit) et erreur (message simple + Réessayer).
 */
export function SegmentLoading({ shape = "cards", label = "common.loading" }: { shape?: "cards" | "weather" | "lines"; label?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4 pt-2">
      <LoadingBlock shape="lines" count={2} label={t(label)} />
      <LoadingBlock shape={shape} count={shape === "weather" ? 7 : 3} label="" />
    </div>
  );
}

export function SegmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  const online = useOnline();
  useEffect(() => {
    console.error("[monitoring] erreur d'affichage", error.digest ?? error.message);
  }, [error]);
  return online ? (
    <Callout
      tone="critical"
      role="alert"
      title={t("error.generic")}
      action={
        <Button variant="primary" onClick={() => retry()}>
          {t("common.retry")}
        </Button>
      }
    >
      {t("mon.error_kept")}
    </Callout>
  ) : (
    <Callout
      tone="offline"
      role="status"
      icon={<IconHorsLigne size={28} />}
      title={t("offline.title")}
      action={
        <Button variant="secondary" onClick={() => retry()}>
          {t("common.retry")}
        </Button>
      }
    >
      {t("offline.message")}
    </Callout>
  );
}
