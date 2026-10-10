import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '../../ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';

export function NotificationDropdown({ user }) {
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const fetchCount = async () => {
      try { const r = await api.get('/behaviour/notifications/unread-count'); setNotifCount(r.data.count || 0); } catch (err) { console.error("Error:", err); }
    };
    fetchCount();

    const token = localStorage.getItem('rw_token');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/notifications?token=${token}`;

    let reconnectTimer;
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'new_notification') {
              setNotifCount(c => c + 1);
              setRecentNotifs(prev => [msg.data, ...prev].slice(0, 8));
            }
          } catch (err) { console.error("Error:", err); }
        };
        ws.onclose = () => { reconnectTimer = setTimeout(connect, 5000); };
        ws.onerror = () => { ws.close(); };
      } catch (err) { console.error("Error:", err); }
    };
    connect();

    const interval = setInterval(fetchCount, 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const loadRecentNotifs = async () => {
    try {
      const r = await api.get('/behaviour/notifications');
      setRecentNotifs((r.data || []).slice(0, 8));
    } catch (err) { console.error("Error:", err); }
  };

  const getNotifUrl = (n) => {
    if (n.action_url) return n.action_url;
    const map = {
      new_resource: '/student/resources', new_assignment: '/student/assignments',
      quiz_published: '/student/quizzes', new_quiz: '/student/quizzes',
      behaviour_report: user?.role === 'Teacher' ? '/teacher/behaviour' : '/admin/behaviour',
      lesson_submitted: '/admin/lesson-approvals', assignment_created: '/admin/assignments',
      wp_task_assigned: '/working-paper', wp_approval_request: '/working-paper',
      wp_approval_completed: '/working-paper', wp_approval_rejected: '/working-paper',
      wp_mention: '/working-paper', wp_document_signed: '/working-paper',
      wp_document_expired: '/working-paper', meeting_invite: null,
    };
    return map[n.type] || null;
  };

  const handleNotifClick = async (n) => {
    if (!n.is_read) {
      try { await api.post(`/behaviour/notifications/${n.notif_id}/read`); setNotifCount(c => Math.max(0, c - 1)); } catch (err) { console.error("Error:", err); }
    }
    setNotifOpen(false);
    const url = getNotifUrl(n);
    if (url) navigate(url);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/behaviour/notifications/read-all');
      setNotifCount(0);
      setRecentNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) { console.error("Error:", err); }
  };

  const getNotifRole = () => {
    if (user?.role === 'Student') return '/student/notifications';
    if (user?.role === 'Teacher') return '/teacher/behaviour';
    return '/admin/behaviour';
  };

  return (
    <DropdownMenu open={notifOpen} onOpenChange={(open) => { setNotifOpen(open); if (open) loadRecentNotifs(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
          <Bell className="w-5 h-5 text-slate-500" />
          {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-md text-white text-[10px] font-bold flex items-center justify-center">{notifCount}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <span className="text-sm font-semibold text-[#1B2A4A]">Notifications</span>
          {notifCount > 0 && (
            <button className="text-[10px] text-[#2E6CC4] font-medium hover:underline" onClick={handleMarkAllRead} data-testid="notif-mark-all-read">Mark all read</button>
          )}
        </div>
        {recentNotifs.length === 0 ? (
          <div className="px-3 py-6 text-center text-slate-400 text-xs">No notifications</div>
        ) : (
          recentNotifs.map(n => (
            <DropdownMenuItem
              key={n.notif_id}
              className={`cursor-pointer px-3 py-2.5 flex items-start gap-2.5 ${!n.is_read ? 'bg-[#2E6CC4]/[0.03]' : ''}`}
              onClick={() => handleNotifClick(n)}
              data-testid={`notif-dropdown-${n.notif_id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#2E6CC4] flex-shrink-0" />}
                  <p className={`text-xs truncate ${!n.is_read ? 'font-semibold text-[#1B2A4A]' : 'text-slate-600'}`}>{n.title}</p>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{n.message}</p>
                <span className="text-[9px] text-slate-400">{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer justify-center text-xs text-[#2E6CC4] font-medium" onClick={() => { setNotifOpen(false); navigate(getNotifRole()); }} data-testid="notif-view-all">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
