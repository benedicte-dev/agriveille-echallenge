"use client";

import { startTransition, useActionState, useId } from "react";
import { IconCheck, IconCroix } from "@/components/icons";
import { Button, Callout, Field, Input, Select, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { reviewReportAction, type ReviewActionState } from "../actions";

export interface ReviewPestOption {
  id: string;
  label: string;
  likely: boolean;
}

/** Formulaire de décision : ravageur identifié, rayon, note, confirmer ou rejeter. */
export function ReviewForm({
  reportId,
  pests,
  defaultPestId,
  defaultRadiusKm,
}: {
  reportId: string;
  pests: ReviewPestOption[];
  defaultPestId: string | null;
  defaultRadiusKm: number;
}) {
  const t = useT();
  const uid = useId();
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(reviewReportAction, { status: "idle" });
  const fields = state.status === "error" ? state.fields ?? {} : {};
  const likely = pests.filter((p) => p.likely);
  const others = pests.filter((p) => !p.likely);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        // Envoi manuel : React ne vide pas le formulaire, la note reste saisie en cas d'erreur.
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget);
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="reportId" value={reportId} />

      {state.status === "ok" ? (
        <Callout tone="success" role="status" title={state.decision === "CONFIRMED" ? t("rep.agent.confirmed_result", { count: state.recipients ?? 0 }) : t("rep.agent.rejected_result")}>
          {state.decision === "CONFIRMED"
            ? t("rep.agent.severity_note", {
                severity: t(`alert.severity.${state.severity ?? "WARNING"}`),
                count: state.confirmedNearby ?? 1,
              })
            : null}
        </Callout>
      ) : null}
      {state.status === "error" ? (
        <Callout tone={state.code === "ALREADY_REVIEWED" ? "warning" : "critical"} role="alert" title={state.code === "ALREADY_REVIEWED" ? t("rep.agent.already") : state.message}>
          {fields._form ?? null}
        </Callout>
      ) : null}

      <Field id={`${uid}-pest`} label={t("rep.agent.pest_select")} hint={t("rep.agent.pest_hint")} error={fields.pestId}>
        {(a) => (
          <Select {...a} name="pestId" defaultValue={defaultPestId ?? ""}>
            <option value="">{t("rep.agent.pest_choose")}</option>
            {likely.length > 0 ? (
              <optgroup label={t("rep.agent.pest_likely")}>
                {likely.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={likely.length > 0 ? t("rep.pest_others") : t("admin.pests")}>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          </Select>
        )}
      </Field>

      <Field id={`${uid}-radius`} label={t("agent.radius_km")} hint={t("rep.agent.radius_hint")} error={fields.radiusKm}>
        {(a) => <Input {...a} name="radiusKm" type="number" inputMode="decimal" min={1} max={100} step={0.5} defaultValue={defaultRadiusKm} className="max-w-40" />}
      </Field>

      <Field id={`${uid}-note`} label={t("agent.review_note")} hint={t("rep.agent.note_hint")} error={fields.note}>
        {(a) => <Textarea {...a} name="note" rows={3} maxLength={500} />}
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" name="decision" value="CONFIRMED" size="md" icon={<IconCheck size={22} />} loading={pending} loadingLabel={t("rep.agent.processing")}>
          {t("agent.report_confirm")}
        </Button>
        <Button type="submit" name="decision" value="REJECTED" size="md" variant="secondary" icon={<IconCroix size={22} />} disabled={pending}>
          {t("agent.report_reject")}
        </Button>
      </div>
    </form>
  );
}
