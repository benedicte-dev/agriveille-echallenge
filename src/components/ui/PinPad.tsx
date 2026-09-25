"use client";

import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { IconEffacer, IconCroix } from "@/components/icons";
import { cx } from "./cx";

export type PinPadLabels = {
  /** Bouton « effacer le dernier chiffre ». */
  backspace: string;
  /** Bouton « tout effacer ». */
  clear: string;
  /** Annonce après chaque appui, {count} et {total} remplacés. */
  progress: string;
  /** Annonce quand la saisie est complète. */
  complete: string;
};

const DEFAULT_LABELS: PinPadLabels = {
  backspace: "Effacer le dernier chiffre",
  clear: "Tout effacer",
  progress: "{count} chiffres sur {total}",
  complete: "Saisie complète",
};

export type PinPadProps = {
  /** Nom du champ caché envoyé avec le formulaire (ex. "pin", "phone"). */
  name: string;
  /** Libellé visible au-dessus de l'afficheur. */
  label: string;
  /** "pin" : chiffres masqués, cases. "phone" : chiffres visibles groupés par 2. */
  mode?: "pin" | "phone";
  /** Nombre de chiffres. Défaut : 4 (pin), 10 (phone, format béninois 01 XX XX XX XX). */
  length?: number;
  /** Valeur initiale (chiffres seuls). */
  defaultValue?: string;
  /** Appelé à chaque changement (chiffres seuls). */
  onChange?: (digits: string) => void;
  /** Appelé quand `length` chiffres sont saisis. */
  onComplete?: (digits: string) => void;
  /** Soumet le formulaire parent dès que la saisie est complète (PIN : 1 geste de moins). */
  autoSubmit?: boolean;
  /** Message d'erreur (PIN incorrect…) : relié et annoncé. */
  error?: string;
  hint?: string;
  labels?: Partial<PinPadLabels>;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

function formatPhone(d: string): string {
  return d.replace(/(\d{2})(?=\d)/g, "$1 ");
}

/**
 * Pavé numérique géant (touches 72 px) pour le PIN et le téléphone.
 * - Afficheur = vrai <input> (inputMode="none" : pas de clavier système par-dessus le pavé),
 *   donc saisie au clavier physique, collage et lecture par les lecteurs d'écran.
 * - Un <input type="hidden" name={name}> porte la valeur pour les Server Actions.
 * - Les appuis sur le pavé sont annoncés par une région live, sans lire les chiffres du PIN.
 * - Les touches ne sont jamais désactivées par l'état (plein / vide) : le focus ne saute pas ;
 *   un appui sans effet est simplement ignoré.
 */
export function PinPad({
  name,
  label,
  mode = "pin",
  length = mode === "pin" ? 4 : 10,
  defaultValue = "",
  onChange,
  onComplete,
  autoSubmit = false,
  error,
  hint,
  labels: labelsProp,
  disabled = false,
  autoFocus = false,
  className,
}: PinPadProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const uid = useId();
  const inputId = `${uid}-display`;
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const [digits, setDigits] = useState(() => defaultValue.replace(/\D/g, "").slice(0, length));
  const [announce, setAnnounce] = useState("");
  const hiddenRef = useRef<HTMLInputElement>(null);

  function update(next: string, fromPad: boolean) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    if (clean === digits) return;
    setDigits(clean);
    onChange?.(clean);
    const done = clean.length === length;
    if (fromPad) {
      setAnnounce(
        done
          ? labels.complete
          : labels.progress.replace("{count}", String(clean.length)).replace("{total}", String(length)),
      );
    }
    if (done) {
      onComplete?.(clean);
      if (autoSubmit) {
        // Laisse React écrire la valeur dans le champ caché avant la soumission.
        requestAnimationFrame(() => hiddenRef.current?.form?.requestSubmit());
      }
    }
  }

  const masked = mode === "pin";
  const shown = masked ? digits : formatPhone(digits);

  return (
    <div className={cx("flex w-full max-w-sm flex-col gap-3", className)}>
      <label htmlFor={inputId} className="text-lg font-bold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="-mt-2 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type={masked ? "password" : "tel"}
          inputMode="none"
          autoComplete={masked ? "off" : "tel-national"}
          value={shown}
          onChange={(e: ChangeEvent<HTMLInputElement>) => update(e.target.value, false)}
          maxLength={masked ? length : length + Math.floor((length - 1) / 2)}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          className={cx(
            "av-control w-full rounded-lg border-2 border-line-strong bg-surface text-ink caret-primary",
            "min-h-touch-lg px-4 text-center text-3xl font-bold tabular-nums tracking-widest",
            "aria-invalid:border-critical",
            masked && "text-transparent caret-transparent selection:bg-transparent",
          )}
        />
        {masked ? (
          /* Cases visibles du PIN, par-dessus l'input (qui garde le focus et la saisie). */
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4">
            {Array.from({ length }, (_, i) => (
              <span
                key={i}
                className={cx(
                  "size-5 rounded-full border-2",
                  i < digits.length ? "border-ink bg-ink" : "border-line-strong bg-transparent",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      <input ref={hiddenRef} type="hidden" name={name} value={digits} />

      {error ? (
        <p id={errorId} role="alert" className="text-base font-semibold text-critical">
          {error}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div role="group" aria-label={label} className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PadKey key={d} disabled={disabled} onPress={() => update(digits + d, true)}>
            {d}
          </PadKey>
        ))}
        <PadKey
          disabled={disabled}
          onPress={() => update("", true)}
          ariaLabel={labels.clear}
          tone="quiet"
        >
          <IconCroix size={28} />
        </PadKey>
        <PadKey disabled={disabled} onPress={() => update(digits + "0", true)}>
          0
        </PadKey>
        <PadKey
          disabled={disabled}
          onPress={() => update(digits.slice(0, -1), true)}
          ariaLabel={labels.backspace}
          tone="quiet"
        >
          <IconEffacer size={32} />
        </PadKey>
      </div>
    </div>
  );
}

function PadKey({
  children,
  onPress,
  disabled,
  ariaLabel,
  tone = "digit",
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  tone?: "digit" | "quiet";
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cx(
        "av-control flex h-18 items-center justify-center rounded-xl border-2 text-3xl font-bold tabular-nums",
        "transition-colors disabled:cursor-not-allowed",
        tone === "digit"
          ? "border-line-strong bg-surface text-ink hover:bg-sunken active:bg-primary-soft disabled:text-ink-muted"
          : "border-transparent bg-sunken text-ink hover:border-line-strong disabled:text-ink-muted",
      )}
    >
      {children}
    </button>
  );
}
