"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { IconQr } from "@/components/icons";

/** Code de vérification d'une quittance : 12 caractères (lettres et chiffres), cf. SPEC §3. */
const CODE_RE = /^[A-Z0-9]{12}$/;

/**
 * Saisie du code imprimé sous le QR d'une quittance → /verifier/<code>.
 * La vérification réelle est faite par la page publique /verifier/[code].
 */
export function VerifyForm({
  labels,
}: {
  labels: { title: string; label: string; hint: string; submit: string; invalid: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("code") ?? "");
    const code = raw.replace(/[\s-]/g, "").toUpperCase();
    if (!CODE_RE.test(code)) {
      setError(labels.invalid);
      document.getElementById("verifier-code")?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    router.push(`/verifier/${encodeURIComponent(code)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-labelledby="verifier-titre">
      <h3 id="verifier-titre" className="flex items-center gap-2 text-lg">
        <IconQr size={24} />
        {labels.title}
      </h3>
      <Field id="verifier-code" label={labels.label} hint={labels.hint} error={error}>
        {(a) => (
          <Input
            {...a}
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            className="font-mono tracking-widest uppercase"
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" size="sm" loading={pending} className="w-fit">
        {labels.submit}
      </Button>
    </form>
  );
}
