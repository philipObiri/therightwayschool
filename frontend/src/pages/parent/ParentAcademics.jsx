import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { BookOpen, ClipboardList, BarChart3, ArrowLeft, GraduationCap, User } from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

const subjectIcons = {'Mathematics':'📐','Extended Mathematics':'📐','English Language':'📖','Biology':'🧬','Chemistry':'⚗️','Physics':'⚡','French':'🇫🇷','Coordinated Science':'🔬','Information Technology':'💻','Economics':'📊','Business Studies':'💼','Accounting':'🧮','Geography':'🌍','Art and Design':'🎨','Sociology':'👥','Christian Doctrine':'✝️','Global Perspectives':'🌐'};
const subjectColors = ['bg-blue-50 border-blue-200 text-blue-700','bg-[#C5A55A]/10 border-[#C5A55A]/30 text-[#C5A55A]','bg-blue-50 border-blue-200 text-[#1B2A4A]','bg-amber-50 border-amber-200 text-amber-700','bg-red-50 border-red-200 text-red-700','bg-blue-50 border-blue-200 text-[#2E6CC4]','bg-indigo-50 border-indigo-200 text-indigo-700','bg-blue-50 border-blue-200 text-[#2E6CC4]'];

export default function ParentAcademics() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childDetail, setChildDetail] = useState(null);
  const [grades, setGrades] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectTeacher, setSubjectTeacher] = useState(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const kids = [];
      for (const id of (user?.children_ids || [])) {
        try { const r = await api.get(`/admin/students/${id}`); kids.push(r.data); } catch (err) { console.error("Error:", err); }
      }
      setChildren(kids);
      if (kids.length === 1) selectChild(kids[0]);
      setLoading(false);
    };
    if (user) fetch();
  }, [user]);

  const selectChild = async (child) => {
    setSelectedChild(child);
    setChildDetail(child);
    try {
      const [gradesRes, asgnRes] = await Promise.all([
        api.get('/gradebook/entries', { params: { student_id: child.user_id } }),
        api.get('/assignments'),
      ]);
      setGrades(gradesRes.data);
      setAssignments(asgnRes.data);
    } catch (err) { console.error("Error:", err); }
  };

  const openSubject = async (s) => {
    setSelectedSubject(s);
    setSubjectTeacher(null);
    if (!s.subject_id || !childDetail?.user_id) return;
    setLoadingTeacher(true);
    try {
      const r = await api.get('/academic/child-subject-detail', { params: { student_id: childDetail.user_id, subject_id: s.subject_id } });
      setSubjectTeacher(r.data?.teacher || null);
    } catch (err) { console.error("Error:", err); }
    setLoadingTeacher(false);
  };

  if (loading) return <AppLoader />;
  if (!selectedChild && children.length > 1) {
    return (<div className="space-y-4"><h1 className="text-2xl font-bold text-[#1B2A4A]">Academics</h1><div className="grid md:grid-cols-2 gap-4">{children.map(c => (<Card key={c.user_id} className="rounded-md card-hover cursor-pointer" onClick={() => selectChild(c)}><CardContent className="p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-lg font-bold">{c.name?.charAt(0)}</div><div><h3 className="font-semibold">{c.name}</h3><p className="text-xs text-slate-500">{c.year_group}</p></div></CardContent></Card>))}</div></div>);
  }
  if (!selectedChild && children.length === 1) selectChild(children[0]);
  if (!childDetail) return null;

  const mySubjects = childDetail.subjects || [];

  // Subject detail view
  if (selectedSubject) {
    const subjGrades = grades.filter(g => g.subject_name === selectedSubject.name || g.subject_id === selectedSubject.subject_id);
    const subjAssignments = assignments.filter(a => a.subject_name === selectedSubject.name || a.subject_id === selectedSubject.subject_id);
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedSubject(null); setSubjectTeacher(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div className="flex items-center gap-3"><div className="text-3xl">{subjectIcons[selectedSubject.name]||'📚'}</div><div><h2 className="text-lg font-bold text-[#1B2A4A]">{selectedSubject.name}</h2><p className="text-xs text-slate-500">{selectedSubject.code} | {childDetail.name}</p></div></div>

        {/* Subject Teacher card */}
        <Card className="rounded-md border-[#C5A55A]/30 bg-gradient-to-br from-[#C5A55A]/5 to-white" data-testid="subject-teacher-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Subject Teacher</p>
              {loadingTeacher ? (
                <p className="text-sm text-slate-400 italic">Loading teacher details...</p>
              ) : subjectTeacher ? (
                <>
                  <p className="text-base font-semibold text-[#1B2A4A]" data-testid="subject-teacher-name">{subjectTeacher.name}</p>
                  <p className="text-xs text-slate-500">
                    {subjectTeacher.department && <span className="mr-2">{subjectTeacher.department} Department</span>}
                    {subjectTeacher.email && <span className="font-mono text-[#2E6CC4]">{subjectTeacher.email}</span>}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">No teacher assigned yet</p>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Grades */}
        <Card className="rounded-md"><CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#2E6CC4]" /> Test & Exam Results ({subjGrades.length})</CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">CA</TableHead><TableHead className="bg-slate-50">Exam</TableHead><TableHead className="bg-slate-50">Final</TableHead><TableHead className="bg-slate-50">Grade</TableHead><TableHead className="bg-slate-50">Comment</TableHead></TableRow></TableHeader>
          <TableBody>{subjGrades.map((g,i) => (<TableRow key={i}><TableCell><Badge variant="secondary" className="capitalize text-[10px]">{(g.score_type||'').replace(/_/g,' ')}</Badge></TableCell><TableCell>{g.ca_score}/{g.ca_max}</TableCell><TableCell>{g.exam_score}/{g.exam_max}</TableCell><TableCell className={`font-bold ${g.final_score>=60?'text-[#C5A55A]':g.final_score>=40?'text-[#F59E0B]':'text-[#DC2626]'}`}>{g.final_score}%</TableCell><TableCell><Badge className={g.grade_letter==='A'||g.grade_letter==='B+'?'bg-[#C5A55A]/15 text-[#C5A55A]':'bg-amber-100 text-amber-700'}>{g.grade_letter}</Badge></TableCell><TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{g.teacher_comment||'-'}</TableCell></TableRow>
          ))}{subjGrades.length===0&&<TableRow><TableCell colSpan={6} className="text-center py-6 text-slate-400">No results yet</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
        {/* Assignments */}
        <Card className="rounded-md"><CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-amber-600" /> Assignments ({subjAssignments.length})</CardTitle></CardHeader><CardContent>
          {subjAssignments.length > 0 ? subjAssignments.map(a => (
            <div key={a.assignment_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-md mb-2">
              <div><p className="text-sm font-medium">{a.title}</p><p className="text-[10px] text-slate-400">Due: {a.due_date||'No date'} | Max: {a.max_score} | {a.teacher_name}</p></div>
              {a.my_submission ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Submitted</Badge> : <Badge className="bg-amber-100 text-amber-700">Pending</Badge>}
            </div>
          )) : <p className="text-center py-4 text-slate-400 text-sm">No assignments</p>}
        </CardContent></Card>
      </div>
    );
  }

  // Subject tiles
  return (
    <div className="space-y-6">
      {children.length > 1 && <Button variant="ghost" size="sm" onClick={() => { setSelectedChild(null); setChildDetail(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Switch Child</Button>}
      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white font-bold">{childDetail.name?.charAt(0)}</div><div><h1 className="text-xl font-bold text-[#1B2A4A]">{childDetail.name} - Academics</h1><p className="text-xs text-slate-500">{childDetail.year_group} | {activeTerm} | {mySubjects.length} subjects</p></div></div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {mySubjects.map((s, i) => {
          const subjGrades = grades.filter(g => g.subject_name === s.name || g.subject_id === s.subject_id);
          const subjAssignments = assignments.filter(a => a.subject_name === s.name || a.subject_id === s.subject_id);
          const avg = subjGrades.length > 0 ? Math.round(subjGrades.reduce((a,g) => a + (g.final_score||0), 0) / subjGrades.length) : null;
          return (
            <div key={s.subject_id||i} onClick={() => openSubject(s)} className={`border-2 rounded-md p-4 cursor-pointer hover:shadow-md transition-all ${subjectColors[i%subjectColors.length]}`}>
              <div className="text-3xl mb-2">{subjectIcons[s.name]||'📚'}</div>
              <h3 className="text-sm font-bold">{s.name}</h3>
              <div className="flex flex-col gap-0.5 mt-2 text-[10px]">
                <span><BarChart3 className="w-3 h-3 inline mr-1" />{subjGrades.length} results {avg!==null && <span className={avg>=60?'text-[#C5A55A]':avg>=40?'text-amber-700':'text-red-700'}>({avg}%)</span>}</span>
                <span><ClipboardList className="w-3 h-3 inline mr-1" />{subjAssignments.length} assignments</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
