"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Durée maximale d'une dictée : au-delà, l'enregistrement s'arrête seul. */
export const MAX_RECORD_SECONDS = 60;

export type RecorderStatus = "idle" | "recording" | "done" | "denied" | "unsupported" | "error";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/aac"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

/**
 * Enregistrement micro (MediaRecorder). Gère le refus de permission
 * (NotAllowedError), l'absence de micro, et coupe le micro dès l'arrêt.
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      cleanup();
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "unsupported" : "error");
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
    } catch {
      cleanup();
      setStatus("error");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
      if (blob.size === 0) {
        setStatus("error");
        return;
      }
      setAudio(blob);
      setStatus("done");
    };
    rec.onerror = () => {
      cleanup();
      setStatus("error");
    };
    recorderRef.current = rec;
    setAudio(null);
    setSeconds(0);
    rec.start();
    setStatus("recording");
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_RECORD_SECONDS) stop();
    }, 250);
  }, [cleanup, stop]);

  const reset = useCallback(() => {
    stop();
    setAudio(null);
    setSeconds(0);
    setStatus("idle");
  }, [stop]);

  return { status, seconds, audio, start, stop, reset };
}
