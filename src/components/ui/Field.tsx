import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { IconDanger } from "@/components/icons";
import { cx } from "./cx";

/** Attributs à étaler sur le contrôle : id, aria-describedby, aria-invalid, required. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

export type FieldProps = {
  /** id du contrôle ; sert à construire ceux de l'aide et de l'erreur. */
  id: string;
  label: ReactNode;
  /** Aide sous le libellé (exemple de saisie). */
  hint?: ReactNode;
  /** Message d'erreur : relié par aria-describedby et annoncé (role="alert"). */
  error?: ReactNode;
  required?: boolean;
  /** Mention affichée à côté du libellé si required (défaut « obligatoire »). */
  requiredLabel?: string;
  /** Pictogramme devant le libellé (écrans fermier). */
  icon?: ReactNode;
  className?: string;
  /** Rendu du contrôle avec les attributs d'accessibilité déjà calculés. */
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Champ de formulaire : libellé visible + aide + erreur, reliés au contrôle.
 *
 *   <Field id="qty" label="Quantité (kg)" hint="Exemple : 200" error={errors.qty}>
 *     {(a) => <Input {...a} name="quantityKg" inputMode="numeric" />}
 *   </Field>
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel = "obligatoire",
  icon,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-2 text-base font-semibold text-ink">
        {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
        <span>{label}</span>
        {required ? <span className="text-sm font-normal text-ink-muted">({requiredLabel})</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-base font-semibold text-critical">
          <IconDanger size={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

const control =
  "av-control w-full rounded-lg border-2 border-line-strong bg-surface px-3 text-base text-ink " +
  "placeholder:text-ink-muted transition-colors hover:border-ink " +
  "aria-invalid:border-critical disabled:bg-sunken disabled:text-ink-muted";

export function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cx(control, "min-h-touch py-2", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cx(control, "min-h-28 py-2.5 leading-normal", className)} {...props} />;
}

/** Liste native (accessible, légère) ; flèche dessinée pour un rendu identique partout. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(control, "min-h-touch appearance-none py-2 pr-11", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={20}
        height={20}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
