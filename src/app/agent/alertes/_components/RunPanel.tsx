"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconGraphique } from "@/components/icons";
import { Button, Callout } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { runMonitoringAction, type RunState } from "../actions";

/** « Lancer l'analyse maintenant » : exécute le monitoring et affiche le rapport. */
export function RunPanel() {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<RunState | null>(null);

  function run() {
    setReport(null);
    startTransition(async () => {
      try {
        const res = await runMonitoringAction();
        setReport(res);
        if (res.ok) router.refresh();
      } catch {
        setReport({ ok: false, error: t("error.network") });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-ink-muted">{t("mon.agent.run_hint")}</p>
      <div>
        <Button icon={<IconGraphique size={24} />} loading={pending} loadingLabel={t("mon.agent.running")} onClick={run}>
          {t("mon.agent.run")}
        </Button>
      </div>
      {report && report.ok ? (
        <Callout
          tone={report.errors > 0 ? "warning" : "success"}
          role="status"
          title={t("mon.agent.run_done", { created: report.created, duplicates: report.duplicates })}
        >
          <ul className="list-disc pl-5">
            <li>{t("mon.agent.run_analyzed", { analyzed: report.analyzed, parcels: report.parcels })}</li>
            <li>{t("mon.agent.run_deliveries", { count: report.deliveries })}</li>
            <li>{t("mon.agent.run_errors", { count: report.errors, noWeather: report.noWeather })}</li>
            {report.deferred > 0 ? <li>{t("mon.agent.run_deferred", { count: report.deferred })}</li> : null}
            <li>{t("mon.agent.run_duration", { seconds: Math.round(report.durationMs / 100) / 10 })}</li>
          </ul>
        </Callout>
      ) : report && !report.ok ? (
        <Callout tone="critical" role="alert" title={report.error} />
      ) : (
        <p role="status" className="sr-only" />
      )}
    </div>
  );
}
