"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconCamera,
  IconCarte,
  IconChamp,
  IconCheck,
  IconEffacer,
  IconInsecte,
  IconMaladieFeuille,
  IconMicro,
  IconSignaler,
  IconStop,
} from "@/components/icons";
import { Button, Callout, Field, ListenButton, Select, Spinner, Textarea, cx, useOnline } from "@/components/ui";
import { newClientId, submitReportOfflineSafe, type SubmitOutcome } from "@/lib/offline";
import { useAudioUrl, useLocale, useT } from "@/lib/i18n/provider";
import { compressPhoto, PhotoError } from "./compress";
import { MAX_RECORD_SECONDS, useRecorder } from "./useRecorder";

/** Emprise du Bénin (miroir client de BENIN_BOUNDS, le serveur revérifie). */
const BENIN = { latMin: 6.0, latMax: 12.5, lonMin: 0.7, lonMax: 3.9 };
const STT_TIMEOUT_MS = 60_000;
const TEXT_MAX = 1000;

export interface WizardParcel {
  id: string;
  name: string;
  communeName: string;
  cropSlugs: string[];
}

export interface WizardPest {
  id: string;
  name: string;
  kind: "PEST" | "DISEASE";
  cropSlugs: string[];
}

export interface WizardCommune {
  id: string;
  name: string;
  department: string;
}

type PhotoState =
  | { status: "empty" }
  | { status: "processing" }
  | { status: "ready"; blob: Blob; url: string }
  | { status: "error"; message: string };

type SttState = "idle" | "transcribing" | "done" | "error" | "offline";
type GpsState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "ok"; lat: number; lon: number; accuracy: number }
  | { status: "error"; message: string };

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "done"; outcome: SubmitOutcome };

const NO_PARCEL = "__none__";

export function ReportWizard({
  parcels,
  pests,
  communes,
  mineHref,
}: {
  parcels: WizardParcel[];
  pests: WizardPest[];
  communes: WizardCommune[];
  mineHref: string;
}) {
  const t = useT();
  const locale = useLocale();
  const online = useOnline();
  const listenLabels = {
    listen: t("common.listen"),
    stop: t("common.stop"),
    loading: t("common.loading"),
    error: t("error.voice_unavailable"),
  };

  const [clientId, setClientId] = useState(() => newClientId());
  const [photo, setPhoto] = useState<PhotoState>({ status: "empty" });
  const [transcript, setTranscript] = useState("");
  const [description, setDescription] = useState("");
  const [stt, setStt] = useState<SttState>("idle");
  const [parcelId, setParcelId] = useState<string>(parcels[0]?.id ?? NO_PARCEL);
  const [communeId, setCommuneId] = useState<string>("");
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [pestId, setPestId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ evidence?: string; place?: string }>({});
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const recorder = useRecorder();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const photoUrl = photo.status === "ready" ? photo.url : null;
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  useEffect(() => {
    if (submit.status === "done") resultRef.current?.focus();
  }, [submit]);

  // ── Photo ──
  async function onPhotoChosen(file: File | undefined) {
    if (!file) return;
    setPhoto({ status: "processing" });
    setErrors((e) => ({ ...e, evidence: undefined }));
    try {
      const blob = await compressPhoto(file);
      setPhoto({ status: "ready", blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      const reason = err instanceof PhotoError ? err.reason : "decode";
      setPhoto({ status: "error", message: reason === "too_big_source" ? t("report.photo_too_big") : t("rep.photo_error") });
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  // ── Voix → texte (fon / yoruba) ──
  const recordedAudio = recorder.audio;
  const recordedUrl = useMemo(() => (recordedAudio ? URL.createObjectURL(recordedAudio) : null), [recordedAudio]);
  useEffect(() => () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, [recordedUrl]);

  async function transcribe(audio: Blob) {
    if (locale === "fr") return;
    if (!navigator.onLine) {
      setStt("offline");
      return;
    }
    setStt("transcribing");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), STT_TIMEOUT_MS);
    try {
      const fd = new FormData();
      const ext = audio.type.includes("mp4") || audio.type.includes("aac") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", audio, `dictee.${ext}`);
      fd.append("lang", locale);
      const res = await fetch("/api/voice/stt", { method: "POST", body: fd, signal: ctrl.signal, credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { text?: unknown };
      const text = typeof data.text === "string" ? data.text.trim() : "";
      if (!text) throw new Error("empty");
      setTranscript((prev) => (prev ? `${prev} ${text}` : text).slice(0, TEXT_MAX));
      setErrors((e) => ({ ...e, evidence: undefined }));
      setStt("done");
    } catch {
      setStt(navigator.onLine ? "error" : "offline");
    } finally {
      clearTimeout(timer);
    }
  }

  // Transcription automatique dès la fin de l'enregistrement.
  const lastTranscribed = useRef<Blob | null>(null);
  useEffect(() => {
    if (recorder.status === "done" && recordedAudio && lastTranscribed.current !== recordedAudio) {
      lastTranscribed.current = recordedAudio;
      void transcribe(recordedAudio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- déclenché par la fin d'un enregistrement uniquement
  }, [recorder.status, recordedAudio]);

  // ── Lieu ──
  function locate() {
    if (!("geolocation" in navigator)) {
      setGps({ status: "error", message: t("rep.place_gps_unavailable") });
      return;
    }
    setGps({ status: "searching" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        if (lat < BENIN.latMin || lat > BENIN.latMax || lon < BENIN.lonMin || lon > BENIN.lonMax) {
          setGps({ status: "error", message: t("rep.place_gps_outside") });
          return;
        }
        setGps({ status: "ok", lat, lon, accuracy });
        setErrors((e) => ({ ...e, place: undefined }));
      },
      (err) => {
        setGps({
          status: "error",
          message: err.code === err.PERMISSION_DENIED ? t("error.location_denied") : t("rep.place_gps_unavailable"),
        });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  }

  const selectedParcel = parcels.find((p) => p.id === parcelId) ?? null;
  const needsCommune = !selectedParcel && gps.status !== "ok";

  // ── Ravageurs : ceux des cultures du champ choisi d'abord ──
  const [likelyPests, otherPests] = useMemo(() => {
    const crops = new Set(selectedParcel?.cropSlugs ?? []);
    if (crops.size === 0) return [[], pests] as const;
    const likely = pests.filter((p) => p.cropSlugs.some((c) => crops.has(c)));
    return [likely, pests.filter((p) => !likely.includes(p))] as const;
  }, [pests, selectedParcel]);

  // ── Envoi ──
  async function onSubmit() {
    const next: typeof errors = {};
    const hasEvidence = photo.status === "ready" || transcript.trim() !== "" || description.trim() !== "";
    if (!hasEvidence) next.evidence = t("rep.evidence_missing");
    if (needsCommune && !communeId) next.place = t("rep.place_missing");
    setErrors(next);
    if (next.evidence || next.place) return;

    setSubmit({ status: "sending" });
    const outcome = await submitReportOfflineSafe({
      clientId,
      parcelId: selectedParcel?.id ?? null,
      communeId: needsCommune ? communeId : null,
      lat: gps.status === "ok" ? Number(gps.lat.toFixed(6)) : null,
      lon: gps.status === "ok" ? Number(gps.lon.toFixed(6)) : null,
      pestId,
      description: description.trim() || null,
      voiceTranscript: transcript.trim() || null,
      voiceLang: transcript.trim() ? locale : null,
      photo: photo.status === "ready" ? photo.blob : null,
    });
    setSubmit({ status: "done", outcome });
  }

  function startOver() {
    setClientId(newClientId());
    setPhoto({ status: "empty" });
    setTranscript("");
    setDescription("");
    setStt("idle");
    recorder.reset();
    setPestId(null);
    setErrors({});
    setSubmit({ status: "idle" });
  }

  // ── Résultat ──
  if (submit.status === "done" && submit.outcome.status !== "failed") {
    const o = submit.outcome;
    const sessionLost = o.status === "queued" && o.httpStatus === 401;
    return (
      <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-4 outline-none">
        {o.status === "sent" ? (
          <Callout tone="success" role="status" title={t("report.sent")}>
            {t("rep.sent_next")}
          </Callout>
        ) : sessionLost ? (
          <Callout tone="warning" role="status" title={t("rep.session_expired_title")}>
            {t("rep.session_expired")}
          </Callout>
        ) : (
          <Callout tone="offline" role="status" title={t("rep.queued_title")}>
            {t("rep.queued_message")}
          </Callout>
        )}
        <ListenButton
          text={
            o.status === "sent"
              ? `${t("report.sent")} ${t("rep.sent_next")}`
              : `${t("rep.queued_title")}. ${t("rep.queued_message")}`
          }
          lang={locale}
          labels={listenLabels}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          {sessionLost ? (
            <Button href="/connexion?next=/app/signaler" size="lg" block>
              {t("nav.login")}
            </Button>
          ) : null}
          <Button variant={sessionLost ? "secondary" : "primary"} size="lg" block onClick={startOver} icon={<IconSignaler size={24} />}>
            {t("rep.new_report")}
          </Button>
          <Button href={mineHref} variant="secondary" size="lg" block>
            {t("report.my_reports")}
          </Button>
        </div>
      </div>
    );
  }

  const failed = submit.status === "done" && submit.outcome.status === "failed" ? submit.outcome : null;
  const sending = submit.status === "sending";

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      {/* 1. Photo */}
      <Step n={1} icon={<IconCamera size={28} />} title={t("report.step_photo")} listenKey="report.step_photo" hint={t("rep.photo_hint")} labels={listenLabels}>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void onPhotoChosen(e.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void onPhotoChosen(e.target.files?.[0])}
        />
        {photo.status === "ready" ? (
          <figure className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), pas d'optimisation serveur possible */}
            <img src={photo.url} alt={t("rep.photo_preview")} className="max-h-72 w-full rounded-lg border border-line object-contain bg-sunken" />
            <figcaption className="text-sm text-ink-muted">{t("rep.photo_size", { size: Math.round(photo.blob.size / 1024) })}</figcaption>
          </figure>
        ) : null}
        {photo.status === "processing" ? (
          <p role="status" className="flex items-center gap-2 text-base">
            <Spinner /> {t("rep.photo_processing")}
          </p>
        ) : null}
        {photo.status === "error" ? (
          <Callout tone="critical" role="alert" title={photo.message}>
            {t("rep.photo_camera_hint")}
          </Callout>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            block
            variant={photo.status === "ready" ? "secondary" : "primary"}
            icon={<IconCamera size={24} />}
            onClick={() => cameraRef.current?.click()}
            loading={photo.status === "processing"}
          >
            {photo.status === "ready" ? t("report.retake_photo") : t("report.take_photo")}
          </Button>
          <Button size="md" block variant="ghost" onClick={() => galleryRef.current?.click()} disabled={photo.status === "processing"}>
            {t("rep.photo_gallery")}
          </Button>
          {photo.status === "ready" ? (
            <Button size="md" variant="ghost" icon={<IconEffacer size={22} />} onClick={() => setPhoto({ status: "empty" })}>
              {t("rep.photo_remove")}
            </Button>
          ) : null}
        </div>
      </Step>

      {/* 2. Voix */}
      <Step n={2} icon={<IconMicro size={28} />} title={t("report.step_voice")} listenKey="report.step_voice" hint={locale === "fr" ? t("rep.description_hint") : t("rep.voice_hint")} labels={listenLabels}>
        {locale === "fr" ? (
          <Field id={`${uid}-desc`} label={t("rep.description")}>
            {(a) => (
              <Textarea
                {...a}
                value={description}
                maxLength={TEXT_MAX}
                rows={3}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors((er) => ({ ...er, evidence: undefined }));
                }}
              />
            )}
          </Field>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {recorder.status === "recording" ? (
                <Button size="lg" variant="danger" icon={<IconStop size={24} />} onClick={recorder.stop}>
                  {t("report.stop_record")}
                </Button>
              ) : (
                <Button
                  size="lg"
                  icon={<IconMicro size={24} />}
                  onClick={() => void recorder.start()}
                  disabled={stt === "transcribing"}
                  aria-describedby={`${uid}-mic-status`}
                >
                  {t("report.record")}
                </Button>
              )}
              {recordedUrl && recorder.status === "done" ? (
                <audio controls src={recordedUrl} className="h-12 max-w-full" aria-label={t("report.play_record")} />
              ) : null}
            </div>
            <p id={`${uid}-mic-status`} role="status" className="text-base">
              {recorder.status === "recording"
                ? t("rep.voice_recording", { seconds: recorder.seconds, max: MAX_RECORD_SECONDS })
                : stt === "transcribing"
                  ? t("rep.voice_transcribing")
                  : ""}
            </p>
            {recorder.status === "denied" ? (
              <Callout tone="warning" role="alert" title={t("error.mic_denied")}>
                {t("rep.mic_denied_hint")}
              </Callout>
            ) : null}
            {recorder.status === "unsupported" || recorder.status === "error" ? (
              <Callout tone="warning" role="alert" title={t("rep.voice_unsupported")}>
                {t("rep.voice_fallback")}
              </Callout>
            ) : null}
            {stt === "error" || stt === "offline" ? (
              <Callout
                tone={stt === "offline" ? "offline" : "warning"}
                role="alert"
                title={stt === "offline" ? t("rep.voice_offline") : t("rep.voice_unavailable")}
                action={
                  recordedAudio && online ? (
                    <Button variant="secondary" size="sm" onClick={() => void transcribe(recordedAudio)}>
                      {t("rep.voice_retry")}
                    </Button>
                  ) : null
                }
              />
            ) : null}
            <Field id={`${uid}-transcript`} label={t("rep.voice_transcript")} hint={t("rep.voice_edit_hint")}>
              {(a) => (
                <Textarea
                  {...a}
                  value={transcript}
                  maxLength={TEXT_MAX}
                  rows={3}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    setErrors((er) => ({ ...er, evidence: undefined }));
                  }}
                />
              )}
            </Field>
          </div>
        )}
        {errors.evidence ? (
          <p role="alert" className="text-base font-semibold text-critical">
            {errors.evidence}
          </p>
        ) : null}
      </Step>

      {/* 3. Lieu */}
      <Step n={3} icon={<IconCarte size={28} />} title={t("report.step_place")} listenKey="report.step_place" labels={listenLabels}>
        {parcels.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-semibold">{t("report.choose_parcel")}</legend>
            {[...parcels, null].map((p) => {
              const value = p?.id ?? NO_PARCEL;
              const checked = parcelId === value;
              return (
                <label
                  key={value}
                  className={cx(
                    "av-control flex min-h-touch-lg cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2",
                    checked ? "border-primary bg-primary-soft" : "border-line-strong bg-surface hover:bg-sunken",
                  )}
                >
                  <input
                    type="radio"
                    name={`${uid}-parcel`}
                    value={value}
                    checked={checked}
                    onChange={() => {
                      setParcelId(value);
                      setErrors((e) => ({ ...e, place: undefined }));
                    }}
                    className="size-6 accent-primary"
                  />
                  <IconChamp size={28} className="shrink-0 text-primary" />
                  <span className="flex flex-col">
                    <span className="text-lg font-semibold">{p ? p.name : t("rep.place_elsewhere")}</span>
                    {p ? <span className="text-sm text-ink-muted">{p.communeName}</span> : null}
                  </span>
                  {checked ? <IconCheck size={24} className="ml-auto shrink-0 text-primary" /> : null}
                </label>
              );
            })}
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            variant={gps.status === "ok" ? "secondary" : "primary"}
            size="lg"
            block
            icon={<IconCarte size={24} />}
            onClick={locate}
            loading={gps.status === "searching"}
            loadingLabel={t("rep.place_gps_searching")}
          >
            {t("report.use_location")}
          </Button>
          <p role="status" className="text-base">
            {gps.status === "ok" ? (
              <span className="inline-flex items-center gap-2 font-semibold text-success">
                <IconCheck size={22} /> {t("rep.place_gps_ok", { meters: Math.round(gps.accuracy) })}
              </span>
            ) : null}
          </p>
          {gps.status === "error" ? (
            <Callout tone="warning" role="alert" title={gps.message}>
              {parcels.length > 0 ? t("rep.place_gps_fallback_parcel") : t("rep.place_gps_fallback_commune")}
            </Callout>
          ) : null}
        </div>

        {needsCommune ? (
          <Field id={`${uid}-commune`} label={t("rep.place_commune")} hint={t("rep.place_commune_hint")} error={errors.place}>
            {(a) => (
              <Select
                {...a}
                value={communeId}
                onChange={(e) => {
                  setCommuneId(e.target.value);
                  setErrors((er) => ({ ...er, place: undefined }));
                }}
              >
                <option value="">{t("rep.place_commune_choose")}</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.department})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </Step>

      {/* Facultatif : ravageur reconnu */}
      {pests.length > 0 ? (
        <details className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <summary className="av-control flex min-h-touch cursor-pointer items-center gap-3 text-lg font-semibold">
            <IconInsecte size={28} className="text-primary" />
            {t("report.pest")}
            <span className="text-sm font-normal text-ink-muted">({t("rep.optional")})</span>
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <PestGrid
              legend={likelyPests.length > 0 ? t("rep.pest_for_parcel") : null}
              pests={likelyPests}
              selected={pestId}
              onSelect={setPestId}
              kindLabel={(k) => t(`rep.pest_kind.${k}`)}
            />
            <PestGrid
              legend={likelyPests.length > 0 ? t("rep.pest_others") : null}
              pests={otherPests}
              selected={pestId}
              onSelect={setPestId}
              kindLabel={(k) => t(`rep.pest_kind.${k}`)}
              unknownLabel={t("report.unknown_pest")}
            />
          </div>
        </details>
      ) : null}

      {failed ? (
        <Callout tone="critical" role="alert" title={t("rep.failed_title")}>
          {failed.fields ? Object.values(failed.fields)[0] ?? failed.message : failed.message}
        </Callout>
      ) : null}
      {!online ? (
        <Callout tone="offline" title={t("rep.queued_title")}>
          {t("rep.offline_before_send")}
        </Callout>
      ) : null}

      <div className="sticky bottom-20 z-10 sm:static">
        <Button type="submit" size="lg" block icon={<IconSignaler size={24} />} loading={sending} loadingLabel={t("rep.sending")}>
          {t("report.send")}
        </Button>
      </div>
    </form>
  );
}

function Step({
  n,
  icon,
  title,
  hint,
  listenKey,
  labels,
  children,
}: {
  n: number;
  icon: ReactNode;
  title: string;
  hint?: string;
  listenKey: string;
  labels: { listen: string; stop: string; loading: string; error: string };
  children: ReactNode;
}) {
  const locale = useLocale();
  const audioSrc = useAudioUrl(listenKey);
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary">
          {n}
        </span>
        <span className="text-primary">{icon}</span>
        <h2 id={id} className="min-w-0 flex-1 text-lg">
          {title}
        </h2>
        <ListenButton text={hint ? `${title}. ${hint}` : title} lang={locale} audioSrc={hint ? null : audioSrc} labels={labels} variant="icon" />
      </div>
      {hint ? <p className="text-base text-ink-muted">{hint}</p> : null}
      {children}
    </section>
  );
}

function PestGrid({
  legend,
  pests,
  selected,
  onSelect,
  kindLabel,
  unknownLabel,
}: {
  legend: string | null;
  pests: WizardPest[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  kindLabel: (kind: WizardPest["kind"]) => string;
  unknownLabel?: string;
}) {
  if (pests.length === 0 && !unknownLabel) return null;
  return (
    <div className="flex flex-col gap-2">
      {legend ? <p className="text-base font-semibold">{legend}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pests.map((p) => {
          const Icon = p.kind === "DISEASE" ? IconMaladieFeuille : IconInsecte;
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : p.id)}
              className={cx(
                "av-control flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center",
                active ? "border-primary bg-primary-soft" : "border-line-strong bg-surface hover:bg-sunken",
              )}
            >
              <Icon size={40} className={p.kind === "DISEASE" ? "text-earth" : "text-primary"} />
              <span className="text-base leading-tight font-semibold">{p.name}</span>
              <span className="text-sm text-ink-muted">{kindLabel(p.kind)}</span>
            </button>
          );
        })}
        {unknownLabel ? (
          <button
            type="button"
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
            className={cx(
              "av-control flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center",
              selected === null ? "border-primary bg-primary-soft" : "border-line-strong bg-surface hover:bg-sunken",
            )}
          >
            <span aria-hidden="true" className="text-3xl font-bold text-ink-muted">
              ?
            </span>
            <span className="text-base font-semibold">{unknownLabel}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
