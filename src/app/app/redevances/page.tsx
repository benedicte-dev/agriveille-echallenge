import type { Metadata } from "next";
import Link from "next/link";
import { IconChevron, IconPayer, IconQr } from "@/components/icons";
import { Badge, Callout, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createDeclarationAction } from "@/server/levies/actions";
import { activeLevyRates, myDeclarations } from "@/server/levies/queries";
import { formatDate, formatFcfa, pickLocalized } from "@/server/market/format";
import { marketReferenceData } from "@/server/market/queries";
import { cropName, dateLocale, pageI18n } from "@/app/marche/_ui/labels";
import { DeclareForm } from "./DeclareForm";

export const metadata: Metadata = { title: "Redevances" };

export const STATUS_TONE = { SUBMITTED: "warning", PAID: "success", VALIDATED: "primary", REJECTED: "critical" } as const;

/** Déclarer une vente (montant calculé avant validation) et retrouver ses quittances. */
export default async function RedevancesPage() {
  const user = await requireRole("FARMER");
  const actor = { id: user.id, role: user.role };
  const [{ locale, tr, listenLabels }, levies, { crops }, declarations] = await Promise.all([
    pageI18n(),
    activeLevyRates(),
    marketReferenceData(),
    myDeclarations(actor),
  ]);
  const dl = dateLocale(locale);

  return (
    <>
      <PageHeader
        title={tr("levy.title")}
        icon={<IconPayer size={36} />}
        backHref="/app"
        backLabel={tr("common.back")}
        listen={{ text: `${tr("levy.title")}. ${tr("lev.listen_page")}`, lang: locale, labels: listenLabels }}
      />

      <section aria-labelledby="declarer" className="mb-10">
        <h2 id="declarer" className="mb-4 text-xl">
          {tr("levy.declare")}
        </h2>
        {levies.length === 0 ? (
          <Callout tone="info" title={tr("lev.err.rate_unknown")} />
        ) : (
          <DeclareForm
            action={createDeclarationAction}
            levies={levies.map((l) => ({
              id: l.id,
              label: pickLocalized(locale, l.labelFr, l.labelFon, l.labelYo),
              basis: l.basis,
              rate: l.rate,
            }))}
            crops={crops.map((c) => ({ id: c.id, name: cropName(locale, c) }))}
          />
        )}
      </section>

      <section aria-labelledby="quittances">
        <h2 id="quittances" className="mb-4 text-xl">
          {tr("levy.receipts")}
        </h2>
        {declarations.length === 0 ? (
          <EmptyState
            kind="first-use"
            icon={<IconQr size={44} />}
            title={tr("lev.receipts_empty_title")}
            message={tr("lev.receipts_empty_msg")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {declarations.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/app/quittance/${d.id}`}
                  className="flex min-h-touch-lg items-center gap-3 rounded-xl border border-line bg-surface p-4 text-ink no-underline shadow-card hover:border-primary"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
                    <IconQr size={28} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold tabular-nums">{d.receiptNumber}</span>
                    <span className="block text-sm text-ink-muted">
                      {pickLocalized(locale, d.levyRate.labelFr, d.levyRate.labelFon, d.levyRate.labelYo)} ·{" "}
                      {formatDate(d.paidAt ?? d.createdAt, dl)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-bold tabular-nums">{formatFcfa(d.amountDueFcfa)}</span>
                    <Badge tone={STATUS_TONE[d.status]}>{tr(`levy.status.${d.status}`)}</Badge>
                  </span>
                  <IconChevron size={22} className="shrink-0 text-ink-muted" />
                  <span className="sr-only">{tr("lev.see_receipt")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
