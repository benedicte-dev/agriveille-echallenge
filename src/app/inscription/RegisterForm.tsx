"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Callout, Field, Input, LANGUAGE_NAMES, PinPad, Select, cx } from "@/components/ui";
import { IconChamp, IconVendre, IconCheck } from "@/components/icons";
import { registerAction, type AuthActionState } from "@/lib/auth/actions";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n";

export interface CommuneOption {
  id: string;
  name: string;
  department: string;
}

const FIELD_ORDER = ["role", "fullName", "phone", "pin", "pinConfirm", "communeId", "organization", "locale"] as const;

/**
 * Inscription publique (FARMER ou BUYER). Envoi manuel pour que React ne vide
 * pas le formulaire : en cas d'erreur, tout reste saisi sauf les PIN (à retaper),
 * et le focus va au premier champ en erreur.
 */
export function RegisterForm({ communes, currentLocale }: { communes: CommuneOption[]; currentLocale: Locale }) {
  const tr = useT();
  const [state, action, pending] = useActionState<AuthActionState, FormData>(registerAction, { ok: false });
  const [role, setRole] = useState<"FARMER" | "BUYER" | "">("");
  const [fullName, setFullName] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [organization, setOrganization] = useState("");
  const [locale, setLocale] = useState<Locale>(currentLocale);
  const [attempt, setAttempt] = useState(0);
  const [pinMismatch, setPinMismatch] = useState(false);
  const pinRef = useRef({ pin: "", confirm: "" });
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (!state.fieldErrors) return;
    const first = FIELD_ORDER.find((k) => state.fieldErrors?.[k]);
    if (!first) return;
    const el = document.getElementById(`champ-${first}`);
    const target = el?.matches("input,select,textarea") ? el : el?.querySelector<HTMLElement>("input:not([type=hidden]),select,textarea");
    target?.focus();
  }, [state]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (pinRef.current.pin.length === 4 && pinRef.current.confirm.length === 4 && pinRef.current.pin !== pinRef.current.confirm) {
      setPinMismatch(true);
      document.getElementById("champ-pinConfirm")?.querySelector("input")?.focus();
      return;
    }
    const fd = new FormData(e.currentTarget);
    setAttempt((a) => a + 1);
    startTransition(() => action(fd));
  }

  const padLabels = {
    backspace: tr("pub.pad.backspace"),
    clear: tr("pub.pad.clear"),
    progress: tr("pub.pad.progress"),
    complete: tr("pub.pad.complete"),
  };

  const departments = [...new Set(communes.map((c) => c.department))].sort((a, b) => a.localeCompare(b, "fr"));
  const roles = [
    { value: "FARMER" as const, icon: IconChamp, label: tr("pub.register.role_farmer"), hint: tr("pub.register.role_farmer_hint") },
    { value: "BUYER" as const, icon: IconVendre, label: tr("pub.register.role_buyer"), hint: tr("pub.register.role_buyer_hint") },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {state.error ? (
        <Callout tone="critical" role="alert" title={state.error}>
          {tr("pub.register.kept")}
        </Callout>
      ) : null}

      <fieldset id="champ-role" className="flex flex-col gap-2" aria-describedby={errors.role ? "err-role" : undefined}>
        <legend className="mb-2 text-lg font-bold">{tr("pub.register.role")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {roles.map(({ value, icon: Icon, label, hint }) => {
            const on = role === value;
            return (
              <label
                key={value}
                className={cx(
                  "relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-colors",
                  "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  on ? "border-primary bg-primary-soft text-primary" : "border-line-strong bg-surface text-ink hover:border-primary",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={on}
                  onChange={() => setRole(value)}
                  className="sr-only"
                  aria-invalid={errors.role ? true : undefined}
                />
                <Icon size={48} />
                <span className="text-lg font-bold">{label}</span>
                <span className="text-sm text-ink-muted">{hint}</span>
                {on ? <IconCheck size={24} className="absolute top-2 right-2" /> : null}
              </label>
            );
          })}
        </div>
        {errors.role ? (
          <p id="err-role" role="alert" className="font-semibold text-critical">
            {errors.role}
          </p>
        ) : null}
      </fieldset>

      <Field id="champ-fullName" label={tr("auth.full_name")} hint={tr("pub.register.name_hint")} error={errors.fullName} required requiredLabel={tr("common.required")}>
        {(a) => <Input {...a} name="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />}
      </Field>

      <div id="champ-phone">
        <PinPad name="phone" mode="phone" label={tr("auth.phone")} hint={tr("auth.phone_hint")} error={errors.phone} labels={padLabels} />
      </div>

      <div id="champ-pin">
        <PinPad
          key={`pin-${attempt}`}
          name="pin"
          mode="pin"
          label={tr("auth.pin_new")}
          hint={tr("pub.register.pin_hint")}
          error={errors.pin}
          labels={padLabels}
          onChange={(d) => {
            pinRef.current.pin = d;
            setPinMismatch(false);
          }}
        />
      </div>
      <div id="champ-pinConfirm">
        <PinPad
          key={`pinc-${attempt}`}
          name="pinConfirm"
          mode="pin"
          label={tr("auth.pin_repeat")}
          error={pinMismatch ? tr("auth.pin_mismatch") : errors.pinConfirm}
          labels={padLabels}
          onChange={(d) => {
            pinRef.current.confirm = d;
            setPinMismatch(false);
          }}
        />
      </div>

      <Field id="champ-communeId" label={tr("auth.commune")} error={errors.communeId}>
        {(a) => (
          <Select {...a} name="communeId" value={communeId} onChange={(e) => setCommuneId(e.target.value)}>
            <option value="">{tr("pub.register.commune_none")}</option>
            {departments.map((d) => (
              <optgroup key={d} label={d}>
                {communes
                  .filter((c) => c.department === d)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        )}
      </Field>

      {role === "BUYER" ? (
        <Field id="champ-organization" label={tr("buyer.organization")} hint={tr("pub.register.org_hint")} error={errors.organization}>
          {(a) => <Input {...a} name="organization" autoComplete="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={120} />}
        </Field>
      ) : null}

      <fieldset id="champ-locale" className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-bold">{tr("profile.language")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["fr", "fon", "yo"] as const).map((l) => (
            <label
              key={l}
              lang={l}
              className={cx(
                "flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border-2 px-4 font-semibold",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                locale === l ? "border-primary bg-primary-soft text-primary" : "border-line-strong bg-surface",
              )}
            >
              <input type="radio" name="locale" value={l} checked={locale === l} onChange={() => setLocale(l)} className="size-5 accent-primary" />
              {LANGUAGE_NAMES[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" block loading={pending} loadingLabel={tr("common.loading")}>
        {tr("auth.register_title")}
      </Button>

      <p className="text-base">
        <Link href="/connexion" className="font-semibold text-primary">
          {tr("auth.have_account")}
        </Link>
      </p>
    </form>
  );
}
