"use client";

import { useState } from "react";
import { IconContraste } from "@/components/icons";
import { cx } from "./cx";

export const CONTRAST_COOKIE = "av_contrast";

/**
 * Bascule « contraste élevé » (plein soleil). Pose data-contrast="high" sur <html>
 * et un cookie lu par le layout serveur (pas de script inline, compatible CSP stricte).
 */
export function ContrastToggle({
  initial = false,
  label = "Contraste élevé",
  showLabel = false,
  className,
}: {
  initial?: boolean;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const [on, setOn] = useState(initial);
  function toggle() {
    const next = !on;
    setOn(next);
    if (next) document.documentElement.dataset.contrast = "high";
    else delete document.documentElement.dataset.contrast;
    document.cookie = `${CONTRAST_COOKIE}=${next ? "high" : "normal"}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={showLabel ? undefined : label}
      title={label}
      onClick={toggle}
      className={cx(
        "av-control inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-lg border-2 px-2 font-semibold transition-colors",
        on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink hover:bg-sunken",
        className,
      )}
    >
      <IconContraste size={24} />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
