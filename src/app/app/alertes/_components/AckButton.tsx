"use client";

import { useState, useTransition } from "react";
import { IconCheck } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { acknowledgeAlertAction } from "../actions";

export type AckLabels = { ack: string; acked: string; error: string; offline: string };

/**
 * Bouton « J'ai compris ». Expose `data-alert-id` et `data-offline-action="alert.ack"`
 * pour la file hors ligne (M2). Hors ligne, un événement `av:offline-queue`
 * {kind: "alert.ack", alertId} est émis pour cette file ; l'action serveur est idempotente.
 */
export function AckButton({
  alertId,
  acknowledged,
  labels,
  size = "lg",
}: {
  alertId: string;
  acknowledged: boolean;
  labels: AckLabels;
  size?: "md" | "lg";
}) {
  const [done, setDone] = useState(acknowledged);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span role="status">
        <Badge tone="success" size="md" icon={<IconCheck size={20} />}>
          {labels.acked}
        </Badge>
      </span>
    );
  }

  function onClick() {
    setMessage(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      window.dispatchEvent(new CustomEvent("av:offline-queue", { detail: { kind: "alert.ack", alertId } }));
      setMessage(labels.offline);
      return;
    }
    startTransition(async () => {
      try {
        const res = await acknowledgeAlertAction(alertId);
        if (res.ok) setDone(true);
        else setMessage(labels.error);
      } catch {
        setMessage(labels.offline);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="primary"
        size={size}
        block
        icon={<IconCheck size={24} />}
        loading={pending}
        onClick={onClick}
        data-alert-id={alertId}
        data-offline-action="alert.ack"
      >
        {labels.ack}
      </Button>
      <p role="status" className={message ? "text-base font-semibold text-critical" : "sr-only"}>
        {message ?? ""}
      </p>
    </div>
  );
}
