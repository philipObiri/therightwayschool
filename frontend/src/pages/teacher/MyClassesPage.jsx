import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Users, BookOpen, AlertTriangle, ArrowLeft, GraduationCap, Eye, BarChart3, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function MyClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportDialog, setReportDialog] = useState(null);
  const [studentInfoDialog, setStudentInfoDialog] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [reportForm, setReportForm] = useState({ category: 'general', severity: 'minor', title: '', description: '', action_taken: '' });
  const [boosterLessons, setBoosterLessons] = useState([]);
  const [parentConcerns, setParentConcerns] = useState([]);
  const [showBoosterPanel, setShowBoosterPanel] = useState(false);

  useEffect(() => {
    api.get('/behaviour/my-classes').then(r => setClasses(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const viewClass = async (cls) => {
    setSelectedClass(cls);
    setShowBoosterPanel(false);
    try {
      const [studentsRes, boosterRes, concernsRes] = await Promise.all([
        api.get(`/behaviour/class-students/${cls.class_id}`),
        api.get(`/booster/lessons/by-class/${cls.class_id}`).catch(() => ({ data: [] })),
        api.get(`/booster/concerns/by-class/${cls.class_id}`).catch(() => ({ data: [] })),
      ]);
      setStudents(studentsRes.data);
      setBoosterLessons(boosterRes.data);
      setParentConcerns(concernsRes.data);
    } catch { toast.error('Failed to load students'); }
  };

  const viewStudent = async (student) => {
    setStudentInfoDialog(student);
    try {
      const [detailRes, gradesRes] = await Promise.all([
        api.get(`/admin/students/${student.user_id}`),
        api.get('/gradebook/entries', { params: { student_id: student.user_id } }),
      ]);
      const detail = detailRes.data;
      const grades = gradesRes.data;
      const finals = grades.filter(g => g.final_score).map(g => g.final_score);
      detail.gpa = finals.length > 0 ? (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(1) : null;
      detail.grade_count = grades.length;
      detail.grades = grades;
      setStudentDetail(detail);
    } catch { setStudentDetail(null); }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    try {
      await api.post('/behaviour/reports', {
        ...reportForm,
        student_id: reportDialog.user_id,
        class_id: selectedClass?.class_id || '',
      });
      toast.success('Behaviour report submitted and forwarded to Head Teacher & Principal');
      setReportDialog(null);
      setReportForm({ category: 'general', severity: 'minor', title: '', description: '', action_taken: '' });
      viewClass(selectedClass);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <AppLoader />;

  if (selectedClass) {
    return (
      <div className="space-y-6" data-testid="class-students-view">
        <Button variant="ghost" size="sm" onClick={() => setSelectedClass(null)} data-testid="back-to-classes"><ArrowLeft className="w-4 h-4 mr-1" /> Back to My Classes</Button>

        <div className="bg-white rounded-md border border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1B2A4A]">{selectedClass.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{selectedClass.year_group} | {students.length} students | Teaching: {selectedClass.teaching_subjects?.join(', ') || 'All subjects'}</p>
            </div>
            {(boosterLessons.length > 0 || parentConcerns.length > 0) && (
              <Button
                variant={showBoosterPanel ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBoosterPanel(!showBoosterPanel)}
                className={`text-xs rounded-md ${showBoosterPanel ? 'bg-[#C5A55A] hover:bg-[#C5A55A]/90 text-white' : 'border-[#C5A55A] text-[#C5A55A] hover:bg-[#C5A55A]/10'}`}
                data-testid="toggle-booster-panel"
              >
                <Zap className="w-3.5 h-3.5 mr-1" />
                Support ({boosterLessons.length + parentConcerns.length})
              </Button>
            )}
          </div>
        </div>

        {/* Booster & Concerns Panel */}
        {showBoosterPanel && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Booster Lessons */}
            <div className="bg-blue-50/50 rounded-md border border-blue-100 p-4">
              <h3 className="text-sm font-semibold text-[#2E6CC4] mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Booster Lessons ({boosterLessons.length})
              </h3>
              {boosterLessons.length === 0 ? (
                <p className="text-xs text-slate-400">No active booster lessons for this class</p>
              ) : (
                <div className="space-y-2">
                  {boosterLessons.map(l => (
                    <div key={l.lesson_id} className="bg-white rounded-md p-3 border border-blue-100" data-testid={`booster-card-${l.lesson_id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#1B2A4A]">{l.student_name}</p>
                        <Badge className={`text-[9px] ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{l.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">Subject: <strong>{l.subject}</strong></p>
                      {l.teacher_name && <p className="text-xs text-slate-500">Teacher: {l.teacher_name}</p>}
                      {l.preferred_days?.length > 0 && <p className="text-xs text-slate-400">Days: {l.preferred_days.join(', ')}</p>}
                      {l.reason && <p className="text-xs text-slate-400 mt-1 italic">{l.reason}</p>}
                      {l.notes && <p className="text-xs text-slate-400 mt-0.5">Notes: {l.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Parent Concerns */}
            <div className="bg-amber-50/50 rounded-md border border-amber-100 p-4">
              <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Parent Concerns ({parentConcerns.length})
              </h3>
              {parentConcerns.length === 0 ? (
                <p className="text-xs text-slate-400">No active parent concerns for this class</p>
              ) : (
                <div className="space-y-2">
                  {parentConcerns.map(c => (
                    <div key={c.concern_id} className="bg-white rounded-md p-3 border border-amber-100" data-testid={`concern-card-${c.concern_id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-[#1B2A4A]">{c.student_name}</p>
                        <Badge className={`text-[9px] capitalize ${c.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-600">{c.subject}</p>
                      <p className="text-xs text-slate-400 capitalize">Category: {c.category}</p>
                      {c.description && <p className="text-xs text-slate-500 mt-1">{c.description}</p>}
                      {c.notes && <p className="text-xs text-slate-400 mt-0.5 italic">Notes: {c.notes}</p>}
                      <p className="text-[10px] text-slate-300 mt-1">Raised by: {c.raised_by_name} ({c.raised_by_role})</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="bg-slate-50">#</TableHead>
              <TableHead className="bg-slate-50">Name</TableHead>
              <TableHead className="bg-slate-50">ADM No.</TableHead>
              <TableHead className="bg-slate-50">Reports</TableHead>
              <TableHead className="bg-slate-50">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {students.map((s, i) => (
                <TableRow key={s.user_id} data-testid={`class-student-${s.user_id}`}>
                  <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-[#2E6CC4] transition-colors" onClick={() => viewStudent(s)}>
                      <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-[#2E6CC4] text-xs font-bold">{s.name?.charAt(0)}</div>
                      <span className="underline decoration-dotted underline-offset-2">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{s.admission_number}</TableCell>
                  <TableCell>{s.report_count > 0 ? <Badge className="bg-red-100 text-red-700">{s.report_count}</Badge> : <span className="text-slate-300">0</span>}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="text-xs h-7 rounded-md text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setReportDialog(s)} data-testid={`report-btn-${s.user_id}`}>
                      <AlertTriangle className="w-3 h-3 mr-1" /> Report
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Student Info Dialog */}
        <Dialog open={!!studentInfoDialog} onOpenChange={() => { setStudentInfoDialog(null); setStudentDetail(null); }}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Student Profile</DialogTitle></DialogHeader>
            {studentDetail ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{studentDetail.name?.charAt(0)}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[#1B2A4A]">{studentDetail.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className="bg-blue-100 text-blue-700 text-xs">{studentDetail.year_group}</Badge>
                      <Badge variant="secondary" className="text-xs">{studentDetail.admission_number}</Badge>
                      <Badge className="bg-blue-100 text-[#1B2A4A] text-xs">{studentDetail.boarding_status}</Badge>
                    </div>
                  </div>
                </div>

                {/* GPA */}
                <div className="bg-slate-50 rounded-md p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Current GPA</p>
                    {studentDetail.gpa ? (
                      <p className={`text-3xl font-bold ${parseFloat(studentDetail.gpa) >= 60 ? 'text-[#C5A55A]' : parseFloat(studentDetail.gpa) >= 40 ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{studentDetail.gpa}%</p>
                    ) : (
                      <p className="text-lg text-slate-400">No grades yet</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Subjects Graded</p>
                    <p className="text-2xl font-bold text-[#1B2A4A]">{studentDetail.grade_count || 0}</p>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-md p-3"><p className="text-[10px] text-slate-500">Class</p><p className="text-sm font-medium">{studentDetail.class_name || '-'}</p></div>
                  <div className="bg-slate-50 rounded-md p-3"><p className="text-[10px] text-slate-500">Email</p><p className="text-sm font-medium truncate">{studentDetail.email}</p></div>
                </div>

                {/* Subjects */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Enrolled Subjects ({studentDetail.subjects?.length || 0})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(studentDetail.subjects || []).map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] py-1">{s.name || s}</Badge>
                    ))}
                    {(!studentDetail.subjects || studentDetail.subjects.length === 0) && (
                      <p className="text-xs text-slate-400">No subjects assigned</p>
                    )}
                  </div>
                </div>

                {/* Recent Grades */}
                {studentDetail.grades && studentDetail.grades.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Grades</p>
                    <div className="space-y-1.5">
                      {studentDetail.grades.slice(0, 6).map((g, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2">
                          <div>
                            <p className="text-xs font-medium text-[#1B2A4A]">{g.subject_name}</p>
                            <p className="text-[10px] text-slate-400">{g.score_type?.replace(/_/g, ' ') || g.term}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${g.final_score >= 60 ? 'text-[#C5A55A]' : g.final_score >= 40 ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{g.final_score}%</span>
                            <Badge className={g.grade_letter === 'A' || g.grade_letter === 'B+' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : g.grade_letter === 'B' || g.grade_letter === 'C' ? 'bg-amber-100 text-amber-700 text-[10px]' : 'bg-red-100 text-red-700 text-[10px]'}>{g.grade_letter}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <AppLoader size="sm" />
            )}
          </DialogContent>
        </Dialog>

        {/* Report Dialog */}
        <Dialog open={!!reportDialog} onOpenChange={() => setReportDialog(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Behaviour Report: {reportDialog?.name}</DialogTitle></DialogHeader>
            <form onSubmit={handleReport} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={reportForm.category} onValueChange={v => setReportForm({...reportForm, category: v})}>
                    <SelectTrigger data-testid="report-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['general','academic','conduct','attendance','bullying','other'].map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Severity</Label>
                  <Select value={reportForm.severity} onValueChange={v => setReportForm({...reportForm, severity: v})}>
                    <SelectTrigger data-testid="report-severity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem><SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="serious">Serious</SelectItem><SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="space-y-2"><Label>Title</Label><Input value={reportForm.title} onChange={e => setReportForm({...reportForm, title: e.target.value})} required placeholder="Brief summary of incident" data-testid="report-title" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={reportForm.description} onChange={e => setReportForm({...reportForm, description: e.target.value})} required rows={4} placeholder="Detailed description of the behaviour incident..." data-testid="report-description" /></div>
              <div className="space-y-2"><Label>Action Taken</Label><Textarea value={reportForm.action_taken} onChange={e => setReportForm({...reportForm, action_taken: e.target.value})} rows={2} placeholder="What action was taken immediately?" data-testid="report-action" /></div>
              <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-700">This report will be automatically forwarded to the Head Teacher and Principal.</div>
              <Button type="submit" className="w-full rounded-md bg-[#DC2626] hover:bg-red-700" data-testid="submit-report-btn">Submit Behaviour Report</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="my-classes">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">My Classes</h1><p className="text-slate-500 mt-1">{classes.length} classes assigned</p></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(cls => (
          <Card key={cls.class_id} className="rounded-md border-slate-100 card-hover cursor-pointer" onClick={() => viewClass(cls)} data-testid={`class-card-${cls.class_id}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-md bg-blue-50 flex items-center justify-center"><Users className="w-6 h-6 text-[#2E6CC4]" /></div>
                <div><h3 className="font-semibold text-[#1B2A4A]">{cls.name}</h3><p className="text-xs text-slate-400">{cls.year_group}</p></div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-slate-500"><GraduationCap className="w-4 h-4" /> {cls.student_count} students</span>
                {cls.teaching_subjects?.length > 0 && <Badge variant="secondary" className="text-[10px]">{cls.teaching_subjects[0]}{cls.teaching_subjects.length > 1 ? ` +${cls.teaching_subjects.length - 1}` : ''}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
        {classes.length === 0 && <p className="col-span-full text-center py-12 text-slate-400">No classes assigned yet</p>}
      </div>
    </div>
  );
}
