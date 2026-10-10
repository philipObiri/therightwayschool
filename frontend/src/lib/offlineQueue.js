/**
 * Offline Queue — stores failed mutations (POST/PUT/DELETE) in IndexedDB
 * and replays them when the connection is restored.
 */
const DB_NAME = 'rw_offline_queue';
const DB_VERSION = 1;
const QUEUE_STORE = 'pending_requests';
const CACHE_STORE = 'api_cache';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const store = db.createObjectStore(CACHE_STORE, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Mutation Queue ──

export async function enqueueRequest(method, url, data, headers) {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).add({
    method,
    url,
    data,
    headers: { ...headers, Authorization: headers?.Authorization },
    timestamp: new Date().toISOString(),
  });
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

export async function getPendingRequests() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const req = tx.objectStore(QUEUE_STORE).getAll();
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result || []); req.onerror = rej; });
}

export async function removePendingRequest(id) {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).delete(id);
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

export async function clearQueue() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).clear();
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

// ── API Response Cache ──

export async function cacheResponse(url, data, ttlMs = 5 * 60 * 1000) {
  try {
    const db = await openDB();
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put({
      url,
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs,
    });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch { /* silently fail cache writes */ }
}

export async function getCachedResponse(url) {
  try {
    const db = await openDB();
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const req = tx.objectStore(CACHE_STORE).get(url);
    return new Promise((res) => {
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && entry.expiry > Date.now()) {
          res(entry.data);
        } else {
          res(null);
        }
      };
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

export async function clearExpiredCache() {
  try {
    const db = await openDB();
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const now = Date.now();
      for (const entry of req.result || []) {
        if (entry.expiry < now) {
          store.delete(entry.url);
        }
      }
    };
  } catch { /* silent */ }
}
