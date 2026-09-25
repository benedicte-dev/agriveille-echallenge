"use client";

import { IconHorsLigne } from "@/components/icons";
import { Button, Callout, useOnline } from "@/components/ui";
import { useOfflineQueue } from "@/lib/offline";
import { useT } from "@/lib/i18n/provider";

/** Réessayer (recharge l'adresse demandée) + état de la file d'envois. */
export function OfflineActions() {
  const t = useT();
  const online = useOnline();
  const { ready, pending } = useOfflineQueue();
  return (
    <div className="flex flex-col gap-3">
      {ready && pending > 0 ? (
        <Callout tone="offline" title={t("offline.pending", { count: pending })}>
          {t("rep.queued_message")}
        </Callout>
      ) : null}
      {online ? (
        <Callout tone="success" role="status" title={t("off.back_online")} />
      ) : null}
      <Button size="lg" block icon={<IconHorsLigne size={24} />} onClick={() => window.location.reload()}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
