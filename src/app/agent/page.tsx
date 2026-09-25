import type { Metadata } from "next";
import Link from "next/link";
import { IconAlerte, IconCarte, IconCheck, IconGraphique, IconPayer, IconSignaler } from "@/components/icons";
import { Badge, Button, DataTable, EmptyState, PageHeader, SeverityBadge, StatCard, type Column, type Tone } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getTranslator, listenLabels } from "@/server/content/ui/i18n";
import { BENIN_CENTER, getAgentKpis, getAgentMapData, recentAlertStats } from "@/server/content/agent-dashboard";
import { formatDate, formatInt } from "@/server/market/format";
import { AgentMapLoader } from "./_components/AgentMapLoader";
import type { AgentMapProps } from "./_components/map-types";

export const metadata: Metadata = { title: "Tableau de bord agent" };

const REPORT_TONE: Record<"PENDING" | "CONFIRMED" | "REJECTED", Tone> = {
  PENDING: "warning",
  CONFIRMED: "critical",
  REJECTED: "neutral",
};

type MapRow = { key: string; layer: string; tone: Tone; name: string; place: string; detail: string; coords: string };
type RecentRow = Awaited<ReturnType<typeof recentAlertStats>>[number];

/** Tableau de bord AGENT/ADMIN (docs/DESIGN.md §9.4) : à traiter, taux d'accusés, carte, recettes. */
export default async function AgentDashboardPage() {
  const agent = await requireRole("AGENT");
  const actor = { id: agent.id, role: agent.role };
  const { locale, tr } = await getTranslator();
  const dl = locale === "yo" ? "yo-NG" : "fr-FR";
  const [kpis, map, recent] = await Promise.all([getAgentKpis(actor, locale), getAgentMapData(actor), recentAlertStats(10)]);

  const sevLabels = { INFO: tr("alert.severity.INFO"), WARNING: tr("alert.severity.WARNING"), CRITICAL: tr("alert.severity.CRITICAL") };
  const coords = (lat: number, lon: number) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  const mapProps: AgentMapProps = {
    center: BENIN_CENTER,
    parcels: map.parcels,
    alerts: map.alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      severityLabel: sevLabels[a.severity],
      title: a.title,
      lat: a.lat,
      lon: a.lon,
      radiusKm: a.radiusKm,
      place: a.place,
    })),
    reports: map.reports.map((r) => ({
      id: r.id,
      lat: r.lat,
      lon: r.lon,
      communeName: r.communeName,
      pestName: r.pestName,
      status: r.status,
      statusLabel: tr(`report.status.${r.status}`),
      createdAt: formatDate(r.createdAt, dl),
    })),
    labels: {
      map: tr("agt.map.label"),
      parcel: tr("agt.map.parcel"),
      report: tr("agt.map.report"),
      unknownPest: tr("agt.map.unknown_pest"),
      examine: tr("agt.map.examine"),
      radius: tr("agt.map.radius"),
    },
  };

  const mapRows: MapRow[] = [
    ...map.reports.map((r) => ({
      key: `r-${r.id}`,
      layer: `${tr("agt.map.report")} · ${tr(`report.status.${r.status}`)}`,
      tone: REPORT_TONE[r.status],
      name: r.pestName ?? tr("agt.map.unknown_pest"),
      place: r.communeName,
      detail: formatDate(r.createdAt, dl),
      coords: coords(r.lat, r.lon),
    })),
    ...map.alerts.map((a) => ({
      key: `a-${a.id}`,
      layer: `${tr("agt.map.alert")} · ${sevLabels[a.severity]}`,
      tone: (a.severity === "CRITICAL" ? "critical" : a.severity === "WARNING" ? "warning" : "info") as Tone,
      name: a.title,
      place: a.place ?? "—",
      detail: a.radiusKm ? tr("agt.map.radius", { count: a.radiusKm }) : tr("agt.map.until", { date: formatDate(a.validUntil, dl) }),
      coords: a.lat !== null && a.lon !== null ? coords(a.lat, a.lon) : "—",
    })),
    ...map.parcels.map((p) => ({
      key: `p-${p.id}`,
      layer: tr("agt.map.parcel"),
      tone: "primary" as Tone,
      name: p.name,
      place: p.communeName,
      detail: "—",
      coords: coords(p.lat, p.lon),
    })),
  ];

  const mapColumns: Column<MapRow>[] = [
    { key: "name", header: tr("agt.col.name"), cell: (r) => r.name, primary: true },
    { key: "layer", header: tr("agt.col.layer"), cell: (r) => <Badge tone={r.tone}>{r.layer}</Badge> },
    { key: "place", header: tr("agt.col.place"), cell: (r) => r.place },
    { key: "detail", header: tr("agt.col.detail"), cell: (r) => r.detail, hideOnMobile: true },
    { key: "coords", header: tr("agt.col.coords"), cell: (r) => <span className="tabular-nums">{r.coords}</span>, hideOnMobile: true },
  ];

  const recentColumns: Column<RecentRow>[] = [
    { key: "title", header: tr("agt.col.alert"), cell: (a) => a.titleFr, primary: true },
    { key: "severity", header: tr("agt.col.severity"), cell: (a) => <SeverityBadge severity={a.severity} labels={sevLabels} size="sm" /> },
    { key: "type", header: tr("agt.col.type"), cell: (a) => tr(`alert.type.${a.type}`), hideOnMobile: true },
    { key: "source", header: tr("agt.col.source"), cell: (a) => tr(`alert.source.${a.source}`), hideOnMobile: true },
    { key: "place", header: tr("agt.col.place"), cell: (a) => a.place ?? "—" },
    { key: "date", header: tr("agt.col.date"), cell: (a) => formatDate(a.createdAt, dl) },
    {
      key: "ack",
      header: tr("agt.col.ack"),
      cell: (a) => <span className="tabular-nums">{tr("agt.kpi.ack_hint", { acknowledged: formatInt(a.acknowledged), delivered: formatInt(a.delivered) })}</span>,
      align: "end",
    },
  ];

  const ack = kpis.ackRate7d;
  const sev = kpis.activeAlerts;

  return (
    <>
      <PageHeader
        title={tr("agent.title")}
        icon={<IconGraphique size={36} />}
        listen={{
          text: `${tr("agent.title")}. ${tr("agent.kpi.pending_reports")} : ${kpis.pendingReports}. ${tr("agent.kpi.active_alerts")} : ${kpis.activeAlertsTotal}.`,
          lang: locale,
          labels: listenLabels(tr),
        }}
        actions={
          <>
            <Button href="/agent/signalements" variant="primary" icon={<IconSignaler size={22} />}>
              {tr("agt.link.reports")}
            </Button>
            <Button href="/agent/alertes" variant="secondary" icon={<IconAlerte size={22} />}>
              {tr("agt.link.alerts")}
            </Button>
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={tr("agent.kpi.pending_reports")}
          value={formatInt(kpis.pendingReports)}
          icon={<IconSignaler size={24} />}
          tone="critical"
          hint={
            <Link href="/agent/signalements?status=PENDING" className="font-semibold text-primary">
              {tr("agt.kpi.review")}
            </Link>
          }
        />
        <StatCard
          label={tr("agent.kpi.active_alerts")}
          value={formatInt(kpis.activeAlertsTotal)}
          icon={<IconAlerte size={24} />}
          tone="warning"
          hint={tr("agt.kpi.by_severity", {
            critical: formatInt(sev.CRITICAL),
            warning: formatInt(sev.WARNING),
            info: formatInt(sev.INFO),
          })}
        />
        <StatCard
          label={tr("agt.kpi.ack_rate_7d")}
          value={ack.percent === null ? "—" : formatInt(ack.percent)}
          unit={ack.percent === null ? undefined : "%"}
          icon={<IconCheck size={24} />}
          tone="primary"
          hint={
            ack.delivered === 0
              ? tr("agt.kpi.ack_none")
              : tr("agt.kpi.ack_hint", { acknowledged: formatInt(ack.acknowledged), delivered: formatInt(ack.delivered) })
          }
        />
        <StatCard
          label={tr("agent.kpi.revenue")}
          value={kpis.revenueThisMonthFcfa === null ? "—" : formatInt(kpis.revenueThisMonthFcfa)}
          unit={kpis.revenueThisMonthFcfa === null ? undefined : "FCFA"}
          icon={<IconPayer size={24} />}
          tone="earth"
          hint={
            <Link href="/agent/recettes" className="font-semibold text-primary">
              {tr("agt.kpi.revenue_link")}
            </Link>
          }
        />
        <StatCard label={tr("agt.kpi.parcels")} value={formatInt(kpis.parcelsTracked)} icon={<IconCarte size={24} />} tone="info" />
      </div>

      <section aria-labelledby="carte" className="mb-10 flex flex-col gap-3">
        <h2 id="carte" className="text-xl">
          {tr("agent.map")}
        </h2>
        <p className="text-sm text-ink-muted">{tr("agt.map.legend")}</p>
        <AgentMapLoader {...mapProps} />
        <DataTable
          caption={tr("agt.map.table_caption")}
          captionVisible
          columns={mapColumns}
          rows={mapRows}
          rowKey={(r) => r.key}
          empty={<EmptyState kind="first-use" icon={<IconCarte size={44} />} title={tr("agt.map.empty")} />}
        />
      </section>

      <section aria-labelledby="dernieres-alertes" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dernieres-alertes" className="text-xl">
            {tr("agt.recent.title")}
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/agent/alertes" className="font-semibold text-primary">
              {tr("agt.link.alerts")}
            </Link>
            <Link href="/agent/signalements" className="font-semibold text-primary">
              {tr("agt.link.reports")}
            </Link>
          </div>
        </div>
        <DataTable
          caption={tr("agt.recent.title")}
          columns={recentColumns}
          rows={recent}
          rowKey={(a) => a.id}
          empty={
            <EmptyState
              kind="first-use"
              icon={<IconAlerte size={44} />}
              title={tr("agt.recent.empty")}
              action={
                <Button href="/agent/alertes" variant="secondary">
                  {tr("agt.link.alerts")}
                </Button>
              }
            />
          }
        />
      </section>
    </>
  );
}
