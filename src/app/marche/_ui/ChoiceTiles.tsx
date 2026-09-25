/**
 * Groupe de choix par pictogrammes : vrais boutons radio (clavier, lecteurs d'écran),
 * habillés en tuiles ≥ 48 px. L'état choisi est porté par la bordure, le fond ET une coche
 * (la couleur n'est jamais seule). Utilisable côté serveur comme côté client.
 */
import type { ReactNode } from "react";
import { IconCheck } from "@/components/icons";
import { cx } from "@/components/ui";

export type Choice = { value: string; label: string; hint?: string; icon: ReactNode };

export function ChoiceTiles({
  name,
  legend,
  choices,
  value,
  defaultValue,
  onChange,
  columns = 3,
  required,
  error,
  errorId,
}: {
  name: string;
  legend: ReactNode;
  choices: Choice[];
  /** Contrôlé (client). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  columns?: 2 | 3 | 4;
  required?: boolean;
  error?: string;
  errorId?: string;
}) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  const errId = error ? (errorId ?? `${name}-error`) : undefined;
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={errId} aria-invalid={error ? true : undefined}>
      <legend className="mb-3 text-lg font-bold text-ink">{legend}</legend>
      <div className={cx("grid gap-3", cols)}>
        {choices.map((c) => {
          const controlled = value !== undefined;
          return (
            <label
              key={c.value}
              className={cx(
                "group relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-line-strong",
                "bg-surface p-3 text-center text-ink transition-colors hover:border-ink",
                "has-checked:border-primary has-checked:bg-primary-soft has-checked:ring-2 has-checked:ring-primary has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
              )}
            >
              <input
                type="radio"
                name={name}
                value={c.value}
                className="sr-only"
                required={required}
                {...(controlled
                  ? { checked: value === c.value, onChange: () => onChange?.(c.value) }
                  : { defaultChecked: defaultValue === c.value })}
              />
              <span className="flex size-14 items-center justify-center rounded-full bg-earth-soft text-earth">{c.icon}</span>
              <span className="text-base leading-tight font-bold">{c.label}</span>
              {c.hint ? <span className="text-sm text-ink-muted">{c.hint}</span> : null}
              <span
                aria-hidden="true"
                className="absolute top-2 right-2 hidden size-7 items-center justify-center rounded-full bg-primary text-on-primary group-has-checked:flex"
              >
                <IconCheck size={18} />
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errId} role="alert" className="text-base font-semibold text-critical">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
