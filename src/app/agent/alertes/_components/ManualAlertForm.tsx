"use client";

import { useActionState } from "react";
import { IconAlerte } from "@/components/icons";
import { Button, Callout, Field, Input, Select, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { manualAlertAction, type ManualState } from "../actions";

const TYPES = ["PEST_OUTBREAK", "PEST_RISK", "DROUGHT", "HEAVY_RAIN", "HEAT", "WIND", "SOWING_WINDOW", "HARVEST_WINDOW"] as const;
const SEVERITIES = ["WARNING", "CRITICAL", "INFO"] as const;

export function ManualAlertForm({
  communes,
  initialKey,
}: {
  communes: Array<{ id: string; label: string }>;
  initialKey: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<ManualState | undefined, FormData>(manualAlertAction, undefined);
  const e = state?.fieldErrors ?? {};
  const key = state?.nextKey ?? initialKey;
  const req = t("common.required");

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.ok && state.result ? (
        <Callout tone="success" role="status" title={t(state.result.created ? "mon.agent.manual_sent" : "mon.agent.manual_duplicate")}>
          {t("mon.agent.manual_recipients", {
            count: state.result.recipients,
            parcels: state.result.parcels,
            commune: state.result.commune,
          })}
        </Callout>
      ) : state && !state.ok && state.error ? (
        <Callout tone="critical" role="alert" title={state.error} />
      ) : null}

      <input type="hidden" name="clientKey" value={key} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="type" label={t("mon.agent.field_type")} required requiredLabel={req} error={e.type}>
          {(a) => (
            <Select {...a} name="type" defaultValue="PEST_OUTBREAK">
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`alert.type.${x}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="severity" label={t("mon.agent.field_severity")} required requiredLabel={req} error={e.severity}>
          {(a) => (
            <Select {...a} name="severity" defaultValue="WARNING">
              {SEVERITIES.map((x) => (
                <option key={x} value={x}>
                  {t(`alert.severity.${x}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="communeId" label={t("parcel.commune")} required requiredLabel={req} error={e.communeId}>
          {(a) => (
            <Select {...a} name="communeId" defaultValue="">
              <option value="" disabled>
                {t("mon.new.commune_placeholder")}
              </option>
              {communes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="radiusKm" label={t("mon.agent.field_radius")} required requiredLabel={req} error={e.radiusKm}>
            {(a) => <Input {...a} name="radiusKm" type="number" inputMode="numeric" min="1" max="100" step="1" defaultValue="15" />}
          </Field>
          <Field id="validDays" label={t("mon.agent.field_valid_days")} required requiredLabel={req} error={e.validDays}>
            {(a) => <Input {...a} name="validDays" type="number" inputMode="numeric" min="1" max="30" step="1" defaultValue="3" />}
          </Field>
        </div>
      </div>

      <Field id="titleFr" label={t("mon.agent.field_title")} hint={t("mon.agent.fr_hint")} required requiredLabel={req} error={e.titleFr}>
        {(a) => <Input {...a} name="titleFr" maxLength={120} lang="fr" autoComplete="off" />}
      </Field>
      <Field id="messageFr" label={t("mon.agent.field_message")} required requiredLabel={req} error={e.messageFr}>
        {(a) => <Textarea {...a} name="messageFr" maxLength={600} lang="fr" />}
      </Field>
      <Field id="adviceFr" label={t("mon.agent.field_advice")} error={e.adviceFr}>
        {(a) => <Textarea {...a} name="adviceFr" maxLength={400} rows={3} lang="fr" />}
      </Field>

      <div>
        <Button type="submit" icon={<IconAlerte size={24} />} loading={pending} loadingLabel={t("mon.agent.manual_sending")}>
          {t("mon.agent.manual_submit")}
        </Button>
      </div>
    </form>
  );
}
