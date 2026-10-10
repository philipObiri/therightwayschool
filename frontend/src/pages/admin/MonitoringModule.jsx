import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import {
  Eye, BarChart3, Users, AlertTriangle, CheckCircle, Clock, Star,
  FileText, BookOpen, ClipboardList, TrendingUp, TrendingDown, Minus,
  Plus, AlertCircle, Shield, GraduationCap, UserCheck, ArrowLeft,
  Send, Paperclip, LinkIcon, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const riskColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-[#C5A55A]/15 text-[#C5A55A]' };

export default function MonitoringModule() {
  const { user } = useAuth();
  const [tab, setTab] = useState('executive');
  const isAdmin = ['Admin', 'SuperAdmin', 'HeadOfAcademics', 'HoD', 'CEO', 'Founder', 'Principal', 'HeadTeacher'].includes(user?.role);
  const isTeacher = user?.role === 'Teacher';

  return (
    <div className="space-y-6" data-testid="monitoring-module">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#1B2A4A]">Monitoring & Quality</h1>
        <p className="text-slate-500 mt-1 text-xs md:text-base">Teacher performance, compliance, tasks, documents & star performers</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border flex-wrap h-auto gap-1 p-1">
          {isAdmin && <TabsTrigger value="executive" className="text-xs">Executive</TabsTrigger>}
          {isAdmin && <TabsTrigger value="teacher-review" className="text-xs">Staff Review</TabsTrigger>}
          <TabsTrigger value="scorecards" className="text-xs">Teacher Scorecards</TabsTrigger>
          <TabsTrigger value="stars" className="text-xs">Star Performers</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Teacher Tasks</TabsTrigger>
          <TabsTrigger value="observations" className="text-xs">Observations</TabsTrigger>
          <TabsTrigger value="coverage" className="text-xs">Lesson Coverage</TabsTrigger>
          <TabsTrigger value="marking" className="text-xs">Marking Monitor</TabsTrigger>
          <TabsTrigger value="students" className="text-xs">Student Outcomes</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
        </TabsList>

        {isAdmin && <TabsContent value="executive"><ExecutiveTab /></TabsContent>}
        {isAdmin && <TabsContent value="teacher-review"><TeacherReviewTab user={user} /></TabsContent>}
        <TabsContent value="scorecards"><ScorecardsTab isAdmin={isAdmin} userId={user?.user_id} /></TabsContent>
        <TabsContent value="stars"><StarPerformersTab /></TabsContent>
        <TabsContent value="tasks"><TeacherTasksTab /></TabsContent>
        <TabsContent value="observations"><ObservationsTab isAdmin={isAdmin} user={user} /></TabsContent>
        <TabsContent value="coverage"><CoverageTab user={user} /></TabsContent>
        <TabsContent value="marking"><MarkingTab user={user} /></TabsContent>
        <TabsContent value="students"><StudentOutcomesTab /></TabsContent>
        <TabsContent value="alerts"><AlertsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ExecutiveTab() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/monitoring/executive-dashboard').then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <AppLoader />;

  const ac = data.academic || {};
  const fin = data.finance || {};
  const alerts = data.alerts || {};

  return (
    <div className="mt-4 space-y-6">
      {/* Banner */}
      <div className="relative rounded-md overflow-hidden h-32">
        <img src="/campus-2.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A]/80 to-transparent flex items-center px-6">
          <div><p className="text-lg font-bold text-white">Academic Excellence Monitoring</p><p className="text-xs text-white/60">Real-time tracking of teaching quality and student outcomes</p></div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={GraduationCap} label="Students" value={ac.students} color="blue" />
        <StatCard icon={Users} label="Teachers" value={ac.teachers} color="green" />
        <StatCard icon={BookOpen} label="Lessons" value={ac.lessons} color="blue" />
        <StatCard icon={ClipboardList} label="Assignments" value={ac.assignments} color="amber" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={FileText} label="Plan Compliance" value={`${ac.plan_compliance}%`} color={ac.plan_compliance >= 80 ? 'green' : ac.plan_compliance >= 50 ? 'amber' : 'red'} />
        <StatCard icon={CheckCircle} label="Marking Rate" value={`${ac.marking_rate}%`} color={ac.marking_rate >= 80 ? 'green' : 'amber'} />
        <StatCard icon={Star} label="Avg Observation" value={`${ac.avg_observation}/5`} color="amber" />
        <StatCard icon={TrendingUp} label="Collection Rate" value={`${fin.collection_rate}%`} color={fin.collection_rate >= 60 ? 'green' : 'red'} />
      </div>

      {/* Alerts summary */}
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Active Alerts ({alerts.total || 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(alerts.alerts || []).slice(0, 8).map((a, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-md ${a.priority === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
                {a.priority === 'high' ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <p className="text-sm text-slate-700 flex-1">{a.message}</p>
                <Badge className={a.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{a.priority}</Badge>
              </div>
            ))}
            {(!alerts.alerts || alerts.alerts.length === 0) && <p className="text-center text-slate-400 py-4">No active alerts</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = { blue: 'bg-blue-50 text-[#2E6CC4]', gold: 'bg-[#C5A55A]/10 text-[#C5A55A]', green: 'bg-[#C5A55A]/10 text-[#C5A55A]', amber: 'bg-amber-50 text-[#F59E0B]', red: 'bg-red-50 text-[#DC2626]' };
  return (
    <div className="stat-card">
      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-md flex items-center justify-center mb-2 ${colors[color] || colors.blue}`}><Icon className="w-4 h-4 md:w-5 md:h-5" /></div>
      <p className="text-xl md:text-2xl font-bold">{value}</p>
      <p className="text-xs md:text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ScorecardsTab({ isAdmin, userId }) {
  const [scorecards, setScorecards] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        if (isAdmin) {
          const r = await api.get('/monitoring/teacher-scorecards');
          setScorecards(r.data);
        } else {
          const r = await api.get(`/monitoring/teacher-scorecard/${userId}`);
          setDetail(r.data);
        }
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    fetch();
  }, [isAdmin, userId]);

  const viewDetail = async (teacherId) => {
    try {
      const r = await api.get(`/monitoring/teacher-scorecard/${teacherId}`);
      setDetail(r.data);
      setSelectedTeacher(teacherId);
    } catch { toast.error('Failed to load scorecard'); }
  };

  if (loading) return <AppLoader />;

  if (detail && (!isAdmin || selectedTeacher)) {
    const k = detail.kpis || {};
    const radarData = [
      { dim: 'Plans', val: k.lesson_plans?.rate || 0 },
      { dim: 'Lessons', val: Math.min(100, (k.lessons?.created || 0) * 20) },
      { dim: 'Assignments', val: Math.min(100, (k.assignments?.created || 0) * 25) },
      { dim: 'Marking', val: k.marking?.sla_total ? round(k.marking.sla_met / k.marking.sla_total * 100) : 0 },
      { dim: 'Tasks', val: k.tasks?.rate || 0 },
    ];
    return (
      <div className="mt-4 space-y-6">
        {isAdmin && <Button variant="ghost" onClick={() => { setDetail(null); setSelectedTeacher(null); }} className="text-xs mb-2">&larr; Back to all staff</Button>}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{detail.teacher?.name?.charAt(0)}</div>
          <div>
            <h2 className="text-xl font-bold">{detail.teacher?.name}</h2>
            <p className="text-sm text-slate-500">{detail.teacher?.department} | {detail.classes_count} classes | {detail.subjects_count} subjects</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Lesson Plans" value={`${k.lesson_plans?.approved || 0}/${k.lesson_plans?.total || 0}`} sub={`${k.lesson_plans?.rate || 0}% approved`} color={k.lesson_plans?.rate >= 80 ? 'green' : 'amber'} />
          <KpiCard label="Lessons Created" value={k.lessons?.created || 0} sub={`${k.lessons?.recent_30d || 0} in last 30d`} color="blue" />
          <KpiCard label="Assignments" value={k.assignments?.created || 0} sub={`${k.assignments?.recent_30d || 0} in last 30d`} color="blue" />
          <KpiCard label="Marking Turnaround" value={`${k.marking?.avg_turnaround_days || 0}d`} sub={`${k.marking?.ungraded || 0} ungraded`} color={k.marking?.avg_turnaround_days <= 5 ? 'green' : 'red'} />
          <KpiCard label="Attendance Records" value={k.attendance_records || 0} sub="sessions recorded" color="blue" />
          <KpiCard label="Observation Rating" value={`${k.observations?.avg_rating || 0}/5`} sub={`${k.observations?.count || 0} observations`} color="amber" />
          <KpiCard label="Tasks Completed" value={`${k.tasks?.completed || 0}/${k.tasks?.assigned || 0}`} sub={`${k.tasks?.rate || 0}% completion`} color={k.tasks?.rate >= 80 ? 'green' : 'amber'} />
          <KpiCard label="Platform Activity" value={`${(k.platform_activity?.lessons_30d || 0) + (k.platform_activity?.assignments_30d || 0)}`} sub="actions in 30 days" color="blue" />
        </div>

        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-base">Performance Radar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} /><PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} /><Radar dataKey="val" stroke="#2E6CC4" fill="#2E6CC4" fillOpacity={0.2} /></RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">Teacher</TableHead><TableHead className="bg-slate-50">Dept</TableHead>
            <TableHead className="bg-slate-50">Plans</TableHead><TableHead className="bg-slate-50">Lessons</TableHead>
            <TableHead className="bg-slate-50">Ungraded</TableHead><TableHead className="bg-slate-50">Obs Rating</TableHead>
            <TableHead className="bg-slate-50">Score</TableHead><TableHead className="bg-slate-50">Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {scorecards.map(s => (
              <TableRow key={s.teacher_id} data-testid={`scorecard-${s.teacher_id}`}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-slate-500 text-sm">{s.department}</TableCell>
                <TableCell><span className="text-sm">{s.plans_approved}/{s.lesson_plans}</span></TableCell>
                <TableCell className="text-sm">{s.lessons}</TableCell>
                <TableCell>{s.ungraded > 0 ? <Badge className="bg-red-100 text-red-700">{s.ungraded}</Badge> : <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">0</Badge>}</TableCell>
                <TableCell><div className="flex items-center gap-1">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= s.obs_rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div></TableCell>
                <TableCell><div className="flex items-center gap-2"><Progress value={s.compliance_score} className="h-2 w-16" /><span className="text-xs font-medium">{s.compliance_score}%</span></div></TableCell>
                <TableCell><Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => viewDetail(s.teacher_id)} data-testid={`view-scorecard-${s.teacher_id}`}><Eye className="w-3 h-3 mr-1" /> View</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  const borders = { gold: 'border-l-[#C5A55A]', green: 'border-l-[#C5A55A]', amber: 'border-l-[#F59E0B]', red: 'border-l-[#DC2626]', blue: 'border-l-[#2E6CC4]' };
  return (
    <div className={`bg-white rounded-md border border-slate-100 p-3 border-l-4 ${borders[color] || borders.blue}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-[#1B2A4A]">{value}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}

function round(v) { return Math.round(v * 10) / 10; }

function ObservationsTab({ isAdmin, user }) {
  const [observations, setObservations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ teacher_id: '', class_id: '', subject_id: '', date: '', strengths: '', areas_for_improvement: '', recommendations: '', action_plan: '', follow_up_date: '', rubric_scores: {} });

  useEffect(() => {
    Promise.all([
      api.get('/monitoring/observations').then(r => setObservations(r.data)),
      api.get('/monitoring/rubric-dimensions').then(r => setDimensions(r.data)),
      isAdmin ? api.get('/admin/staff').then(r => setTeachers(r.data.filter(s => s.role === 'Teacher'))) : Promise.resolve(),
      api.get('/academic/subjects').then(r => setSubjects(r.data)),
      api.get('/academic/classes').then(r => setClasses(r.data)),
    ]).catch(() => {});
  }, [isAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/monitoring/observations', form);
      toast.success('Observation recorded');
      setDialog(false);
      const r = await api.get('/monitoring/observations');
      setObservations(r.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const setRubric = (dim, val) => setForm({ ...form, rubric_scores: { ...form.rubric_scores, [dim]: val } });

  return (
    <div className="mt-4 space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={dialog} onOpenChange={setDialog}>
            <DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="create-obs-btn"><Plus className="w-4 h-4 mr-2" /> New Observation</Button></DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Record Classroom Observation</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Teacher</Label><Select value={form.teacher_id} onValueChange={v => setForm({...form, teacher_id: v})}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Subject</Label><Select value={form.subject_id} onValueChange={v => setForm({...form, subject_id: v})}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="h-8 text-xs" /></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Rubric Scoring (1-5)</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {dimensions.map(dim => (
                      <div key={dim} className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2">
                        <span className="text-xs text-slate-700 flex-1">{dim}</span>
                        <div className="flex gap-1">{[1,2,3,4,5].map(v => (
                          <button key={v} type="button" onClick={() => setRubric(dim, v)} className={`w-7 h-7 rounded-md text-xs font-bold transition-colors ${form.rubric_scores[dim] === v ? 'bg-[#2E6CC4] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{v}</button>
                        ))}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Strengths</Label><Textarea value={form.strengths} onChange={e => setForm({...form, strengths: e.target.value})} rows={2} className="text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Areas for Improvement</Label><Textarea value={form.areas_for_improvement} onChange={e => setForm({...form, areas_for_improvement: e.target.value})} rows={2} className="text-xs" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Action Plan</Label><Textarea value={form.action_plan} onChange={e => setForm({...form, action_plan: e.target.value})} rows={2} className="text-xs" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-obs-btn">Save Observation</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {observations.map(o => (
          <Card key={o.observation_id} className="rounded-md border-slate-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><Badge variant="secondary" className="text-xs">{o.subject_name}</Badge><span className="text-xs text-slate-400">{o.date}</span></div>
                <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= (o.overall_rating || o.rating || 0) ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div>
              </div>
              <p className="text-sm font-semibold text-[#1B2A4A]">{o.teacher_name}</p>
              <p className="text-xs text-slate-400 mb-2">Observed by {o.observer_name}</p>
              {o.strengths && <p className="text-xs text-slate-600 mb-1"><strong className="text-[#C5A55A]">Strengths:</strong> {o.strengths}</p>}
              {o.areas_for_improvement && <p className="text-xs text-slate-600 mb-1"><strong className="text-[#DC2626]">Improve:</strong> {o.areas_for_improvement}</p>}
              {o.action_plan && <p className="text-xs text-slate-600"><strong className="text-[#2E6CC4]">Action:</strong> {o.action_plan}</p>}
              {o.rubric_scores && Object.keys(o.rubric_scores).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">{Object.entries(o.rubric_scores).map(([d, v]) => <Badge key={d} variant="secondary" className="text-[10px]">{d.split(' ')[0]}: {v}/5</Badge>)}</div>
              )}
            </CardContent>
          </Card>
        ))}
        {observations.length === 0 && <p className="col-span-full text-center py-8 text-slate-400">No observations recorded</p>}
      </div>
    </div>
  );
}

function CoverageTab({ user }) {
  const [coverage, setCoverage] = useState(null);
  useEffect(() => { api.get('/monitoring/lesson-coverage').then(r => setCoverage(r.data)).catch(() => {}); }, []);
  if (!coverage) return <AppLoader />;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-2xl font-bold">{coverage.planned_sessions_per_week}</p><p className="text-sm text-slate-500">Planned/Week</p></div>
        <div className="stat-card"><p className="text-2xl font-bold">{coverage.total_lessons_delivered}</p><p className="text-sm text-slate-500">Lessons Delivered</p></div>
        <div className="stat-card"><p className="text-2xl font-bold">{coverage.overall_rate}%</p><p className="text-sm text-slate-500">Coverage Rate</p></div>
      </div>
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle className="text-base">Coverage by Subject</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={coverage.by_subject || []}><XAxis dataKey="subject" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="planned" fill="#E5E7EB" name="Planned" radius={[4,4,0,0]} /><Bar dataKey="delivered" fill="#2E6CC4" name="Delivered" radius={[4,4,0,0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="bg-slate-50">Subject</TableHead><TableHead className="bg-slate-50">Planned</TableHead><TableHead className="bg-slate-50">Delivered</TableHead><TableHead className="bg-slate-50">Coverage</TableHead></TableRow></TableHeader>
          <TableBody>
            {(coverage.by_subject || []).map((s, i) => (
              <TableRow key={i}><TableCell className="font-medium">{s.subject}</TableCell><TableCell>{s.planned}</TableCell><TableCell>{s.delivered}</TableCell>
              <TableCell><div className="flex items-center gap-2"><Progress value={s.rate} className="h-2 w-20" /><span className={`text-xs font-medium ${s.rate >= 80 ? 'text-[#C5A55A]' : s.rate >= 50 ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{s.rate}%</span></div></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MarkingTab({ user }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/monitoring/marking-monitor').then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <AppLoader />;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card bg-red-50 border-red-100"><p className="text-3xl font-bold text-[#DC2626]">{data.total_ungraded}</p><p className="text-sm text-slate-600">Total Ungraded</p></div>
        <div className="stat-card bg-amber-50 border-amber-100"><p className="text-3xl font-bold text-[#F59E0B]">{data.overdue_count}</p><p className="text-sm text-slate-600">Overdue (past SLA)</p></div>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="bg-slate-50">Assignment</TableHead><TableHead className="bg-slate-50">Teacher</TableHead><TableHead className="bg-slate-50">Subject</TableHead><TableHead className="bg-slate-50">Due</TableHead><TableHead className="bg-slate-50">Progress</TableHead><TableHead className="bg-slate-50">Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data.assignments || []).map(m => (
              <TableRow key={m.assignment_id} className={m.is_overdue ? 'bg-red-50/50' : ''}>
                <TableCell className="font-medium text-sm">{m.title}</TableCell>
                <TableCell className="text-sm text-slate-500">{m.teacher_name}</TableCell>
                <TableCell className="text-sm text-slate-500">{m.subject_name}</TableCell>
                <TableCell className="text-xs text-slate-400">{m.due_date || '-'}</TableCell>
                <TableCell><div className="flex items-center gap-2"><Progress value={m.progress} className="h-2 w-16" /><span className="text-xs">{m.graded}/{m.total_submissions}</span></div></TableCell>
                <TableCell>{m.is_overdue ? <Badge className="bg-red-100 text-red-700">Overdue</Badge> : m.ungraded > 0 ? <Badge className="bg-amber-100 text-amber-700">{m.ungraded} pending</Badge> : <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Complete</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StudentOutcomesTab() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/monitoring/student-outcomes').then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <AppLoader />;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-2xl font-bold">{data.total}</p><p className="text-sm text-slate-500">Total Students</p></div>
        <div className="stat-card bg-red-50 border-red-100"><p className="text-2xl font-bold text-[#DC2626]">{data.at_risk_count}</p><p className="text-sm text-slate-600">At Risk</p></div>
        <div className="stat-card bg-[#C5A55A]/10 border-[#C5A55A]/20"><p className="text-2xl font-bold text-[#C5A55A]">{data.total - data.at_risk_count}</p><p className="text-sm text-slate-600">On Track</p></div>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="bg-slate-50">Student</TableHead><TableHead className="bg-slate-50">Class</TableHead><TableHead className="bg-slate-50">Avg Grade</TableHead><TableHead className="bg-slate-50">Attendance</TableHead><TableHead className="bg-slate-50">Assignments</TableHead><TableHead className="bg-slate-50">Risk</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data.students || []).map(s => (
              <TableRow key={s.student_id} className={s.risk_level === 'high' ? 'bg-red-50/50' : ''} data-testid={`outcome-${s.student_id}`}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm text-slate-500">{s.class_name}</TableCell>
                <TableCell className={`font-medium ${s.avg_grade < 40 ? 'text-[#DC2626]' : s.avg_grade < 60 ? 'text-[#F59E0B]' : 'text-[#C5A55A]'}`}>{s.avg_grade || '-'}%</TableCell>
                <TableCell className={s.attendance_rate < 80 ? 'text-[#DC2626]' : 'text-[#C5A55A]'}>{s.attendance_rate}%</TableCell>
                <TableCell><span className="text-sm">{s.submitted}/{s.total_assignments}</span> <span className="text-xs text-slate-400">({s.assignment_completion}%)</span></TableCell>
                <TableCell><Badge className={riskColors[s.risk_level]}>{s.risk_level}{s.risk_flags?.length > 0 && ` (${s.risk_flags.join(', ')})`}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AlertsTab() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/monitoring/alerts').then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <AppLoader />;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-2xl font-bold">{data.total}</p><p className="text-sm text-slate-500">Total Alerts</p></div>
        <div className="stat-card bg-red-50"><p className="text-2xl font-bold text-[#DC2626]">{data.high}</p><p className="text-sm text-slate-600">High Priority</p></div>
        <div className="stat-card bg-amber-50"><p className="text-2xl font-bold text-[#F59E0B]">{data.medium}</p><p className="text-sm text-slate-600">Medium Priority</p></div>
      </div>
      <div className="space-y-2">
        {(data.alerts || []).map((a, i) => (
          <div key={i} className={`flex items-center gap-3 p-4 rounded-md border ${a.priority === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`} data-testid={`alert-${i}`}>
            {a.priority === 'high' ? <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />}
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1B2A4A]">{a.message}</p>
              <p className="text-xs text-slate-500 capitalize">{a.category}</p>
            </div>
            <Badge className={a.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{a.priority}</Badge>
          </div>
        ))}
        {(!data.alerts || data.alerts.length === 0) && <p className="text-center py-8 text-slate-400">No active alerts</p>}
      </div>
    </div>
  );
}


function StarPerformersTab() {
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/monitoring/teacher-scorecards').then(r => setScorecards(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLoader />;

  const stars = scorecards.filter(s => s.compliance_score >= 60).sort((a, b) => b.compliance_score - a.compliance_score);
  const needsSupport = scorecards.filter(s => s.compliance_score < 40);

  return (
    <div className="mt-4 space-y-6">
      {/* Star performers */}
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="w-5 h-5 text-[#F59E0B]" /> Star Performers</CardTitle></CardHeader>
        <CardContent>
          {stars.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stars.map((s, i) => (
                <div key={s.teacher_id} className={`p-4 rounded-md border-2 ${i === 0 ? 'border-[#F59E0B] bg-amber-50' : i < 3 ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center text-white font-bold ${i === 0 ? 'bg-[#F59E0B]' : i < 3 ? 'bg-[#2E6CC4]' : 'bg-slate-400'}`}>
                      {i === 0 ? <Star className="w-5 h-5" /> : i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1B2A4A]">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Progress value={s.compliance_score} className="h-2 flex-1" />
                    <span className="text-xs font-bold text-[#1B2A4A]">{s.compliance_score}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div><p className="font-bold text-sm">{s.lesson_plans}</p><p className="text-slate-400">Plans</p></div>
                    <div><p className="font-bold text-sm">{s.lessons}</p><p className="text-slate-400">Lessons</p></div>
                    <div><p className="font-bold text-sm">{s.obs_rating}/5</p><p className="text-slate-400">Rating</p></div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-center py-6 text-slate-400">No star performers yet - teachers need more activity</p>}
        </CardContent>
      </Card>

      {/* Needs support */}
      {needsSupport.length > 0 && (
        <Card className="rounded-md border-red-100">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-[#DC2626]"><AlertCircle className="w-5 h-5" /> Needs Support ({needsSupport.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {needsSupport.map(s => (
                <div key={s.teacher_id} className="flex items-center justify-between p-3 bg-red-50 rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-red-200 flex items-center justify-center text-red-700 text-sm font-bold">{s.name?.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-[10px] text-slate-400">{s.department} | {s.lesson_plans} plans | {s.ungraded} ungraded</p>
                    </div>
                  </div>
                  <Badge className="bg-red-100 text-red-700">{s.compliance_score}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeacherTasksTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks').then(r => {
      // Filter to show only teacher-assigned tasks
      const teacherTasks = r.data.filter(t => t.assigned_to_role === 'Teacher' || t.assigned_role === 'Teacher');
      setTasks(teacherTasks.length > 0 ? teacherTasks : r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLoader />;

  const statusColors = {
    draft: 'bg-slate-100 text-slate-600', assigned: 'bg-blue-100 text-blue-700',
    acknowledged: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-blue-100 text-[#2E6CC4]',
    blocked: 'bg-red-100 text-red-700', submitted: 'bg-amber-100 text-amber-700',
    returned: 'bg-orange-100 text-orange-700', approved: 'bg-[#C5A55A]/15 text-[#C5A55A]',
    closed: 'bg-slate-200 text-slate-600',
  };

  const byStatus = {};
  tasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="stat-card text-center">
            <p className="text-xl font-bold">{count}</p>
            <Badge className={`${statusColors[status] || 'bg-slate-100'} text-[10px]`}>{status.replace(/_/g, ' ')}</Badge>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">Task</TableHead>
            <TableHead className="bg-slate-50">Assigned To</TableHead>
            <TableHead className="bg-slate-50">Due</TableHead>
            <TableHead className="bg-slate-50">Progress</TableHead>
            <TableHead className="bg-slate-50">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {tasks.map(t => (
              <TableRow key={t.task_id}>
                <TableCell><p className="text-sm font-medium">{t.title}</p><p className="text-[10px] text-slate-400">{t.task_type}</p></TableCell>
                <TableCell className="text-sm">{t.assigned_to_name}</TableCell>
                <TableCell className="text-xs text-slate-500">{t.due_date || '-'}</TableCell>
                <TableCell><div className="flex items-center gap-2"><Progress value={t.checklist_progress || t.progress_percent || 0} className="h-2 w-16" /><span className="text-xs">{t.checklist_progress || t.progress_percent || 0}%</span></div></TableCell>
                <TableCell><Badge className={statusColors[t.status] || 'bg-slate-100'}>{t.status?.replace(/_/g, ' ')}</Badge></TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">No teacher tasks found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const COMMENT_CAT_COLORS = {
  general: 'bg-slate-100 text-slate-600', performance: 'bg-blue-100 text-blue-700', improvement: 'bg-amber-100 text-amber-700',
  praise: 'bg-[#C5A55A]/15 text-[#C5A55A]', lesson_feedback: 'bg-indigo-100 text-indigo-700', assignment_feedback: 'bg-blue-100 text-[#1B2A4A]',
  attendance: 'bg-blue-100 text-[#2E6CC4]', professional_dev: 'bg-blue-100 text-[#2E6CC4]', warning: 'bg-red-100 text-red-700', directive: 'bg-orange-100 text-orange-700',
};

function CommentCard({ c, pinned, onDelete, onPin, fmtDate }) {
  return (
    <div className={`rounded-lg p-4 border ${pinned ? 'border-[#F59E0B] bg-amber-50/50' : 'border-slate-100 bg-slate-50'}`} data-testid={`comment-${c.comment_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-semibold text-[#1B2A4A]">{c.author_name}</span>
            <Badge variant="secondary" className="text-[9px]">{c.author_role}</Badge>
            <Badge className={`text-[9px] ${COMMENT_CAT_COLORS[c.category] || COMMENT_CAT_COLORS.general}`}>{(c.category || 'general').replace(/_/g, ' ')}</Badge>
            {pinned && <Badge className="text-[9px] bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30">Pinned</Badge>}
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.text}</p>
          <p className="text-[10px] text-slate-400 mt-2">{fmtDate(c.created_at)}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onPin(c.comment_id)} className="p-1 rounded hover:bg-slate-200 transition-colors" title={pinned ? 'Unpin' : 'Pin'} data-testid={`pin-${c.comment_id}`}>
            <Star className={`w-3.5 h-3.5 ${pinned ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-300'}`} />
          </button>
          <button onClick={() => onDelete(c.comment_id)} className="p-1 rounded hover:bg-red-100 transition-colors text-red-400" data-testid={`delete-comment-${c.comment_id}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TeacherReviewTab({ user }) {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherData, setTeacherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ratingDialog, setRatingDialog] = useState(null);
  const [rating, setRating] = useState(3);
  const [ratingComment, setRatingComment] = useState('');
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const [activeSection, setActiveSection] = useState('overview');
  const [commentText, setCommentText] = useState('');
  const [commentCategory, setCommentCategory] = useState('general');
  const [commentLoading, setCommentLoading] = useState(false);
  const [staffFilter, setStaffFilter] = useState('all');

  const token = localStorage.getItem('rw_token');
  const fileUrl = (fileId, action = 'preview') => `${import.meta.env.VITE_API_URL}/api/files/${fileId}/${action}?token=${token}`;

  useEffect(() => {
    api.get('/admin/staff').then(r => {
      setTeachers(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectTeacher = async (teacher) => {
    setSelectedTeacher(teacher);
    setDetailLoading(true);
    try {
      const res = await api.get(`/monitoring/teacher-full-review/${teacher.user_id}`);
      setTeacherData(res.data);
    } catch { toast.error('Failed to load teacher data'); }
    setDetailLoading(false);
  };

  const handleRate = async () => {
    if (!ratingDialog) return;
    try {
      await api.post('/monitoring/observations', {
        teacher_id: selectedTeacher.user_id,
        rubric_scores: { 'Overall Performance': rating },
        strengths: ratingComment,
        areas_for_improvement: '',
        rating: rating,
      });
      toast.success(`Rated ${selectedTeacher.name}: ${rating}/5`);
      setRatingDialog(null);
      setRating(3);
      setRatingComment('');
      selectTeacher(selectedTeacher);
    } catch { toast.error('Failed'); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', {
        ...taskForm,
        assigned_to: selectedTeacher.user_id,
        task_type: 'Academic',
        checklist: [],
        tags: [],
        sla_hours: 0,
        estimated_minutes: 0,
      });
      toast.success(`Task assigned to ${selectedTeacher.name}`);
      setTaskDialog(false);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !selectedTeacher) return;
    setCommentLoading(true);
    try {
      await api.post(`/monitoring/teacher-comments/${selectedTeacher.user_id}`, {
        text: commentText, category: commentCategory,
      });
      toast.success('Comment added');
      setCommentText('');
      setCommentCategory('general');
      selectTeacher(selectedTeacher);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setCommentLoading(false);
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/monitoring/teacher-comments/${commentId}`);
      toast.success('Comment deleted');
      selectTeacher(selectedTeacher);
    } catch { toast.error('Failed to delete'); }
  };

  const pinComment = async (commentId) => {
    try {
      await api.patch(`/monitoring/teacher-comments/${commentId}/pin`);
      selectTeacher(selectedTeacher);
    } catch { toast.error('Failed'); }
  };

  const fmtDate = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
  };
  const fmtShort = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return iso; }
  };

  if (loading && !selectedTeacher) return <AppLoader />;

  // ─── Teacher Full Review View ───
  if (selectedTeacher && (teacherData || detailLoading)) {
    if (detailLoading) return <AppLoader />;
    const { lessons, lesson_plans: plans, assignments, uploaded_files, staff_documents, clock_history, audit_logs, remarks, wp_documents, wp_audit, scorecard, summary, activity_metrics, management_comments, daily_metrics } = teacherData;
    const kpis = scorecard?.kpis || {};
    const metrics = activity_metrics || {};
    const breakdown = metrics.breakdown || {};
    const daily = daily_metrics || {};
    const dailyBreakdown = daily.breakdown || {};

    const sections = [
      { key: 'overview', label: 'Overview', icon: BarChart3 },
      { key: 'daily_score', label: 'Daily Score', icon: Clock },
      { key: 'activity_score', label: 'Monthly Score', icon: TrendingUp },
      { key: 'feedback', label: `Feedback (${(management_comments || []).length})`, icon: Send },
      { key: 'lessons', label: `Lessons (${summary.total_lessons})`, icon: BookOpen },
      { key: 'plans', label: `Plans (${summary.total_plans})`, icon: FileText },
      { key: 'assignments', label: `Assignments (${summary.total_assignments})`, icon: ClipboardList },
      { key: 'files', label: `Files (${summary.total_files})`, icon: Paperclip },
      { key: 'documents', label: `Documents (${summary.total_staff_docs})`, icon: Shield },
      { key: 'remarks', label: `Remarks (${summary.total_remarks})`, icon: AlertCircle },
      { key: 'activity', label: 'Activity Log', icon: Clock },
      { key: 'clock', label: 'Clock History', icon: UserCheck },
    ];

    return (
      <div className="mt-4 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedTeacher(null); setTeacherData(null); setActiveSection('overview'); }} data-testid="back-to-teachers"><ArrowLeft className="w-4 h-4 mr-1" /> Back to All Staff</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-md text-xs" onClick={() => setRatingDialog(true)} data-testid="rate-teacher-btn"><Star className="w-4 h-4 mr-1 text-[#F59E0B]" /> Rate</Button>
            <Button className="rounded-md bg-[#2E6CC4] text-xs" onClick={() => setTaskDialog(true)} data-testid="assign-task-btn"><Plus className="w-4 h-4 mr-1" /> Assign Task</Button>
          </div>
        </div>

        {/* Teacher header */}
        <div className="bg-white rounded-md border border-slate-100 p-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{selectedTeacher.name?.charAt(0)}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#1B2A4A]">{selectedTeacher.name}</h2>
            <p className="text-sm text-slate-500">{selectedTeacher.department} | {(selectedTeacher.teaching_subjects || []).join(', ')} | {(selectedTeacher.assigned_year_groups || []).join(', ')}</p>
          </div>
          <div className="text-center">
            <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= (kpis.observations?.avg_rating || 0) ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div>
            <p className="text-xs text-slate-400 mt-1">{kpis.observations?.avg_rating || 0}/5 avg rating</p>
          </div>
        </div>

        {/* Section nav */}
        <div className="flex gap-1 flex-wrap bg-white rounded-md border border-slate-100 p-1.5" data-testid="review-sections">
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeSection === s.key ? 'bg-[#2E6CC4] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                data-testid={`section-${s.key}`}>
                <Icon className="w-3.5 h-3.5" />{s.label}
              </button>
            );
          })}
        </div>

        {/* ── Overview ── */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Dual Score Banners - Daily + Monthly */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Score */}
              <div className={`rounded-xl p-5 border ${(daily.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/10 border-[#C5A55A]/30' : (daily.overall_score || 0) >= 60 ? 'bg-blue-50 border-blue-200' : (daily.overall_score || 0) >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`} data-testid="daily-score-banner">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today's Activity Score</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-black">{daily.overall_score || 0}</span>
                      <span className="text-sm text-slate-400">/100</span>
                      <Badge className={`ml-1 text-[10px] ${(daily.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : (daily.overall_score || 0) >= 60 ? 'bg-blue-100 text-blue-700' : (daily.overall_score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {daily.activity_level || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-16 h-16 relative">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={(daily.overall_score || 0) >= 80 ? '#10b981' : (daily.overall_score || 0) >= 60 ? '#3b82f6' : (daily.overall_score || 0) >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeDasharray={`${(daily.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{daily.overall_score || 0}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">{daily.date || 'Today'} — Lessons, assignments, plans, files, clock hours & platform actions</p>
              </div>

              {/* Monthly Score */}
              <div className={`rounded-xl p-5 border ${metrics.overall_score >= 80 ? 'bg-[#C5A55A]/10 border-[#C5A55A]/30' : metrics.overall_score >= 60 ? 'bg-blue-50 border-blue-200' : metrics.overall_score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`} data-testid="activity-score-banner">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monthly Activity Score (30d)</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-black">{metrics.overall_score || 0}</span>
                      <span className="text-sm text-slate-400">/100</span>
                      <Badge className={`ml-1 text-[10px] ${metrics.overall_score >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : metrics.overall_score >= 60 ? 'bg-blue-100 text-blue-700' : metrics.overall_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {metrics.activity_level || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-16 h-16 relative">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={metrics.overall_score >= 80 ? '#10b981' : metrics.overall_score >= 60 ? '#3b82f6' : metrics.overall_score >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeDasharray={`${(metrics.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{metrics.overall_score || 0}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Based on 30-day rolling window of all teaching activities</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_lessons}</p><p className="text-xs text-slate-500">Lessons</p></div>
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_plans}</p><p className="text-xs text-slate-500">Plans</p></div>
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_assignments}</p><p className="text-xs text-slate-500">Assignments</p></div>
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_files}</p><p className="text-xs text-slate-500">Files</p></div>
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_staff_docs}</p><p className="text-xs text-slate-500">Docs</p></div>
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_remarks}</p><p className="text-xs text-slate-500">Remarks</p></div>
              <div className="stat-card text-center"><p className="text-xl font-bold">{summary.total_wp_docs}</p><p className="text-xs text-slate-500">WP Docs</p></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="Lesson Plans" value={`${kpis.lesson_plans?.approved || 0}/${kpis.lesson_plans?.total || 0}`} sub={`${kpis.lesson_plans?.rate || 0}% approved`} color={kpis.lesson_plans?.rate >= 80 ? 'green' : 'amber'} />
              <KpiCard label="Marking Avg" value={`${kpis.marking?.avg_turnaround_days || 0}d`} sub={`${kpis.marking?.ungraded || 0} ungraded`} color={kpis.marking?.avg_turnaround_days <= 5 ? 'green' : 'red'} />
              <KpiCard label="Observation" value={`${kpis.observations?.avg_rating || 0}/5`} sub={`${kpis.observations?.count || 0} obs`} color="amber" />
              <KpiCard label="Tasks" value={`${kpis.tasks?.completed || 0}/${kpis.tasks?.assigned || 0}`} sub={`${kpis.tasks?.rate || 0}%`} color={kpis.tasks?.rate >= 80 ? 'green' : 'amber'} />
              <KpiCard label="30-Day Activity" value={`${(kpis.platform_activity?.lessons_30d || 0) + (kpis.platform_activity?.assignments_30d || 0)}`} sub="actions" color="blue" />
            </div>
          </div>
        )}

        {/* ── Daily Score Breakdown ── */}
        {activeSection === 'daily_score' && (
          <div className="space-y-4" data-testid="daily-score-section">
            {/* Score ring + level */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex items-center gap-8">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={(daily.overall_score || 0) >= 80 ? '#10b981' : (daily.overall_score || 0) >= 60 ? '#3b82f6' : (daily.overall_score || 0) >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(daily.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">{daily.overall_score || 0}</span>
                    <span className="text-[10px] text-slate-400">/100</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1B2A4A]">Daily Score: {daily.activity_level || 'N/A'}</h3>
                  <p className="text-sm text-slate-500 mt-1">This score tracks what {selectedTeacher?.name?.split(' ')[0] || 'this teacher'} has accomplished <strong>today ({daily.date})</strong>. It measures lessons created, assignments set, plans submitted, files uploaded, hours clocked in, and platform actions — all reset at midnight.</p>
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C5A55A]/100"></span> 80-100 Excellent</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 60-79 Good</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 40-59 Fair</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 0-39 Needs Improvement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily metric breakdown cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: 'lessons', label: 'Lessons Created', icon: BookOpen, color: '#2E6CC4', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0} per day` },
                { key: 'assignments', label: 'Assignments Set', icon: ClipboardList, color: '#7c3aed', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0} per day` },
                { key: 'plans', label: 'Lesson Plans', icon: FileText, color: '#059669', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0} per day` },
                { key: 'files', label: 'File Uploads', icon: Paperclip, color: '#0891b2', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0} per day` },
                { key: 'clock_hours', label: 'Clock-In Hours', icon: Clock, color: '#d97706', detail: (b) => `${b.hours_today || 0}h today / target: ${b.target || 0}h per day` },
                { key: 'platform_activity', label: 'Platform Actions', icon: TrendingUp, color: '#4f46e5', detail: (b) => `${b.actions_today || 0} actions today / target: ${b.target || 0} per day` },
                { key: 'wp_documents', label: 'Working Paper Docs', icon: FolderOpen, color: '#be185d', detail: (b) => `${b.count_today || 0} uploaded today / target: ${b.target || 0} per day` },
                { key: 'wp_actions', label: 'Working Paper Actions', icon: Shield, color: '#0d9488', detail: (b) => `${b.count_today || 0} actions today / target: ${b.target || 0} per day` },
              ].map(m => {
                const b = dailyBreakdown[m.key] || {};
                const Icon = m.icon;
                return (
                  <div key={m.key} className="bg-white rounded-lg border border-slate-100 p-4" data-testid={`daily-metric-${m.key}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: m.color }} />
                        <span className="text-sm font-semibold text-[#1B2A4A]">{m.label}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{b.weight || 0}% weight</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold" style={{ color: m.color }}>{b.score || 0}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <Progress value={b.score || 0} className="h-2 mb-2" />
                    <p className="text-[10px] text-slate-400">{m.detail(b)}</p>
                  </div>
                );
              })}
            </div>

            {/* Daily vs Monthly comparison */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h4 className="text-sm font-bold text-[#1B2A4A] mb-3">Today vs Monthly Comparison</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Today</p>
                  <p className={`text-3xl font-black ${(daily.overall_score || 0) >= 60 ? 'text-[#C5A55A]' : (daily.overall_score || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{daily.overall_score || 0}</p>
                  <Badge className={`mt-1 ${(daily.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : (daily.overall_score || 0) >= 60 ? 'bg-blue-100 text-blue-700' : (daily.overall_score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{daily.activity_level || 'N/A'}</Badge>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Monthly (30d)</p>
                  <p className={`text-3xl font-black ${(metrics.overall_score || 0) >= 60 ? 'text-[#C5A55A]' : (metrics.overall_score || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{metrics.overall_score || 0}</p>
                  <Badge className={`mt-1 ${metrics.overall_score >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : metrics.overall_score >= 60 ? 'bg-blue-100 text-blue-700' : metrics.overall_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{metrics.activity_level || 'N/A'}</Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Activity Score Breakdown (Monthly) ── */}
        {activeSection === 'activity_score' && (
          <div className="space-y-4" data-testid="activity-score-section">
            {/* Score ring + level */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex items-center gap-8">
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={metrics.overall_score >= 80 ? '#10b981' : metrics.overall_score >= 60 ? '#3b82f6' : metrics.overall_score >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(metrics.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">{metrics.overall_score || 0}</span>
                    <span className="text-[10px] text-slate-400">/100</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1B2A4A]">Monthly Score: {metrics.activity_level}</h3>
                  <p className="text-sm text-slate-500 mt-1">This score is calculated from 7 weighted metrics over the last 30 days. It reflects how actively this teacher is engaging with teaching, grading, and platform activities.</p>
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C5A55A]/100"></span> 80-100 Excellent</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 60-79 Good</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 40-59 Fair</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 0-39 Needs Improvement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metric breakdown cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: 'lessons', label: 'Lessons Created', icon: BookOpen, color: '#2E6CC4', detail: `${breakdown.lessons?.count_30d || 0} in 30d / ${breakdown.lessons?.total || 0} total / ${breakdown.lessons?.published || 0} published` },
                { key: 'assignments', label: 'Assignments', icon: ClipboardList, color: '#7c3aed', detail: `${breakdown.assignments?.count_30d || 0} in 30d / ${breakdown.assignments?.total || 0} total` },
                { key: 'plans', label: 'Lesson Plans', icon: FileText, color: '#059669', detail: `${breakdown.plans?.count_30d || 0} in 30d / ${breakdown.plans?.total || 0} total / ${breakdown.plans?.approval_rate || 0}% approved` },
                { key: 'files', label: 'File Uploads', icon: Paperclip, color: '#0891b2', detail: `${breakdown.files?.count_30d || 0} in 30d / ${breakdown.files?.total || 0} total` },
                { key: 'clock_hours', label: 'Clock-In Hours', icon: Clock, color: '#d97706', detail: `${breakdown.clock_hours?.hours_30d || 0}h in 30d / ${breakdown.clock_hours?.total_hours || 0}h total` },
                { key: 'grading', label: 'Grading Rate', icon: CheckCircle, color: '#dc2626', detail: `${breakdown.grading?.graded || 0}/${breakdown.grading?.total_submissions || 0} graded (${breakdown.grading?.rate || 0}%)` },
                { key: 'platform_activity', label: 'Platform Activity', icon: TrendingUp, color: '#4f46e5', detail: `${breakdown.platform_activity?.actions_30d || 0} actions in 30d / ${breakdown.platform_activity?.total_logs || 0} total logs` },
                { key: 'wp_documents', label: 'Working Paper Docs', icon: FolderOpen, color: '#be185d', detail: `${breakdown.wp_documents?.count_30d || 0} in 30d / ${breakdown.wp_documents?.total || 0} total` },
                { key: 'wp_actions', label: 'Working Paper Actions', icon: Shield, color: '#0d9488', detail: `${breakdown.wp_actions?.count_30d || 0} in 30d / ${breakdown.wp_actions?.total || 0} total` },
              ].map(m => {
                const b = breakdown[m.key] || {};
                const Icon = m.icon;
                return (
                  <div key={m.key} className="bg-white rounded-lg border border-slate-100 p-4" data-testid={`metric-${m.key}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: m.color }} />
                        <span className="text-sm font-semibold text-[#1B2A4A]">{m.label}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{b.weight || 0}% weight</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold" style={{ color: m.color }}>{b.score || 0}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <Progress value={b.score || 0} className="h-2 mb-2" />
                    <p className="text-[10px] text-slate-400">{m.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Management Feedback ── */}
        {activeSection === 'feedback' && (
          <div className="space-y-4" data-testid="feedback-section">
            {/* Comment form */}
            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4 text-[#2E6CC4]" /> Leave a Comment for {selectedTeacher.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <Select value={commentCategory} onValueChange={setCommentCategory}>
                    <SelectTrigger className="w-[180px] text-xs" data-testid="comment-category-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Note</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="improvement">Needs Improvement</SelectItem>
                      <SelectItem value="praise">Praise / Recognition</SelectItem>
                      <SelectItem value="lesson_feedback">Lesson Feedback</SelectItem>
                      <SelectItem value="assignment_feedback">Assignment Feedback</SelectItem>
                      <SelectItem value="attendance">Attendance / Punctuality</SelectItem>
                      <SelectItem value="professional_dev">Professional Dev</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="directive">Directive / Action Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="Write your comment, feedback, or directive for this teacher..." value={commentText} onChange={e => setCommentText(e.target.value)} rows={3} className="resize-none" data-testid="comment-textarea" />
                <div className="flex justify-end">
                  <Button onClick={submitComment} disabled={commentLoading || !commentText.trim()} className="rounded-md bg-[#2E6CC4] text-xs gap-2" data-testid="submit-comment-btn">
                    {commentLoading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Post Comment
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Comments list */}
            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-sm">Management Comments ({(management_comments || []).length})</CardTitle></CardHeader>
              <CardContent>
                {(management_comments || []).length > 0 ? (
                  <div className="space-y-3">
                    {/* Pinned first */}
                    {(management_comments || []).filter(c => c.pinned).map(c => (
                      <CommentCard key={c.comment_id} c={c} pinned onDelete={deleteComment} onPin={pinComment} fmtDate={fmtDate} />
                    ))}
                    {(management_comments || []).filter(c => !c.pinned).map(c => (
                      <CommentCard key={c.comment_id} c={c} onDelete={deleteComment} onPin={pinComment} fmtDate={fmtDate} />
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400 text-center py-8">No management comments yet. Be the first to leave feedback.</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Lessons ── */}
        {activeSection === 'lessons' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#2E6CC4]" /> All Lessons ({lessons.length})</CardTitle></CardHeader>
            <CardContent>
              {lessons.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Title</TableHead>
                      <TableHead className="bg-slate-50">Subject</TableHead>
                      <TableHead className="bg-slate-50">Type</TableHead>
                      <TableHead className="bg-slate-50">Date</TableHead>
                      <TableHead className="bg-slate-50">Files</TableHead>
                      <TableHead className="bg-slate-50">Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {lessons.map(l => (
                        <TableRow key={l.lesson_id} data-testid={`lesson-row-${l.lesson_id}`}>
                          <TableCell className="font-medium text-sm">{l.title}</TableCell>
                          <TableCell className="text-sm text-slate-500">{l.subject_name}</TableCell>
                          <TableCell className="text-xs text-slate-400">{l.lesson_type}</TableCell>
                          <TableCell className="text-xs text-slate-400">{fmtShort(l.created_at)}</TableCell>
                          <TableCell>
                            {(l.file_ids || []).map(fid => (
                              <span key={fid} className="inline-flex gap-1 mr-1">
                                <a href={fileUrl(fid, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] hover:underline text-[10px]" data-testid={`view-file-${fid}`}>View</a>
                                <a href={fileUrl(fid, 'download')} className="text-[#C5A55A] hover:underline text-[10px]" data-testid={`dl-file-${fid}`}>DL</a>
                              </span>
                            ))}
                            {(!l.file_ids || l.file_ids.length === 0) && <span className="text-[10px] text-slate-300">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Badge className={l.published ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : 'bg-slate-100 text-slate-500 text-[10px]'}>{l.published ? 'Published' : 'Draft'}</Badge>
                              {l.submitted_to_management && <Badge className={l.submission_status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : 'bg-amber-100 text-amber-700 text-[10px]'}>{l.submission_status || 'pending'}</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No lessons uploaded</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Lesson Plans ── */}
        {activeSection === 'plans' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-[#C5A55A]" /> Lesson Plans ({plans.length})</CardTitle></CardHeader>
            <CardContent>
              {plans.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Topic</TableHead>
                      <TableHead className="bg-slate-50">Subject</TableHead>
                      <TableHead className="bg-slate-50">Class</TableHead>
                      <TableHead className="bg-slate-50">Week</TableHead>
                      <TableHead className="bg-slate-50">Files</TableHead>
                      <TableHead className="bg-slate-50">Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {plans.map(p => (
                        <TableRow key={p.plan_id}>
                          <TableCell className="font-medium text-sm">{p.topic}</TableCell>
                          <TableCell className="text-sm text-slate-500">{p.subject_name}</TableCell>
                          <TableCell className="text-sm text-slate-500">{p.class_name}</TableCell>
                          <TableCell className="text-xs text-slate-400">{p.week}</TableCell>
                          <TableCell>
                            {(p.evidence_file_ids || []).map(fid => (
                              <span key={fid} className="inline-flex gap-1 mr-1">
                                <a href={fileUrl(fid, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] hover:underline text-[10px]">View</a>
                                <a href={fileUrl(fid, 'download')} className="text-[#C5A55A] hover:underline text-[10px]">DL</a>
                              </span>
                            ))}
                            {(!p.evidence_file_ids || p.evidence_file_ids.length === 0) && <span className="text-[10px] text-slate-300">-</span>}
                          </TableCell>
                          <TableCell><Badge className={p.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : p.status === 'returned' ? 'bg-red-100 text-red-700 text-[10px]' : 'bg-amber-100 text-amber-700 text-[10px]'}>{p.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No lesson plans submitted</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Assignments ── */}
        {activeSection === 'assignments' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#2E6CC4]" /> Assignments ({assignments.length})</CardTitle></CardHeader>
            <CardContent>
              {assignments.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Title</TableHead>
                      <TableHead className="bg-slate-50">Subject</TableHead>
                      <TableHead className="bg-slate-50">Due</TableHead>
                      <TableHead className="bg-slate-50">Submissions</TableHead>
                      <TableHead className="bg-slate-50">Graded</TableHead>
                      <TableHead className="bg-slate-50">Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {assignments.map(a => (
                        <TableRow key={a.assignment_id}>
                          <TableCell className="font-medium text-sm">{a.title}</TableCell>
                          <TableCell className="text-sm text-slate-500">{a.subject_name}</TableCell>
                          <TableCell className="text-xs text-slate-400">{a.due_date || '-'}</TableCell>
                          <TableCell className="text-sm">{a.total_submissions || 0}</TableCell>
                          <TableCell className="text-sm">{a.graded_count || 0}</TableCell>
                          <TableCell><Badge className={a.published ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : 'bg-slate-100 text-slate-500 text-[10px]'}>{a.published ? 'Active' : 'Draft'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No assignments created</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Uploaded Files ── */}
        {activeSection === 'files' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Paperclip className="w-4 h-4 text-[#2E6CC4]" /> All Uploaded Files ({uploaded_files.length})</CardTitle></CardHeader>
            <CardContent>
              {uploaded_files.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Filename</TableHead>
                      <TableHead className="bg-slate-50">Type</TableHead>
                      <TableHead className="bg-slate-50">Size</TableHead>
                      <TableHead className="bg-slate-50">Uploaded</TableHead>
                      <TableHead className="bg-slate-50">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {uploaded_files.map(f => (
                        <TableRow key={f.file_id} data-testid={`file-row-${f.file_id}`}>
                          <TableCell className="font-medium text-sm">{f.original_filename}</TableCell>
                          <TableCell className="text-xs text-slate-400">{f.content_type?.split('/').pop() || '-'}</TableCell>
                          <TableCell className="text-xs text-slate-400">{f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : '-'}</TableCell>
                          <TableCell className="text-xs text-slate-400">{fmtDate(f.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <a href={fileUrl(f.file_id, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] hover:underline text-xs font-medium" data-testid={`preview-${f.file_id}`}>
                                <Eye className="w-3.5 h-3.5 inline mr-0.5" />View
                              </a>
                              <a href={fileUrl(f.file_id, 'download')} className="text-[#C5A55A] hover:underline text-xs font-medium" data-testid={`download-${f.file_id}`}>
                                <LinkIcon className="w-3.5 h-3.5 inline mr-0.5" />Download
                              </a>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No files uploaded by this teacher</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Staff Documents (CVs, certificates) ── */}
        {activeSection === 'documents' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-[#2E6CC4]" /> Staff Documents & CVs ({staff_documents.length})</CardTitle></CardHeader>
            <CardContent>
              {staff_documents.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Title</TableHead>
                      <TableHead className="bg-slate-50">Type</TableHead>
                      <TableHead className="bg-slate-50">File</TableHead>
                      <TableHead className="bg-slate-50">Uploaded</TableHead>
                      <TableHead className="bg-slate-50">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {staff_documents.map(d => (
                        <TableRow key={d.doc_id} data-testid={`sdoc-row-${d.doc_id}`}>
                          <TableCell className="font-medium text-sm">{d.title || d.filename}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{d.doc_type || 'other'}</Badge></TableCell>
                          <TableCell className="text-xs text-slate-400">{d.filename}</TableCell>
                          <TableCell className="text-xs text-slate-400">{fmtDate(d.created_at)}</TableCell>
                          <TableCell>
                            {d.file_id && (
                              <div className="flex gap-2">
                                <a href={fileUrl(d.file_id, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] hover:underline text-xs font-medium">
                                  <Eye className="w-3.5 h-3.5 inline mr-0.5" />View
                                </a>
                                <a href={fileUrl(d.file_id, 'download')} className="text-[#C5A55A] hover:underline text-xs font-medium">
                                  <LinkIcon className="w-3.5 h-3.5 inline mr-0.5" />Download
                                </a>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No staff documents on file</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Remarks ── */}
        {activeSection === 'remarks' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> Teacher Remarks ({remarks.length})</CardTitle></CardHeader>
            <CardContent>
              {remarks.length > 0 ? (
                <div className="space-y-3">
                  {remarks.map(r => (
                    <div key={r.remark_id} className="bg-slate-50 rounded-md p-4 border border-slate-100" data-testid={`remark-row-${r.remark_id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-[#1B2A4A]">{r.title}</h4>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[10px]">{(r.category || '').replace(/_/g, ' ')}</Badge>
                          <Badge className={r.status === 'resolved' || r.status === 'closed' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : r.status === 'open' ? 'bg-amber-100 text-amber-700 text-[10px]' : 'bg-blue-100 text-blue-700 text-[10px]'}>{r.status}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{r.body}</p>
                      <div className="flex gap-3 text-[10px] text-slate-400">
                        {r.subject && <span>Subject: {r.subject}</span>}
                        {r.year_group && <span>Year: {r.year_group}</span>}
                        <span>{fmtDate(r.created_at)}</span>
                        {r.responses?.length > 0 && <span className="text-[#2E6CC4] font-medium">{r.responses.length} response(s)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No remarks submitted</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Activity Log ── */}
        {activeSection === 'activity' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-[#2E6CC4]" /> Activity & Audit Log ({audit_logs.length})</CardTitle></CardHeader>
            <CardContent>
              {audit_logs.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50 sticky top-0">Action</TableHead>
                      <TableHead className="bg-slate-50 sticky top-0">Entity</TableHead>
                      <TableHead className="bg-slate-50 sticky top-0">Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {audit_logs.map((log, i) => (
                        <TableRow key={log.log_id || i} data-testid={`audit-row-${i}`}>
                          <TableCell className="text-sm font-medium capitalize">{(log.action || '').replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-xs text-slate-500">{log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 12)}...)` : ''}</TableCell>
                          <TableCell className="text-xs text-slate-400">{fmtDate(log.timestamp)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No activity recorded</p>}
              {/* WP Audit */}
              {wp_audit.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Working Paper Activity ({wp_audit.length})</p>
                  <div className="space-y-1">
                    {wp_audit.slice(0, 15).map((w, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded p-2">
                        <span className="text-slate-500 capitalize font-medium">{(w.action || '').replace(/_/g, ' ')}</span>
                        <span className="text-slate-400 flex-1 truncate">{typeof w.details === 'string' ? w.details : (w.details && Object.keys(w.details).length > 0 ? JSON.stringify(w.details) : '')}</span>
                        <span className="text-slate-300 text-[10px]">{fmtDate(w.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Clock History ── */}
        {activeSection === 'clock' && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="w-4 h-4 text-[#C5A55A]" /> Clock-In/Out History ({clock_history.length})</CardTitle></CardHeader>
            <CardContent>
              {clock_history.length > 0 ? (
                <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Clock In</TableHead>
                      <TableHead className="bg-slate-50">Clock Out</TableHead>
                      <TableHead className="bg-slate-50">Duration</TableHead>
                      <TableHead className="bg-slate-50">Method</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {clock_history.map(c => {
                        let dur = '-';
                        if (c.clock_in && c.clock_out) {
                          const ms = new Date(c.clock_out) - new Date(c.clock_in);
                          const hrs = Math.floor(ms / 3600000);
                          const mins = Math.floor((ms % 3600000) / 60000);
                          dur = `${hrs}h ${mins}m`;
                        }
                        return (
                          <TableRow key={c.entry_id} data-testid={`clock-row-${c.entry_id}`}>
                            <TableCell className="text-sm">{fmtDate(c.clock_in)}</TableCell>
                            <TableCell className="text-sm">{c.clock_out ? fmtDate(c.clock_out) : <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]">Active</Badge>}</TableCell>
                            <TableCell className="text-sm font-medium">{dur}</TableCell>
                            <TableCell className="text-xs text-slate-400 capitalize">{(c.method || '').replace(/_/g, ' ')}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">No clock entries found</p>}
            </CardContent>
          </Card>
        )}

        {/* Rating Dialog */}
        <Dialog open={!!ratingDialog} onOpenChange={() => setRatingDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Rate {selectedTeacher.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-3">How would you rate this teacher's overall performance?</p>
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map(v => (
                    <button key={v} onClick={() => setRating(v)} className="transition-transform hover:scale-110" data-testid={`star-${v}`}>
                      <Star className={`w-10 h-10 ${v <= rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
                <p className="text-lg font-bold mt-2">{rating}/5 - {['', 'Poor', 'Below Average', 'Good', 'Very Good', 'Excellent'][rating]}</p>
              </div>
              <div className="space-y-2">
                <Label>Comments (optional)</Label>
                <Textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)} rows={3} placeholder="Add feedback or comments..." data-testid="rating-comment" />
              </div>
              <Button className="w-full rounded-md bg-[#F59E0B] hover:bg-amber-600 text-white" onClick={handleRate} data-testid="submit-rating">
                <Star className="w-4 h-4 mr-2" /> Submit Rating
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Task Dialog */}
        <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Assign Task to {selectedTeacher.name}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2"><Label>Task Title</Label><Input value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} required placeholder="e.g. Submit Term 2 lesson plans" data-testid="task-title" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} rows={3} placeholder="Describe what needs to be done..." data-testid="task-desc" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Priority</Label>
                  <Select value={taskForm.priority} onValueChange={v => setTaskForm({...taskForm, priority: v})}>
                    <SelectTrigger data-testid="task-priority"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} data-testid="task-due" /></div>
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-task">
                <Send className="w-4 h-4 mr-2" /> Assign Task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Staff Tiles Grid ───
  const ROLE_COLORS = {
    Teacher: 'bg-blue-100 text-blue-700',
    HeadTeacher: 'bg-indigo-100 text-indigo-700',
    HeadOfAcademics: 'bg-indigo-100 text-indigo-700',
    Principal: 'bg-blue-100 text-[#1B2A4A]',
    CEO: 'bg-amber-100 text-amber-700',
    Founder: 'bg-amber-100 text-amber-700',
    SuperAdmin: 'bg-red-100 text-red-700',
    Admin: 'bg-slate-100 text-slate-600',
    FinanceOfficer: 'bg-[#C5A55A]/15 text-[#C5A55A]',
    HR_Officer: 'bg-blue-100 text-[#2E6CC4]',
    AdmissionsOfficer: 'bg-blue-100 text-[#2E6CC4]',
    BoardingStaff: 'bg-orange-100 text-orange-700',
  };
  const uniqueRoles = [...new Set(teachers.map(t => t.role))].sort();
  const filteredStaff = staffFilter === 'all' ? teachers : teachers.filter(t => t.role === staffFilter);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1B2A4A]">Staff Review</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{filteredStaff.length} staff</span>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="h-8 text-xs w-40" data-testid="staff-review-filter"><SelectValue placeholder="Filter by role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {uniqueRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredStaff.map(t => (
          <div
            key={t.user_id}
            onClick={() => selectTeacher(t)}
            className="bg-white rounded-md border-2 border-slate-100 p-5 cursor-pointer hover:border-[#2E6CC4] hover:shadow-lg transition-all group"
            data-testid={`staff-tile-${t.user_id}`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold mb-3 group-hover:scale-110 transition-transform">
                {t.name?.charAt(0)}
              </div>
              <h3 className="text-sm font-semibold text-[#1B2A4A]">{t.name}</h3>
              <Badge className={`text-[9px] mt-1 ${ROLE_COLORS[t.role] || 'bg-slate-100 text-slate-600'}`}>{t.role}</Badge>
              <p className="text-[10px] text-slate-400 mt-1">{t.department || ''}</p>
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {(t.teaching_subjects || []).slice(0, 2).map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px]">{s}</Badge>
                ))}
              </div>
              {(t.assigned_year_groups || []).length > 0 && (
                <p className="text-[10px] text-slate-400 mt-1">{t.assigned_year_groups.join(', ')}</p>
              )}
            </div>
          </div>
        ))}
        {filteredStaff.length === 0 && <p className="col-span-full text-center py-12 text-slate-400">No staff found</p>}
      </div>
    </div>
  );
}