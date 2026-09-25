import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconCamera, IconCarte, IconHorloge, IconSignaler } from "@/components/icons";
import { Callout, Card, PageHeader, SeverityBadge, intlLocale } from "@/components/ui";
import { formatBeninPhone, requireRole } from "@/lib/auth";
import { getMessages, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { DEFAULT_OUTBREAK_RADIUS_KM, getReport, isReportError, listPestOptions, type ReportDetail } from "@/server/reports";
import { ReportStatusBadge } from "@/app/app/signaler/status";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "Examiner un signalement" };

const HISTORY_KEYS: Record<string, string> = {
  "report.create": "rep.agent.hist.create",
  "report.confirm": "rep.agent.hist.confirm",
  "report.reject": "rep.agent.hist.reject",
};

const LANG_NAMES: Record<string, string> = { fr: "français", fon: "fɔngbe", yo: "yorùbá" };

async function load(agent: { id: string; role: "AGENT" | "ADMIN" | "FARMER" | "BUYER" }, id: string): Promise<ReportDetail> {
  try {
    return await getReport(agent, id);
  } catch (err) {
    if (isReportError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
}

/** Détail d'un signalement et décision de l'agent (docs/uml/04). */
export default async function AgentSignalementPage({ params }: { params: Promise<{ id: string }> }) {
  const agent = await requireRole("AGENT");
  const { id } = await params;
  const [report, pests, locale] = await Promise.all([load(agent, id), listPestOptions(), getLocale()]);
  const m = getMessages(locale);
  const dt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Porto-Novo" });
  const d = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeZone: "Africa/Porto-Novo" });
  const num = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });
  const coords = `${report.lat.toFixed(5)}, ${report.lon.toFixed(5)}`;
  const osm = `https://www.openstreetmap.org/?mlat=${report.lat.toFixed(5)}&mlon=${report.lon.toFixed(5)}#map=14/${report.lat.toFixed(5)}/${report.lon.toFixed(5)}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t(m, "rep.agent.detail_title", { date: dt.format(report.createdAt) })}
        icon={<IconSignaler size={32} />}
        subtitle={`${report.communeName} · ${report.department}`}
        backHref="/agent/signalements"
        backLabel={t(m, "agent.reports")}
        actions={<ReportStatusBadge status={report.status} label={t(m, `report.status.${report.status}`)} />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Card title={t(m, "rep.agent.evidence")}>
            {report.hasPhoto ? (
              <a href={`/api/reports/${report.id}/photo`} target="_blank" rel="noopener" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route autorisée, sans optimiseur */}
                <img
                  src={`/api/reports/${report.id}/photo`}
                  alt={t(m, "rep.agent.photo_alt")}
                  className="max-h-[28rem] w-full rounded-lg border border-line bg-sunken object-contain"
                  loading="lazy"
                  decoding="async"
                />
                <span className="mt-1 block text-sm">{t(m, "rep.agent.photo_open")}</span>
              </a>
            ) : (
              <p className="flex items-center gap-2 text-ink-muted">
                <IconCamera size={22} /> {t(m, "rep.agent.no_photo")}
              </p>
            )}
            {report.voiceTranscript ? (
              <div className="mt-4">
                <h3 className="text-base">{t(m, "rep.agent.transcript", { lang: LANG_NAMES[report.voiceLang ?? ""] ?? "?" })}</h3>
                <p lang={report.voiceLang ?? undefined} className="mt-1 rounded-lg bg-sunken p-3 whitespace-pre-line">
                  {report.voiceTranscript}
                </p>
              </div>
            ) : null}
            {report.description ? (
              <div className="mt-4">
                <h3 className="text-base">{t(m, "rep.agent.description")}</h3>
                <p className="mt-1 rounded-lg bg-sunken p-3 whitespace-pre-line">{report.description}</p>
              </div>
            ) : null}
          </Card>

          <Card title={t(m, "rep.agent.location")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
              <dt className="text-ink-muted">{t(m, "parcel.commune")}</dt>
              <dd>
                {report.communeName} ({report.department})
              </dd>
              <dt className="text-ink-muted">{t(m, "rep.agent.parcel")}</dt>
              <dd>
                {report.parcel ? report.parcel.name : t(m, "rep.agent.no_parcel")}
                {report.parcelDistanceKm !== null && report.parcelDistanceKm >= 0.05 ? (
                  <span className="block text-sm text-ink-muted">{t(m, "rep.agent.parcel_distance", { km: num.format(report.parcelDistanceKm) })}</span>
                ) : null}
              </dd>
              <dt className="text-ink-muted">{t(m, "rep.agent.coordinates")}</dt>
              <dd className="tabular-nums">{coords}</dd>
            </dl>
            <a href={osm} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-touch items-center gap-2 font-semibold">
              <IconCarte size={22} /> {t(m, "rep.agent.open_map")}
            </a>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title={t(m, "rep.agent.reporter")}>
            <p className="text-base font-semibold">{report.reporter.fullName}</p>
            {report.reporter.phone ? <p className="text-base tabular-nums">{formatBeninPhone(report.reporter.phone)}</p> : null}
            <p className="mt-2 text-base">
              <span className="text-ink-muted">{t(m, "rep.agent.declared_pest")} : </span>
              {report.pest?.nameFr ?? t(m, "rep.agent.not_declared")}
            </p>
          </Card>

          {report.status === "PENDING" ? (
            <Card title={t(m, "rep.agent.decision")}>
              <ReviewForm
                reportId={report.id}
                defaultPestId={report.pest?.id ?? null}
                defaultRadiusKm={DEFAULT_OUTBREAK_RADIUS_KM}
                pests={pests.map((p) => ({
                  id: p.id,
                  label: `${p.nameFr} (${t(m, `rep.pest_kind.${p.kind}`)})`,
                  likely: report.pest?.id === p.id,
                }))}
              />
            </Card>
          ) : (
            <Card title={t(m, "rep.agent.decision")}>
              <p className="text-base">
                {t(m, "rep.agent.reviewed_by", {
                  name: report.reviewedBy?.fullName ?? "?",
                  date: report.reviewedAt ? dt.format(report.reviewedAt) : "?",
                })}
              </p>
              {report.reviewNote ? <p className="mt-2 rounded-lg bg-sunken p-3">{report.reviewNote}</p> : null}
              {report.status === "CONFIRMED" && report.alerts.length === 0 ? (
                <Callout tone="warning" title={t(m, "rep.agent.no_alert")} className="mt-3" />
              ) : null}
              {report.alerts.map((a) => (
                <div key={a.id} className="mt-3 flex flex-col gap-2 rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge
                      severity={a.severity}
                      labels={{ INFO: t(m, "alert.severity.INFO"), WARNING: t(m, "alert.severity.WARNING"), CRITICAL: t(m, "alert.severity.CRITICAL") }}
                    />
                    <span className="font-semibold">{t(m, "alert.type.PEST_OUTBREAK")}</span>
                  </div>
                  <p className="text-lg font-bold">{t(m, "rep.agent.confirmed_result", { count: a.recipients })}</p>
                  {a.recipients === 0 ? <p className="text-base">{t(m, "rep.agent.zero_recipients")}</p> : null}
                  <p className="text-base text-ink-muted">
                    {t(m, "rep.agent.alert_meta", {
                      km: num.format(a.radiusKm ?? DEFAULT_OUTBREAK_RADIUS_KM),
                      date: d.format(a.validUntil),
                      acks: a.acknowledged,
                    })}
                  </p>
                </div>
              ))}
            </Card>
          )}

          <Card title={t(m, "rep.agent.history")}>
            {report.history.length === 0 ? (
              <p className="text-ink-muted">{t(m, "rep.agent.history_empty")}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {report.history.map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-base">
                    <IconHorloge size={20} className="mt-0.5 shrink-0 text-ink-muted" />
                    <span>
                      <span className="font-semibold">{HISTORY_KEYS[h.action] ? t(m, HISTORY_KEYS[h.action]) : h.action}</span>
                      {h.actorName ? ` · ${h.actorName}` : ""}
                      <span className="block text-sm text-ink-muted">{dt.format(h.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
