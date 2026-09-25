import type { Metadata } from "next";
import { IconGraphique, IconPayer, IconQr } from "@/components/icons";
import { Badge, Callout, DataTable, EmptyState, PageHeader, StatCard, type Column } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { markPaidAtCounterAction, validateDeclarationAction } from "@/server/levies/actions";
import { declarationsToReview, revenueStats, type ReviewRow } from "@/server/levies/queries";
import type { Bucket } from "@/server/levies/stats";
import { formatDate, formatFcfa, formatInt } from "@/server/market/format";
import { ActionButton } from "@/app/marche/_ui/ActionButton";
import { dateLocale, pageI18n, type Tr } from "@/app/marche/_ui/labels";
import { STATUS_TONE } from "@/app/app/redevances/page";
import { BarChart } from "./BarChart";

export const metadata: Metadata = { title: "Recettes" };

const MONTHS = 6;

function monthLabel(key: string, dl: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(dl, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function BucketSection({ id, title, keyHeader, buckets, tr }: { id: string; title: string; keyHeader: string; buckets: Bucket[]; tr: Tr }) {
  const columns: Column<Bucket>[] = [
    { key: "label", header: keyHeader, cell: (b) => b.label, primary: true },
    { key: "total", header: tr("lev.col.total"), cell: (b) => formatFcfa(b.totalFcfa), align: "end" },
    { key: "count", header: tr("lev.col.count"), cell: (b) => formatInt(b.count), align: "end" },
  ];
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {buckets.length === 0 ? (
        <p className="text-ink-muted">{tr("lev.no_data")}</p>
      ) : (
        <>
          <BarChart buckets={buckets} label={tr("lev.chart_label", { title })} />
          <DataTable caption={title} columns={columns} rows={buckets} rowKey={(b) => b.key} />
        </>
      )}
    </section>
  );
}

/** Recettes (AGENT/ADMIN) : indicateurs, totaux par barème, commune et mois, déclarations à traiter. */
export default async function AgentRecettesPage() {
  const agent = await requireRole("AGENT");
  const actor = { id: agent.id, role: agent.role };
  const { locale, tr, listenLabels } = await pageI18n();
  const dl = dateLocale(locale);
  const [stats, review] = await Promise.all([
    revenueStats(actor, { months: MONTHS, locale, noCommuneLabel: tr("lev.no_commune") }),
    declarationsToReview(actor, locale),
  ]);
  if (!stats) return null; // requireRole a déjà filtré ; garde défensive.

  const byMonth = stats.byMonth.map((b) => ({ ...b, label: monthLabel(b.key, dl) }));

  const reviewColumns: Column<ReviewRow>[] = [
    { key: "receipt", header: tr("lev.col.receipt"), cell: (r) => <span className="font-bold tabular-nums">{r.receiptNumber}</span>, primary: true },
    { key: "farmer", header: tr("lev.col.farmer"), cell: (r) => r.farmerName },
    { key: "commune", header: tr("lev.col.commune"), cell: (r) => r.communeName ?? tr("lev.no_commune"), hideOnMobile: true },
    { key: "levy", header: tr("lev.col.levy"), cell: (r) => r.levyLabel, hideOnMobile: true },
    { key: "amount", header: tr("lev.col.amount"), cell: (r) => formatFcfa(r.amountDueFcfa), align: "end" },
    { key: "date", header: tr("lev.col.date"), cell: (r) => formatDate(r.paidAt ?? r.createdAt, dl) },
    { key: "status", header: tr("lev.col.status"), cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{tr(`levy.status.${r.status}`)}</Badge> },
    {
      key: "actions",
      header: tr("lev.col.actions"),
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.status === "SUBMITTED" ? (
            <ActionButton action={markPaidAtCounterAction} fields={{ declarationId: r.id }} label={tr("lev.action.counter")} variant="secondary" hideOnSuccess />
          ) : (
            <ActionButton
              action={validateDeclarationAction}
              fields={{ declarationId: r.id, decision: "VALIDATED" }}
              label={tr("lev.action.validate")}
              hideOnSuccess
            />
          )}
          <ActionButton
            action={validateDeclarationAction}
            fields={{ declarationId: r.id, decision: "REJECTED" }}
            label={tr("lev.action.reject")}
            variant="danger"
            hideOnSuccess
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={tr("lev.revenue_title")}
        icon={<IconGraphique size={36} />}
        listen={{
          text: `${tr("lev.revenue_title")}. ${tr("lev.kpi.collected")} : ${formatFcfa(stats.collectedFcfa)}.`,
          lang: locale,
          labels: listenLabels,
        }}
      />
      <p className="mb-4 text-ink-muted">{tr("lev.period", { months: MONTHS })}</p>
      {stats.truncated ? <Callout tone="warning" title={tr("lev.truncated")} className="mb-4" /> : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label={tr("lev.kpi.collected")} value={formatInt(stats.collectedFcfa)} unit="FCFA" icon={<IconPayer size={24} />} />
        <StatCard
          label={tr("lev.kpi.receipts")}
          value={formatInt(stats.receiptsCount)}
          icon={<IconQr size={24} />}
          tone="earth"
          hint={tr("lev.kpi.awaiting_payment", { count: formatInt(stats.awaitingPaymentCount) })}
        />
        <StatCard
          label={tr("lev.kpi.awaiting_validation")}
          value={formatInt(stats.awaitingValidationCount)}
          icon={<IconGraphique size={24} />}
          tone="warning"
        />
      </div>

      <div className="mb-10 flex flex-col gap-6">
        <BucketSection id="par-bareme" title={tr("lev.by_levy")} keyHeader={tr("lev.col.levy")} buckets={stats.byLevy} tr={tr} />
        <BucketSection id="par-commune" title={tr("lev.by_commune")} keyHeader={tr("lev.col.commune")} buckets={stats.byCommune} tr={tr} />
        <BucketSection id="par-mois" title={tr("lev.by_month")} keyHeader={tr("lev.col.month")} buckets={byMonth} tr={tr} />
      </div>

      <section aria-labelledby="a-traiter">
        <h2 id="a-traiter" className="mb-3 text-xl">
          {tr("lev.to_review")}
        </h2>
        <DataTable
          caption={tr("lev.to_review")}
          columns={reviewColumns}
          rows={review}
          rowKey={(r) => r.id}
          empty={<EmptyState kind="first-use" icon={<IconQr size={44} />} title={tr("lev.review_empty")} />}
        />
      </section>
    </>
  );
}
