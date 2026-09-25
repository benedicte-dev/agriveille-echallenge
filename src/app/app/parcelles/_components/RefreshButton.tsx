"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconHorloge } from "@/components/icons";
import { Button } from "@/components/ui";
import { refreshParcelAction } from "../actions";

export type RefreshLabels = { refresh: string; refreshing: string; done: string; stale: string; error: string; offline: string };

/** « Actualiser » : météo forcée + analyse, puis rafraîchissement de la page. */
export function RefreshButton({ parcelId, labels }: { parcelId: string; labels: RefreshLabels }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  function onClick() {
    setMessage(null);
    if (!navigator.onLine) {
      setMessage({ text: labels.offline, tone: "err" });
      return;
    }
    startTransition(async () => {
      try {
        const res = await refreshParcelAction(parcelId);
        if (!res.ok) setMessage({ text: labels.error, tone: "err" });
        else {
          setMessage({ text: res.stale ? labels.stale : labels.done, tone: res.stale ? "err" : "ok" });
          router.refresh();
        }
      } catch {
        setMessage({ text: labels.offline, tone: "err" });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        size="md"
        icon={<IconHorloge size={22} />}
        loading={pending}
        loadingLabel={labels.refreshing}
        onClick={onClick}
      >
        {labels.refresh}
      </Button>
      <p role="status" className={message ? `text-sm font-semibold ${message.tone === "ok" ? "text-success" : "text-critical"}` : "sr-only"}>
        {message?.text ?? ""}
      </p>
    </div>
  );
}
