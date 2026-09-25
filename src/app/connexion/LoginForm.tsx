"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button, Callout, ListenButton, PinPad } from "@/components/ui";
import { IconRetour, IconTelephone, IconUtilisateur } from "@/components/icons";
import { normalizeBeninPhone } from "@/lib/auth/phone";
import { useAudioUrl, useLocale, useT } from "@/lib/i18n/provider";
import { loginWithNextAction, type LoginState } from "./actions";

export interface DemoAccount {
  role: string;
  name: string;
  phone: string; // 10 chiffres locaux
  pin: string;
}

/**
 * Deux écrans, un seul formulaire : 1) pavé téléphone → Suivant ; 2) pavé PIN
 * (envoi automatique au 4e chiffre). Le téléphone reste saisi en cas d'erreur ;
 * le PIN est vidé et reçoit le focus.
 */
export function LoginForm({ next, demoAccounts }: { next: string | null; demoAccounts: DemoAccount[] | null }) {
  const tr = useT();
  const locale = useLocale();
  const [state, action, pending] = useActionState<LoginState, FormData>(loginWithNextAction, { attempt: 0 });
  const [phone, setPhone] = useState("");
  const [phoneKey, setPhoneKey] = useState(0);
  const [step, setStep] = useState<"phone" | "pin">("phone");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [seenAttempt, setSeenAttempt] = useState(0);

  // Un échec serveur sur le numéro ramène à l'écran téléphone (ajusté pendant le rendu, sans effet).
  if (state.attempt !== seenAttempt) {
    setSeenAttempt(state.attempt);
    if (state.error === "phone") {
      setStep("phone");
      setPhoneError(tr("pub.login.phone_invalid"));
    }
  }

  const listenLabels = { listen: tr("common.listen"), stop: tr("common.stop"), loading: tr("common.loading"), error: tr("error.voice_unavailable") };
  const phoneAudio = useAudioUrl("auth.phone");
  const pinAudio = useAudioUrl("auth.pin_hint");

  function goPin(digits = phone) {
    if (!normalizeBeninPhone(digits)) {
      setPhoneError(tr("pub.login.phone_invalid"));
      document.getElementById("connexion-telephone")?.querySelector("input")?.focus();
      return;
    }
    setPhoneError(undefined);
    setStep("pin");
  }

  function fillDemo(acc: DemoAccount) {
    setPhone(acc.phone);
    setPhoneKey((k) => k + 1);
    setPhoneError(undefined);
    setStep("pin");
  }

  // Envoi manuel (et non <form action>) : React ne réinitialise pas le formulaire, le numéro reste saisi.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  }

  const serverError =
    state.error && state.error !== "phone"
      ? tr(
          state.error === "invalid"
            ? "pub.login.error"
            : state.error === "rate"
              ? "error.too_many"
              : state.error === "fields"
                ? "error.invalid"
                : "error.generic",
        )
      : undefined;

  const padLabels = {
    backspace: tr("pub.pad.backspace"),
    clear: tr("pub.pad.clear"),
    progress: tr("pub.pad.progress"),
    complete: tr("pub.pad.complete"),
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div id="connexion-telephone" hidden={step !== "phone"} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <IconTelephone size={32} className="text-primary" />
            <ListenButton text={tr("auth.phone")} lang={locale} audioSrc={phoneAudio} labels={listenLabels} variant="icon" />
          </div>
          <PinPad
            key={`phone-${phoneKey}`}
            name="phone"
            mode="phone"
            label={tr("auth.phone")}
            hint={tr("auth.phone_hint")}
            defaultValue={phone}
            onChange={(d) => {
              setPhone(d);
              if (phoneError) setPhoneError(undefined);
            }}
            error={phoneError}
            labels={padLabels}
            autoFocus={step === "phone" && phoneKey > 0}
          />
          <Button type="button" size="lg" block onClick={() => goPin()} className="max-w-sm">
            {tr("common.next")}
          </Button>
        </div>

        {step === "pin" ? (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="-ml-2 inline-flex min-h-touch w-fit items-center gap-2 rounded-lg px-2 font-semibold text-primary hover:bg-primary-soft"
            >
              <IconRetour size={24} />
              <span>
                {tr("pub.login.change_phone")} <span className="tabular-nums">{phone.replace(/(\d{2})(?=\d)/g, "$1 ")}</span>
              </span>
            </button>
            {serverError ? (
              <Callout tone="critical" role="alert" title={serverError}>
                {tr("pub.login.error_help")}
              </Callout>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <ListenButton text={tr("auth.pin_hint")} lang={locale} audioSrc={pinAudio} labels={listenLabels} variant="icon" />
            </div>
            <PinPad
              key={`pin-${state.attempt}`}
              name="pin"
              mode="pin"
              label={tr("auth.pin")}
              hint={tr("auth.pin_hint")}
              autoSubmit
              autoFocus
              disabled={pending}
              labels={padLabels}
            />
            <Button type="submit" size="lg" block loading={pending} loadingLabel={tr("common.loading")} className="max-w-sm">
              {tr("auth.submit")}
            </Button>
          </div>
        ) : null}
      </form>

      <p className="text-base">
        {tr("pub.login.no_account")}{" "}
        <Link href="/inscription" className="font-semibold text-primary">
          {tr("nav.register")}
        </Link>
      </p>
      <p className="text-sm text-ink-muted">{tr("auth.forgot_pin")}</p>

      {demoAccounts ? (
        <section aria-labelledby="comptes-demo" className="rounded-xl border-2 border-dashed border-line-strong bg-surface p-4">
          <h2 id="comptes-demo" className="flex items-center gap-2 text-lg">
            <IconUtilisateur size={24} />
            {tr("pub.demo.title")}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{tr("pub.demo.text")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {demoAccounts.map((acc) => (
              <li key={acc.phone} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {acc.role} · {acc.name}
                  </span>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {acc.phone.replace(/(\d{2})(?=\d)/g, "$1 ")} · PIN {acc.pin}
                  </span>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => fillDemo(acc)}>
                  {tr("pub.demo.use")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
