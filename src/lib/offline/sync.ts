/**
 * Rejeu de la file hors ligne (navigateur). Déclencheurs : chargement de la
 * page, événement `online`, retour au premier plan, minuterie de backoff, et
 * Background Sync du service worker quand il existe (public/sw.js rejoue la
 * même file avec les mêmes règles). Le serveur est idempotent (clientId pour
 * les signalements, accusé déjà posé pour les acks) : un double envoi entre
 * deux onglets ou entre la page et le SW ne crée aucun doublon.
 */
import {
  OFFLINE_CHANNEL,
  SYNC_ENDPOINT,
  SYNC_LOCK,
  SYNC_TAG,
  backoffMs,
  classifyStatus,
  dueItems,
  newClientId,
  parseRetryAfter,
  type QueueFailure,
  type QueueItem,
} from "./policy";
import * as queue from "./queue";
import { OfflineStorageUnavailable } from "./queue";

/** Envoi d'une photo de 300 Ko en 2G : jusqu'à une minute. */
const SEND_TIMEOUT_MS = 90_000;
const GENERIC_FAILURE = "Envoi refusé. Vérifiez les informations et recommencez.";

export type OfflineEvent =
  | { type: "changed" }
  | { type: "sent"; id: string; kind: QueueItem["kind"]; entityId?: string }
  | { type: "failed"; failure: QueueFailure };

// ── Diffusion (même onglet, autres onglets, service worker) ───────────────

const listeners = new Set<(e: OfflineEvent) => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  channel = new BroadcastChannel(OFFLINE_CHANNEL);
  channel.onmessage = (m: MessageEvent<OfflineEvent>) => {
    if (m.data && typeof m.data === "object" && "type" in m.data) listeners.forEach((l) => l(m.data));
  };
  return channel;
}

function emit(e: OfflineEvent) {
  listeners.forEach((l) => l(e));
  try {
    getChannel()?.postMessage(e);
  } catch {
    /* canal fermé */
  }
}

export function subscribe(listener: (e: OfflineEvent) => void): () => void {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Envoi d'un élément ────────────────────────────────────────────────────

export interface SendResult {
  outcome: "done" | "retry" | "drop";
  status: number;
  body: SyncResponseBody | null;
  retryAfterMs: number;
}

export type SyncResponseBody =
  | { ok: true; kind: "report"; clientId: string; reportId: string; duplicate: boolean }
  | { ok: true; kind: "ack"; alertId: string; duplicate: boolean }
  | { ok: false; error: string; message: string; fields?: Record<string, string> };

export function toFormData(item: Pick<QueueItem, "fields" | "photo">): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(item.fields)) fd.append(k, v);
  if (item.photo) fd.append("photo", item.photo, item.photo.type === "image/jpeg" ? "photo.jpg" : "photo.webp");
  return fd;
}

export async function sendItem(item: QueueItem): Promise<SendResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      body: toFormData(item),
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      signal: ctrl.signal,
    });
    let body: SyncResponseBody | null = null;
    try {
      body = (await res.json()) as SyncResponseBody;
    } catch {
      body = null;
    }
    // Redirection opaque (session perdue côté proxy) : statut 0 → on garde.
    const status = res.type === "opaqueredirect" ? 401 : res.status;
    return { outcome: classifyStatus(status), status, body, retryAfterMs: parseRetryAfter(res.headers.get("Retry-After")) };
  } catch {
    return { outcome: "retry", status: 0, body: null, retryAfterMs: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Applique le résultat d'un envoi à la file (retrait, report, échec définitif). */
async function settle(item: QueueItem, r: SendResult): Promise<void> {
  if (r.outcome === "done") {
    await queue.remove(item.id);
    const entityId = r.body && r.body.ok ? (r.body.kind === "report" ? r.body.reportId : r.body.alertId) : undefined;
    emit({ type: "sent", id: item.id, kind: item.kind, entityId });
  } else if (r.outcome === "drop") {
    await queue.remove(item.id);
    const failure: QueueFailure = {
      id: item.id,
      kind: item.kind,
      status: r.status,
      message: r.body && !r.body.ok && r.body.message ? r.body.message : GENERIC_FAILURE,
      at: Date.now(),
    };
    await queue.recordFailure(failure).catch(() => undefined);
    emit({ type: "failed", failure });
  } else {
    const attempts = item.attempts + 1;
    await queue.enqueue({
      ...item,
      attempts,
      lastStatus: r.status,
      nextAttemptAt: Date.now() + backoffMs(attempts, { retryAfterMs: r.retryAfterMs }),
    });
  }
  emit({ type: "changed" });
}

// ── Rejeu de la file ──────────────────────────────────────────────────────

let flushing: Promise<FlushSummary> | null = null;

export interface FlushSummary {
  sent: number;
  failed: number;
  kept: number;
}

async function withLock<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks) return fn();
  // ifAvailable : si un autre onglet ou le SW rejoue déjà, on ne double pas les envois.
  return locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => (lock ? fn() : fallback));
}

/**
 * Envoie les éléments dus (ou tous si `force`), un par un, du plus ancien au
 * plus récent. Une erreur réseau interrompt la passe : inutile d'insister.
 */
export function flushQueue(opts: { force?: boolean } = {}): Promise<FlushSummary> {
  if (flushing) return flushing;
  const empty: FlushSummary = { sent: 0, failed: 0, kept: 0 };
  flushing = withLock(async () => {
    const summary = { ...empty };
    let items: QueueItem[];
    try {
      items = await queue.list();
    } catch {
      return summary;
    }
    const due = dueItems(items, Date.now(), opts.force);
    summary.kept = items.length - due.length;
    for (const item of due) {
      const r = await sendItem(item);
      await settle(item, r).catch(() => undefined);
      if (r.outcome === "done") summary.sent++;
      else if (r.outcome === "drop") summary.failed++;
      else {
        summary.kept++;
        if (r.status === 0 || r.status === 401) {
          summary.kept += due.length - due.indexOf(item) - 1;
          break;
        }
      }
    }
    return summary;
  }, empty).finally(() => {
    flushing = null;
    scheduleNext();
  });
  return flushing;
}

// ── Déclencheurs automatiques ─────────────────────────────────────────────

let installed = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleNext() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = null;
  queue
    .list()
    .then((items) => {
      if (items.length === 0) return;
      const next = Math.min(...items.map((i) => i.nextAttemptAt));
      const delay = Math.max(1_000, Math.min(next - Date.now(), 10 * 60_000));
      timer = setTimeout(() => {
        if (navigator.onLine) void flushQueue();
        else scheduleNext();
      }, delay);
    })
    .catch(() => undefined);
}

/**
 * Installe le rejeu automatique (idempotent) : au chargement, sur `online`
 * (tout est renvoyé sans attendre le backoff), au retour au premier plan,
 * et sur message du service worker.
 */
export function startAutoReplay(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => void flushQueue({ force: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) void flushQueue();
  });
  if (navigator.onLine) void flushQueue({ force: true });
  else scheduleNext();
}

async function registerBackgroundSync(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = (await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 2_000)),
    ])) as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | null;
    await reg?.sync?.register(SYNC_TAG);
  } catch {
    /* Background Sync indisponible : la page rejoue elle-même (startAutoReplay). */
  }
}

// ── API métier ────────────────────────────────────────────────────────────

export type SubmitOutcome =
  | { status: "sent"; entityId?: string; duplicate?: boolean }
  | { status: "queued"; reason: "offline" | "retry"; httpStatus: number }
  | { status: "failed"; message: string; fields?: Record<string, string>; httpStatus: number };

/**
 * Met l'élément en file (durable) PUIS tente l'envoi immédiat si le réseau est
 * là : si l'onglet se ferme pendant l'envoi, rien n'est perdu.
 */
async function submit(item: QueueItem): Promise<SubmitOutcome> {
  let stored = true;
  try {
    await queue.enqueue(item);
    emit({ type: "changed" });
  } catch (err) {
    if (!(err instanceof OfflineStorageUnavailable)) throw err;
    stored = false;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (!stored) return { status: "failed", message: "Pas de réseau et pas de mémoire disponible sur ce téléphone.", httpStatus: 0 };
    void registerBackgroundSync();
    scheduleNext();
    return { status: "queued", reason: "offline", httpStatus: 0 };
  }

  const r = await sendItem(item);
  if (stored) {
    if (r.outcome === "drop") {
      // Échec définitif affiché tout de suite à l'écran : pas d'entrée « échec » en plus.
      await queue.remove(item.id).catch(() => undefined);
      emit({ type: "changed" });
    } else {
      await settle(item, r).catch(() => undefined);
    }
  }
  if (r.outcome === "done") {
    const body = r.body && r.body.ok ? r.body : null;
    return {
      status: "sent",
      entityId: body ? (body.kind === "report" ? body.reportId : body.alertId) : undefined,
      duplicate: body?.duplicate,
    };
  }
  if (r.outcome === "drop") {
    const body = r.body && !r.body.ok ? r.body : null;
    return { status: "failed", message: body?.message ?? GENERIC_FAILURE, fields: body?.fields, httpStatus: r.status };
  }
  if (!stored) return { status: "failed", message: "Envoi impossible pour le moment. Réessayez.", httpStatus: r.status };
  void registerBackgroundSync();
  return { status: "queued", reason: r.status === 0 ? "offline" : "retry", httpStatus: r.status };
}

export interface ReportDraft {
  clientId?: string;
  parcelId?: string | null;
  communeId?: string | null;
  lat?: number | null;
  lon?: number | null;
  pestId?: string | null;
  description?: string | null;
  voiceTranscript?: string | null;
  voiceLang?: "fr" | "fon" | "yo" | null;
  photo?: Blob | null;
}

export function reportToItem(draft: ReportDraft): QueueItem {
  const clientId = draft.clientId ?? newClientId();
  const fields: Record<string, string> = { kind: "report", clientId };
  const put = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") fields[k] = String(v);
  };
  put("parcelId", draft.parcelId);
  put("communeId", draft.communeId);
  put("lat", draft.lat);
  put("lon", draft.lon);
  put("pestId", draft.pestId);
  put("description", draft.description);
  put("voiceTranscript", draft.voiceTranscript);
  if (draft.voiceTranscript) put("voiceLang", draft.voiceLang);
  const now = Date.now();
  return { id: clientId, kind: "report", fields, photo: draft.photo ?? null, createdAt: now, attempts: 0, nextAttemptAt: now };
}

/** Signalement : file durable + envoi immédiat si possible. */
export function submitReportOfflineSafe(draft: ReportDraft): Promise<SubmitOutcome> {
  return submit(reportToItem(draft));
}

/**
 * Accusé de réception d'une alerte qui survit à une coupure réseau
 * (à brancher sur le bouton « J'ai compris »). Plusieurs appuis = un seul envoi.
 */
export function ackAlertOfflineSafe(alertId: string): Promise<SubmitOutcome> {
  const now = Date.now();
  return submit({
    id: `ack:${alertId}`,
    kind: "ack",
    fields: { kind: "ack", alertId },
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
  });
}

export async function pendingCount(): Promise<number> {
  try {
    return await queue.count();
  } catch {
    return 0;
  }
}

export async function pendingItems(): Promise<QueueItem[]> {
  try {
    return await queue.list();
  } catch {
    return [];
  }
}

export async function failures(): Promise<QueueFailure[]> {
  try {
    return await queue.listFailures();
  } catch {
    return [];
  }
}

export async function dismissFailure(id: string): Promise<void> {
  await queue.dismissFailure(id).catch(() => undefined);
  emit({ type: "changed" });
}
