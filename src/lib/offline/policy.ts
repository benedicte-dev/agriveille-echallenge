/**
 * Politique de la file hors ligne (module pur, partagé avec public/sw.js qui
 * en recopie les règles : garder les deux en phase).
 *
 * - 2xx : envoyé, l'élément quitte la file.
 * - 401 (session expirée, E5), 408, 425, 429 (quota, E4), 5xx, erreur réseau :
 *   l'élément reste et sera rejoué avec un délai croissant.
 * - Autre 4xx (invalide, refusé, introuvable…) : erreur définitive, l'élément
 *   est retiré et l'échec est signalé à l'utilisatrice.
 */

export const OFFLINE_DB_NAME = "agriveille-offline";
export const OFFLINE_DB_VERSION = 1;
export const QUEUE_STORE = "queue";
export const FAILURE_STORE = "failures";
export const SYNC_TAG = "av-offline-sync";
export const SYNC_LOCK = "av-offline-sync";
export const OFFLINE_CHANNEL = "av-offline";
export const SYNC_ENDPOINT = "/api/offline/sync";

export type QueueKind = "report" | "ack";

export interface QueueItem {
  /** clientId (signalement) ou `ack:<alertId>` (accusé de réception). */
  id: string;
  kind: QueueKind;
  /** Champs texte envoyés tels quels en multipart (dont `kind`). */
  fields: Record<string, string>;
  /** Photo compressée (webp/jpeg), stockée en Blob dans IndexedDB. */
  photo?: Blob | null;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  /** Dernier statut HTTP (0 = réseau). */
  lastStatus?: number | null;
}

export interface QueueFailure {
  id: string;
  kind: QueueKind;
  status: number;
  message: string;
  at: number;
}

export type Outcome = "done" | "retry" | "drop";

export function classifyStatus(status: number): Outcome {
  if (status >= 200 && status < 300) return "done";
  if (status === 0 || status === 401 || status === 408 || status === 425 || status === 429) return "retry";
  if (status >= 500) return "retry";
  if (status >= 400) return "drop";
  // 1xx / 3xx inattendus (redirection vers /connexion…) : on garde.
  return "retry";
}

export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 10 * 60_000;

/**
 * Délai avant la prochaine tentative : 5 s, 10 s, 20 s… plafonné à 10 min,
 * avec ±20 % d'aléa pour ne pas synchroniser tous les téléphones au retour du réseau.
 * `retryAfterMs` (en-tête Retry-After d'un 429) est un minimum.
 */
export function backoffMs(attempts: number, opts: { random?: number; retryAfterMs?: number } = {}): number {
  const n = Math.max(1, Math.floor(attempts));
  const raw = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(n - 1, 20));
  const r = opts.random ?? Math.random();
  const jittered = Math.round(raw * (0.8 + 0.4 * Math.min(1, Math.max(0, r))));
  return Math.max(jittered, opts.retryAfterMs ?? 0);
}

/** En-tête Retry-After (secondes ou date HTTP) → ms ; 0 si absent ou illisible. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number {
  if (!value) return 0;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, Math.round(secs * 1000));
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : 0;
}

/** Items prêts à partir (ou tous si `force`), du plus ancien au plus récent. */
export function dueItems<T extends Pick<QueueItem, "nextAttemptAt" | "createdAt">>(items: readonly T[], now: number, force = false): T[] {
  return items.filter((i) => force || i.nextAttemptAt <= now).sort((a, b) => a.createdAt - b.createdAt);
}

/** UUID v4 : crypto.randomUUID, avec repli getRandomValues (contexte non sécurisé en réseau local). */
export function newClientId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
