"use client";

/**
 * Contexte i18n client léger. Le Server Component parent passe la langue et
 * le seul dictionnaire utile (et, en option, le français pour le repli) :
 *
 *   const locale = await getLocale();
 *   <I18nProvider locale={locale} messages={getMessages(locale)} fallback={frMessages}>
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { type Messages, type Vars, translateKey } from "./format";
import { audioUrlFor } from "./audio";

type Ctx = { locale: Locale; messages: Messages; fallback?: Messages };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider(props: {
  locale: Locale;
  messages: Messages;
  fallback?: Messages;
  children: ReactNode;
}) {
  const { locale, messages, fallback, children } = props;
  const value = useMemo(() => ({ locale, messages, fallback }), [locale, messages, fallback]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useCtx(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT() doit être utilisé sous <I18nProvider>");
  return ctx;
}

/** Renvoie t(key, vars?) lié à la langue courante. */
export function useT(): (key: string, vars?: Vars) => string {
  const { messages, fallback } = useCtx();
  return useCallback(
    (key: string, vars?: Vars) => translateKey(messages, key, vars, fallback),
    [messages, fallback],
  );
}

export function useLocale(): Locale {
  return useCtx().locale;
}

/** URL de l'audio pré-généré de la clé dans la langue courante (null si fr ou absent). */
export function useAudioUrl(key: string): string | null {
  return audioUrlFor(useCtx().locale, key);
}
