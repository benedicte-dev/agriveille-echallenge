"use client";

import { Button, Callout, useOnline } from "@/components/ui";
import { useOfflineQueue } from "@/lib/offline";
import { useT } from "@/lib/i18n/provider";

/**
 * Compteur des envois en attente et échecs définitifs signalés (file hors
 * ligne). Rien n'est affiché quand la file est vide.
 */
export function PendingQueue() {
  const t = useT();
  const online = useOnline();
  const { ready, pending, failures, flush, dismiss } = useOfflineQueue();
  if (!ready) return null;

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {pending > 0 ? (
        <Callout
          tone="offline"
          title={t("offline.pending", { count: pending })}
          action={
            online ? (
              <Button variant="secondary" size="sm" onClick={flush}>
                {t("rep.send_now")}
              </Button>
            ) : null
          }
        >
          {online ? t("rep.pending_online") : t("rep.queued_message")}
        </Callout>
      ) : null}
      {failures.map((f) => (
        <Callout
          key={f.id}
          tone="critical"
          role="alert"
          title={f.kind === "report" ? t("rep.failed_title") : t("rep.ack_failed_title")}
          action={
            <Button variant="secondary" size="sm" onClick={() => dismiss(f.id)}>
              {t("common.close")}
            </Button>
          }
        >
          {f.message}
        </Callout>
      ))}
    </div>
  );
}
