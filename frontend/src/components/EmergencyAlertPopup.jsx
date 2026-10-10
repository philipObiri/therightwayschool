import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { AlertTriangle, Siren } from 'lucide-react';

export default function EmergencyAlertPopup() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  const fetchAlerts = async () => {
    if (!user) return;
    try {
      const res = await api.get('/sick-bay/emergency/active');
      if (res.data?.length > 0) {
        setAlerts(prev => {
          const prevIds = new Set(prev.map(a => a.alert_id));
          const newAlerts = res.data.filter(a => !prevIds.has(a.alert_id));
          if (newAlerts.length > 0) playAlarm();
          return res.data;
        });
      } else {
        setAlerts([]);
      }
    } catch (err) { /* silent */ }
  };

  const playAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Urgent alarm: alternating tones
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + i * 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.18);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.18);
      }
    } catch (e) { /* audio not allowed */ }
  };

  useEffect(() => {
    fetchAlerts();
    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchAlerts, 10000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAcknowledge = async () => {
    const alert = alerts[currentIdx];
    if (!alert) return;
    setAcknowledging(true);
    try {
      await api.post(`/sick-bay/emergency/${alert.alert_id}/acknowledge`);
      const remaining = alerts.filter((_, i) => i !== currentIdx);
      setAlerts(remaining);
      if (remaining.length > 0) setCurrentIdx(0);
    } catch (err) { console.error(err); }
    setAcknowledging(false);
  };

  if (!alerts.length) return null;
  const alert = alerts[currentIdx];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-red-950/80 backdrop-blur-md animate-pulse-bg" data-testid="emergency-overlay">
      <style>{`
        @keyframes pulse-bg { 0%, 100% { background-color: rgba(69, 10, 10, 0.8); } 50% { background-color: rgba(127, 29, 29, 0.9); } }
        .animate-pulse-bg { animation: pulse-bg 2s ease-in-out infinite; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); } 20%, 40%, 60%, 80% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.6s ease-in-out; }
      `}</style>
      <div className="bg-white rounded-2xl shadow-[0_0_60px_rgba(220,38,38,0.5)] w-full max-w-xl mx-4 overflow-hidden animate-shake" data-testid="emergency-modal">
        {/* Red header */}
        <div className="bg-red-600 px-6 py-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Siren className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl tracking-tight">EMERGENCY ALERT</h2>
            <p className="text-red-200 text-xs">Sick Bay — Immediate Attention Required</p>
          </div>
          {alerts.length > 1 && (
            <span className="ml-auto bg-white/20 text-white text-xs px-2 py-1 rounded-full">{currentIdx + 1} of {alerts.length}</span>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Student */}
          {alert.student_name && (
            <div className="flex items-center gap-3 bg-red-50 rounded-lg p-3 border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-500 font-medium">Student</p>
                <p className="text-lg font-bold text-red-800">{alert.student_name}</p>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-base text-[#1B2A4A] font-medium leading-relaxed">{alert.description || 'Emergency in Sick Bay — Please respond immediately'}</p>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Triggered by: <strong className="text-[#1B2A4A]">{alert.triggered_by_name}</strong></span>
            <span>&middot;</span>
            <span>{alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : ''}</span>
          </div>
        </div>

        {/* Acknowledge */}
        <div className="px-6 py-4 border-t border-red-100 bg-red-50/50">
          <Button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="w-full h-12 rounded-xl text-base font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
            data-testid="emergency-acknowledge-btn"
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            {acknowledging ? 'Acknowledging...' : 'I ACKNOWLEDGE — OK'}
          </Button>
        </div>
      </div>
    </div>
  );
}
