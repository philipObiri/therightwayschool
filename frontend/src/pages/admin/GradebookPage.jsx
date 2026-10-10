import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { BarChart3, Plus, Download, FileText, GraduationCap, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

export default function GradebookPage() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const [tab, setTab] = useState('class');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(activeTerm || 'Term 1');
  const [gradebook, setGradebook] = useState(null);
  const [gradeDialog, setGradeDialog] = useState(false);
  const [gradeForm, setGradeForm] = useState({ student_id: '', subject_id: '', term: activeTerm || 'Term 1', ca_score: 0, ca_max: 100, exam_score: 0, exam_max: 100, teacher_comment: '' });
  const [reportCard, setReportCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const isTeacher = ['Teacher', 'Admin', 'SuperAdmin', 'HeadOfAcademics'].includes(user?.role);

  useEffect(() => {
    setSelectedTerm(activeTerm);
    setGradeForm(prev => ({ ...prev, term: activeTerm }));
  }, [activeTerm]);

  useEffect(() => {
    Promise.all([
      api.get('/academic/classes').then(r => setClasses(r.data)),
      api.get('/academic/subjects').then(r => setSubjects(r.data)),
      api.get('/admin/students').then(r => setStudents(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadGradebook = async (classId, term) => {
    if (!classId) return;
    try {
      const r = await api.get(`/gradebook/class/${classId}`, { params: { term } });
      setGradebook(r.data);
    } catch { toast.error('Failed to load gradebook'); }
  };

  const handleClassSelect = (cid) => {
    setSelectedClass(cid);
    loadGradebook(cid, selectedTerm);
  };

  const handleRecordGrade = async (e) => {
    e.preventDefault();
    try {
      await api.post('/gradebook/entries', { ...gradeForm, ca_score: parseFloat(gradeForm.ca_score), exam_score: parseFloat(gradeForm.exam_score), ca_max: parseFloat(gradeForm.ca_max), exam_max: parseFloat(gradeForm.exam_max) });
      successToast('Grade recorded');
      setGradeDialog(false);
      if (selectedClass) loadGradebook(selectedClass, selectedTerm);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const viewReportCard = async (studentId) => {
    try {
      const r = await api.get(`/gradebook/report-card/${studentId}`, { params: { term: selectedTerm } });
      setReportCard(r.data);
      setTab('report');
    } catch { toast.error('Failed to load report card'); }
  };

  const downloadPdf = (studentId) => {
    const token = localStorage.getItem('rw_token');
    window.open(`${BACKEND}/api/gradebook/report-card/${studentId}/pdf?term=${selectedTerm}&token=${token}`, '_blank');
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="gradebook-page">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[#1B2A4A]">Gradebook</h1><p className="text-slate-500 mt-1">Student grades, assessments, and report cards</p></div>
        {isTeacher && (
          <Dialog open={gradeDialog} onOpenChange={setGradeDialog}>
            <DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="record-grade-btn"><Plus className="w-4 h-4 mr-2" /> Record Grade</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Grade</DialogTitle></DialogHeader>
              <form onSubmit={handleRecordGrade} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Student</Label>
                    <Select value={gradeForm.student_id} onValueChange={v => setGradeForm({...gradeForm, student_id: v})}>
                      <SelectTrigger className="h-9 text-xs" data-testid="grade-student"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-1"><Label className="text-xs">Subject</Label>
                    <Select value={gradeForm.subject_id} onValueChange={v => setGradeForm({...gradeForm, subject_id: v})}>
                      <SelectTrigger className="h-9 text-xs" data-testid="grade-subject"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1"><Label className="text-xs">CA Score</Label><Input type="number" value={gradeForm.ca_score} onChange={e => setGradeForm({...gradeForm, ca_score: e.target.value})} className="h-9 text-xs" data-testid="grade-ca" /></div>
                  <div className="space-y-1"><Label className="text-xs">CA Max</Label><Input type="number" value={gradeForm.ca_max} onChange={e => setGradeForm({...gradeForm, ca_max: e.target.value})} className="h-9 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Exam Score</Label><Input type="number" value={gradeForm.exam_score} onChange={e => setGradeForm({...gradeForm, exam_score: e.target.value})} className="h-9 text-xs" data-testid="grade-exam" /></div>
                  <div className="space-y-1"><Label className="text-xs">Exam Max</Label><Input type="number" value={gradeForm.exam_max} onChange={e => setGradeForm({...gradeForm, exam_max: e.target.value})} className="h-9 text-xs" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Comment</Label><Input value={gradeForm.teacher_comment} onChange={e => setGradeForm({...gradeForm, teacher_comment: e.target.value})} className="h-9 text-xs" data-testid="grade-comment" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-grade">Save Grade</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="class" className="text-xs">Class Gradebook</TabsTrigger>
          <TabsTrigger value="report" className="text-xs">Report Card</TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="mt-4 space-y-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1"><Label className="text-xs">Class</Label>
              <Select value={selectedClass} onValueChange={handleClassSelect}>
                <SelectTrigger className="w-40 h-9 text-xs" data-testid="gradebook-class"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label className="text-xs">Term</Label>
              <Select value={selectedTerm} onValueChange={v => { setSelectedTerm(v); if (selectedClass) loadGradebook(selectedClass, v); }}>
                <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent>
              </Select></div>
          </div>

          {gradebook && (
            <div className="bg-white rounded-md border border-slate-100 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-slate-50 sticky left-0 z-10 bg-white">#</TableHead>
                    <TableHead className="bg-slate-50 sticky left-8 z-10 bg-white min-w-[140px]">Student</TableHead>
                    {gradebook.subjects?.map(s => <TableHead key={s.subject_id} className="bg-slate-50 text-center min-w-[80px]">{s.code || s.name.slice(0,4)}</TableHead>)}
                    <TableHead className="bg-slate-50 text-center">Avg</TableHead>
                    <TableHead className="bg-slate-50"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradebook.students?.map(row => (
                    <TableRow key={row.student_id} data-testid={`gradebook-row-${row.student_id}`}>
                      <TableCell className="text-xs font-medium sticky left-0 bg-white">{row.position}</TableCell>
                      <TableCell className="font-medium text-sm sticky left-8 bg-white">{row.name}</TableCell>
                      {gradebook.subjects?.map(s => {
                        const g = row.subjects[s.subject_id];
                        return (
                          <TableCell key={s.subject_id} className="text-center">
                            {g ? (
                              <div><span className={`text-sm font-semibold ${g.final >= 60 ? 'text-[#C5A55A]' : g.final >= 40 ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{g.final}</span><br/><span className="text-[10px] text-slate-400">{g.grade}</span></div>
                            ) : <span className="text-slate-300">-</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold text-sm">{row.average}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => viewReportCard(row.student_id)} data-testid={`view-report-${row.student_id}`}><FileText className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadPdf(row.student_id)} data-testid={`download-pdf-${row.student_id}`}><Download className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!gradebook && <div className="text-center py-12 text-slate-400"><BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Select a class to view gradebook</p></div>}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          {reportCard ? (
            <Card className="rounded-md border-slate-100 max-w-3xl mx-auto">
              <CardHeader className="bg-[#2A7A5A] text-white rounded-t-2xl">
                <CardTitle className="text-center">
                  <p className="text-lg font-bold">The RightWay Centre of Learning</p>
                  <p className="text-sm font-normal opacity-80">Academic Report Card - {reportCard.term}</p>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500">Student:</span> <strong>{reportCard.student?.name}</strong></div>
                  <div><span className="text-slate-500">Class:</span> <strong>{reportCard.class?.name}</strong></div>
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="bg-slate-50">Subject</TableHead><TableHead className="bg-slate-50">CA</TableHead>
                    <TableHead className="bg-slate-50">Exam</TableHead><TableHead className="bg-slate-50">Final</TableHead>
                    <TableHead className="bg-slate-50">Grade</TableHead><TableHead className="bg-slate-50">Remark</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reportCard.grades?.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{g.subject}</TableCell>
                        <TableCell>{g.ca_score}/{g.ca_max}</TableCell>
                        <TableCell>{g.exam_score}/{g.exam_max}</TableCell>
                        <TableCell className="font-bold">{g.final_score}%</TableCell>
                        <TableCell><Badge className={g.final_score >= 60 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : g.final_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{g.grade}</Badge></TableCell>
                        <TableCell className="text-sm text-slate-500">{g.remark}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between bg-slate-50 rounded-md p-4">
                  <div><span className="text-sm text-slate-500">Overall Average:</span> <strong className="text-lg">{reportCard.average}%</strong></div>
                  <Badge className={reportCard.average >= 60 ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-lg px-3 py-1' : 'bg-amber-100 text-amber-700 text-lg px-3 py-1'}>{reportCard.overall_grade} - {reportCard.overall_remark}</Badge>
                </div>
                <div className="bg-slate-50 rounded-md p-4">
                  <p className="text-sm font-semibold mb-1">Attendance</p>
                  <p className="text-xs text-slate-500">Present: {reportCard.attendance?.present} | Absent: {reportCard.attendance?.absent} | Late: {reportCard.attendance?.late} | Rate: {reportCard.attendance?.total ? Math.round(reportCard.attendance.present / reportCard.attendance.total * 100) : 0}%</p>
                </div>
                <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={() => downloadPdf(reportCard.student?.user_id)} data-testid="download-report-pdf">
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </Button>
              </CardContent>
            </Card>
          ) : <div className="text-center py-12 text-slate-400"><GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Select a student from the gradebook to view report card</p></div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
