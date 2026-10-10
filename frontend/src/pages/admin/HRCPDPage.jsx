import React, { useEffect, useState, useRef } from 'react';
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
import { BookOpen, Plus, Award, Users, Zap, Upload, CheckCircle, Eye, BarChart3, Download } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

export default function HRCPDPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseDialog, setCourseDialog] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: 'General', duration_hours: 2, provider: 'Internal', start_date: '' });
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/cpd/courses').then(r => setCourses(r.data)),
      api.get('/quiz/list').then(r => setQuizzes(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cpd/courses', courseForm);
      toast.success('Training course created');
      setCourseDialog(false);
      setCourseForm({ title: '', description: '', category: 'General', duration_hours: 2, provider: 'Internal', start_date: '' });
      const r = await api.get('/cpd/courses'); setCourses(r.data);
    } catch (err) { toast.error('Failed'); }
  };

  const handleGenerateQuiz = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) { toast.error('Only PDF files'); return; }
    setGenerating(true);
    toast.info('AI generating staff training quiz from PDF...');
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post('/quiz/generate-from-pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      toast.success(`Generated ${res.data.question_count} questions for staff training!`);
      const r = await api.get('/quiz/list'); setQuizzes(r.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setGenerating(false);
    e.target.value = '';
  };

  const publishToStaff = async (quizId) => {
    try {
      await api.post(`/quiz/${quizId}/publish`, { class_ids: [], score_type: 'cpd_training', max_score: 100 });
      // Mark as staff quiz
      await api.put(`/quiz/${quizId}`, { title: quizzes.find(q => q.quiz_id === quizId)?.title + ' (Staff CPD)' });
      toast.success('Quiz published for staff training');
      const r = await api.get('/quiz/list'); setQuizzes(r.data);
    } catch { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="hr-cpd">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">CPD & Staff Training</h1><p className="text-slate-500 mt-1">Manage training courses and generate quizzes for staff development</p></div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border"><TabsTrigger value="courses" className="text-xs">Training Courses</TabsTrigger><TabsTrigger value="quizzes" className="text-xs">AI Training Quizzes</TabsTrigger></TabsList>

        {/* Training Courses */}
        <TabsContent value="courses" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={courseDialog} onOpenChange={setCourseDialog}><DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]"><Plus className="w-4 h-4 mr-2" /> New Training</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Create Training Course</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateCourse} className="space-y-3">
                  <div className="space-y-2"><Label>Title</Label><Input value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} required /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={courseForm.description} onChange={e => setCourseForm({...courseForm, description: e.target.value})} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Category</Label><Select value={courseForm.category} onValueChange={v => setCourseForm({...courseForm, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['General','Pedagogy','Technology','Leadership','Safeguarding','Wellbeing','Subject-Specific','Policy'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Duration (hrs)</Label><Input type="number" value={courseForm.duration_hours} onChange={e => setCourseForm({...courseForm, duration_hours: parseInt(e.target.value)})} /></div>
                  </div>
                  <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={courseForm.start_date} onChange={e => setCourseForm({...courseForm, start_date: e.target.value})} /></div>
                  <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]">Create Training</Button>
                </form></DialogContent></Dialog>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(c => (
              <Card key={c.course_id} className="rounded-md border-slate-200 card-hover">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3"><div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center"><Award className="w-5 h-5 text-[#2E6CC4]" /></div><Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">{c.status}</Badge></div>
                  <h3 className="font-semibold text-[#1B2A4A] mb-1">{c.title}</h3>
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">{c.description}</p>
                  <div className="flex gap-2 text-xs text-slate-400 mb-3"><span>{c.category}</span><span>|</span><span>{c.duration_hours}h</span><span>|</span><span><Users className="w-3 h-3 inline" /> {c.enrolled_count || 0}</span></div>
                  {c.my_enrolment?.status === 'completed' ? (
                    <Button size="sm" className="rounded-md bg-[#C5A55A] text-white text-xs" onClick={() => {
                      const token = localStorage.getItem('rw_token');
                      fetch(`${BACKEND}/api/cpd/certificate/${c.course_id}/${user?.user_id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.blob()).then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Certificate.pdf'; a.click(); toast.success('Downloaded'); }).catch(() => toast.error('Failed'));
                    }}><Award className="w-3 h-3 mr-1" /> Certificate</Button>
                  ) : c.my_enrolment ? (
                    <Badge className="bg-blue-100 text-blue-700">Enrolled</Badge>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            {courses.length === 0 && <p className="col-span-full text-center py-8 text-slate-400">No training courses yet</p>}
          </div>
        </TabsContent>

        {/* AI Training Quizzes */}
        <TabsContent value="quizzes" className="mt-4 space-y-4">
          <Card className="rounded-md border-2 border-dashed border-[#2E6CC4] bg-blue-50/30">
            <CardContent className="p-6 text-center">
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" onChange={handleGenerateQuiz} />
              <Zap className="w-10 h-10 text-[#2E6CC4] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#1B2A4A] mb-1">Generate Staff Training Quiz from PDF</h3>
              <p className="text-xs text-slate-500 mb-3">Upload training material PDF and AI creates 40 MCQs for staff assessment</p>
              <Button className="rounded-md bg-[#2E6CC4]" onClick={() => fileInputRef.current?.click()} disabled={generating}>
                {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-md animate-spin mr-2" /> Generating...</> : <><Upload className="w-4 h-4 mr-2" /> Upload Training PDF</>}
              </Button>
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map(q => (
              <Card key={q.quiz_id} className="rounded-md border-slate-200 card-hover">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2"><Zap className="w-5 h-5 text-[#2E6CC4]" /><Badge className="bg-blue-100 text-[#1B2A4A]">{q.question_count} Qs</Badge></div>
                  <h3 className="font-semibold text-[#1B2A4A] mb-1 line-clamp-2">{q.title}</h3>
                  <p className="text-xs text-slate-400 mb-3">{q.source_filename} | {new Date(q.created_at).toLocaleDateString()}</p>
                  <div className="flex gap-2">
                    {!q.published && <Button size="sm" className="rounded-md bg-[#2E6CC4] text-xs" onClick={() => publishToStaff(q.quiz_id)}>Publish for Staff</Button>}
                    {q.published && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Published</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
