import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconPayer, IconQr } from "@/components/icons";
import { OfficialHeader } from "@/components/brand/OfficialHeader";
import { Badge, Callout, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getDeclarationForOwner } from "@/server/levies/queries";
import { payDemoAction } from "@/server/levies/actions";
import { appOrigin, qrDataUrl, verifyPath } from "@/server/levies/qr";
import { formatDate, formatFcfa, formatKg, pickLocalized } from "@/server/market/format";
import { dateLocale, pageI18n } from "@/app/marche/_ui/labels";
import { ActionButton } from "@/app/marche/_ui/ActionButton";
import { PrintButton } from "@/app/marche/_ui/PrintButton";
import { STATUS_TONE } from "@/app/app/redevances/page";

export const metadata: Metadata = { title: "Quittance" };

/**
 * Quittance imprimable d'une déclaration : QR de vérification, détails, bouton « Payer (démo) »
 * tant qu'elle n'est pas payée. Propriété stricte : `getDeclarationForOwner` filtre par
 * `farmerId = acteur` ; une quittance absente ou d'un autre fermier donne 404 (anti-IDOR).
 */
export default async function QuittancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouvelle?: string }>;
}) {
  const user = await requireRole("FARMER");
  const [{ id }, sp, { locale, tr, listenLabels }] = await Promise.all([params, searchParams, pageI18n()]);
  const d = await getDeclarationForOwner({ id: user.id, role: user.role }, id);
  if (!d) notFound();

  const origin = await appOrigin();
  const verifyUrl = `${origin}${verifyPath(d.verificationCode)}`;
  const qr = await qrDataUrl(verifyUrl);
  const dl = dateLocale(locale);
  const levyLabel = pickLocalized(locale, d.levyRate.labelFr, d.levyRate.labelFon, d.levyRate.labelYo);
  const cropLabel = d.crop ? pickLocalized(locale, d.crop.nameFr, d.crop.nameFon, d.crop.nameYo) : null;
  const notPaid = d.status === "SUBMITTED";

  return (
    <>
      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; }
          #quittance-print { border: none !important; box-shadow: none !important; background: #fff !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title={tr("lev.receipt_title", { number: d.receiptNumber })}
          icon={<IconQr size={36} />}
          backHref="/app/redevances"
          backLabel={tr("common.back")}
          listen={{
            text: `${tr("lev.receipt_title", { number: d.receiptNumber })}. ${formatFcfa(d.amountDueFcfa)}. ${tr(`levy.status.${d.status}`)}`,
            lang: locale,
            labels: listenLabels,
          }}
        />
      </div>

      {sp.nouvelle === "1" ? (
        <Callout tone="success" role="status" title={tr("lev.receipt_created")} className="no-print mb-4" />
      ) : null}

      <div id="quittance-print" className="flex flex-col gap-6 rounded-2xl border-2 border-line bg-surface p-6 shadow-card">
        <OfficialHeader
          armsAlt={tr("brand.arms_alt")}
          republic={tr("brand.republic")}
          motto={tr("brand.motto")}
          ministry={tr("brand.ministry")}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">{tr("levy.title")}</p>
            <p className="text-2xl font-bold tabular-nums">{d.receiptNumber}</p>
          </div>
          <Badge tone={STATUS_TONE[d.status]} size="md">
            {tr(`levy.status.${d.status}`)}
          </Badge>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">{tr("lev.holder")}</dt>
            <dd className="text-lg font-semibold">{d.farmer.fullName}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("mkt.filter.commune")}</dt>
            <dd className="text-lg font-semibold">{d.farmer.commune?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("levy.rate")}</dt>
            <dd className="text-lg font-semibold">{levyLabel}</dd>
          </div>
          {cropLabel ? (
            <div>
              <dt className="text-sm text-ink-muted">{tr("lev.crop_optional")}</dt>
              <dd className="text-lg font-semibold">{cropLabel}</dd>
            </div>
          ) : null}
          {d.quantityKg != null ? (
            <div>
              <dt className="text-sm text-ink-muted">{tr("lev.quantity_kg")}</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatKg(d.quantityKg)}</dd>
            </div>
          ) : null}
          {d.declaredValueFcfa != null ? (
            <div>
              <dt className="text-sm text-ink-muted">{tr("levy.declared_value")}</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatFcfa(d.declaredValueFcfa)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-sm text-ink-muted">{tr("lev.col.date")}</dt>
            <dd className="text-lg font-semibold">{tr("lev.declared_on", { date: formatDate(d.createdAt, dl) })}</dd>
          </div>
          {d.paidAt ? (
            <div>
              <dt className="text-sm text-ink-muted">{tr("lev.col.status")}</dt>
              <dd className="text-lg font-semibold">{tr("lev.paid_on", { date: formatDate(d.paidAt, dl) })}</dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-sm text-ink-muted">{tr("levy.amount_due")}</dt>
            <dd className="text-3xl font-bold tabular-nums">{formatFcfa(d.amountDueFcfa)}</dd>
          </div>
        </dl>

        <div className="flex flex-col items-center gap-3 border-t border-line pt-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL générée côté serveur, pas d'optimisation next/image utile */}
          <img
            src={qr}
            alt={tr("lev.qr_alt", { number: d.receiptNumber })}
            width={200}
            height={200}
            className="h-[200px] w-[200px]"
          />
          <p className="text-sm text-ink-muted">{tr("lev.qr_hint")}</p>
          <div>
            <p className="text-sm text-ink-muted">{tr("lev.verification_code")}</p>
            <p className="text-xl font-bold tracking-widest tabular-nums">{d.verificationCode}</p>
          </div>
          <p className="text-sm text-ink-muted">{tr("lev.demo_document")}</p>
        </div>
      </div>

      <div className="no-print mt-6 flex flex-col gap-4">
        {notPaid ? (
          <Callout tone="warning" title={tr("lev.not_paid_yet")}>
            <div className="mt-3 flex flex-col gap-2">
              <ActionButton
                action={payDemoAction}
                fields={{ declarationId: d.id }}
                label={tr("levy.pay_demo")}
                pendingLabel={tr("lev.submitting")}
                icon={<IconPayer size={24} />}
                size="lg"
              />
              <p className="text-sm text-ink-muted">{tr("lev.simulation_label")}</p>
            </div>
          </Callout>
        ) : null}
        <PrintButton label={tr("lev.print")} />
      </div>
    </>
  );
}
