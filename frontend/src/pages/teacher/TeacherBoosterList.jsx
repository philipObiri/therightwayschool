import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { BookOpen, Users, Calendar, MessageSquare } from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';
import { BoosterLessonDetailDialog } from '../shared/booster/BoosterLessonDetailDialog';

export default function TeacherBoosterList() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLesson, setDetailLesson] = useState(null);

  const fetchLessons = async () => {
    try {
      const r = await api.get('/booster/lessons', { params: { teacher_id: user?.user_id } });
      setLessons(r.data);
    } catch { }
  };

  useEffect(() => {
    const run = async () => {
      await fetchLessons();
      setLoading(false);
    };
    if (user) run();
  }, [user]);

  const statusColor = (s) => {
    const map = { requested: 'bg-blue-100 text-blue-700', approved: 'bg-emerald-100 text-emerald-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  if (loading) return <AppLoader />;

  const active = lessons.filter(l => ['requested', 'approved', 'in_progress'].includes(l.status));
  const completed = lessons.filter(l => l.status === 'completed');

  return (
    <div className="space-y-6" data-testid="teacher-booster-list">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">My Booster Students</h1>
        <p className="text-slate-500 text-sm mt-1">Students assigned to you for extra lessons</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Active</p>
            <p className="text-2xl font-bold text-[#2E6CC4]">{active.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">{completed.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Assigned</p>
            <p className="text-2xl font-bold text-[#1B2A4A]">{lessons.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Unique Students</p>
            <p className="text-2xl font-bold text-[#C5A55A]">{new Set(lessons.map(l => l.student_id)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Booster Students */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Booster Students</h2>
        {active.length === 0 ? (
          <div className="bg-white rounded-md border border-slate-100 text-center py-12 text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No booster students assigned to you yet</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(l => (
              <Card
                key={l.lesson_id}
                className="rounded-md border-slate-100 cursor-pointer hover:shadow-md hover:border-[#2E6CC4]/40 transition-all"
                onClick={() => setDetailLesson(l)}
                data-testid={`booster-student-${l.lesson_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center text-[#2E6CC4] font-bold text-sm">
                      {l.student_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1B2A4A] truncate">{l.student_name}</p>
                      <p className="text-xs text-slate-400">{l.student_year}</p>
                    </div>
                    <Badge className={`text-[9px] ${statusColor(l.status)}`}>{l.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Subject: <strong className="text-[#1B2A4A]">{l.subject}</strong></span>
                    </div>
                    {l.preferred_days?.length > 0 && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Days: {l.preferred_days.join(', ')}</span>
                      </div>
                    )}
                    {l.reason && (
                      <div className="flex items-start gap-2 text-slate-500">
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5" />
                        <span className="line-clamp-2">{l.reason}</span>
                      </div>
                    )}
                    {l.notes && (
                      <p className="text-slate-400 italic pl-5 line-clamp-2">{l.notes}</p>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-slate-400">
                      By {l.booked_by_name} &middot; {new Date(l.created_at).toLocaleDateString()}
                    </p>
                    <span className="flex items-center gap-1 text-[10px] text-[#2E6CC4] font-medium">
                      <MessageSquare className="w-3 h-3" />
                      {(l.comments?.length || 0)} {l.comments?.length === 1 ? 'comment' : 'comments'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Completed ({completed.length})</h2>
          <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-slate-50">Student</TableHead>
                  <TableHead className="bg-slate-50">Subject</TableHead>
                  <TableHead className="bg-slate-50">Days</TableHead>
                  <TableHead className="bg-slate-50">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.map(l => (
                  <TableRow key={l.lesson_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetailLesson(l)}>
                    <TableCell className="font-medium text-sm">{l.student_name}</TableCell>
                    <TableCell className="text-sm">{l.subject}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {(l.preferred_days || []).map(d => <Badge key={d} variant="secondary" className="text-[9px] py-0">{d.slice(0, 3)}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <BoosterLessonDetailDialog
        open={!!detailLesson}
        onOpenChange={(o) => { if (!o) setDetailLesson(null); }}
        lesson={detailLesson}
        currentUser={user}
        onUpdated={fetchLessons}
      />
    </div>
  );
}
