import React, { useState, useEffect } from 'react';
import { WifiOff, Cloud, Loader2, ChevronUp, ChevronDown, RefreshCw, Check } from 'lucide-react';
import { useSyncStatus } from '../contexts/SyncContext';
import { getPendingRequests } from '../lib/offlineQueue';

export function OfflineStatusBar() {
  const { isOnline, pendingCount, isSyncing, lastSyncedAt, syncNow } = useSyncStatus();
  const [expanded, setExpanded] = useState(false);
  const [pendingDetails, setPendingDetails] = useState([]);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  // Track when coming back online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      setWasOffline(false);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // Load pending details when expanded
  useEffect(() => {
    if (expanded) {
      getPendingRequests().then(setPendingDetails).catch(() => {});
    }
  }, [expanded, pendingCount]);

  // Don't show anything if online with no pending items and no recent reconnect
  if (isOnline && pendingCount === 0 && !isSyncing && !showReconnected) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990]" data-testid="offline-status-bar">
      {/* Reconnected flash */}
      {showReconnected && isOnline && pendingCount === 0 && !isSyncing && (
        <div className="mx-4 mb-4 bg-[#C5A55A] text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-[#C5A55A]/20 animate-slide-up">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Back online — everything is synced</span>
        </div>
      )}

      {/* Offline bar */}
      {!isOnline && (
        <div className="mx-4 mb-4 bg-[#1B2A4A] rounded-xl shadow-2xl shadow-black/20 overflow-hidden animate-slide-up">
          <div
            className="px-4 py-3 flex items-center gap-3 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <WifiOff className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">You're offline</p>
              <p className="text-slate-400 text-xs">
                {pendingCount > 0
                  ? `${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync`
                  : 'Viewing cached data — changes will sync when you reconnect'}
              </p>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#C5A55A] text-xs font-bold bg-[#C5A55A]/10 px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
              </div>
            )}
          </div>

          {/* Expanded queue details */}
          {expanded && pendingDetails.length > 0 && (
            <div className="border-t border-white/10 px-4 py-3 max-h-40 overflow-y-auto">
              {pendingDetails.map((req, i) => (
                <div key={req.id || i} className="flex items-center gap-3 py-1.5 text-xs">
                  <span className={`uppercase font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    req.method === 'post' ? 'bg-blue-500/20 text-blue-300' :
                    req.method === 'put' ? 'bg-amber-500/20 text-amber-300' :
                    req.method === 'delete' ? 'bg-red-500/20 text-red-300' :
                    'bg-slate-500/20 text-slate-300'
                  }`}>{req.method}</span>
                  <span className="text-slate-300 truncate flex-1">{req.url.replace(/.*\/api\//, '/')}</span>
                  <span className="text-slate-500 text-[10px]">{new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Syncing bar */}
      {isOnline && isSyncing && (
        <div className="mx-4 mb-4 bg-[#2E6CC4] text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-[#2E6CC4]/20 animate-slide-up">
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
          <span className="text-sm font-medium">Syncing offline changes...</span>
        </div>
      )}

      {/* Pending items bar (online but still has unsynced) */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <div className="mx-4 mb-4 bg-[#1B2A4A] rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg animate-slide-up">
          <Cloud className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-white text-sm font-medium">{pendingCount} unsynced change{pendingCount > 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={syncNow}
            className="bg-[#C5A55A] text-[#1B2A4A] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#d4b76a] transition-colors flex items-center gap-1.5"
            data-testid="sync-now-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync Now
          </button>
        </div>
      )}
    </div>
  );
}
