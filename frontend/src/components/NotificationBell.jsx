import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Bell, Check, CheckCheck, X, ExternalLink, Settings, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications/?limit=20');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) { console.error("Error:", err); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (notifId) => {
    try {
      await api.put(`/notifications/read/${notifId}`);
      setNotifications(prev => prev.map(n => n.notif_id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) { console.error("Error:", err); }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) { console.error("Error:", err); }
  };

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markRead(notif.notif_id);
    if (notif.action_url) {
      navigate(notif.action_url);
      setOpen(false);
    }
  };

  const getTypeIcon = (type) => {
    const colors = {
      lesson_approval: 'bg-blue-100 text-blue-600',
      scheme_approval: 'bg-blue-100 text-[#2E6CC4]',
      assignment: 'bg-[#C5A55A]/15 text-[#C5A55A]',
      mail: 'bg-indigo-100 text-indigo-600',
      remark: 'bg-amber-100 text-amber-600',
      working_paper: 'bg-blue-100 text-[#2E6CC4]',
      finance: 'bg-[#C5A55A]/15 text-[#C5A55A]',
      general: 'bg-slate-100 text-slate-600',
    };
    return colors[type] || colors.general;
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="relative" ref={ref} data-testid="notification-bell">
      <button onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors" data-testid="notification-bell-btn">
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center animate-pulse" data-testid="notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[380px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="notification-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-[#1B2A4A]">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-[#2E6CC4] hover:underline flex items-center gap-1" data-testid="mark-all-read-btn">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto" data-testid="notification-list">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.notif_id} onClick={() => handleNotifClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${!n.is_read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                  data-testid={`notif-${n.notif_id}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getTypeIcon(n.type)}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold text-[#1B2A4A]' : 'text-slate-700'}`}>{n.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">{formatTime(n.created_at)}</span>
                      {n.action_url && <ExternalLink className="w-3 h-3 text-slate-400" />}
                    </div>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#2E6CC4] mt-2 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
