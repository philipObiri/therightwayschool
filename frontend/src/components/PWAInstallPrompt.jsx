import React, { useState, useEffect } from 'react';
import { X, Download, Share, Info } from 'lucide-react';

export function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (sessionStorage.getItem('rw_pwa_dismissed')) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
    setVisible(true);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Native browser install prompt (Chrome/Edge)
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setVisible(false);
      setDeferredPrompt(null);
    } else {
      // Browser doesn't support automatic install (Brave, Firefox, Safari desktop)
      // Show hint pointing to the address bar
      setShowHint(prev => !prev);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('rw_pwa_dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999]" data-testid="pwa-install-prompt">
      {/* Address-bar hint tooltip */}
      {showHint && !isIOS && (
        <div className="mx-3 mb-1 rounded-xl px-4 py-3 text-xs text-white flex items-start gap-2"
          style={{ background: '#1e3a5f' }}>
          <Info className="w-4 h-4 text-[#f8d904] flex-shrink-0 mt-0.5" />
          <span>
            Look for the <strong className="text-[#f8d904]">install icon ⊕</strong> in your browser's address bar,
            or open this site in <strong className="text-[#f8d904]">Chrome / Edge</strong> for a one-click install.
          </span>
          <button onClick={() => setShowHint(false)} className="ml-auto text-white/50 hover:text-white flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="mx-3 mb-3 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
        style={{ background: '#044875' }}>

        <img src="/main_logo.png" alt="RightWay"
          className="w-12 h-12 rounded-xl flex-shrink-0 bg-white object-contain p-1" />

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold">The RightWay Centre of Learning</p>
          {isIOS ? (
            <p className="text-white/70 text-xs mt-0.5">
              Tap <Share className="w-3 h-3 inline text-[#f8d904]" /> then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-white/70 text-xs mt-0.5">Install the app for quick access from your home screen</p>
          )}
        </div>

        {/* Install button — always visible */}
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="text-[#044875] text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0 hover:opacity-90 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #f8d904, #bc9908)' }}
            data-testid="pwa-install-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        )}

        <button onClick={handleDismiss}
          className="text-white/50 hover:text-white transition-colors p-1 flex-shrink-0"
          aria-label="Dismiss" data-testid="pwa-dismiss-btn">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
