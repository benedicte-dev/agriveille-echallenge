import type { Metadata } from "next";
import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { IconCamera, IconMicro, IconSignaler } from "@/components/icons";
import { Button, DataTable, EmptyState, PageHeader, cx, intlLocale, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getMessages, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { listReports, type ReportListItem } from "@/server/reports";
import { ReportStatusBadge } from "@/app/app/signaler/status";

export const metadata: Metadata = { title: "Signalements" };

const FILTERS = ["PENDING", "CONFIRMED", "REJECTED", "ALL"] as const;
type Filter = (typeof FILTERS)[number];
const PAGE_SIZE = 25;

function toFilter(v: unknown): Filter {
  return typeof v === "string" && (FILTERS as readonly string[]).includes(v) ? (v as Filter) : "PENDING";
}

/** File de traitement des signalements (AGENT/ADMIN), filtrable par statut. */
export default async function AgentSignalementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const agent = await requireRole("AGENT");
  const sp = await searchParams;
  const filter = toFilter(sp.status);
  const locale = await getLocale();
  const m = getMessages(locale);
  const result = await listReports(agent, {
    status: filter === "ALL" ? undefined : filter,
    page: typeof sp.page === "string" ? sp.page : undefined,
    pageSize: PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Porto-Novo" });
  const href = (f: Filter, page = 1) => `/agent/signalements?status=${f}${page > 1 ? `&page=${page}` : ""}`;

  const columns: Column<ReportListItem>[] = [
    {
      key: "date",
      header: t(m, "rep.agent.col.date"),
      primary: true,
      cell: (r) => (
        <Link href={`/agent/signalements/${r.id}`} className="font-semibold">
          {dateFmt.format(r.createdAt)}
        </Link>
      ),
    },
    {
      key: "place",
      header: t(m, "rep.agent.col.place"),
      cell: (r) => (
        <span>
          {r.communeName}
          <span className="block text-ink-muted">{r.parcel ? r.parcel.name : r.department}</span>
        </span>
      ),
    },
    { key: "pest", header: t(m, "rep.agent.col.pest"), cell: (r) => r.pest?.nameFr ?? <span className="text-ink-muted">{t(m, "rep.agent.not_declared")}</span> },
    {
      key: "evidence",
      header: t(m, "rep.agent.col.evidence"),
      hideOnMobile: true,
      cell: (r) => (
        <span className="flex flex-wrap gap-2">
          {r.hasPhoto ? (
            <span className="inline-flex items-center gap-1">
              <IconCamera size={18} /> {t(m, "rep.with_photo")}
            </span>
          ) : null}
          {r.hasVoice ? (
            <span className="inline-flex items-center gap-1">
              <IconMicro size={18} /> {t(m, "rep.with_voice")}
            </span>
          ) : null}
          {r.hasDescription ? <span>{t(m, "rep.with_text")}</span> : null}
        </span>
      ),
    },
    { key: "reporter", header: t(m, "rep.agent.reporter"), hideOnMobile: true, cell: (r) => r.reporterName ?? "" },
    { key: "status", header: t(m, "rep.agent.col.status"), cell: (r) => <ReportStatusBadge status={r.status} label={t(m, `report.status.${r.status}`)} size="sm" /> },
    {
      key: "action",
      header: t(m, "rep.agent.col.action"),
      align: "end",
      cell: (r) => (
        <Button href={`/agent/signalements/${r.id}`} size="sm" variant={r.status === "PENDING" ? "primary" : "secondary"} aria-label={`${t(m, "rep.agent.examine")} : ${dateFmt.format(r.createdAt)}, ${r.communeName}`}>
          {t(m, "rep.agent.examine")}
        </Button>
      ),
    },
  ];

  const filterLabel = (f: Filter) => (f === "ALL" ? t(m, "rep.agent.all") : t(m, `report.status.${f as ReportStatus}`));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t(m, "agent.reports")} icon={<IconSignaler size={32} />} subtitle={t(m, "rep.agent.list_subtitle", { count: result.total })} />

      <nav aria-label={t(m, "rep.agent.filter")}>
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <li key={f}>
              <Link
                href={href(f)}
                aria-current={f === filter ? "page" : undefined}
                className={cx(
                  "av-control inline-flex min-h-touch items-center rounded-full border-2 px-4 font-semibold no-underline",
                  f === filter ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-sunken",
                )}
              >
                {filterLabel(f)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <DataTable
        caption={`${t(m, "agent.reports")} · ${filterLabel(filter)}`}
        columns={columns}
        rows={result.items}
        rowKey={(r) => r.id}
        empty={
          filter === "ALL" ? (
            <EmptyState kind="first-use" icon={<IconSignaler size={48} />} title={t(m, "rep.agent.empty")} message={t(m, "rep.agent.empty_hint")} />
          ) : (
            <EmptyState
              kind="no-results"
              icon={<IconSignaler size={48} />}
              title={t(m, "rep.agent.no_results", { status: filterLabel(filter) })}
              action={
                <Button href={href("ALL")} variant="secondary" size="sm">
                  {t(m, "rep.agent.clear_filter")}
                </Button>
              }
            />
          )
        }
      />

      {pages > 1 ? (
        <nav aria-label={t(m, "rep.pagination")} className="flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Button href={href(filter, result.page - 1)} variant="secondary" size="sm">
              {t(m, "rep.prev")}
            </Button>
          ) : (
            <span />
          )}
          <span>{t(m, "rep.page_of", { page: result.page, pages })}</span>
          {result.page < pages ? (
            <Button href={href(filter, result.page + 1)} variant="secondary" size="sm">
              {t(m, "rep.next")}
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
