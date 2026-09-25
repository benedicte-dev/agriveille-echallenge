"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { Button, Callout, Field, Input, Select, Textarea, cx, type ButtonVariant } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import type { AdminActionState } from "../actions";

type Action = (prev: AdminActionState, fd: FormData) => Promise<AdminActionState>;

const Ctx = createContext<{ fields: Record<string, string>; pending: boolean; uid: string }>({
  fields: {},
  pending: false,
  uid: "f",
});

/**
 * Formulaire du CMS : Server Action via useActionState, envoi manuel (la saisie
 * reste en place en cas d'erreur), focus sur le premier champ invalide,
 * résultat annoncé par Callout.
 */
export function AdminForm({
  action,
  children,
  className,
  inline = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Formulaire compact (bouton de liste) : message sous le bouton. */
  inline?: boolean;
}) {
  const uid = useId();
  const ref = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [state, run, pending] = useActionState<AdminActionState, FormData>(action, { status: "idle" });
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  useEffect(() => {
    if (state.status === "idle") return;
    const invalid = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) invalid.focus();
    else statusRef.current?.focus();
  }, [state]);

  const summary = Object.entries(fields);

  const message =
    state.status === "ok" ? (
      <>
        <Callout tone="success" role="status" title={state.message} />
        {state.warning ? <Callout tone="warning" title={state.warning} /> : null}
      </>
    ) : state.status === "error" ? (
      <Callout tone="critical" role="alert" title={state.message}>
        {summary.length > 0 ? (
          <ul className="list-disc pl-5">
            {summary.map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>
        ) : null}
      </Callout>
    ) : null;

  return (
    <Ctx.Provider value={{ fields, pending, uid }}>
      <form
        ref={ref}
        noValidate
        className={cx(inline ? "flex flex-col gap-2" : "flex flex-col gap-4", className)}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter?.name) fd.set(submitter.name, submitter.value);
          startTransition(() => run(fd));
        }}
      >
        {inline ? null : (
          <div ref={statusRef} tabIndex={-1} className="flex flex-col gap-2 outline-none empty:hidden">
            {message}
          </div>
        )}
        {children}
        {inline ? (
          <div ref={statusRef} tabIndex={-1} className="flex flex-col gap-2 outline-none empty:hidden">
            {message}
          </div>
        ) : null}
      </form>
    </Ctx.Provider>
  );
}

export function useAdminForm() {
  return useContext(Ctx);
}

export function Submit({
  children,
  variant = "primary",
  size = "md",
  name,
  value,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  name?: string;
  value?: string;
}) {
  const { pending } = useAdminForm();
  const t = useT();
  return (
    <Button type="submit" variant={variant} size={size} name={name} value={value} loading={pending} loadingLabel={t("adm.saving")}>
      {children}
    </Button>
  );
}

type TextProps = {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: "text" | "number" | "date" | "search";
  step?: number | string;
  min?: number;
  max?: number;
  maxLength?: number;
  rows?: number;
  lang?: string;
  className?: string;
  inputMode?: "numeric" | "decimal" | "text";
};

export function TextField({ name, label, hint, defaultValue, required, rows, className, ...rest }: TextProps) {
  const { fields, uid } = useAdminForm();
  const t = useT();
  const id = `${uid}-${name}`;
  return (
    <Field id={id} label={label} hint={hint} error={fields[name]} required={required} requiredLabel={t("common.required").toLowerCase()} className={className}>
      {(a) =>
        rows ? (
          <Textarea {...a} name={name} rows={rows} defaultValue={defaultValue ?? ""} maxLength={rest.maxLength} lang={rest.lang} />
        ) : (
          <Input {...a} {...rest} name={name} defaultValue={defaultValue ?? ""} />
        )
      }
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  defaultValue,
  required,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
}) {
  const { fields, uid } = useAdminForm();
  const id = `${uid}-${name}`;
  return (
    <Field id={id} label={label} hint={hint} error={fields[name]} required={required} className={className}>
      {(a) => (
        <Select {...a} name={name} defaultValue={defaultValue ?? ""}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function CheckboxField({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  const { fields, uid } = useAdminForm();
  const id = `${uid}-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-touch items-center gap-3 text-base font-semibold">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={fields[name] ? true : undefined}
          className="size-6 accent-(--color-primary)"
        />
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="pl-9 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {fields[name] ? (
        <p role="alert" className="pl-9 font-semibold text-critical">
          {fields[name]}
        </p>
      ) : null}
    </div>
  );
}

/** Cases à cocher multiples (mois, cultures associées). */
export function CheckboxGroup({
  name,
  legend,
  options,
  defaultValue,
  columns = "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  defaultValue: string[];
  columns?: string;
}) {
  const { fields, uid } = useAdminForm();
  const err = fields[name];
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={err ? `${uid}-${name}-err` : undefined}>
      <legend className="mb-1 text-base font-semibold">{legend}</legend>
      <div className={cx("grid gap-2", columns)}>
        {options.map((o, i) => (
          <label key={o.value} className="flex min-h-touch items-center gap-2 rounded-lg border-2 border-line px-3 has-checked:border-primary has-checked:bg-primary-soft">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValue.includes(o.value)}
              aria-invalid={err && i === 0 ? true : undefined}
              className="size-5 accent-(--color-primary)"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {err ? (
        <p id={`${uid}-${name}-err`} role="alert" className="font-semibold text-critical">
          {err}
        </p>
      ) : null}
    </fieldset>
  );
}
