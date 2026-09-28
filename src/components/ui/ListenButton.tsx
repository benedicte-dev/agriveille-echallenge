"use client";

import { useEffect, useRef, useState } from "react";
import { IconHautParleur, IconStop } from "@/components/icons";
import { cx } from "./cx";
import { Spinner } from "./Spinner";
import type { UiLocale } from "./locale";

export type ListenButtonLabels = {
  listen: string;
  stop: string;
  loading: string;
  error: string;
};

const DEFAULT_LABELS: ListenButtonLabels = {
  listen: "Écouter",
  stop: "Arrêter",
  loading: "Chargement…",
  error: "Voix pas disponible. Lisez le texte.",
};

export type ListenButtonProps = {
  /** Texte à dire (dans la langue `lang`). */
  text: string;
  lang: UiLocale;
  /** Fichier audio pré-généré (public/audio/…) : prioritaire, fonctionne hors ligne via le SW. */
  audioSrc?: string | null;
  labels?: Partial<ListenButtonLabels>;
  /** "pill" : pictogramme + mot (défaut, écrans fermier). "icon" : carré 48 px, mot en nom accessible. */
  variant?: "pill" | "icon";
  className?: string;
};

type Status = "idle" | "loading" | "playing" | "error";

/**
 * WAV silencieux de 8 échantillons. Joué dans le geste de l'utilisateur pour « déverrouiller »
 * l'élément audio : iOS Safari et Chrome Android refusent play() si le son arrive plusieurs
 * secondes après le toucher (le temps que 229langues réponde). Le même élément, déjà autorisé,
 * lit ensuite l'audio reçu.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Cache mémoire des blobs TTS (clé lang + texte) pour la durée de la page. */
const blobCache = new Map<string, string>();
const TTS_TIMEOUT_MS = 60_000; // premier appel 229langues jusqu'à 60 s (SPEC §5)

/**
 * Bouton « Écouter ».
 * - fr : speechSynthesis (fr-FR), sans réseau.
 * - fon / yo : `audioSrc` si fourni, sinon POST /api/voice/tts {text, lang} → blob audio.
 * Second appui = arrêt. Erreur : message visible et annoncé, le texte reste lisible à l'écran.
 */
export function ListenButton({ text, lang, audioSrc, labels: labelsProp, variant = "pill", className }: ListenButtonProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const currentKey = `${lang}:${audioSrc ?? ""}:${text}`;
  const [state, setState] = useState<{ key: string; status: Status }>({ key: currentKey, status: "idle" });
  // Statut lié au texte : si le texte change (navigation client), on repart de « idle ».
  const status: Status = state.key === currentKey ? state.status : "idle";
  const setStatus = (next: Status) => setState({ key: currentKey, status: next });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  // Démontage ou changement de texte : on coupe la lecture en cours.
  useEffect(() => stop, [currentKey]);

  /** À appeler de façon synchrone dans le gestionnaire de clic (geste utilisateur). */
  function unlockAudio(): HTMLAudioElement {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = SILENT_WAV;
    audio.play().then(
      () => audio.pause(),
      () => {},
    );
    audioRef.current = audio;
    return audio;
  }

  function playUrl(url: string, audio: HTMLAudioElement = audioRef.current ?? new Audio()) {
    audioRef.current = audio;
    audio.onended = () => setStatus("idle");
    audio.onerror = () => setStatus("error");
    audio.src = url;
    setStatus("playing");
    audio.play().catch(() => setStatus("error"));
  }

  async function start() {
    // Français : speechSynthesis, pas d'élément audio. Sinon, déverrouillage immédiat (geste).
    const audio = audioSrc || lang !== "fr" ? unlockAudio() : null;
    if (audioSrc && audio) return playUrl(audioSrc, audio);

    if (lang === "fr") {
      if (!("speechSynthesis" in window)) return setStatus("error");
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      u.rate = 0.9; // un peu plus lent : lisibilité orale
      const fr = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
      if (fr) u.voice = fr;
      u.onend = () => setStatus("idle");
      u.onerror = (e) => setStatus(e.error === "interrupted" || e.error === "canceled" ? "idle" : "error");
      window.speechSynthesis.cancel();
      setStatus("playing");
      window.speechSynthesis.speak(u);
      return;
    }

    const key = `${lang}:${text}`;
    const cached = blobCache.get(key);
    if (cached && audio) return playUrl(cached, audio);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
    setStatus("loading");
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0 || blob.type.includes("json") || blob.type.startsWith("text/")) {
        throw new Error("tts not audio");
      }
      const url = URL.createObjectURL(blob);
      blobCache.set(key, url);
      if (abortRef.current === ctrl && audio) playUrl(url, audio);
    } catch {
      if (abortRef.current === ctrl) setStatus("error");
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  function onClick() {
    if (status === "playing" || status === "loading") {
      stop();
      setStatus("idle");
      return;
    }
    void start();
  }

  const busy = status === "loading";
  const active = status === "playing" || busy;
  const visibleLabel = busy ? labels.loading : status === "playing" ? labels.stop : labels.listen;

  return (
    <span className={cx("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-busy={busy || undefined}
        aria-label={variant === "icon" ? visibleLabel : undefined}
        title={variant === "icon" ? visibleLabel : undefined}
        className={cx(
          "av-control inline-flex min-h-touch items-center justify-center gap-2 rounded-full border-2 font-semibold",
          "transition-colors",
          variant === "icon" ? "min-w-touch px-0" : "px-4 text-base",
          active
            ? "border-primary bg-primary text-on-primary hover:bg-primary-hover"
            : "border-primary bg-surface text-primary hover:bg-primary-soft",
        )}
      >
        {busy ? <Spinner size={22} /> : status === "playing" ? <IconStop size={22} /> : <IconHautParleur size={24} />}
        {variant === "pill" ? <span>{visibleLabel}</span> : null}
      </button>
      <span role="status" className={status === "error" ? "text-sm font-semibold text-critical" : "sr-only"}>
        {status === "error" ? labels.error : ""}
      </span>
    </span>
  );
}
