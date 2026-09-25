import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IconAlerte, IconCheck, IconDanger, IconQr } from "@/components/icons";
import { Button, Callout, PageHeader, PublicShell, cx } from "@/components/ui";
import { getRequestIp } from "@/lib/security/ip";
import { verifyReceipt, isReceiptValid } from "@/server/levies/service";
import { formatDate, formatFcfa } from "@/server/market/format";
import { dateLocale, pageI18n } from "@/app/marche/_ui/labels";

export const metadata: Metadata = { title: "Vérifier une quittance", robots: { index: false, follow: false } };

type Verdict = "valid" | "unpaid" | "rejected" | "invalid";

const VERDICT_STYLE: Record<Verdict, { box: string; icon: ReactNode }> = {
  valid: { box: "border-success bg-success-soft text-success", icon: <IconCheck size={64} strokeWidth={2.5} /> },
  unpaid: { box: "border-warning bg-warning-soft text-warning", icon: <IconAlerte size={64} strokeWidth={2.5} /> },
  rejected: { box: "border-critical bg-critical-soft text-critical", icon: <IconDanger size={64} strokeWidth={2.5} /> },
  invalid: { box: "border-critical bg-critical-soft text-critical", icon: <IconDanger size={64} strokeWidth={2.5} /> },
};

function VerdictBlock({ verdict, word, message }: { verdict: Verdict; word: string; message: string }) {
  const s = VERDICT_STYLE[verdict];
  return (
    <div role="status" className={cx("flex flex-col items-center gap-3 rounded-2xl border-4 p-6 text-center", s.box)}>
      <span className="flex size-24 items-center justify-center rounded-full bg-surface">{s.icon}</span>
      <p className="text-3xl font-bold">{word}</p>
      <p className="max-w-prose text-lg text-ink">{message}</p>
    </div>
  );
}

/** Vérification publique d'une quittance (cible du QR). Ne montre que le strict minimum. */
export default async function VerifierCodePage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, { locale, tr }] = await Promise.all([params, pageI18n()]);
  const ip = await getRequestIp();
  let raw = code;
  try {
    raw = decodeURIComponent(code);
  } catch {
    // séquence % invalide : traité comme un code inconnu par verifyReceipt
  }
  const res = await verifyReceipt(raw, { ip, locale });

  let body: ReactNode;
  if (!res.ok) {
    body =
      res.code === "rate_limited" ? (
        <Callout tone="warning" role="alert" title={tr("error.too_many")}>
          {tr("lev.verify_limited")}
        </Callout>
      ) : (
        <Callout
          tone="critical"
          role="alert"
          title={tr("error.generic")}
          action={
            <Button href={`/verifier/${encodeURIComponent(code)}`} size="sm">
              {tr("common.retry")}
            </Button>
          }
        />
      );
  } else if (!res.data) {
    body = <VerdictBlock verdict="invalid" word={tr("levy.verify_bad")} message={tr("lev.verify_bad_msg")} />;
  } else {
    const r = res.data;
    const verdict: Verdict = isReceiptValid(r.status) ? "valid" : r.status === "REJECTED" ? "rejected" : "unpaid";
    const word = { valid: tr("levy.verify_ok"), unpaid: tr("lev.verify_unpaid"), rejected: tr("lev.verify_rejected"), invalid: "" }[verdict];
    const message = { valid: tr("lev.verify_ok_msg"), unpaid: tr("lev.verify_unpaid_msg"), rejected: tr("lev.verify_rejected_msg"), invalid: "" }[verdict];
    body = (
      <div className="flex flex-col gap-4">
        <VerdictBlock verdict={verdict} word={word} message={message} />
        <dl className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">{tr("levy.receipt_number")}</dt>
            <dd className="text-lg font-bold tabular-nums">{r.receiptNumber}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("common.date")}</dt>
            <dd className="text-lg font-semibold">{formatDate(r.date, dateLocale(locale))}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("levy.rate")}</dt>
            <dd className="text-lg font-semibold">{r.levyLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("lev.col.amount")}</dt>
            <dd className="text-lg font-bold tabular-nums">{formatFcfa(r.amountDueFcfa)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("lev.col.status")}</dt>
            <dd className="text-lg font-semibold">{tr(`levy.status.${r.status}`)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{tr("lev.holder")}</dt>
            <dd className="text-lg font-semibold">{r.holder}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <PublicShell footer={<p>{tr("lev.demo_document")}</p>}>
      <PageHeader title={tr("levy.verify_title")} icon={<IconQr size={36} />} />
      {body}
      <div className="mt-6">
        <Button href="/verifier" variant="secondary" icon={<IconQr size={24} />}>
          {tr("lev.verify_another")}
        </Button>
      </div>
    </PublicShell>
  );
}
