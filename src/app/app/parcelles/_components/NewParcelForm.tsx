"use client";

import { useActionState, useState } from "react";
import { IconCarte, IconCheck, IconPlus, getCropIcon } from "@/components/icons";
import { Button, Callout, Field, Input, Select, cx } from "@/components/ui";
import { createParcelAction, type ParcelFormState } from "../actions";

export type NewParcelLabels = {
  crop: string;
  commune: string;
  communePlaceholder: string;
  location: string;
  locationHint: string;
  useMyLocation: string;
  locating: string;
  located: string;
  geoError: string;
  name: string;
  nameHint: string;
  area: string;
  sowingDate: string;
  submit: string;
  saving: string;
  required: string;
};

export type CropOption = { id: string; label: string; icon: string };
export type CommuneOption = { id: string; label: string };

/**
 * Formulaire « Ajouter un champ » : culture par pictogramme, commune en liste,
 * position par géolocalisation (sinon le serveur prend le centre de la commune).
 * Toutes les règles (bornes du Bénin, récolte prévue, statut) sont côté serveur.
 */
export function NewParcelForm({
  crops,
  communes,
  defaultCommuneId,
  today,
  labels,
}: {
  crops: CropOption[];
  communes: CommuneOption[];
  defaultCommuneId: string | null;
  today: string;
  labels: NewParcelLabels;
}) {
  const [state, formAction, pending] = useActionState<ParcelFormState | undefined, FormData>(createParcelAction, undefined);
  const [cropId, setCropId] = useState<string>("");
  const [pos, setPos] = useState<{ lat: string; lon: string } | null>(null);
  const [geo, setGeo] = useState<"idle" | "locating" | "ok" | "error">("idle");
  const errors = state?.fieldErrors ?? {};

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeo("error");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude.toFixed(5), lon: p.coords.longitude.toFixed(5) });
        setGeo("ok");
      },
      () => {
        setPos(null);
        setGeo("error");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state && !state.ok && state.error ? (
        <Callout tone="critical" role="alert" title={state.error}>
          {errors.lat ?? errors._form ?? null}
        </Callout>
      ) : null}

      <fieldset className="flex flex-col gap-2" aria-describedby={errors.cropId ? "cropId-error" : undefined}>
        <legend className="mb-2 text-base font-semibold text-ink">
          {labels.crop} <span className="text-sm font-normal text-ink-muted">({labels.required})</span>
        </legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {crops.map((c) => {
            const Icon = getCropIcon(c.icon);
            const checked = cropId === c.id;
            return (
              <label
                key={c.id}
                className={cx(
                  "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 bg-surface p-2 text-center has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  checked ? "border-primary bg-primary-soft" : "border-line-strong hover:border-ink",
                )}
              >
                <input
                  type="radio"
                  name="cropId"
                  value={c.id}
                  checked={checked}
                  onChange={() => setCropId(c.id)}
                  className="sr-only"
                  required
                />
                <Icon size={44} className="text-primary" />
                <span className="text-base font-semibold text-ink">{c.label}</span>
                {checked ? <IconCheck size={20} className="text-primary" aria-hidden="true" /> : null}
              </label>
            );
          })}
        </div>
        {errors.cropId ? (
          <p id="cropId-error" role="alert" className="text-base font-semibold text-critical">
            {errors.cropId}
          </p>
        ) : null}
      </fieldset>

      <Field id="communeId" label={labels.commune} required requiredLabel={labels.required} error={errors.communeId}>
        {(a) => (
          <Select {...a} name="communeId" defaultValue={defaultCommuneId ?? ""}>
            <option value="" disabled>
              {labels.communePlaceholder}
            </option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-ink">{labels.location}</p>
        <p className="text-sm text-ink-muted">{labels.locationHint}</p>
        <Button
          type="button"
          variant="secondary"
          icon={<IconCarte size={24} />}
          loading={geo === "locating"}
          loadingLabel={labels.locating}
          onClick={locate}
        >
          {labels.useMyLocation}
        </Button>
        <p role="status" className={geo === "ok" ? "text-base font-semibold text-success" : geo === "error" ? "text-base font-semibold text-critical" : "sr-only"}>
          {geo === "ok" && pos ? `${labels.located} (${pos.lat}, ${pos.lon})` : geo === "error" ? labels.geoError : ""}
        </p>
        <input type="hidden" name="lat" value={pos?.lat ?? ""} />
        <input type="hidden" name="lon" value={pos?.lon ?? ""} />
      </div>

      <Field id="areaHa" label={labels.area} required requiredLabel={labels.required} error={errors.areaHa}>
        {(a) => <Input {...a} name="areaHa" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" defaultValue="1" />}
      </Field>

      <Field id="sowingDate" label={labels.sowingDate} required requiredLabel={labels.required} error={errors.sowingDate}>
        {(a) => <Input {...a} name="sowingDate" type="date" defaultValue={today} />}
      </Field>

      <Field id="name" label={labels.name} hint={labels.nameHint} error={errors.name}>
        {(a) => <Input {...a} name="name" maxLength={60} autoComplete="off" />}
      </Field>

      <Button type="submit" size="lg" block icon={<IconPlus size={24} />} loading={pending} loadingLabel={labels.saving}>
        {labels.submit}
      </Button>
    </form>
  );
}
