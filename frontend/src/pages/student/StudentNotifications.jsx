import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Bell, CheckCircle, FolderOpen, ClipboardList, BookOpen, AlertTriangle, Zap, Check } from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

const typeConfig = {
  new_resource: { icon: FolderOpen, color: 'bg-indigo-50 text-indigo-600', label: 'Resource' },
  new_assignment: { icon: ClipboardList, color: 'bg-amber-50 text-amber-600', label: 'Assignment' },
  behaviour_report: { icon: AlertTriangle, color: 'bg-red-50 text-red-600', label: 'Behaviour' },
  lesson_submitted: { icon: BookOpen, color: 'bg-blue-50 text-[#2E6CC4]', label: 'Lesson' },
  quiz_published: { icon: Zap, color: 'bg-blue-50 text-[#2E6CC4]', label: 'Quiz' },
};

function getNotifUrl(n) {
  if (n.action_url) return n.action_url;
  const map = {
    new_resource: '/student/resources',
    new_assignment: '/student/assignments',
    quiz_published: '/student/quizzes',
    new_quiz: '/student/quizzes',
    behaviour_report: '/student/home',
  };
  return map[n.type] || null;
}

export default function StudentNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const r = await api.get('/behaviour/notifications');
      setNotifications(r.data || []);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  useEffect(() => { fetchNotifs(); }, []);

  const markRead = async (notifId) => {
    await api.post(`/behaviour/notifications/${notifId}/read`);
    setNotifications(prev => prev.map(n => n.notif_id === notifId ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await api.post('/behaviour/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = async (n) => {
    if (!n.is_read) await markRead(n.notif_id);
    const url = getNotifUrl(n);
    if (url) navigate(url);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="student-notifications-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Notifications</h1>
          <p className="text-slate-500 mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="rounded-md text-xs" onClick={markAllRead} data-testid="mark-all-read-btn">
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">You'll see updates here when teachers share resources or assignments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const cfg = typeConfig[n.type] || { icon: Bell, color: 'bg-slate-50 text-slate-600', label: n.type };
            const Icon = cfg.icon;
            const url = getNotifUrl(n);
            return (
              <Card
                key={n.notif_id}
                className={`rounded-md border transition-colors ${!n.is_read ? 'border-[#2E6CC4]/30 bg-[#2E6CC4]/[0.02]' : 'border-slate-200'} ${url ? 'cursor-pointer hover:border-[#2E6CC4]/50' : ''}`}
                onClick={() => handleClick(n)}
                data-testid={`notif-item-${n.notif_id}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.color.split(' ')[0]}`}>
                    <Icon className={`w-4.5 h-4.5 ${cfg.color.split(' ')[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`text-sm truncate ${!n.is_read ? 'font-semibold text-[#1B2A4A]' : 'font-medium text-slate-600'}`}>{n.title}</h3>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#2E6CC4] flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[9px] capitalize">{cfg.label}</Badge>
                      <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {!n.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); markRead(n.notif_id); }}
                      data-testid={`mark-read-${n.notif_id}`}
                    >
                      <Check className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
