"use client";

/**
 * Nouvelle annonce en 3 gestes : culture (pictogramme) → quantité et prix (prix de référence
 * affiché à côté, un appui pour le reprendre) → marché local / export. Le reste est facultatif.
 * La validation qui fait foi est côté serveur (zod) ; ici on guide seulement.
 */
import { useActionState, useState } from "react";
import { getCropIcon, IconCarte, IconCheck, IconVendre } from "@/components/icons";
import { Button, Callout, Field, Input, Select, Textarea, useOnline } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { IDLE } from "@/server/market/action-state";
import { formatInt } from "@/server/market/format";
import { CERTIFICATIONS } from "@/server/market/constants";
import { ChoiceTiles } from "@/app/marche/_ui/ChoiceTiles";
import type { ServerAction } from "@/app/marche/_ui/ActionButton";

export type CropOption = { id: string; slug: string; icon: string; name: string };
export type RefOption = { cropId: string; market: "LOCAL" | "EXPORT"; national: number | null; locals: Record<string, number> };

const QTY_PRESETS = [100, 500, 1000, 5000];

export function NewListingForm({
  action,
  crops,
  communes,
  refs,
  defaultCommuneId,
  today,
}: {
  action: ServerAction;
  crops: CropOption[];
  communes: { id: string; name: string }[];
  refs: RefOption[];
  defaultCommuneId: string | null;
  today: string;
}) {
  const t = useT();
  const online = useOnline();
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [cropId, setCropId] = useState("");
  const [market, setMarket] = useState<"LOCAL" | "EXPORT">("LOCAL");
  const [communeId, setCommuneId] = useState(defaultCommuneId ?? "");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const fe = state.fieldErrors ?? {};

  const ref = refs.find((r) => r.cropId === cropId && r.market === market);
  const local = ref && communeId ? ref.locals[communeId] : undefined;
  const reference = local !== undefined ? { price: local, scope: "local" } : ref?.national != null ? { price: ref.national, scope: "national" } : null;

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {state.status === "error" ? <Callout tone="critical" role="alert" title={state.message ?? t("error.generic")} /> : null}

      <ChoiceTiles
        name="cropId"
        legend={t("mkt.step1")}
        value={cropId}
        onChange={setCropId}
        required
        error={fe.cropId}
        choices={crops.map((c) => {
          const Icon = getCropIcon(c.icon || c.slug);
          return { value: c.id, label: c.name, icon: <Icon size={36} /> };
        })}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-lg font-bold text-ink">{t("mkt.step2")}</legend>
        <Field id="quantityKg" label={t("mkt.quantity_kg")} error={fe.quantityKg} required requiredLabel={t("common.required")}>
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
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("mkt.quantity_kg")}>
          {QTY_PRESETS.map((q) => (
            <Button key={q} variant="secondary" size="sm" aria-pressed={quantity === String(q)} onClick={() => setQuantity(String(q))}>
              {formatInt(q)} kg
            </Button>
          ))}
        </div>

        <Field
          id="pricePerKgFcfa"
          label={t("mkt.price_fcfa_kg")}
          error={fe.pricePerKgFcfa}
          required
          requiredLabel={t("common.required")}
          hint={
            cropId
              ? reference
                ? t("mkt.ref_help", { amount: formatInt(reference.price), scope: t(`mkt.ref_scope.${reference.scope}`) })
                : t("mkt.ref_missing")
              : undefined
          }
        >
          {(a) => (
            <Input
              {...a}
              name="pricePerKgFcfa"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 7))}
              className="text-xl tabular-nums"
            />
          )}
        </Field>
        {reference && price !== String(reference.price) ? (
          <div>
            <Button variant="secondary" size="sm" icon={<IconCheck size={20} />} onClick={() => setPrice(String(reference.price))}>
              {t("market.reference_price")} : {formatInt(reference.price)} FCFA
            </Button>
          </div>
        ) : null}
      </fieldset>

      <ChoiceTiles
        name="market"
        legend={t("mkt.step3")}
        value={market}
        onChange={(v) => setMarket(v === "EXPORT" ? "EXPORT" : "LOCAL")}
        columns={2}
        error={fe.market}
        choices={[
          { value: "LOCAL", label: t("market.local"), hint: t("mkt.local_hint"), icon: <IconVendre size={32} /> },
          { value: "EXPORT", label: t("market.export"), hint: t("mkt.export_hint"), icon: <IconCarte size={32} /> },
        ]}
      />

      <details className="rounded-xl border border-line bg-surface p-4" open={Boolean(fe.communeId || fe.availableFrom)}>
        <summary className="min-h-touch cursor-pointer content-center font-semibold text-primary">{t("mkt.more_options")}</summary>
        <div className="mt-3 flex flex-col gap-4">
          <Field id="communeId" label={t("mkt.commune_label")} error={fe.communeId}>
            {(a) => (
              <Select {...a} name="communeId" value={communeId} onChange={(e) => setCommuneId(e.target.value)}>
                <option value="">{t("mkt.commune_profile")}</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="availableFrom" label={t("mkt.available_from_label")} error={fe.availableFrom}>
            {(a) => <Input {...a} type="date" name="availableFrom" defaultValue={today} min={today} />}
          </Field>
          <Field id="certification" label={t("market.certification")} error={fe.certification}>
            {(a) => (
              <Select {...a} name="certification" defaultValue="NONE">
                <option value="NONE">{t("mkt.cert.NONE")}</option>
                {CERTIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`mkt.cert.${c}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="qualityNote" label={t("mkt.quality_note")} error={fe.qualityNote}>
            {(a) => <Textarea {...a} name="qualityNote" maxLength={300} rows={3} />}
          </Field>
        </div>
      </details>

      <div className="flex flex-col gap-2">
        {!online ? <Callout tone="offline" title={t("offline.title")}>{t("mkt.offline_form")}</Callout> : null}
        <Button type="submit" size="lg" block loading={pending} loadingLabel={t("mkt.publishing")} disabled={!online} icon={<IconVendre size={24} />}>
          {t("mkt.publish")}
        </Button>
      </div>
    </form>
  );
}
