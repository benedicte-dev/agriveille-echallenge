import type { Metadata } from "next";
import { alertTypeIcons, IconAlerte } from "@/components/icons";
import { Badge, Card, DataTable, PageHeader, SeverityBadge, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recentAlertStats, type RecentAlertStat } from "@/server/monitoring";
import { pageI18n } from "@/server/monitoring/present";
import { newClientKey } from "./client-key";
import { ManualAlertForm } from "./_components/ManualAlertForm";
import { RunPanel } from "./_components/RunPanel";

export const metadata: Metadata = { title: "Émettre une alerte" };
// L'analyse lancée depuis cette page peut durer jusqu'à ~45 s.
export const maxDuration = 60;

export default async function AgentAlertesPage() {
  await requireRole("AGENT");
  const i = await pageI18n();
  const [alerts, communes] = await Promise.all([
    recentAlertStats(20),
    prisma.commune.findMany({ orderBy: { name: "asc" }, take: 200, select: { id: true, name: true, department: true } }),
  ]);
  const severityLabels = {
    INFO: i.tr("alert.severity.INFO"),
    WARNING: i.tr("alert.severity.WARNING"),
    CRITICAL: i.tr("alert.severity.CRITICAL"),
  };

  const columns: Column<RecentAlertStat>[] = [
    {
      key: "type",
      header: i.tr("mon.agent.field_type"),
      primary: true,
      cell: (a) => {
        const Icon = alertTypeIcons[a.type];
        return (
          <span className="flex items-start gap-2">
            <Icon size={22} className="mt-0.5 shrink-0 text-ink-muted" />
            <span className="flex flex-col">
              <span className="font-semibold">{i.tr(`alert.type.${a.type}`)}</span>
              <span className="text-sm text-ink-muted">{a.titleFr}</span>
            </span>
          </span>
        );
      },
    },
    { key: "severity", header: i.tr("mon.agent.field_severity"), cell: (a) => <SeverityBadge severity={a.severity} labels={severityLabels} size="sm" /> },
    { key: "source", header: i.tr("mon.agent.col_source"), hideOnMobile: true, cell: (a) => <Badge tone="neutral">{i.tr(`mon.agent.source.${a.source}`)}</Badge> },
    { key: "zone", header: i.tr("mon.agent.col_zone"), cell: (a) => a.place ?? "—" },
    { key: "date", header: i.tr("common.date"), cell: (a) => i.fmtDate(a.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) },
    {
      key: "ack",
      header: i.tr("agent.kpi.ack_rate"),
      align: "end",
      cell: (a) =>
        a.delivered === 0 ? (
          <span className="text-ink-muted">{i.tr("mon.agent.no_delivery")}</span>
        ) : (
          <span className="tabular-nums">
            {Math.round((a.acknowledged / a.delivered) * 100)} %{" "}
            <span className="text-sm text-ink-muted">({i.tr("mon.agent.ack_of", { ack: a.acknowledged, total: a.delivered })})</span>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title={i.tr("mon.agent.title")} icon={<IconAlerte size={32} />} subtitle={i.tr("mon.agent.subtitle")} />
      <div className="flex flex-col gap-6">
        <Card as="section" title={i.tr("mon.agent.run_title")}>
          <RunPanel />
        </Card>
        <Card as="section" title={i.tr("mon.agent.manual_title")}>
          <ManualAlertForm
            communes={communes.map((c) => ({ id: c.id, label: `${c.name} (${c.department})` }))}
            initialKey={newClientKey()}
          />
        </Card>
        <Card as="section" title={i.tr("mon.agent.recent_title")}>
          <DataTable
            caption={i.tr("mon.agent.recent_title")}
            columns={columns}
            rows={alerts}
            rowKey={(a) => a.id}
            empty={<p className="text-base text-ink-muted">{i.tr("mon.agent.recent_empty")}</p>}
          />
        </Card>
      </div>
    </>
  );
}
