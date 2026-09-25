/**
 * File IndexedDB minimale, sans dépendance. Même base et mêmes magasins que
 * public/sw.js (Background Sync). Navigateur uniquement.
 */
import {
  FAILURE_STORE,
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  QUEUE_STORE,
  type QueueFailure,
  type QueueItem,
} from "./policy";

export class OfflineStorageUnavailable extends Error {
  constructor() {
    super("IndexedDB indisponible");
    this.name = "OfflineStorageUnavailable";
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new OfflineStorageUnavailable());
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    } catch {
      return reject(new OfflineStorageUnavailable());
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FAILURE_STORE)) db.createObjectStore(FAILURE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Une autre version (nouveau SW) demande la main : on ferme proprement.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(new OfflineStorageUnavailable());
    req.onblocked = () => reject(new OfflineStorageUnavailable());
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB"));
      }),
  );
}

/** Ajoute ou remplace (même id = même envoi : pas de doublon local). */
export function enqueue(item: QueueItem): Promise<void> {
  return run(QUEUE_STORE, "readwrite", (s) => s.put(item)).then(() => undefined);
}

export function list(): Promise<QueueItem[]> {
  return run<QueueItem[]>(QUEUE_STORE, "readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>);
}

export function get(id: string): Promise<QueueItem | undefined> {
  return run<QueueItem | undefined>(QUEUE_STORE, "readonly", (s) => s.get(id) as IDBRequest<QueueItem | undefined>);
}

export function remove(id: string): Promise<void> {
  return run(QUEUE_STORE, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function count(): Promise<number> {
  return run<number>(QUEUE_STORE, "readonly", (s) => s.count());
}

export function recordFailure(failure: QueueFailure): Promise<void> {
  return run(FAILURE_STORE, "readwrite", (s) => s.put(failure)).then(() => undefined);
}

export function listFailures(): Promise<QueueFailure[]> {
  return run<QueueFailure[]>(FAILURE_STORE, "readonly", (s) => s.getAll() as IDBRequest<QueueFailure[]>);
}

export function dismissFailure(id: string): Promise<void> {
  return run(FAILURE_STORE, "readwrite", (s) => s.delete(id)).then(() => undefined);
}
