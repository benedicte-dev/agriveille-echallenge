/**
 * File hors ligne (navigateur) : signalements et accusés de réception.
 * - `submitReportOfflineSafe(draft)`, `ackAlertOfflineSafe(alertId)` : mise en
 *   file durable puis envoi immédiat si le réseau est là.
 * - `useOfflineQueue()` : compteur d'envois en attente et échecs.
 * - `OfflineQueueRunner` : à monter une fois dans la coquille pour le rejeu auto.
 */
export {
  ackAlertOfflineSafe,
  submitReportOfflineSafe,
  reportToItem,
  flushQueue,
  startAutoReplay,
  pendingCount,
  pendingItems,
  failures,
  dismissFailure,
  subscribe,
  sendItem,
  toFormData,
} from "./sync";
export type { SubmitOutcome, ReportDraft, OfflineEvent, FlushSummary, SyncResponseBody } from "./sync";
export { enqueue, list, remove, count, OfflineStorageUnavailable } from "./queue";
export {
  classifyStatus,
  backoffMs,
  parseRetryAfter,
  dueItems,
  newClientId,
  OFFLINE_DB_NAME,
  QUEUE_STORE,
  FAILURE_STORE,
  SYNC_TAG,
  OFFLINE_CHANNEL,
  SYNC_ENDPOINT,
} from "./policy";
export type { QueueItem, QueueFailure, QueueKind, Outcome } from "./policy";
export { useOfflineQueue, OfflineQueueRunner } from "./hooks";
export type { OfflineQueueState } from "./hooks";
