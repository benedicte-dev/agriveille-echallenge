import "server-only";
/**
 * Traduction des résultats de service en messages utilisateur (serveur uniquement).
 */
import { getLocale } from "@/lib/i18n/server";
import { getMessages, t, type Messages } from "@/lib/i18n";
import type { ActionState } from "./action-state";
import { errorMessageKey, type Err } from "./result";

export async function serverMessages(): Promise<{ locale: "fr" | "fon" | "yo"; m: Messages }> {
  const locale = await getLocale();
  return { locale, m: getMessages(locale) };
}

/** Une valeur de fieldErrors peut être une clé i18n (« lev.err.* ») ou un message zod déjà rédigé. */
function translateMaybeKey(m: Messages, value: string): string {
  return /^(mkt|lev|error|market|levy)\.[a-z0-9_.]+$/.test(value) ? t(m, value) : value;
}

export function errorState(m: Messages, e: Err): ActionState {
  const fieldErrors = e.fieldErrors
    ? Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, translateMaybeKey(m, v)]))
    : undefined;
  return { status: "error", message: t(m, errorMessageKey(e)), ...(fieldErrors ? { fieldErrors } : {}) };
}

export function notSignedIn(m: Messages): ActionState {
  return { status: "error", message: t(m, "mkt.err.signed_out") };
}
