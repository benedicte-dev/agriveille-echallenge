"use client";

/**
 * Bouton d'action (accepter, refuser, retirer, payer, valider) relié à une Server Action.
 * États : en cours (Spinner, aria-busy), succès (Callout status), erreur (Callout alert),
 * hors ligne (bouton désactivé + explication). Composant partagé des pages M3.
 */
import { useActionState, type ReactNode } from "react";
import { Button, Callout, useOnline, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { IDLE, type ActionState } from "@/server/market/action-state";

export type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "primary",
  size = "sm",
  icon,
  block,
  hideOnSuccess = false,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
  /** Après succès, n'affiche plus que le message (l'action n'a plus lieu d'être). */
  hideOnSuccess?: boolean;
}) {
  const t = useT();
  const online = useOnline();
  const [state, formAction, pending] = useActionState(action, IDLE);
  const done = state.status === "success";

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {done && hideOnSuccess ? null : (
        <Button
          type="submit"
          variant={variant}
          size={size}
          icon={icon}
          block={block}
          loading={pending}
          loadingLabel={pendingLabel ?? t("mkt.working")}
          disabled={!online}
        >
          {label}
        </Button>
      )}
      {!online ? <p className="text-sm text-ink-muted">{t("mkt.offline_form")}</p> : null}
      {state.status === "error" ? (
        <Callout tone="critical" role="alert" title={state.message ?? t("error.generic")} />
      ) : null}
      {done ? <Callout tone="success" role="status" title={state.message ?? t("common.done")} /> : null}
    </form>
  );
}
