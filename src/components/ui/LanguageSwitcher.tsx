"use client";

import { useTransition } from "react";
import { IconCheck } from "@/components/icons";
import { cx } from "./cx";
import { Spinner } from "./Spinner";
import { UI_LOCALES, type UiLocale } from "./locale";

/** Nom de chaque langue écrit dans cette langue (jamais traduit). */
export const LANGUAGE_NAMES: Record<UiLocale, string> = {
  fr: "Français",
  fon: "Fɔngbe",
  yo: "Yorùbá",
};

export type LanguageSwitcherProps = {
  current: UiLocale;
  /** Change la langue (ex. setLocaleAction de src/lib/i18n/actions). Server Action acceptée. */
  action: (locale: UiLocale) => unknown | Promise<unknown>;
  /** "cards" : 3 grands boutons (accueil). "compact" : groupe segmenté (en-tête). */
  variant?: "cards" | "compact";
  /** Nom du groupe pour les lecteurs d'écran, ex. « Langue ». */
  label?: string;
  /** Sous-titre sous chaque nom, facultatif (ex. { fon: "Fon" }). */
  subtitles?: Partial<Record<UiLocale, string>>;
  className?: string;
};

/**
 * Choix de langue. Chaque nom est dans sa propre langue et porte `lang`, pour être
 * reconnu à l'œil et bien prononcé par les lecteurs d'écran. État courant = aria-pressed + coche.
 */
export function LanguageSwitcher({
  current,
  action,
  variant = "compact",
  label = "Langue",
  subtitles,
  className,
}: LanguageSwitcherProps) {
  const [pending, startTransition] = useTransition();

  function choose(locale: UiLocale) {
    if (locale === current || pending) return;
    startTransition(async () => {
      await action(locale);
    });
  }

  const cards = variant === "cards";
  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending || undefined}
      className={cx(cards ? "grid gap-3 sm:grid-cols-3" : "inline-flex w-fit flex-wrap rounded-lg border-2 border-line-strong bg-surface p-0.5", className)}
    >
      {UI_LOCALES.map((loc) => {
        const on = loc === current;
        return (
          <button
            key={loc}
            type="button"
            lang={loc}
            aria-pressed={on}
            onClick={() => choose(loc)}
            className={cx(
              "av-control inline-flex items-center gap-2 font-semibold transition-colors",
              cards
                ? "min-h-touch-lg justify-between rounded-xl border-2 px-5 text-xl"
                : "min-h-touch justify-center rounded-md px-3 text-base",
              cards
                ? on
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line-strong bg-surface text-ink hover:border-primary"
                : on
                  ? "bg-primary text-on-primary"
                  : "text-ink hover:bg-sunken",
            )}
          >
            <span className="flex flex-col items-start leading-tight">
              <span>{LANGUAGE_NAMES[loc]}</span>
              {cards && subtitles?.[loc] ? (
                <span className="text-sm font-normal text-ink-muted">{subtitles[loc]}</span>
              ) : null}
            </span>
            {cards && on ? <IconCheck size={28} /> : null}
          </button>
        );
      })}
      {pending ? (
        <span className={cx("inline-flex items-center gap-2 text-ink-muted", cards ? "sm:col-span-3" : "px-2")}>
          <Spinner size={18} />
        </span>
      ) : null}
    </div>
  );
}
