import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Eye, FileText, BarChart3, Plus, Star, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function TeacherMonitoring() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [plans, setPlans] = useState([]);
  const [observations, setObservations] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planDialog, setPlanDialog] = useState(false);
  const [planForm, setPlanForm] = useState({ subject_id: '', class_id: '', week: '', topic: '', objectives: '', activities: '', resources: '', assessment: '' });

  const isTeacher = user?.role === 'Teacher';
  const isAdmin = ['Admin', 'SuperAdmin', 'HeadOfAcademics', 'HoD'].includes(user?.role);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [kpiRes, planRes, obsRes, subjRes, clsRes] = await Promise.all([
        api.get('/monitoring/kpis'),
        api.get('/monitoring/lesson-plans'),
        api.get('/monitoring/observations'),
        api.get('/academic/subjects'),
        api.get('/academic/classes'),
      ]);
      setKpis(kpiRes.data);
      setPlans(planRes.data);
      setObservations(obsRes.data);
      setSubjects(subjRes.data);
      setClasses(clsRes.data);
      if (isAdmin) {
        try { const t = await api.get('/admin/staff', { params: { role: 'Teacher' } }); setTeachers(t.data); } catch (err) { console.error("Error:", err); }
      }
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleSubmitPlan = async (e) => {
    e.preventDefault();
    try {
      await api.post('/monitoring/lesson-plans', planForm);
      toast.success('Lesson plan submitted');
      setPlanDialog(false);
      setPlanForm({ subject_id: '', class_id: '', week: '', topic: '', objectives: '', activities: '', resources: '', assessment: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleReviewPlan = async (planId, approved) => {
    try {
      await api.post(`/monitoring/lesson-plans/${planId}/review?approved=${approved}&feedback=${approved ? 'Approved' : 'Needs revision'}`);
      toast.success(`Plan ${approved ? 'approved' : 'returned'}`);
      fetchData();
    } catch { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="teacher-monitoring">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">{isTeacher ? 'My Teaching KPIs' : 'Academic Monitoring'}</h1>
          <p className="text-slate-500 mt-1">Lesson plans, observations, and performance tracking</p>
        </div>
        {isTeacher && (
          <Dialog open={planDialog} onOpenChange={setPlanDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-md bg-[#2E6CC4]" data-testid="submit-plan-btn"><Plus className="w-4 h-4 mr-2" /> Submit Lesson Plan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Submit Lesson Plan</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmitPlan} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Subject</Label>
                    <Select value={planForm.subject_id} onValueChange={v => setPlanForm({...planForm, subject_id: v})}>
                      <SelectTrigger data-testid="plan-subject"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Class</Label>
                    <Select value={planForm.class_id} onValueChange={v => setPlanForm({...planForm, class_id: v})}>
                      <SelectTrigger data-testid="plan-class"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{classes.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Week</Label><Input value={planForm.week} onChange={e => setPlanForm({...planForm, week: e.target.value})} placeholder="e.g. Week 3" data-testid="plan-week" /></div>
                  <div className="space-y-2"><Label>Topic</Label><Input value={planForm.topic} onChange={e => setPlanForm({...planForm, topic: e.target.value})} required data-testid="plan-topic" /></div>
                </div>
                <div className="space-y-2"><Label>Objectives</Label><Textarea value={planForm.objectives} onChange={e => setPlanForm({...planForm, objectives: e.target.value})} rows={2} data-testid="plan-objectives" /></div>
                <div className="space-y-2"><Label>Activities</Label><Textarea value={planForm.activities} onChange={e => setPlanForm({...planForm, activities: e.target.value})} rows={2} data-testid="plan-activities" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-plan-form-btn">Submit Plan</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card"><p className="text-2xl font-bold">{kpis.lesson_plans_total}</p><p className="text-sm text-slate-500">Lesson Plans</p><p className="text-xs text-[#C5A55A]">{kpis.plan_approval_rate}% approved</p></div>
          <div className="stat-card"><p className="text-2xl font-bold">{kpis.lessons_created}</p><p className="text-sm text-slate-500">Lessons Created</p></div>
          <div className="stat-card"><p className="text-2xl font-bold">{kpis.assignments_created}</p><p className="text-sm text-slate-500">Assignments</p></div>
          <div className="stat-card"><p className="text-2xl font-bold flex items-center gap-1"><Star className="w-5 h-5 text-[#F59E0B]" />{kpis.average_observation_rating}/5</p><p className="text-sm text-slate-500">Avg Observation Rating</p></div>
        </div>
      )}

      <Tabs defaultValue="plans">
        <TabsList className="bg-white border" data-testid="monitoring-tabs">
          <TabsTrigger value="plans">Lesson Plans ({plans.length})</TabsTrigger>
          <TabsTrigger value="observations">Observations ({observations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <Card className="rounded-md border-slate-100">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Teacher</TableHead>
                  <TableHead className="bg-slate-50">Subject / Class</TableHead>
                  <TableHead className="bg-slate-50">Week</TableHead>
                  <TableHead className="bg-slate-50">Topic</TableHead>
                  <TableHead className="bg-slate-50">Status</TableHead>
                  {isAdmin && <TableHead className="bg-slate-50">Action</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {plans.map(p => (
                    <TableRow key={p.plan_id}>
                      <TableCell className="font-medium">{p.teacher_name}</TableCell>
                      <TableCell className="text-sm text-slate-500">{p.subject_name} / {p.class_name}</TableCell>
                      <TableCell>{p.week}</TableCell>
                      <TableCell>{p.topic}</TableCell>
                      <TableCell><Badge className={p.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : p.status === 'returned' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{p.status}</Badge></TableCell>
                      {isAdmin && <TableCell>
                        {p.status === 'submitted' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="text-[#C5A55A]" onClick={() => handleReviewPlan(p.plan_id, true)}><CheckCircle className="w-4 h-4" /></Button>
                          </div>
                        )}
                      </TableCell>}
                    </TableRow>
                  ))}
                  {plans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No lesson plans</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observations" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {observations.map(o => (
              <Card key={o.observation_id} className="rounded-md border-slate-100">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary">{o.subject_name}</Badge>
                    <div className="flex items-center gap-1">{[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= o.rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div>
                  </div>
                  <p className="text-sm font-medium text-[#1B2A4A]">{o.teacher_name}</p>
                  <p className="text-xs text-slate-400 mb-2">Observed by {o.observer_name} on {o.date}</p>
                  {o.strengths && <p className="text-sm text-slate-600 mb-1"><strong>Strengths:</strong> {o.strengths}</p>}
                  {o.areas_for_improvement && <p className="text-sm text-slate-600"><strong>Improve:</strong> {o.areas_for_improvement}</p>}
                </CardContent>
              </Card>
            ))}
            {observations.length === 0 && <p className="col-span-full text-center py-8 text-slate-400">No observations recorded</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
