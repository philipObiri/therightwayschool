/**
 * Offline Draft Manager
 * Uses IndexedDB to store document drafts when offline, auto-syncs when back online.
 * Works for Working Papers, Lessons, and Scheme of Work editors.
 */

const DB_NAME = 'rw_offline_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a draft to IndexedDB
 * @param {string} type - 'lesson' | 'scheme' | 'workpaper'
 * @param {string} docId - The document ID (lesson_id, scheme_id, document_id)
 * @param {object} content - The content to save (rich_content, title, etc.)
 */
export async function saveDraft(type, docId, content) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const draft = {
    id: `${type}_${docId}`,
    type,
    docId,
    content,
    syncStatus: navigator.onLine ? 'synced' : 'pending',
    updatedAt: new Date().toISOString(),
    savedAt: new Date().toISOString(),
  };
  store.put(draft);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(draft);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a draft from IndexedDB
 */
export async function getDraft(type, docId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(`${type}_${docId}`);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending drafts that need syncing
 */
export async function getPendingDrafts() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('syncStatus');
  const request = index.getAll('pending');
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark a draft as synced
 */
export async function markSynced(type, docId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const key = `${type}_${docId}`;
  const existing = await new Promise(r => { const req = store.get(key); req.onsuccess = () => r(req.result); });
  if (existing) {
    existing.syncStatus = 'synced';
    store.put(existing);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete a draft
 */
export async function deleteDraft(type, docId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(`${type}_${docId}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all drafts of a specific type
 */
export async function getDraftsByType(type) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('type');
  const request = index.getAll(type);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
