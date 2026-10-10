import { useState, useEffect, useCallback, useRef } from 'react';
import { saveDraft, getDraft, getPendingDrafts, markSynced, deleteDraft } from '../lib/offlineDrafts';
import { toast } from 'sonner';

/**
 * Hook for offline editing with auto-sync
 * @param {string} type - 'lesson' | 'scheme' | 'workpaper'
 * @param {string} docId - Document identifier
 * @param {function} syncFn - Async function that takes content and syncs to server
 * @param {number} autoSaveMs - Auto-save interval in ms (default 5000)
 */
export function useOfflineSync(type, docId, syncFn, autoSaveMs = 5000) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const contentRef = useRef(null);
  const timerRef = useRef(null);
  const docIdRef = useRef(docId);
  docIdRef.current = docId;

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => {
      setIsOnline(false);
      toast.info('You are offline. Changes will be saved locally.', { duration: 4000, id: 'offline-toast' });
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && hasPendingChanges) {
      syncPending();
    }
  }, [isOnline]);

  // Auto-save timer
  useEffect(() => {
    if (!docId) return;
    timerRef.current = setInterval(() => {
      if (contentRef.current) {
        saveLocally(contentRef.current);
      }
    }, autoSaveMs);
    return () => clearInterval(timerRef.current);
  }, [docId, autoSaveMs]);

  // Check for existing draft on mount
  useEffect(() => {
    if (!docId) return;
    getDraft(type, docId).then(draft => {
      if (draft && draft.syncStatus === 'pending') {
        setHasPendingChanges(true);
        setLastSaved(draft.savedAt);
      }
    }).catch(() => {});
  }, [type, docId]);

  const saveLocally = useCallback(async (content) => {
    if (!docIdRef.current) return;
    try {
      const draft = await saveDraft(type, docIdRef.current, content);
      setLastSaved(draft.savedAt);
      if (!navigator.onLine) {
        setHasPendingChanges(true);
      }
    } catch (err) {
      console.error('Failed to save draft locally:', err);
    }
  }, [type]);

  const saveContent = useCallback(async (content) => {
    contentRef.current = content;
    if (navigator.onLine && syncFn) {
      try {
        setIsSyncing(true);
        await syncFn(content);
        await markSynced(type, docIdRef.current);
        setHasPendingChanges(false);
        setLastSaved(new Date().toISOString());
      } catch {
        // Save locally if server sync fails
        await saveLocally(content);
        setHasPendingChanges(true);
      } finally {
        setIsSyncing(false);
      }
    } else {
      await saveLocally(content);
      setHasPendingChanges(true);
    }
  }, [syncFn, type, saveLocally]);

  const syncPending = useCallback(async () => {
    if (!syncFn || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const pending = await getPendingDrafts();
      const myPending = pending.filter(d => d.type === type && d.docId === docIdRef.current);
      for (const draft of myPending) {
        await syncFn(draft.content);
        await markSynced(draft.type, draft.docId);
      }
      if (myPending.length > 0) {
        toast.success(`Synced ${myPending.length} offline change(s)`, { id: 'sync-toast' });
      }
      setHasPendingChanges(false);
    } catch {
      toast.error('Failed to sync some changes. Will retry.', { id: 'sync-error-toast' });
    } finally {
      setIsSyncing(false);
    }
  }, [syncFn, type]);

  const getLocalDraft = useCallback(async () => {
    if (!docId) return null;
    return getDraft(type, docId);
  }, [type, docId]);

  const clearDraft = useCallback(async () => {
    if (!docId) return;
    await deleteDraft(type, docId);
    setHasPendingChanges(false);
  }, [type, docId]);

  return {
    isOnline,
    hasPendingChanges,
    isSyncing,
    lastSaved,
    saveContent,
    syncPending,
    getLocalDraft,
    clearDraft,
    saveLocally,
  };
}
