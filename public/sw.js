/* AgriVeille — service worker écrit à la main (SPEC §6).
 *
 * Stratégies :
 * - coquille (/hors-ligne, manifeste, icônes) : pré-cachée à l'installation ;
 * - navigations : réseau d'abord, repli sur la dernière copie en cache de la
 *   page (espace fermier et pages publiques), puis sur /hors-ligne ;
 * - /_next/static/* (fichiers à empreinte, immuables) : cache d'abord ;
 * - /audio/* : mis en cache à la première écoute seulement (pas 4 Mo d'un coup) ;
 * - jamais de cache pour : méthodes autres que GET, /api/* (dont les photos de
 *   signalements), requêtes RSC, espaces /agent et /admin, pages de connexion.
 * - Background Sync (« av-offline-sync ») : rejoue la file IndexedDB partagée
 *   avec src/lib/offline (mêmes règles que src/lib/offline/policy.ts).
 */
"use strict";

const VERSION = "2026-09-25.1";
const SHELL_CACHE = `av-shell-${VERSION}`;
const STATIC_CACHE = `av-static-${VERSION}`;
const PAGES_CACHE = `av-pages-${VERSION}`;
// L'audio pré-généré change rarement : cache séparé, conservé d'une version à l'autre.
const AUDIO_CACHE = "av-audio-v1";
const KEEP = new Set([SHELL_CACHE, STATIC_CACHE, PAGES_CACHE, AUDIO_CACHE]);

const OFFLINE_URL = "/hors-ligne";
const SHELL_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.svg",
  "/icons/apple-touch-icon.png",
];

/** Pages dont une copie peut servir hors ligne (préfixes). */
const CACHEABLE_PAGES = ["/app", "/reglementation", "/marche", "/hors-ligne"];
const CACHEABLE_EXACT = new Set(["/"]);
/** Jamais en cache : données d'agents et d'administration, authentification. */
const NEVER_PAGES = ["/agent", "/admin", "/acheteur", "/connexion", "/inscription", "/api"];
const MAX_PAGES = 40;
const MAX_STATIC = 300;
const NAV_TIMEOUT_MS = 8000;

// ── Installation / activation ─────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // La page hors ligne est indispensable ; les icônes sont au mieux.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload", credentials: "same-origin" }));
      await Promise.allSettled(
        SHELL_URLS.filter((u) => u !== OFFLINE_URL).map((u) => cache.add(new Request(u, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("av-") && !KEEP.has(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          /* non pris en charge */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  // À la déconnexion, la page peut demander l'effacement des copies de pages.
  if (data.type === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGES_CACHE));
  if (data.type === "FLUSH_QUEUE") event.waitUntil(replayQueue());
});

// ── Routage des requêtes ──────────────────────────────────────────────────

function startsWithAny(path, prefixes) {
  return prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
}

function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc") || request.headers.get("Next-Router-Prefetch") === "1";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // POST & co : réseau seul, jamais en cache
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // API (photos de signalements incluses) : jamais en cache
  if (isRscRequest(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC));
    return;
  }
  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(audioCacheOnPlay(request));
    return;
  }
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }
  if (/\.(svg|png|ico|webp|woff2?)$/.test(url.pathname) && !startsWithAny(url.pathname, NEVER_PAGES)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

function pageIsCacheable(url) {
  if (startsWithAny(url.pathname, NEVER_PAGES)) return false;
  return CACHEABLE_EXACT.has(url.pathname) || startsWithAny(url.pathname, CACHEABLE_PAGES);
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

async function handleNavigation(event, url) {
  const cacheable = pageIsCacheable(url);
  const cacheKey = url.origin + url.pathname + url.search;
  const network = (async () => {
    const preloaded = await event.preloadResponse;
    return preloaded || fetch(event.request);
  })();

  // En 2G, on n'attend pas indéfiniment si une copie existe déjà.
  const cached = cacheable ? await caches.match(cacheKey, { cacheName: PAGES_CACHE }) : undefined;
  try {
    const response = cached ? await Promise.race([network, timeout(NAV_TIMEOUT_MS)]) : await network;
    if (!response) {
      event.waitUntil(network.then((r) => storePage(url, cacheKey, r)).catch(() => undefined));
      return cached;
    }
    event.waitUntil(storePage(url, cacheKey, response.clone()));
    return response;
  } catch {
    if (cached) return cached;
    const fallback = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    return fallback || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function storePage(url, cacheKey, response) {
  if (!response) return;
  // Redirigé vers /connexion : la session est finie, on efface les copies de pages.
  if (response.redirected && new URL(response.url).pathname.startsWith("/connexion")) {
    await caches.delete(PAGES_CACHE);
    return;
  }
  if (!pageIsCacheable(url) || !response.ok || response.type !== "basic" || response.redirected) return;
  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("text/html")) return;
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(cacheKey, response);
  await trim(cache, MAX_PAGES);
}

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    trim(cache, max);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (hit) return hit;
  const fresh = await refresh;
  return fresh || new Response("", { status: 504 });
}

/**
 * Audio : mis en cache à la première lecture (fichier complet, sans Range),
 * puis servi depuis le cache, y compris les requêtes partielles du lecteur.
 */
async function audioCacheOnPlay(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const key = new Request(request.url);
  let full = await cache.match(key);
  if (!full) {
    try {
      const response = await fetch(key);
      if (!response.ok || response.type !== "basic") return response;
      await cache.put(key, response.clone());
      full = response;
    } catch {
      return new Response("", { status: 504 });
    }
  }
  const range = request.headers.get("Range");
  if (!range) return full;
  return rangeResponse(full, range);
}

async function rangeResponse(full, range) {
  const buf = await full.arrayBuffer();
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  const size = buf.byteLength;
  let start = 0;
  let end = size - 1;
  if (m) {
    if (m[1] === "" && m[2] !== "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1] || 0);
      if (m[2] !== "") end = Math.min(size - 1, Number(m[2]));
    }
  }
  if (start > end || start >= size) {
    return new Response("", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

// ── Background Sync : rejeu de la file hors ligne ─────────────────────────
// Base, magasins et règles identiques à src/lib/offline/policy.ts.

const DB_NAME = "agriveille-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "queue";
const FAILURE_STORE = "failures";
const SYNC_TAG = "av-offline-sync";
const SYNC_LOCK = "av-offline-sync";
const SYNC_ENDPOINT = "/api/offline/sync";
const CHANNEL = "av-offline";
const SEND_TIMEOUT_MS = 90000;

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(
    replayQueue().then((summary) => {
      // Des éléments restent (401/429/5xx/réseau) : le navigateur reprogrammera la synchro.
      if (summary.kept > 0 && !event.lastChance) throw new Error("retry-later");
    }),
  );
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FAILURE_STORE)) db.createObjectStore(FAILURE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    let result;
    req.onsuccess = () => {
      result = req.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function classifyStatus(status) {
  if (status >= 200 && status < 300) return "done";
  if (status === 0 || status === 401 || status === 408 || status === 425 || status === 429) return "retry";
  if (status >= 500) return "retry";
  if (status >= 400) return "drop";
  return "retry";
}

function backoffMs(attempts, retryAfterMs) {
  const n = Math.max(1, attempts);
  const raw = Math.min(600000, 5000 * Math.pow(2, Math.min(n - 1, 20)));
  return Math.max(Math.round(raw * (0.8 + 0.4 * Math.random())), retryAfterMs || 0);
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
}

function broadcast(message) {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(message);
    ch.close();
  } catch {
    /* BroadcastChannel indisponible */
  }
}

async function sendItem(item) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(item.fields || {})) fd.append(k, v);
  if (item.photo) fd.append("photo", item.photo, item.photo.type === "image/jpeg" ? "photo.jpg" : "photo.webp");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      signal: ctrl.signal,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const status = res.type === "opaqueredirect" ? 401 : res.status;
    return { outcome: classifyStatus(status), status, body, retryAfterMs: parseRetryAfter(res.headers.get("Retry-After")) };
  } catch {
    return { outcome: "retry", status: 0, body: null, retryAfterMs: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function replayOnce() {
  const summary = { sent: 0, failed: 0, kept: 0 };
  const db = await openDb();
  try {
    const items = (await idb(db, QUEUE_STORE, "readonly", (s) => s.getAll())) || [];
    items.sort((a, b) => a.createdAt - b.createdAt);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const r = await sendItem(item);
      if (r.outcome === "done") {
        await idb(db, QUEUE_STORE, "readwrite", (s) => s.delete(item.id));
        summary.sent++;
        const entityId = r.body && r.body.ok ? (r.body.kind === "report" ? r.body.reportId : r.body.alertId) : undefined;
        broadcast({ type: "sent", id: item.id, kind: item.kind, entityId });
      } else if (r.outcome === "drop") {
        await idb(db, QUEUE_STORE, "readwrite", (s) => s.delete(item.id));
        const failure = {
          id: item.id,
          kind: item.kind,
          status: r.status,
          message: (r.body && r.body.message) || "Envoi refusé. Vérifiez les informations et recommencez.",
          at: Date.now(),
        };
        await idb(db, FAILURE_STORE, "readwrite", (s) => s.put(failure));
        summary.failed++;
        broadcast({ type: "failed", failure });
      } else {
        const attempts = (item.attempts || 0) + 1;
        const next = Object.assign({}, item, {
          attempts,
          lastStatus: r.status,
          nextAttemptAt: Date.now() + backoffMs(attempts, r.retryAfterMs),
        });
        await idb(db, QUEUE_STORE, "readwrite", (s) => s.put(next));
        summary.kept++;
        if (r.status === 0 || r.status === 401) {
          summary.kept += items.length - i - 1;
          break;
        }
      }
    }
  } finally {
    db.close();
    broadcast({ type: "changed" });
  }
  return summary;
}

function replayQueue() {
  const locks = self.navigator && self.navigator.locks;
  if (!locks) return replayOnce();
  return locks.request(SYNC_LOCK, { ifAvailable: true }, (lock) =>
    lock ? replayOnce() : { sent: 0, failed: 0, kept: 0 },
  );
}
