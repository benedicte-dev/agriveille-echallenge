"use client";

/**
 * Déclaration de redevance : barème par pictogramme → quantité ou valeur → montant affiché
 * avant validation. L'aperçu utilise la même fonction pure que le serveur (computeAmountDue),
 * mais le serveur recalcule toujours : aucun montant n'est envoyé.
 */
import { useActionState, useState } from "react";
import { IconPayer, IconRecolte, IconVendre } from "@/components/icons";
import { Button, Callout, Field, Input, Select, useOnline } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { IDLE } from "@/server/market/action-state";
import { formatFcfa, formatInt } from "@/server/market/format";
import { previewAmountDue, requiredInputFor } from "@/server/levies/compute";
import { ChoiceTiles } from "@/app/marche/_ui/ChoiceTiles";
import type { ServerAction } from "@/app/marche/_ui/ActionButton";

export type LevyOption = { id: string; label: string; basis: "PER_KG" | "PERCENT_VALUE" | "FLAT"; rate: number };

const BASIS_ICON = { PER_KG: IconRecolte, PERCENT_VALUE: IconVendre, FLAT: IconPayer } as const;

export function basisText(t: (k: string, v?: Record<string, string | number>) => string, l: Pick<LevyOption, "basis" | "rate">): string {
  const rate = l.basis === "PERCENT_VALUE" ? (l.rate / 100).toLocaleString("fr-FR") : formatInt(l.rate);
  return t(`lev.basis.${l.basis}`, { rate });
}

export function DeclareForm({
  action,
  levies,
  crops,
}: {
  action: ServerAction;
  levies: LevyOption[];
  crops: { id: string; name: string }[];
}) {
  const t = useT();
  const online = useOnline();
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [levyId, setLevyId] = useState(levies.length === 1 ? levies[0].id : "");
  const [quantity, setQuantity] = useState("");
  const [value, setValue] = useState("");
  const fe = state.fieldErrors ?? {};

  const levy = levies.find((l) => l.id === levyId);
  const needed = levy ? requiredInputFor(levy.basis) : null;
  const amount = levy
    ? previewAmountDue(levy, {
        quantityKg: quantity ? Number(quantity) : undefined,
        declaredValueFcfa: value ? Number(value) : undefined,
      })
    : null;

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {state.status === "error" ? <Callout tone="critical" role="alert" title={state.message ?? t("error.generic")} /> : null}

      <ChoiceTiles
        name="levyRateId"
        legend={t("lev.step1")}
        value={levyId}
        onChange={setLevyId}
        columns={levies.length >= 3 ? 3 : 2}
        required
        error={fe.levyRateId}
        choices={levies.map((l) => {
          const Icon = BASIS_ICON[l.basis];
          return { value: l.id, label: l.label, hint: basisText(t, l), icon: <Icon size={32} /> };
        })}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-lg font-bold text-ink">{t("lev.step2")}</legend>
        {needed === "quantityKg" || needed === null ? (
          <Field
            id="quantityKg"
            label={t("lev.quantity_kg")}
            error={fe.quantityKg}
            required={needed === "quantityKg"}
            requiredLabel={t("common.required")}
          >
            {(a) => (
              <Input
                {...a}
                name="quantityKg"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="text-xl tabular-nums"
              />
            )}
          </Field>
        ) : null}
        {needed === "declaredValueFcfa" ? (
          <Field id="declaredValueFcfa" label={t("lev.value_fcfa")} error={fe.declaredValueFcfa} required requiredLabel={t("common.required")}>
            {(a) => (
              <Input
                {...a}
                name="declaredValueFcfa"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="text-xl tabular-nums"
              />
            )}
          </Field>
        ) : null}
        <Field id="cropId" label={t("lev.crop_optional")} error={fe.cropId}>
          {(a) => (
            <Select {...a} name="cropId" defaultValue="">
              <option value="">{t("lev.no_crop")}</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </fieldset>

      <section aria-labelledby="montant" className="rounded-xl border-2 border-info bg-info-soft p-4">
        <h2 id="montant" className="text-lg font-bold text-ink">
          {t("lev.step3")}
        </h2>
        <p className="mt-2 text-2xl font-bold text-ink tabular-nums" aria-live="polite">
          {amount !== null ? t("lev.amount_preview", { amount: formatFcfa(amount) }) : t("lev.amount_preview_missing")}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{t("lev.amount_server_note")}</p>
      </section>

      <div className="flex flex-col gap-2">
        {!online ? <Callout tone="offline" title={t("offline.title")}>{t("mkt.offline_form")}</Callout> : null}
        <Button
          type="submit"
          size="lg"
          block
          loading={pending}
          loadingLabel={t("lev.submitting")}
          disabled={!online || amount === null}
          icon={<IconPayer size={24} />}
        >
          {t("lev.submit")}
        </Button>
      </div>
    </form>
  );
}
