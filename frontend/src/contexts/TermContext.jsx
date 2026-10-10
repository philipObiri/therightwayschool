import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { playNotificationBell } from '../lib/notifications';

const TermContext = createContext(null);

export function TermProvider({ children }) {
  const [activeTerm, setActiveTerm] = useState('Term 1');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [loading, setLoading] = useState(true);

  const fetchTerm = useCallback(async () => {
    try {
      const res = await api.get('/settings/active-term');
      setActiveTerm(res.data.term);
      setAcademicYear(res.data.academic_year);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTerm(); }, [fetchTerm]);

  // Listen for real-time term changes via WebSocket
  useEffect(() => {
    const token = localStorage.getItem('rw_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/notifications?token=${token}`;

    let ws;
    let reconnectTimer;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'term_changed' && msg.data) {
              setActiveTerm(msg.data.term);
              setAcademicYear(msg.data.academic_year);
            }
            // Play bell tone for any incoming notification
            if (msg.event === 'new_notification') {
              const isEmergency = msg.data?.type === 'emergency' || msg.data?.type === 'sick_bay_emergency';
              playNotificationBell(isEmergency);
            }
          } catch (err) { console.error("Error:", err); }
        };
        ws.onclose = () => { reconnectTimer = setTimeout(connect, 10000); };
        ws.onerror = () => { ws.close(); };
      } catch (err) { console.error("Error:", err); }
    };
    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const changeTerm = async (term, year) => {
    try {
      await api.put('/settings/active-term', { term, academic_year: year || academicYear });
      setActiveTerm(term);
      if (year) setAcademicYear(year);
    } catch (err) { console.error("Error:", err); }
  };

  return (
    <TermContext.Provider value={{ activeTerm, academicYear, changeTerm, loading, refresh: fetchTerm }}>
      {children}
    </TermContext.Provider>
  );
}

export function useTerm() {
  const ctx = useContext(TermContext);
  if (!ctx) throw new Error('useTerm must be used within TermProvider');
  return ctx;
}
