import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { CheckCircle, Megaphone } from 'lucide-react';

export default function AnnouncementPopup() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await api.get('/announcements/active');
        if (res.data?.length > 0) {
          setAnnouncements(res.data);
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(830, ctx.currentTime);
            osc.frequency.setValueAtTime(1050, ctx.currentTime + 0.15);
            osc.frequency.setValueAtTime(830, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
          } catch (err) { console.error("Error:", err); }
        }
      } catch (err) { console.error("Error:", err); }
    };
    load();
  }, [user]);

  const handleAcknowledge = async () => {
    const ann = announcements[currentIdx];
    if (!ann) return;
    setAcknowledging(true);
    try {
      await api.post(`/announcements/${ann.announcement_id}/acknowledge`);
      const remaining = announcements.filter((_, i) => i !== currentIdx);
      setAnnouncements(remaining);
      if (remaining.length > 0) setCurrentIdx(0);
    } catch (err) { console.error("Error:", err); }
    setAcknowledging(false);
  };

  if (!announcements.length) return null;
  const ann = announcements[currentIdx];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="announcement-overlay">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden" data-testid="announcement-modal">
        <div className="bg-[#1B2A4A] px-6 py-4 flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-[#C5A55A]" />
          <div>
            <h2 className="text-white font-semibold text-base">Announcement</h2>
            <p className="text-slate-300 text-[10px]">
              From {ann.sender_name} ({ann.sender_role}) &middot; {new Date(ann.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {announcements.length > 1 && (
            <span className="ml-auto text-slate-300 text-[10px]">{currentIdx + 1} of {announcements.length}</span>
          )}
        </div>
        <div className="px-6 pt-4 pb-2">
          <h3 className="text-lg font-bold text-[#1B2A4A]" data-testid="announcement-title">{ann.title}</h3>
        </div>
        <div className="px-6 pb-4 max-h-[300px] overflow-y-auto text-sm text-slate-700 leading-relaxed whitespace-pre-wrap" data-testid="announcement-body">
          {ann.body}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end">
          <Button onClick={handleAcknowledge} disabled={acknowledging}
            className="rounded-md text-sm px-6 bg-[#C5A55A] hover:bg-[#b8963e]"
            data-testid="announcement-acknowledge-btn">
            <CheckCircle className="w-4 h-4 mr-2" />
            {acknowledging ? 'Confirming...' : 'I have read it'}
          </Button>
        </div>
      </div>
    </div>
  );
}
