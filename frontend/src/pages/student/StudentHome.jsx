import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { BookOpen, ClipboardList, Calendar, TrendingUp, Clock, Zap, GraduationCap, Megaphone } from 'lucide-react';
import TimetableWidget from '../../components/TimetableWidget';
import { AppLoader } from '../../components/AppLoader';

const subjectColors = [
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-[#C5A55A]/10 border-[#C5A55A]/30 text-[#C5A55A]',
  'bg-blue-50 border-blue-200 text-[#1B2A4A]',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-red-50 border-red-200 text-red-700',
  'bg-blue-50 border-blue-200 text-[#2E6CC4]',
  'bg-indigo-50 border-indigo-200 text-indigo-700',
  'bg-blue-50 border-blue-200 text-[#2E6CC4]',
  'bg-orange-50 border-orange-200 text-orange-700',
  'bg-[#C5A55A]/10 border-[#C5A55A]/30 text-[#C5A55A]',
  'bg-[#2E6CC4]/10 border-blue-200 text-[#2E6CC4]',
  'bg-sky-50 border-sky-200 text-sky-700',
];

const subjectIcons = {
  'Mathematics': '📐', 'Extended Mathematics': '📐', 'Additional Mathematics': '📐',
  'English Language': '📖', 'French': '🇫🇷',
  'Biology': '🧬', 'Chemistry': '⚗️', 'Physics': '⚡',
  'Coordinated Science': '🔬', 'Information Technology': '💻',
  'Economics': '📊', 'Business Studies': '💼', 'Accounting': '🧮',
  'Geography': '🌍', 'History': '📜', 'Sociology': '👥',
  'Art and Design': '🎨', 'Christian Doctrine': '✝️',
  'Global Perspectives': '🌐', 'Probability and Statistics': '📈',
  'Pure Mathematics 1': '📐', 'Pure Mathematics 2': '📐',
};

export default function StudentHome() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const [studentDetail, setStudentDetail] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [detailRes, lesRes, asgnRes, quizRes, annRes] = await Promise.all([
          user?.user_id ? api.get(`/admin/students/${user.user_id}`) : Promise.resolve({ data: null }),
          api.get('/lms/lessons', { params: { published: true } }),
          api.get('/assignments'),
          api.get('/quiz/student/available').catch(() => ({ data: [] })),
          api.get('/live/announcements').catch(() => ({ data: [] })),
        ]);
        setStudentDetail(detailRes.data);
        setLessons(lesRes.data);
        setAssignments(asgnRes.data);
        setQuizzes(quizRes.data || []);
        setAnnouncements(annRes.data || []);
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    if (user) fetchData();
  }, [user]);

  if (loading) return <AppLoader />;

  const mySubjects = studentDetail?.subjects || [];
  const pendingAssignments = assignments.filter(a => !a.my_submission);
  const pendingQuizzes = quizzes.filter(q => !q.my_submission);

  return (
    <div className="space-y-6" data-testid="student-home">
      {/* Welcome Banner */}
      <div className="relative rounded-md overflow-hidden h-40">
        <img src="/campus-students.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A]/80 to-[#1B2A4A]/20 flex items-center px-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name?.split(' ')[0]}</h1>
            <p className="text-white/70">{user?.year_group} | {activeTerm} | {mySubjects.length} subjects enrolled</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card"><div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><BookOpen className="w-5 h-5 text-[#2E6CC4]" /></div><p className="text-2xl font-bold">{mySubjects.length}</p><p className="text-sm text-slate-500">My Subjects</p></div>
        <div className="stat-card"><div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center mb-2"><ClipboardList className="w-5 h-5 text-amber-600" /></div><p className="text-2xl font-bold">{pendingAssignments.length}</p><p className="text-sm text-slate-500">Pending Assignments</p></div>
        <div className="stat-card"><div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><Zap className="w-5 h-5 text-[#2E6CC4]" /></div><p className="text-2xl font-bold">{pendingQuizzes.length}</p><p className="text-sm text-slate-500">Available Quizzes</p></div>
        <div className="stat-card"><div className="w-10 h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center mb-2"><TrendingUp className="w-5 h-5 text-[#C5A55A]" /></div><p className="text-2xl font-bold">{lessons.length}</p><p className="text-sm text-slate-500">Lessons Available</p></div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card className="rounded-md border-[#C5A55A]/30 bg-[#C5A55A]/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-5 h-5 text-[#C5A55A]" /> Announcements</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {announcements.slice(0, 5).map(a => (
                <div key={a.announcement_id} className={`p-3 rounded-md border ${a.priority === 'urgent' ? 'bg-red-50 border-red-200' : a.priority === 'important' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-[#1B2A4A]">{a.title}</h4>
                    <div className="flex gap-1">
                      {a.priority !== 'normal' && <Badge className={a.priority === 'urgent' ? 'bg-red-100 text-red-700 text-[9px]' : 'bg-amber-100 text-amber-700 text-[9px]'}>{a.priority}</Badge>}
                      <span className="text-[10px] text-slate-400">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{a.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">By {a.author_name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Timetable */}
      <TimetableWidget compact />

      {/* My Subjects - Tiles */}
      <div>
        <h2 className="text-lg font-bold text-[#1B2A4A] mb-3 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-[#2E6CC4]" /> My Subjects</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {mySubjects.map((subj, idx) => {
            const colorClass = subjectColors[idx % subjectColors.length];
            const icon = subjectIcons[subj.name] || '📚';
            const subjLessons = lessons.filter(l => l.subject_name === subj.name || l.subject_id === subj.subject_id);
            const subjAssignments = pendingAssignments.filter(a => a.subject_name === subj.name || a.subject_id === subj.subject_id);

            return (
              <div key={subj.subject_id || idx} className={`border-2 rounded-md p-4 transition-all hover:shadow-md cursor-pointer ${colorClass}`} data-testid={`subject-tile-${subj.subject_id || idx}`}>
                <div className="text-3xl mb-2">{icon}</div>
                <h3 className="text-sm font-bold leading-tight">{subj.name}</h3>
                <p className="text-[10px] opacity-70 mt-0.5">{subj.code}</p>
                <div className="flex gap-2 mt-2">
                  {subjLessons.length > 0 && <Badge variant="secondary" className="text-[9px] h-5">{subjLessons.length} lessons</Badge>}
                  {subjAssignments.length > 0 && <Badge className="bg-amber-200 text-amber-800 text-[9px] h-5">{subjAssignments.length} due</Badge>}
                </div>
              </div>
            );
          })}
          {mySubjects.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-400">
              <GraduationCap className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No subjects assigned yet. Contact your class teacher.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Assignments due */}
        <Card className="rounded-md border-slate-200">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ClipboardList className="w-5 h-5 text-amber-600" /> Assignments Due</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingAssignments.slice(0, 5).map(a => (
                <div key={a.assignment_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-md" data-testid={`assignment-item-${a.assignment_id}`}>
                  <div className="w-10 h-10 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0"><ClipboardList className="w-5 h-5 text-amber-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B2A4A] truncate">{a.title}</p>
                    <p className="text-xs text-slate-400">{a.subject_name}</p>
                  </div>
                  {a.due_date && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {a.due_date}</span>}
                </div>
              ))}
              {pendingAssignments.length === 0 && <p className="text-sm text-slate-400 text-center py-4">All caught up!</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent lessons */}
        <Card className="rounded-md border-slate-200">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#2E6CC4]" /> Recent Lessons</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lessons.slice(0, 5).map(l => (
                <div key={l.lesson_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-md" data-testid={`lesson-item-${l.lesson_id}`}>
                  <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0"><BookOpen className="w-5 h-5 text-[#2E6CC4]" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B2A4A] truncate">{l.title}</p>
                    <p className="text-xs text-slate-400">{l.subject_name} - {l.teacher_name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{l.lesson_type}</Badge>
                </div>
              ))}
              {lessons.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No lessons available yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
