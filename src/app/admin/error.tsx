"use client";

import { useEffect } from "react";
import { Button, Callout } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error("[admin]", error.digest ?? error.message);
  }, [error]);
  return (
    <Callout
      tone="critical"
      role="alert"
      title={t("error.generic")}
      action={
        <Button onClick={reset} size="sm">
          {t("common.retry")}
        </Button>
      }
    >
      {t("adm.err.load")}
    </Callout>
  );
}
