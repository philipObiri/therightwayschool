import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { BookOpen, ClipboardList, User, ArrowLeft, FileText, Video, Type, Link, ExternalLink, GraduationCap } from 'lucide-react';
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

export default function StudentSubjects() {
  const { user } = useAuth();
  const [studentDetail, setStudentDetail] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [detailRes, lesRes, asgnRes] = await Promise.all([
          api.get(`/admin/students/${user?.user_id}`),
          api.get('/lms/lessons', { params: { published: true } }),
          api.get('/assignments'),
        ]);
        setStudentDetail(detailRes.data);
        setLessons(lesRes.data);
        setAssignments(asgnRes.data);
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    if (user) fetch();
  }, [user]);

  if (loading) return <AppLoader />;

  const mySubjects = studentDetail?.subjects || [];

  // ─── Subject Detail View ───
  if (selectedSubject) {
    const subjLessons = lessons.filter(l => l.subject_name === selectedSubject.name || l.subject_id === selectedSubject.subject_id);
    const subjAssignments = assignments.filter(a => a.subject_name === selectedSubject.name || a.subject_id === selectedSubject.subject_id);
    // Find teacher for this subject
    const teacherNames = [...new Set([...subjLessons.map(l => l.teacher_name), ...subjAssignments.map(a => a.teacher_name)].filter(Boolean))];

    return (
      <div className="space-y-6" data-testid="subject-detail">
        <Button variant="ghost" size="sm" onClick={() => setSelectedSubject(null)}><ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects</Button>

        {/* Subject header */}
        <div className="bg-white rounded-md border border-slate-200 p-5">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{subjectIcons[selectedSubject.name] || '📚'}</div>
            <div>
              <h2 className="text-xl font-bold text-[#1B2A4A]">{selectedSubject.name}</h2>
              <p className="text-xs text-slate-500">{selectedSubject.code}</p>
              {teacherNames.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-sm text-slate-600"><User className="w-4 h-4 text-[#2E6CC4]" /> {teacherNames.join(', ')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card text-center"><p className="text-2xl font-bold text-[#2E6CC4]">{subjLessons.length}</p><p className="text-xs text-slate-500">Lessons / Notes</p></div>
          <div className="stat-card text-center"><p className="text-2xl font-bold text-amber-600">{subjAssignments.length}</p><p className="text-xs text-slate-500">Assignments</p></div>
          <div className="stat-card text-center"><p className="text-2xl font-bold text-[#1B2A4A]">{teacherNames.length}</p><p className="text-xs text-slate-500">Teacher(s)</p></div>
        </div>

        {/* Lessons */}
        <Card className="rounded-md border-slate-200">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#2E6CC4]" /> Lessons & Notes ({subjLessons.length})</CardTitle></CardHeader>
          <CardContent>
            {subjLessons.length > 0 ? (
              <div className="space-y-2">
                {subjLessons.map(l => (
                  <div key={l.lesson_id} onClick={() => setSelectedLesson(l)} className="flex items-center gap-3 p-3 bg-slate-50 rounded-md cursor-pointer hover:bg-blue-50 transition-colors">
                    <BookOpen className="w-5 h-5 text-[#2E6CC4] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1B2A4A] truncate">{l.title}</p>
                      <p className="text-[10px] text-slate-400">{l.lesson_type} | By {l.teacher_name}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{l.lesson_type}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No lessons yet for this subject</p>}
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card className="rounded-md border-slate-200">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-amber-600" /> Assignments & Classwork ({subjAssignments.length})</CardTitle></CardHeader>
          <CardContent>
            {subjAssignments.length > 0 ? (
              <div className="space-y-2">
                {subjAssignments.map(a => {
                  const submitted = !!a.my_submission;
                  return (
                    <div key={a.assignment_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-md">
                      <ClipboardList className={`w-5 h-5 flex-shrink-0 ${submitted ? 'text-[#C5A55A]' : 'text-amber-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1B2A4A] truncate">{a.title}</p>
                        <p className="text-[10px] text-slate-400">Due: {a.due_date || 'No date'} | Max: {a.max_score} pts | By {a.teacher_name}</p>
                      </div>
                      {submitted ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Submitted</Badge> : <Badge className="bg-amber-100 text-amber-700">Pending</Badge>}
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No assignments yet for this subject</p>}
          </CardContent>
        </Card>

        {/* Lesson viewer dialog */}
        <Dialog open={!!selectedLesson} onOpenChange={() => setSelectedLesson(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{selectedLesson?.title}</DialogTitle></DialogHeader>
            {selectedLesson && (
              <div className="space-y-4">
                <div className="flex gap-2"><Badge variant="secondary">{selectedLesson.subject_name}</Badge><Badge variant="secondary">{selectedLesson.lesson_type}</Badge></div>
                {selectedLesson.description && <p className="text-sm text-slate-600">{selectedLesson.description}</p>}
                {selectedLesson.content_text && <div className="bg-slate-50 rounded-md p-4 text-sm whitespace-pre-wrap">{selectedLesson.content_text}</div>}
                {selectedLesson.content_url && (
                  selectedLesson.content_url.includes('youtube.com') || selectedLesson.content_url.includes('youtu.be') ? (
                    <div className="aspect-video rounded-md overflow-hidden bg-black"><iframe src={selectedLesson.content_url.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen title={selectedLesson.title} /></div>
                  ) : (
                    <a href={selectedLesson.content_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#2E6CC4] hover:underline"><ExternalLink className="w-4 h-4" /> Open resource</a>
                  )
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Subject Tiles ───
  return (
    <div className="space-y-6" data-testid="student-subjects">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">My Subjects</h1><p className="text-slate-500 mt-1">{mySubjects.length} subjects enrolled</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mySubjects.map((subj, idx) => {
          const colorClass = subjectColors[idx % subjectColors.length];
          const icon = subjectIcons[subj.name] || '📚';
          const subjLessons = lessons.filter(l => l.subject_name === subj.name || l.subject_id === subj.subject_id);
          const subjAssignments = assignments.filter(a => a.subject_name === subj.name || a.subject_id === subj.subject_id);
          const pendingCount = subjAssignments.filter(a => !a.my_submission).length;

          return (
            <div key={subj.subject_id || idx} onClick={() => setSelectedSubject(subj)} className={`border-2 rounded-md p-5 transition-all hover:shadow-md cursor-pointer ${colorClass}`} data-testid={`subject-tile-${subj.subject_id}`}>
              <div className="text-4xl mb-3">{icon}</div>
              <h3 className="text-sm font-bold leading-tight">{subj.name}</h3>
              <p className="text-[10px] opacity-70 mt-0.5">{subj.code}</p>
              <div className="flex flex-col gap-1 mt-3">
                <div className="flex items-center gap-1.5 text-[10px]"><BookOpen className="w-3 h-3" /> {subjLessons.length} lessons</div>
                <div className="flex items-center gap-1.5 text-[10px]"><ClipboardList className="w-3 h-3" /> {subjAssignments.length} assignments</div>
                {pendingCount > 0 && <Badge className="bg-amber-200 text-amber-800 text-[9px] w-fit mt-1">{pendingCount} pending</Badge>}
              </div>
            </div>
          );
        })}
        {mySubjects.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400"><GraduationCap className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p>No subjects assigned</p></div>
        )}
      </div>
    </div>
  );
}
