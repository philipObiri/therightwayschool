import React, { useEffect, useState } from 'react';
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
import { BookOpen, Plus, Award, Users, Star, Target, Shield, CheckCircle, Clock, Send, FileText, Upload, Eye, Trash2, TrendingUp, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const statusColors = { open: 'bg-[#C5A55A]/15 text-[#C5A55A]', enrolled: 'bg-blue-100 text-blue-700', completed: 'bg-[#C5A55A]/15 text-[#C5A55A]', draft: 'bg-slate-100 text-slate-600', submitted: 'bg-amber-100 text-amber-700', acknowledged: 'bg-blue-100 text-blue-700', approved: 'bg-[#C5A55A]/15 text-[#C5A55A]', pending: 'bg-amber-100 text-amber-700', revision_needed: 'bg-red-100 text-red-700' };

export default function ProfessionalDev() {
  const { user } = useAuth();
  const [tab, setTab] = useState('cpd');
  const isAdmin = ['Admin', 'SuperAdmin', 'HeadOfAcademics', 'HoD', 'HR_Officer', 'CEO'].includes(user?.role);

  return (
    <div className="space-y-6" data-testid="professional-dev">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[#1B2A4A]">Professional Development</h1><p className="text-slate-500 mt-1">CPD, reading materials, performance reviews, and promotions</p></div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border"><TabsTrigger value="cpd" className="text-xs">CPD Catalogue</TabsTrigger><TabsTrigger value="materials" className="text-xs">Reading Materials</TabsTrigger><TabsTrigger value="reviews" className="text-xs">Performance Reviews</TabsTrigger><TabsTrigger value="promotion" className="text-xs">Promotion Checker</TabsTrigger><TabsTrigger value="assessment" className="text-xs">Assessment Vault</TabsTrigger></TabsList>
        <TabsContent value="cpd" className="mt-4"><CPDTab isAdmin={isAdmin} user={user} /></TabsContent>
        <TabsContent value="materials" className="mt-4"><MaterialsTab isAdmin={isAdmin} user={user} /></TabsContent>
        <TabsContent value="reviews" className="mt-4"><ReviewsTab isAdmin={isAdmin} user={user} /></TabsContent>
        <TabsContent value="promotion" className="mt-4"><PromotionTab isAdmin={isAdmin} user={user} /></TabsContent>
        <TabsContent value="assessment" className="mt-4"><AssessmentTab isAdmin={isAdmin} user={user} /></TabsContent>
      </Tabs>
    </div>
  );
}

function CPDTab({ isAdmin, user }) {
  const [courses, setCourses] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', duration_hours: 2, provider: 'Internal', start_date: '', max_participants: 50 });
  const [cpdTests, setCpdTests] = useState([]);
  const [takingQuiz, setTakingQuiz] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    api.get('/cpd/courses').then(r => setCourses(r.data)).catch(() => {});
    api.get('/quiz/staff/cpd-tests').then(r => setCpdTests(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.post('/cpd/courses', form); toast.success('Course created'); setDialog(false); const r = await api.get('/cpd/courses'); setCourses(r.data); } catch (err) { toast.error('Failed'); }
  };

  const handleEnrol = async (courseId) => {
    try { await api.post(`/cpd/courses/${courseId}/enrol`); toast.success('Enrolled'); const r = await api.get('/cpd/courses'); setCourses(r.data); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleComplete = async (courseId, userId) => {
    try { await api.post(`/cpd/courses/${courseId}/complete`, { user_id: userId }); toast.success('Course completed! Certificate ready.'); const r = await api.get('/cpd/courses'); setCourses(r.data); } catch (err) { toast.error('Failed'); }
  };

  const downloadCert = (courseId, userId) => {
    const token = localStorage.getItem('rw_token');
    fetch(`${import.meta.env.VITE_API_URL}/api/cpd/certificate/${courseId}/${userId}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `RightWay_Certificate.pdf`; a.click(); toast.success('Certificate downloaded'); })
      .catch(() => toast.error('Failed'));
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="create-cpd-btn"><Plus className="w-4 h-4 mr-2" /> New Course</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Create CPD Course</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="h-9 text-xs" data-testid="cpd-title" /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="text-xs" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Category</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['General','Pedagogy','Technology','Leadership','Subject-Specific','Safeguarding','Wellbeing'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Duration (hrs)</Label><Input type="number" value={form.duration_hours} onChange={e => setForm({...form, duration_hours: parseInt(e.target.value)})} className="h-9 text-xs" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="h-9 text-xs" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-cpd">Create</Button>
              </form></DialogContent></Dialog>
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(c => (
          <Card key={c.course_id} className="rounded-md border-slate-100 card-hover" data-testid={`cpd-card-${c.course_id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3"><div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center"><BookOpen className="w-5 h-5 text-[#2E6CC4]" /></div><Badge className={statusColors[c.status]}>{c.status}</Badge></div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">{c.title}</h3>
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{c.description || 'No description'}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-3"><span>{c.category}</span><span>|</span><span>{c.duration_hours}h</span><span>|</span><span><Users className="w-3 h-3 inline" /> {c.enrolled_count}</span></div>
              {c.my_enrolment ? (
                <div className="flex gap-2 flex-wrap">
                  {c.my_enrolment.status === 'completed' ? (
                    <Button size="sm" className="rounded-md bg-[#C5A55A] text-white text-xs" onClick={() => downloadCert(c.course_id, user?.user_id)} data-testid={`cert-${c.course_id}`}><Award className="w-3 h-3 mr-1" /> Download Certificate</Button>
                  ) : (
                    <>
                      <Badge className="bg-blue-100 text-blue-700">Enrolled</Badge>
                      {isAdmin && <Button size="sm" variant="outline" className="rounded-md text-xs text-[#C5A55A] border-[#C5A55A]/30" onClick={() => handleComplete(c.course_id, user?.user_id)}>Mark Complete</Button>}
                    </>
                  )}
                </div>
              ) : (
                <Button size="sm" className="rounded-md bg-[#2E6CC4] text-xs" onClick={() => handleEnrol(c.course_id)} data-testid={`enrol-cpd-${c.course_id}`}>Enrol</Button>
              )}
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && <p className="col-span-full text-center py-8 text-slate-400">No CPD courses available</p>}
      </div>

      {/* CPD Tests */}
      {cpdTests.length > 0 && (
        <div className="space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">CPD Tests ({cpdTests.length})</h3>
          {takingQuiz ? (
            <Card className="rounded-md"><CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1B2A4A]">{takingQuiz.title}</h3>
                <Button variant="ghost" size="sm" onClick={() => { setTakingQuiz(null); setAnswers({}); }}>Close</Button>
              </div>
              {(takingQuiz.questions || []).map((q, idx) => (
                <div key={idx} className="bg-slate-50 rounded-md p-4">
                  <p className="text-sm font-medium mb-2"><span className="text-[#2E6CC4]">Q{q.number}.</span> {q.question}</p>
                  {q.options && <div className="grid grid-cols-2 gap-2">{Object.entries(q.options).map(([k, v]) => (
                    <button key={k} onClick={() => setAnswers({...answers, [q.number]: k})} className={`text-left px-3 py-2 rounded-md text-xs border-2 transition-all ${answers[q.number] === k ? 'border-[#2E6CC4] bg-blue-50 font-semibold' : 'border-slate-200'}`}><span className="font-bold mr-1">{k}.</span> {v}</button>
                  ))}</div>}
                  {q.marks && !q.options && <div className="mt-2"><Textarea placeholder="Write your answer..." rows={4} className="text-sm" onChange={e => setAnswers({...answers, [q.number]: e.target.value})} value={answers[q.number] || ''} /></div>}
                </div>
              ))}
              <Button className="w-full rounded-md bg-[#2E6CC4] h-11" onClick={async () => {
                try {
                  const res = await api.post(`/quiz/${takingQuiz.quiz_id}/submit`, { answers });
                  successToast(`Test submitted! Score: ${res.data.percentage}%`);
                  setTakingQuiz(null); setAnswers({});
                  api.get('/quiz/staff/cpd-tests').then(r => setCpdTests(r.data)).catch(() => {});
                } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
              }}>Submit Test</Button>
            </CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cpdTests.map(t => (
                <Card key={t.quiz_id} className="rounded-md border-blue-100 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center"><Award className="w-5 h-5 text-[#2E6CC4]" /></div>
                      <Badge className={t.quiz_type === 'essay' ? 'bg-amber-100 text-amber-700' : t.quiz_type === 'structured' ? 'bg-blue-100 text-[#1B2A4A]' : 'bg-blue-100 text-blue-700'}>{t.quiz_type === 'essay' ? 'Essay' : t.quiz_type === 'structured' ? 'Structured' : 'MCQ'}</Badge>
                    </div>
                    <h3 className="font-semibold text-[#1B2A4A] mb-1">{t.title}</h3>
                    <p className="text-xs text-slate-400 mb-3">{t.question_count} questions{t.total_marks ? ` | ${t.total_marks} marks` : ''}</p>
                    {t.my_submission ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
                        <span className="text-sm font-bold text-[#C5A55A]">{t.my_submission.percentage}%</span>
                      </div>
                    ) : (
                      <Button size="sm" className="rounded-md bg-[#1B2A4A] hover:bg-[#0E2E68] text-xs" onClick={() => { setTakingQuiz(t); setAnswers({}); }}>Take Test</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ isAdmin, user }) {
  const [reviews, setReviews] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ reviewee_id: '', cycle: 'Term 1 2025-2026', targets: '', strengths: '', areas_for_development: '', overall_rating: 3, action_items: '' });

  useEffect(() => {
    api.get('/performance/reviews').then(r => setReviews(r.data)).catch(() => {});
    if (isAdmin) api.get('/admin/staff').then(r => setTeachers(r.data)).catch(() => {});
  }, [isAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/performance/reviews', { ...form, targets: form.targets.split('\n').filter(Boolean).map(t => ({ text: t, status: 'pending' })) });
      toast.success('Review created');
      setDialog(false);
      const r = await api.get('/performance/reviews');
      setReviews(r.data);
    } catch (err) { toast.error('Failed'); }
  };

  const handleAction = async (id, action) => {
    try { await api.post(`/performance/reviews/${id}/${action}`); toast.success(`Review ${action}d`); const r = await api.get('/performance/reviews'); setReviews(r.data); } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="create-review-btn"><Plus className="w-4 h-4 mr-2" /> New Review</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Create Performance Review</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Staff Member</Label><Select value={form.reviewee_id} onValueChange={v => setForm({...form, reviewee_id: v})}><SelectTrigger className="h-9 text-xs" data-testid="review-staff"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Cycle</Label><Input value={form.cycle} onChange={e => setForm({...form, cycle: e.target.value})} className="h-9 text-xs" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Targets (one per line)</Label><Textarea value={form.targets} onChange={e => setForm({...form, targets: e.target.value})} rows={3} placeholder="Complete all lesson plans&#10;Improve marking turnaround&#10;Attend 2 CPD sessions" className="text-xs" data-testid="review-targets" /></div>
                <div className="space-y-1"><Label className="text-xs">Strengths</Label><Textarea value={form.strengths} onChange={e => setForm({...form, strengths: e.target.value})} rows={2} className="text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Areas for Development</Label><Textarea value={form.areas_for_development} onChange={e => setForm({...form, areas_for_development: e.target.value})} rows={2} className="text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Rating (1-5)</Label>
                  <div className="flex gap-1">{[1,2,3,4,5].map(v => <button key={v} type="button" onClick={() => setForm({...form, overall_rating: v})} className={`w-9 h-9 rounded-md text-sm font-bold ${form.overall_rating === v ? 'bg-[#2E6CC4] text-white' : 'bg-slate-100 text-slate-500'}`}>{v}</button>)}</div></div>
                <div className="space-y-1"><Label className="text-xs">Action Items</Label><Textarea value={form.action_items} onChange={e => setForm({...form, action_items: e.target.value})} rows={2} className="text-xs" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-review">Create Review</Button>
              </form></DialogContent></Dialog>
        </div>
      )}
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="bg-slate-50">Staff</TableHead><TableHead className="bg-slate-50">Cycle</TableHead><TableHead className="bg-slate-50">Rating</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {reviews.map(r => (
              <TableRow key={r.review_id} data-testid={`review-row-${r.review_id}`}>
                <TableCell className="font-medium">{r.reviewee_name} <span className="text-xs text-slate-400">({r.reviewee_role})</span></TableCell>
                <TableCell className="text-sm text-slate-500">{r.cycle}</TableCell>
                <TableCell><div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= r.overall_rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div></TableCell>
                <TableCell><Badge className={statusColors[r.status]}>{r.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.status === 'draft' && isAdmin && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleAction(r.review_id, 'submit')}>Submit</Button>}
                    {r.status === 'submitted' && r.reviewee_id === user?.user_id && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleAction(r.review_id, 'acknowledge')}>Acknowledge</Button>}
                    {r.status === 'acknowledged' && isAdmin && <Button size="sm" variant="ghost" className="text-xs h-7 text-[#C5A55A]" onClick={() => handleAction(r.review_id, 'approve')}>Approve</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {reviews.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">No reviews yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AssessmentTab({ isAdmin, user }) {
  const [papers, setPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ title: '', subject_id: '', paper_type: 'end_of_term', term: 'Term 1', total_marks: 100, duration_minutes: 120 });

  useEffect(() => {
    api.get('/assessment/papers').then(r => setPapers(r.data)).catch(() => {});
    api.get('/academic/subjects').then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.post('/assessment/papers', form); toast.success('Paper added to vault'); setDialog(false); const r = await api.get('/assessment/papers'); setPapers(r.data); } catch { toast.error('Failed'); }
  };

  const handleModerate = async (paperId, approved) => {
    try { await api.post(`/assessment/papers/${paperId}/moderate`, { approved, feedback: approved ? 'Approved' : 'Needs revision' }); toast.success(`Paper ${approved ? 'approved' : 'returned'}`); const r = await api.get('/assessment/papers'); setPapers(r.data); } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="create-paper-btn"><Plus className="w-4 h-4 mr-2" /> Add Paper</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Exam Paper</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="h-9 text-xs" data-testid="paper-title" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Subject</Label><Select value={form.subject_id} onValueChange={v => setForm({...form, subject_id: v})}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Type</Label><Select value={form.paper_type} onValueChange={v => setForm({...form, paper_type: v})}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mid_term">Mid Term</SelectItem><SelectItem value="end_of_term">End of Term</SelectItem><SelectItem value="mock">Mock Exam</SelectItem><SelectItem value="class_test">Class Test</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Total Marks</Label><Input type="number" value={form.total_marks} onChange={e => setForm({...form, total_marks: parseInt(e.target.value)})} className="h-9 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value)})} className="h-9 text-xs" /></div>
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-paper">Add to Vault</Button>
            </form></DialogContent></Dialog>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="bg-slate-50">Paper</TableHead><TableHead className="bg-slate-50">Subject</TableHead><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">Marks</TableHead><TableHead className="bg-slate-50">Moderation</TableHead>{isAdmin && <TableHead className="bg-slate-50">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {papers.map(p => (
              <TableRow key={p.paper_id} data-testid={`paper-row-${p.paper_id}`}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell className="text-sm text-slate-500">{p.subject_name}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs capitalize">{p.paper_type?.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell>{p.total_marks} ({p.duration_minutes}min)</TableCell>
                <TableCell><Badge className={statusColors[p.moderation_status]}>{p.moderation_status}</Badge></TableCell>
                {isAdmin && <TableCell>
                  {p.moderation_status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-[#C5A55A]" onClick={() => handleModerate(p.paper_id, true)}>Approve</Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-[#DC2626]" onClick={() => handleModerate(p.paper_id, false)}>Return</Button>
                    </div>
                  )}
                </TableCell>}
              </TableRow>
            ))}
            {papers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No exam papers in vault</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


const BACKEND = import.meta.env.VITE_API_URL;

function MaterialsTab({ isAdmin, user }) {
  const [materials, setMaterials] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', file_ids: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [viewingPdf, setViewingPdf] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const fileRef = React.useRef(null);

  useEffect(() => { api.get('/cpd/materials').then(r => setMaterials(r.data)).catch(() => {}); }, []);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const fd = new FormData(); fd.append('file', file);
        const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const fid = res.data.file_id;
        setForm(prev => ({ ...prev, file_ids: [...prev.file_ids, fid] }));
        setUploadedFiles(prev => [...prev, { id: fid, name: file.name, size: file.size }]);
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cpd/materials', form);
      successToast('Material added');
      setDialog(false); setForm({ title: '', description: '', category: 'General', file_ids: [] }); setUploadedFiles([]);
      const r = await api.get('/cpd/materials'); setMaterials(r.data);
    } catch { toast.error('Failed'); }
  };

  const handlePublish = async (id) => {
    try { await api.post(`/cpd/materials/${id}/publish`); successToast('Published to all staff'); const r = await api.get('/cpd/materials'); setMaterials(r.data); } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    try { await api.delete(`/cpd/materials/${id}`); successToast('Deleted'); const r = await api.get('/cpd/materials'); setMaterials(r.data); } catch { toast.error('Failed'); }
  };

  const viewPdf = async (mat) => {
    if (mat.file_ids?.length > 0) {
      try {
        const token = localStorage.getItem('rw_token');
        const resp = await fetch(`${BACKEND}/api/files/${mat.file_ids[0]}/preview`, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await resp.blob();
        setPdfUrl(URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })));
        setViewingPdf(mat);
      } catch { toast.error('Cannot preview'); }
    }
  };

  if (viewingPdf && pdfUrl) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); setViewingPdf(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h2 className="text-sm font-semibold text-[#1B2A4A]">{viewingPdf.title}</h2>
        <div className="bg-white rounded-md border overflow-hidden" style={{ height: 'calc(100vh - 16rem)' }}>
          <embed src={pdfUrl} type="application/pdf" className="w-full h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]"><Plus className="w-4 h-4 mr-2" /> Add Reading Material</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add Reading Material</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} /></div>
                <div className="space-y-1"><Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['General','Pedagogy','Technology','Leadership','Subject-Specific','Safeguarding','Policy'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1">
                  <Label className="text-xs">Upload PDF Files</Label>
                  <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.pptx" onChange={handleUpload} />
                  <Button type="button" variant="outline" className="w-full rounded-md border-dashed border-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload Files'}
                  </Button>
                  {uploadedFiles.map(f => <div key={f.id} className="flex items-center gap-2 bg-slate-50 rounded px-3 py-1.5 text-xs"><FileText className="w-3 h-3 text-slate-400" /><span className="flex-1 truncate">{f.name}</span></div>)}
                </div>
                <div className="sticky bottom-0 bg-white pt-3 border-t"><Button type="submit" className="w-full rounded-md bg-[#2E6CC4]">Save Material</Button></div>
              </form></DialogContent></Dialog>
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map(m => (
          <Card key={m.material_id} className={`rounded-md border-slate-100 card-hover ${m.file_ids?.length > 0 ? 'cursor-pointer' : ''}`} onClick={m.file_ids?.length > 0 ? () => viewPdf(m) : undefined}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-md bg-indigo-50 flex items-center justify-center"><FileText className="w-5 h-5 text-indigo-600" /></div>
                <div className="flex gap-1">{m.published ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Published</Badge> : <Badge className="bg-slate-100 text-slate-600">Draft</Badge>}<Badge variant="secondary" className="text-[10px]">{m.category}</Badge></div>
              </div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">{m.title}</h3>
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{m.description}</p>
              {m.file_ids?.length > 0 && <p className="text-xs text-[#2E6CC4]"><Eye className="w-3 h-3 inline mr-1" />Click to view PDF</p>}
              {isAdmin && <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                {!m.published && <Button size="sm" variant="outline" className="text-xs rounded-md text-[#2E6CC4]" onClick={() => handlePublish(m.material_id)}><Send className="w-3 h-3 mr-1" /> Publish</Button>}
                <Button size="sm" variant="ghost" className="text-xs text-red-500" onClick={() => handleDelete(m.material_id)}><Trash2 className="w-3 h-3" /></Button>
              </div>}
            </CardContent>
          </Card>
        ))}
        {materials.length === 0 && <p className="col-span-full text-center py-12 text-slate-400">No reading materials yet</p>}
      </div>
    </div>
  );
}


function PromotionTab({ isAdmin, user }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/cpd/promotion-check').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1B2A4A]">Promotion Eligibility</h2>
        <p className="text-xs text-slate-400">Based on completed CPD courses and test performance</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-md"><CardContent className="p-5 text-center"><TrendingUp className="w-8 h-8 text-[#C5A55A] mx-auto mb-2" /><p className="text-3xl font-bold text-[#C5A55A]">{data.filter(d => d.eligible).length}</p><p className="text-xs text-slate-500">Eligible for Promotion</p></CardContent></Card>
        <Card className="rounded-md"><CardContent className="p-5 text-center"><Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" /><p className="text-3xl font-bold text-amber-600">{data.filter(d => !d.eligible).length}</p><p className="text-xs text-slate-500">Not Yet Eligible</p></CardContent></Card>
        <Card className="rounded-md"><CardContent className="p-5 text-center"><Users className="w-8 h-8 text-[#2E6CC4] mx-auto mb-2" /><p className="text-3xl font-bold">{data.length}</p><p className="text-xs text-slate-500">Total Staff Reviewed</p></CardContent></Card>
      </div>

      {/* Criteria info */}
      <Card className="rounded-md bg-blue-50/50 border-blue-100"><CardContent className="p-4">
        <h3 className="text-sm font-semibold text-[#1B2A4A] mb-2">Promotion Criteria</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-white rounded p-3 border"><p className="font-semibold text-[#2E6CC4]">Teacher → Senior Teacher</p><p className="text-slate-500 mt-1">3+ CPD courses completed</p><p className="text-slate-500">70%+ average test score</p></div>
          <div className="bg-white rounded p-3 border"><p className="font-semibold text-[#2E6CC4]">Senior → Lead Teacher</p><p className="text-slate-500 mt-1">5+ CPD courses completed</p><p className="text-slate-500">75%+ average test score</p></div>
          <div className="bg-white rounded p-3 border"><p className="font-semibold text-amber-600">Lead → Head of Department</p><p className="text-slate-500 mt-1">8+ CPD courses completed</p><p className="text-slate-500">80%+ average test score</p></div>
        </div>
      </CardContent></Card>

      {/* Staff table */}
      <div className="bg-white rounded-md border overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Staff Member</TableHead>
            <TableHead className="text-center">Current Level</TableHead>
            <TableHead className="text-center">CPD Completed</TableHead>
            <TableHead className="text-center">Avg Test Score</TableHead>
            <TableHead className="text-center">Reviews</TableHead>
            <TableHead className="text-center">Next Level</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.user_id}>
                <TableCell><p className="text-sm font-medium">{d.name}</p><p className="text-[10px] text-slate-400">{d.email}</p></TableCell>
                <TableCell className="text-center"><Badge variant="secondary" className="text-[10px]">{d.current_level}</Badge></TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-bold ${d.completed_courses >= d.required_courses ? 'text-[#C5A55A]' : 'text-slate-500'}`}>{d.completed_courses}</span>
                  <span className="text-[10px] text-slate-400">/{d.required_courses}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-bold ${d.avg_test_score >= d.required_score ? 'text-[#C5A55A]' : 'text-slate-500'}`}>{d.avg_test_score}%</span>
                  <span className="text-[10px] text-slate-400"> (min {d.required_score}%)</span>
                </TableCell>
                <TableCell className="text-center text-sm">{d.reviews_count} <span className="text-xs text-slate-400">({d.avg_review_rating}/5)</span></TableCell>
                <TableCell className="text-center"><Badge className="bg-blue-100 text-[#1B2A4A] text-[10px]">{d.next_level}</Badge></TableCell>
                <TableCell className="text-center">
                  {d.eligible
                    ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]"><CheckCircle className="w-3 h-3 mr-1" />Eligible</Badge>
                    : <Badge className="bg-slate-100 text-slate-500"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>
                  }
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">No staff data available</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
