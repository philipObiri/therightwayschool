import React from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, Loader2, Check } from 'lucide-react';

export function OfflineIndicator({ isOnline, hasPendingChanges, isSyncing, lastSaved }) {
  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 text-[#2E6CC4] bg-blue-50 px-2.5 py-1 rounded-lg" data-testid="offline-syncing">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-[10px] font-medium">Syncing...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg" data-testid="offline-indicator">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">Offline — saved locally</span>
      </div>
    );
  }

  if (hasPendingChanges) {
    return (
      <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg" data-testid="offline-pending">
        <CloudOff className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">Pending sync</span>
      </div>
    );
  }

  if (lastSaved) {
    const timeAgo = getTimeAgo(lastSaved);
    return (
      <div className="flex items-center gap-1.5 text-[#C5A55A] bg-[#C5A55A]/10 px-2.5 py-1 rounded-lg" data-testid="offline-saved">
        <Check className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">Saved {timeAgo}</span>
      </div>
    );
  }

  return null;
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 10000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
