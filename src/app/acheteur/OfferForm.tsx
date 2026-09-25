"use client";

/**
 * Formulaire « Faire une offre », replié dans un <details> sous chaque annonce (progressive
 * enhancement : fonctionne sans JavaScript, le formulaire est juste toujours ouvert dans ce cas).
 */
import { useActionState } from "react";
import { IconVendre } from "@/components/icons";
import { Button, Callout, Field, Input, Textarea, useOnline } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { IDLE } from "@/server/market/action-state";
import { formatInt, formatKg } from "@/server/market/format";
import { makeOfferAction } from "@/server/market/actions";

export function OfferForm({ listingId, maxQuantityKg, askedPrice }: { listingId: string; maxQuantityKg: number; askedPrice: number }) {
  const t = useT();
  const online = useOnline();
  const [state, formAction, pending] = useActionState(makeOfferAction, IDLE);
  const fe = state.fieldErrors ?? {};
  const idPrefix = `offer-${listingId}`;

  return (
    <details className="mt-2 rounded-lg border border-line-strong bg-canvas open:p-3">
      <summary className="min-h-touch cursor-pointer list-none content-center font-semibold text-primary [&::-webkit-details-marker]:hidden">
        {t("market.make_offer")}
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="listingId" value={listingId} />
        {state.status === "error" ? <Callout tone="critical" role="alert" title={state.message ?? t("error.generic")} /> : null}
        <p className="text-sm text-ink-muted">{t("mkt.offer_available", { qty: formatKg(maxQuantityKg) })}</p>
        <Field id={`${idPrefix}-qty`} label={t("mkt.quantity_kg")} error={fe.quantityKg} required requiredLabel={t("common.required")}>
          {(a) => (
            <Input
              {...a}
              name="quantityKg"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              defaultValue={String(maxQuantityKg)}
              className="text-xl tabular-nums"
            />
          )}
        </Field>
        <Field
          id={`${idPrefix}-price`}
          label={t("mkt.price_fcfa_kg")}
          error={fe.pricePerKgFcfa}
          required
          requiredLabel={t("common.required")}
          hint={t("mkt.asked_price", { amount: formatInt(askedPrice) })}
        >
          {(a) => (
            <Input
              {...a}
              name="pricePerKgFcfa"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              defaultValue={String(askedPrice)}
              className="text-xl tabular-nums"
            />
          )}
        </Field>
        <Field id={`${idPrefix}-msg`} label={t("mkt.offer_message")} error={fe.message}>
          {(a) => <Textarea {...a} name="message" maxLength={300} rows={2} />}
        </Field>
        {!online ? <p className="text-sm text-ink-muted">{t("mkt.offline_form")}</p> : null}
        <Button type="submit" loading={pending} loadingLabel={t("mkt.offer_sending")} disabled={!online} icon={<IconVendre size={22} />}>
          {t("mkt.offer_send")}
        </Button>
      </form>
    </details>
  );
}
