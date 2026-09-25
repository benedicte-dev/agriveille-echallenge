"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, Callout, Field, Input, Select } from "@/components/ui";
import { ussdStepAction } from "./actions";

export interface UssdLabels {
  farmer: string;
  dial: string;
  hangUp: string;
  input: string;
  inputHint: string;
  send: string;
  idle: string;
  ended: string;
  invalid: string;
  notFound: string;
  failed: string;
  screen: string;
}

type Phase = "idle" | "active" | "ended";

/**
 * Simulateur USSD *229*1# (DÉMO). Sans état côté serveur : chaque envoi
 * rejoue le chemin complet via la Server Action, qui renvoie le chemin
 * normalisé à conserver. Navigable au clavier : saisir un chiffre, Entrée.
 */
export function UssdSimulator({ farmers, code, labels }: { farmers: { id: string; label: string }[]; code: string; labels: UssdLabels }) {
  const [farmerId, setFarmerId] = useState(farmers[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [screen, setScreen] = useState("");
  const [path, setPath] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [inputError, setInputError] = useState<string | null>(null);
  const uid = useId();
  const screenId = `${uid}-screen`;
  const inputId = `${uid}-digit`;
  const focusInput = () => requestAnimationFrame(() => document.getElementById(inputId)?.focus());

  function run(nextPath: string[]) {
    setError(null);
    setInputError(null);
    startTransition(async () => {
      try {
        const res = await ussdStepAction({ farmerId, path: nextPath });
        if (!res.ok) {
          setError(res.error === "not_found" ? labels.notFound : labels.invalid);
          return;
        }
        setScreen(res.text);
        setPath(res.path);
        setPhase(res.end ? "ended" : "active");
        setValue("");
        if (!res.end) focusInput();
      } catch {
        // Saisie conservée : l'agent peut renvoyer tel quel.
        setError(labels.failed);
      }
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const digits = value.trim();
    if (!/^[0-9]{1,2}$/.test(digits)) {
      setInputError(labels.inputHint);
      focusInput();
      return;
    }
    run([...path, digits]);
  }

  function hangUp() {
    setPhase("idle");
    setScreen("");
    setPath([]);
    setValue("");
    setError(null);
    setInputError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Field id={`${uid}-farmer`} label={labels.farmer}>
        {(p) => (
          <Select
            {...p}
            value={farmerId}
            onChange={(e) => {
              setFarmerId(e.target.value);
              hangUp();
            }}
          >
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border-4 border-ink bg-ink p-3 shadow-card">
        <div className="mb-2 text-center text-xs font-semibold text-canvas">{code}</div>
        <div
          id={screenId}
          role="log"
          aria-live="polite"
          aria-label={labels.screen}
          className="min-h-[220px] rounded-xl bg-surface p-3 font-mono text-sm whitespace-pre-wrap text-ink"
        >
          {phase === "idle" ? labels.idle : screen}
          {phase === "ended" ? `\n\n— ${labels.ended}` : ""}
        </div>
      </div>

      {error ? <Callout tone="critical" title={error} role="alert" /> : null}

      {phase === "active" ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-describedby={screenId}>
          <Field id={inputId} label={labels.input} hint={labels.inputHint} error={inputError}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                pattern="[0-9]{1,2}"
                maxLength={2}
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              {labels.send}
            </Button>
            <Button type="button" variant="secondary" onClick={hangUp}>
              {labels.hangUp}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" onClick={() => run([])} loading={pending} disabled={!farmerId}>
          {labels.dial}
        </Button>
      )}
    </div>
  );
}
