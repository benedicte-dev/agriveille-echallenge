/**
 * Dictionnaires figés (fr source ; fon et yo générés par
 * scripts/i18n/translate-messages.ts puis relus). Import côté serveur :
 * le client reçoit uniquement le dictionnaire de sa langue via I18nProvider.
 */
import fr from "./messages/fr.json";
import fon from "./messages/fon.json";
import yo from "./messages/yo.json";
import { type Locale, toLocale } from "./config";
import { type Messages, type Vars, translateKey } from "./format";

/** Clés connues (autocomplétion) ; une chaîne quelconque reste acceptée. */
export type MessageKey = keyof typeof fr;

const DICTS: Record<Locale, Messages> = { fr, fon, yo };

export const frMessages: Messages = fr;

export function getMessages(locale: Locale): Messages {
  return DICTS[toLocale(locale)];
}

/**
 * Traduit une clé. Repli : clé absente ou vide dans `messages` → français →
 * la clé elle-même.
 */
export function t(messages: Messages, key: MessageKey | (string & {}), vars?: Vars): string {
  return translateKey(messages, key, vars, fr);
}
