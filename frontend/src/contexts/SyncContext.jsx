import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { getPendingRequests, removePendingRequest } from '../lib/offlineQueue';
import { toast } from 'sonner';

const SyncContext = createContext({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  syncNow: () => {},
});

export function useSyncStatus() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const syncingRef = useRef(false);

  // Define syncNow FIRST so effects can reference it
  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const pending = await getPendingRequests();
      if (pending.length === 0) {
        setIsSyncing(false);
        syncingRef.current = false;
        return;
      }

      let synced = 0;
      let failed = 0;

      for (const req of pending) {
        try {
          // Normalise stored URL → strip origin so it works via the Vite proxy in dev
          // e.g. "http://localhost:8000/api/foo" → "/api/foo"
          let url = req.url || '';
          try {
            const parsed = new URL(url);
            url = parsed.pathname + parsed.search;
          } catch { /* already a relative path */ }

          await api({
            method: req.method,
            url,
            data: req.data,
            timeout: 15000,
          });

          await removePendingRequest(req.id);
          synced++;
        } catch (err) {
          // Remove dead requests (4xx) — they will never succeed
          if (err.response && err.response.status >= 400 && err.response.status < 500) {
            await removePendingRequest(req.id);
            failed++;
          }
          // 5xx / network errors: leave in queue for next retry
        }
      }

      const remaining = await getPendingRequests();
      setPendingCount(remaining.length);
      setLastSyncedAt(new Date().toISOString());

      if (synced > 0) {
        toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''}`, { id: 'sync-success', duration: 3000 });
      }
      if (failed > 0) {
        toast.error(`${failed} change${failed > 1 ? 's' : ''} couldn't be synced`, { id: 'sync-failed', duration: 4000 });
      }
    } catch (err) {
      console.error('Sync error:', err);
    }

    setIsSyncing(false);
    syncingRef.current = false;
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => {
      setIsOnline(false);
      toast.info('You\'re offline. Changes will sync when you reconnect.', { id: 'offline-global', duration: 5000 });
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
    if (isOnline && pendingCount > 0) {
      const timer = setTimeout(() => syncNow(), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, syncNow, pendingCount]);

  // Poll pending count every 5s
  useEffect(() => {
    const checkPending = async () => {
      try {
        const pending = await getPendingRequests();
        setPendingCount(pending.length);
      } catch { /* silent */ }
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, lastSyncedAt, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}
