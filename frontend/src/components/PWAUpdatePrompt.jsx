import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PWAUpdatePrompt — shows a banner when a new service worker is available.
 * When a new version is deployed, the SW detects it and this prompts the user to refresh.
 */
export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [worker, setWorker] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = (registration) => {
      if (registration.waiting) {
        setWorker(registration.waiting);
        setShowPrompt(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWorker(newWorker);
            setShowPrompt(true);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) handleUpdate(reg);
    });

    // Also listen for controller changes (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]">
      <div className="bg-[#2A7A5A] text-white rounded-xl shadow-xl px-5 py-4 flex items-center gap-4">
        <div className="flex-shrink-0">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Update available</p>
          <p className="text-xs text-white/70">A new version of RightWay is ready.</p>
        </div>
        <button
          onClick={handleUpdate}
          className="flex-shrink-0 bg-white text-[#2A7A5A] rounded-full px-4 py-1.5 text-sm font-bold hover:bg-[#F0F7F4] transition-colors"
        >
          Update
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="flex-shrink-0 text-white/60 hover:text-white text-xl leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
