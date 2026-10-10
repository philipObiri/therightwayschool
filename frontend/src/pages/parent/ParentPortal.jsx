import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import TimetableWidget from '../../components/TimetableWidget';
import {
  GraduationCap, BookOpen, BarChart3, DollarSign, Calendar,
  Clock, Upload, Download, CreditCard, Smartphone, Building,
  ArrowLeft, User, Paperclip, CheckCircle, AlertCircle, ShieldCheck, Eye, FileText, PenSquare, Presentation
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';
import FileViewerModal from '../../components/FileViewerModal';

const BACKEND = import.meta.env.VITE_API_URL;

const subjectIcons = {
  'Mathematics': '📐', 'Extended Mathematics': '📐', 'English Language': '📖',
  'Biology': '🧬', 'Chemistry': '⚗️', 'Physics': '⚡', 'French': '🇫🇷',
  'Coordinated Science': '🔬', 'Information Technology': '💻',
  'Economics': '📊', 'Business Studies': '💼', 'Accounting': '🧮',
  'Geography': '🌍', 'Art and Design': '🎨', 'Sociology': '👥',
  'Christian Doctrine': '✝️', 'Global Perspectives': '🌐',
};

export default function ParentPortal() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childDetail, setChildDetail] = useState(null);
  const [grades, setGrades] = useState([]);
  const [financeProfile, setFinanceProfile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('momo');
  const [payReference, setPayReference] = useState('');
  const [payFile, setPayFile] = useState(null);
  const [payFileName, setPayFileName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectDetail, setSubjectDetail] = useState(null);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [payOnlineDialog, setPayOnlineDialog] = useState(false);
  const [onlinePayAmount, setOnlinePayAmount] = useState('');
  const [processingOnline, setProcessingOnline] = useState(false);
  const [docViewer, setDocViewer] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);


  const openDocument = async (docId, docType, docTitle) => {
    setDocViewer({ title: docTitle, type: docType, content: null, loading: true, fileIds: [] });
    try {
      let endpoint;
      if (docType === 'scheme') endpoint = 'schemes';
      else if (docType === 'lesson') endpoint = 'lessons-v2';
      else if (docType === 'lecture') endpoint = 'lectures';
      else endpoint = 'assignments';

      const r = await api.get(`/${endpoint}/${docId}`);
      const data = r.data;
      let html = '';
      const fileIds = [...(data.file_ids || []).map(f => typeof f === 'string' ? f : f?.file_id).filter(Boolean)];
      if (data.original_file_id) fileIds.push(data.original_file_id);

      if (docType === 'scheme') {
        html = data.rich_content || '';
        if (!html && data.weeks && data.weeks.length > 0) {
          html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#1B2A4A;color:white;">' +
            '<th style="padding:8px;border:1px solid #334155;">Week</th><th style="padding:8px;border:1px solid #334155;">Topic</th>' +
            '<th style="padding:8px;border:1px solid #334155;">Objectives</th><th style="padding:8px;border:1px solid #334155;">Activities</th></tr></thead><tbody>' +
            data.weeks.map((w, i) => `<tr><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${w.week_number || i+1}</td><td style="padding:8px;border:1px solid #e2e8f0;">${w.topic || ''}</td><td style="padding:8px;border:1px solid #e2e8f0;">${w.objectives || ''}</td><td style="padding:8px;border:1px solid #e2e8f0;">${w.activities || ''}</td></tr>`).join('') +
            '</tbody></table>';
        }
        if (html) html = `<div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;"><h3 style="margin:0;color:#1B2A4A;">${data.title || data.subject_name || ''}</h3><p style="margin:4px 0 0;color:#64748b;font-size:12px;">${data.subject_name || ''} | ${data.year_group || ''} | ${data.term || ''} | ${data.teacher_name || ''}</p></div>` + html;
      } else if (docType === 'lesson') {
        html = data.rich_content || data.content_html || data.content_text || '';
        if (html) html = `<div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;"><h3 style="margin:0;color:#1B2A4A;">${data.title || ''}</h3><p style="margin:4px 0 0;color:#64748b;font-size:12px;">${data.subject_name || ''} | ${data.year_group || ''} | ${data.teacher_name || ''}</p>${data.objectives ? `<p style="margin:6px 0 0;font-size:13px;"><strong>Objectives:</strong> ${data.objectives}</p>` : ''}</div>` + html;
      } else if (docType === 'assignment') {
        const parts = [];
        if (data.instructions) parts.push(data.instructions);
        if (data.description) parts.push(data.description);
        if (data.rich_content) parts.push(data.rich_content);
        html = parts.join('<hr style="margin:12px 0"/>');
        if (html) html = `<div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;"><h3 style="margin:0;color:#1B2A4A;">${data.title || ''}</h3><p style="margin:4px 0 0;color:#64748b;font-size:12px;">${data.subject || ''} | Due: ${data.due_date ? new Date(data.due_date).toLocaleDateString() : 'N/A'}</p></div>` + html;
      }

      if (!html) html = '<div style="text-align:center;padding:40px 0;color:#94a3b8;">No viewable content — check attached files below</div>';
      setDocViewer(prev => ({ ...prev, content: html, loading: false, fileIds }));
    } catch {
      setDocViewer(prev => ({ ...prev, content: '<div style="text-align:center;padding:40px 0;color:#ef4444;">Failed to load document</div>', loading: false }));
    }
  };

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const childIds = user?.children_ids || [];
        const kids = [];
        for (const id of childIds) {
          try {
            const res = await api.get(`/admin/students/${id}`);
            kids.push(res.data);
          } catch (err) { console.error("Parent portal error:", err); }
        }
        setChildren(kids);
        if (kids.length === 1) selectChild(kids[0]);
      } catch (err) { console.error("Parent portal error:", err); }
      setLoading(false);
    };
    if (user) fetchChildren();
  }, [user, activeTerm]);

  const selectChild = async (child) => {
    setSelectedChild(child);
    setTab('overview');
    try {
      const [gradesRes, finRes] = await Promise.all([
        api.get('/gradebook/entries', { params: { student_id: child.user_id, term: activeTerm } }),
        api.get(`/finance/student-profile/${child.user_id}`).catch(() =>
          api.get(`/academic/child-finance?student_id=${child.user_id}`).then(r => ({
            data: { summary: { total_billed: r.data.total_fees, total_paid: r.data.total_paid, balance: r.data.balance }, invoices: r.data.invoices, payments: r.data.payments }
          }))
        ).catch(() => ({ data: { summary: { total_billed: 0, total_paid: 0, balance: 0 }, invoices: [], payments: [] } })),
      ]);
      setGrades(gradesRes.data);
      setFinanceProfile(finRes.data);
      setChildDetail(child);
    } catch (err) { console.error("Parent portal error:", err); }
  };

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (file) { setPayFile(file); setPayFileName(file.name); }
    e.target.value = '';
  };

  const handleSubmitPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) { toast.error('Enter the amount you paid'); return; }
    setUploading(true);
    try {
      let proofFileId = '';
      // Upload proof file if provided
      if (payFile) {
        const fd = new FormData(); fd.append('file', payFile);
        const uploadRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        proofFileId = uploadRes.data.file_id;
      }
      // Record payment with amount + proof
      await api.post('/finance/payments', {
        student_id: selectedChild.user_id,
        amount: parseFloat(payAmount),
        method: payMethod,
        reference: payReference || `Payment by ${user?.name} for ${selectedChild.name}`,
        payer_name: user?.name || 'Parent',
        proof_file_id: proofFileId,
      });
      toast.success(`Payment of TT$ ${parseFloat(payAmount).toLocaleString()} submitted successfully!`);
      setUploadDialog(false);
      setPayAmount(''); setPayMethod('momo'); setPayReference(''); setPayFile(null); setPayFileName('');
      // Refresh finance data
      const finRes = await api.get(`/finance/student-profile/${selectedChild.user_id}`);
      setFinanceProfile(finRes.data);
    } catch { toast.error('Submission failed. Please try again.'); }
    setUploading(false);
  };

  if (loading) return <AppLoader />;

  const openSubject = async (subj) => {
    setSelectedSubject(subj);
    setSubjectLoading(true);
    try {
      const res = await api.get(`/academic/child-subject-detail?student_id=${selectedChild.user_id}&subject_id=${subj.subject_id}`);
      setSubjectDetail(res.data);
    } catch { setSubjectDetail(null); }
    setSubjectLoading(false);
  };

  const handlePayOnline = async () => {
    const amount = parseFloat(onlinePayAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!selectedChild) { toast.error('No child selected'); return; }
    setProcessingOnline(true);
    try {
      const res = await api.post('/paystack/initialize', {
        amount,
        student_id: selectedChild.user_id,
        email: user?.email,
        callback_url: `${BACKEND}/api/paystack/verify`,
      });
      const { authorization_url, reference } = res.data;
      // Open Paystack payment page
      const payWindow = window.open(authorization_url, '_blank', 'width=600,height=700');
      // Poll for verification
      const pollInterval = setInterval(async () => {
        try {
          const verify = await api.get(`/paystack/verify/${reference}`);
          if (verify.data.status === 'success') {
            clearInterval(pollInterval);
            setPayOnlineDialog(false);
            setOnlinePayAmount('');
            successToast(`Payment of TT$ ${amount.toLocaleString()} successful!`);
            selectChild(selectedChild); // Refresh data
          }
        } catch { /* still pending */ }
        // Stop polling if window was closed
        if (payWindow && payWindow.closed) {
          clearInterval(pollInterval);
          setProcessingOnline(false);
          // Try verify one more time
          try {
            const verify = await api.get(`/paystack/verify/${reference}`);
            if (verify.data.status === 'success') {
              setPayOnlineDialog(false);
              setOnlinePayAmount('');
              successToast(`Payment of TT$ ${amount.toLocaleString()} successful!`);
              selectChild(selectedChild);
            }
          } catch {}
        }
      }, 3000);
      // Stop after 10 minutes
      setTimeout(() => clearInterval(pollInterval), 600000);
    } catch (e) { toast.error(e.response?.data?.detail || 'Payment initialization failed'); }
    setProcessingOnline(false);
  };

  // Child selector if multiple children
  if (!selectedChild) {
    return (
      <div className="space-y-6" data-testid="parent-portal">
        <div className="relative rounded-md overflow-hidden h-36">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] to-[#2E6CC4]" />
          <div className="absolute inset-0 flex items-center px-8"><div><h1 className="text-2xl font-bold text-white">Welcome, {user?.name}</h1><p className="text-white/70 mt-1">Select your child to view their information</p></div></div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => (
            <Card key={child.user_id} className="rounded-md border-slate-200 card-hover cursor-pointer" onClick={() => selectChild(child)}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{child.name?.charAt(0)}</div>
                <div><h3 className="font-semibold text-[#1B2A4A]">{child.name}</h3><p className="text-xs text-slate-500">{child.year_group} | {child.admission_number}</p></div>
              </CardContent>
            </Card>
          ))}
          {children.length === 0 && <p className="col-span-full text-center py-12 text-slate-400">No wards linked to your account. Contact the school admin.</p>}
        </div>
      </div>
    );
  }

  const summary = financeProfile?.summary || { total_billed: 0, total_paid: 0, balance: 0 };
  const invoices = financeProfile?.invoices || [];
  const payments = financeProfile?.payments || [];
  const mySubjects = childDetail?.subjects || [];
  const avgGrade = grades.length > 0 ? (grades.reduce((s, g) => s + (g.final_score || 0), 0) / grades.length).toFixed(1) : null;

  return (
    <>
    <div className="space-y-6" data-testid="parent-child-view">
      {children.length > 1 && <Button variant="ghost" size="sm" onClick={() => { setSelectedChild(null); setChildDetail(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Switch Child</Button>}

      {/* Child header */}
      <div className="bg-white rounded-md border border-slate-200 p-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{selectedChild.name?.charAt(0)}</div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#1B2A4A]">{selectedChild.name}</h2>
          <div className="flex gap-2 mt-1"><Badge variant="secondary">{selectedChild.year_group}</Badge><Badge variant="secondary">{selectedChild.admission_number}</Badge><Badge className="bg-blue-100 text-[#1B2A4A]">{selectedChild.boarding_status}</Badge></div>
        </div>
        {avgGrade && <div className="text-center"><p className="text-2xl font-bold text-[#2E6CC4]">{avgGrade}%</p><p className="text-[10px] text-slate-500">Average</p></div>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border"><TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger><TabsTrigger value="subjects" className="text-xs">Subjects</TabsTrigger><TabsTrigger value="grades" className="text-xs">Grades</TabsTrigger><TabsTrigger value="timetable" className="text-xs">Timetable</TabsTrigger><TabsTrigger value="fees" className="text-xs">Fees & Payments</TabsTrigger></TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card text-center"><BookOpen className="w-6 h-6 text-[#2E6CC4] mx-auto mb-1" /><p className="text-xl font-bold">{mySubjects.length}</p><p className="text-xs text-slate-500">Subjects</p></div>
            <div className="stat-card text-center"><BarChart3 className="w-6 h-6 text-[#C5A55A] mx-auto mb-1" /><p className="text-xl font-bold">{grades.length}</p><p className="text-xs text-slate-500">Grades Recorded</p></div>
            <div className="stat-card text-center bg-[#C5A55A]/10"><DollarSign className="w-6 h-6 text-[#C5A55A] mx-auto mb-1" /><p className="text-xl font-bold text-[#C5A55A]">TT$ {summary.total_paid.toLocaleString()}</p><p className="text-xs text-slate-500">Fees Paid</p></div>
            <div className="stat-card text-center bg-red-50"><AlertCircle className="w-6 h-6 text-[#DC2626] mx-auto mb-1" /><p className="text-xl font-bold text-[#DC2626]">TT$ {summary.balance.toLocaleString()}</p><p className="text-xs text-slate-500">Balance</p></div>
          </div>
          <TimetableWidget compact studentId={selectedChild?.user_id} />
        </TabsContent>

        {/* Subjects */}
        <TabsContent value="subjects" className="mt-4">
          {selectedSubject ? (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedSubject(null); setSubjectDetail(null); }}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects
              </Button>
              <div className="bg-white rounded-md border border-slate-200 p-5 flex items-center gap-4">
                <div className="text-4xl">{subjectIcons[selectedSubject.name] || '\uD83D\uDCDA'}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1B2A4A]">{selectedSubject.name}</h3>
                  <p className="text-xs text-slate-400">{selectedSubject.code} | {selectedChild?.year_group}</p>
                </div>
                {subjectDetail?.teacher && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Teacher</p>
                    <p className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1"><User className="w-3.5 h-3.5" />{subjectDetail.teacher.name}</p>
                    {subjectDetail.teacher.department && <p className="text-[10px] text-slate-400">{subjectDetail.teacher.department}</p>}
                  </div>
                )}
              </div>

              {subjectLoading ? (
                <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-[#2E6CC4] border-t-transparent rounded-full" /></div>
              ) : subjectDetail ? (
                <div className="space-y-5">
                  {/* Latest Scores Grid */}
                  {Object.keys(subjectDetail.latest_scores || {}).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        {key:'classwork',label:'Classwork',color:'#2E6CC4'},
                        {key:'progressive_test_1',label:'Prog. 1',color:'#7C3AED'},
                        {key:'progressive_test_2',label:'Prog. 2',color:'#7C3AED'},
                        {key:'progressive_test_3',label:'Prog. 3',color:'#7C3AED'},
                        {key:'mid_term',label:'Mid Term',color:'#C5A55A'},
                        {key:'end_of_term',label:'End of Term',color:'#059669'},
                      ].map(({key,label,color}) => {
                        const s = subjectDetail.latest_scores[key];
                        return (
                          <div key={key} className="bg-white rounded-md border border-slate-100 p-3 text-center">
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
                            {s ? (
                              <><p className="text-xl font-bold mt-1" style={{color}}>{s.score}%</p><Badge className="mt-1 text-[9px]" style={{background:`${color}15`,color}}>{s.grade}</Badge></>
                            ) : (
                              <p className="text-sm text-slate-300 mt-2">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Performance Graph */}
                  {subjectDetail.performance_trend?.length > 1 && (
                    <Card className="rounded-md border-slate-200">
                      <CardHeader className="py-3 px-5 bg-slate-50 rounded-t-md border-b"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#2E6CC4]" />Performance Trend</CardTitle></CardHeader>
                      <CardContent className="p-4">
                        <div className="flex items-end gap-1 h-40">
                          {subjectDetail.performance_trend.map((p, i) => {
                            const barH = Math.max(8, (p.score / 100) * 140);
                            const barColor = p.score >= 80 ? '#C5A55A' : p.score >= 60 ? '#2E6CC4' : p.score >= 45 ? '#F59E0B' : '#DC2626';
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-[#1B2A4A] text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap z-10">{p.score}%</div>
                                <div className="w-full max-w-[36px] rounded-t transition-all duration-300 group-hover:opacity-80" style={{height: `${barH}px`, background: barColor}} />
                                <p className="text-[7px] text-slate-400 mt-1 text-center leading-tight truncate w-full">{p.label}</p>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Approved Lesson Plans */}
                  {subjectDetail.lessons?.length > 0 && (
                    <Card className="rounded-md border-slate-200">
                      <CardHeader className="py-3 px-5 bg-slate-50 rounded-t-md border-b"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-[#7C3AED]" />Lesson Plans ({subjectDetail.lessons.length})</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Week</TableHead><TableHead>Term</TableHead><TableHead>Teacher</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>{subjectDetail.lessons.map(l => (
                          <TableRow key={l.lesson_id} className="cursor-pointer hover:bg-blue-50/50" onClick={() => openDocument(l.lesson_id, 'lesson', l.title)} data-testid={`lesson-row-${l.lesson_id}`}>
                            <TableCell className="font-medium text-sm">{l.title}</TableCell><TableCell className="text-xs">Week {l.week_number}</TableCell><TableCell className="text-xs">{l.term}</TableCell><TableCell className="text-xs">{l.teacher_name}</TableCell><TableCell><Badge className="bg-emerald-50 text-emerald-700 text-[10px]">{l.status}</Badge></TableCell>
                            <TableCell><Eye className="w-3.5 h-3.5 text-slate-300" /></TableCell>
                          </TableRow>
                        ))}</TableBody></Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Scheme of Work */}
                  <Card className="rounded-md border-slate-200">
                    <CardHeader className="py-3 px-5 bg-slate-50 rounded-t-md border-b"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#C5A55A]" />Scheme of Work ({subjectDetail.schemes?.length || 0})</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {subjectDetail.schemes?.length > 0 ? (
                        <Table><TableHeader><TableRow><TableHead>Term</TableHead><TableHead>Title</TableHead><TableHead>Teacher</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>{subjectDetail.schemes.map(s => (
                          <TableRow key={s.scheme_id} className="cursor-pointer hover:bg-amber-50/50" onClick={() => openDocument(s.scheme_id, 'scheme', s.title)} data-testid={`scheme-row-${s.scheme_id}`}>
                            <TableCell className="text-sm">{s.term}</TableCell><TableCell className="font-medium text-sm">{s.title}</TableCell><TableCell className="text-xs">{s.teacher_name}</TableCell><TableCell><Badge className="bg-[#C5A55A]/10 text-[#C5A55A] text-[10px]">{s.status}</Badge></TableCell>
                            <TableCell><Eye className="w-3.5 h-3.5 text-slate-300" /></TableCell>
                          </TableRow>
                        ))}</TableBody></Table>
                      ) : <p className="text-center py-6 text-slate-400 text-sm">No approved schemes yet</p>}
                    </CardContent>
                  </Card>

                  {/* Assignments */}
                  <Card className="rounded-md border-slate-200">
                    <CardHeader className="py-3 px-5 bg-slate-50 rounded-t-md border-b"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#2E6CC4]" />Assignments ({subjectDetail.assignments?.length || 0})</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {subjectDetail.assignments?.length > 0 ? (
                        <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Due</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>{subjectDetail.assignments.map(a => (
                          <TableRow key={a.assignment_id} className="cursor-pointer hover:bg-blue-50/50" onClick={() => openDocument(a.assignment_id, 'assignment', a.title)} data-testid={`assignment-row-${a.assignment_id}`}>
                            <TableCell className="font-medium text-sm">{a.title}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{a.type || 'Assignment'}</Badge></TableCell>
                            <TableCell className="text-xs text-slate-500">{a.due_date ? new Date(a.due_date).toLocaleDateString() : '-'}</TableCell>
                            <TableCell className="text-xs font-bold">{a.submission ? `${a.submission.score || '-'}` : '-'}</TableCell>
                            <TableCell>{a.submission ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">Submitted</Badge> : <Badge className="bg-amber-50 text-amber-700 text-[10px]">Pending</Badge>}</TableCell>
                            <TableCell><Eye className="w-3.5 h-3.5 text-slate-300" /></TableCell>
                          </TableRow>
                        ))}</TableBody></Table>
                      ) : <p className="text-center py-6 text-slate-400 text-sm">No assignments posted yet</p>}
                    </CardContent>
                  </Card>

                  {/* Teacher Reports (forwarded to parent) */}
                  {subjectDetail.parent_reports?.length > 0 && (
                    <Card className="rounded-md border-red-100">
                      <CardHeader className="py-3 px-5 bg-red-50/50 rounded-t-md border-b border-red-100"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" />Teacher Reports ({subjectDetail.parent_reports.length})</CardTitle></CardHeader>
                      <CardContent className="divide-y">
                        {subjectDetail.parent_reports.map(r => (
                          <div key={r.report_id} className="py-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-[#1B2A4A]">{r.title}</span>
                              <Badge className={`text-[9px] ${r.severity === 'warning' ? 'bg-amber-100 text-amber-700' : r.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{r.severity}</Badge>
                            </div>
                            <p className="text-xs text-slate-600">{r.content}</p>
                            <p className="text-[10px] text-slate-400 mt-1">By {r.teacher_name} &middot; {new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Resources */}
                  {subjectDetail.resources?.length > 0 && (
                    <Card className="rounded-md border-slate-200">
                      <CardHeader className="py-3 px-5 bg-slate-50 rounded-t-md border-b"><CardTitle className="text-sm flex items-center gap-2"><Download className="w-4 h-4 text-[#F59E0B]" />Resources ({subjectDetail.resources.length})</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Teacher</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                        <TableBody>{subjectDetail.resources.map(r => (
                          <TableRow key={r.resource_id}><TableCell className="font-medium text-sm">{r.title || r.file_name || 'Resource'}</TableCell><TableCell><Badge variant="secondary" className="text-[10px] capitalize">{r.resource_type || r.type || 'Document'}</Badge></TableCell><TableCell className="text-xs">{r.teacher_name}</TableCell>
                          <TableCell>{r.file_id && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => window.open(`${BACKEND}/api/files/${r.file_id}`, '_blank')}><Download className="w-3 h-3 mr-1" />View</Button>}</TableCell></TableRow>
                        ))}</TableBody></Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : <p className="text-center py-8 text-slate-400">Failed to load subject details</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {mySubjects.map((s, i) => (
                <div key={s.subject_id || i}
                  className="bg-white rounded-md border border-slate-200 p-4 cursor-pointer hover:border-[#2E6CC4] hover:shadow-md transition-all"
                  onClick={() => openSubject(s)} data-testid={`subject-tile-${s.code}`}>
                  <div className="text-3xl mb-2">{subjectIcons[s.name] || '📚'}</div>
                  <h3 className="text-sm font-bold text-[#1B2A4A]">{s.name}</h3>
                  <p className="text-[10px] text-slate-400">{s.code}</p>
                  <p className="text-[10px] text-[#2E6CC4] mt-1 font-medium">Tap to view details →</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Grades */}
        <TabsContent value="grades" className="mt-4">
          <Card className="rounded-md border-slate-200"><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Subject</TableHead><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">CA</TableHead><TableHead className="bg-slate-50">Exam</TableHead><TableHead className="bg-slate-50">Final</TableHead><TableHead className="bg-slate-50">Grade</TableHead><TableHead className="bg-slate-50">Comment</TableHead></TableRow></TableHeader>
            <TableBody>{grades.map((g, i) => (
              <TableRow key={i}><TableCell className="font-medium">{g.subject_name}</TableCell><TableCell><Badge variant="secondary" className="text-[10px] capitalize">{(g.score_type||'').replace(/_/g,' ')}</Badge></TableCell><TableCell>{g.ca_score}/{g.ca_max}</TableCell><TableCell>{g.exam_score}/{g.exam_max}</TableCell><TableCell className={`font-bold ${g.final_score>=60?'text-[#C5A55A]':g.final_score>=40?'text-[#F59E0B]':'text-[#DC2626]'}`}>{g.final_score}%</TableCell><TableCell><Badge className={g.grade_letter==='A'||g.grade_letter==='B+'?'bg-[#C5A55A]/15 text-[#C5A55A]':'bg-amber-100 text-amber-700'}>{g.grade_letter}</Badge></TableCell><TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{g.teacher_comment||'-'}</TableCell></TableRow>
            ))}{grades.length===0&&<TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">No grades for {activeTerm} yet</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        {/* Timetable */}
        <TabsContent value="timetable" className="mt-4">
          <TimetableWidget studentId={selectedChild?.user_id} />
        </TabsContent>

        {/* Fees & Payments */}
        <TabsContent value="fees" className="mt-4 space-y-4">
          {/* Balance summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card text-center"><p className="text-xl font-bold">TT$ {summary.total_billed.toLocaleString()}</p><p className="text-xs text-slate-500">Total Fee</p></div>
            <div className="stat-card text-center bg-[#C5A55A]/10"><p className="text-xl font-bold text-[#C5A55A]">TT$ {summary.total_paid.toLocaleString()}</p><p className="text-xs text-slate-500">Paid</p></div>
            <div className="stat-card text-center bg-red-50"><p className="text-xl font-bold text-[#DC2626]">TT$ {summary.balance.toLocaleString()}</p><p className="text-xs text-slate-500">Balance Owing</p></div>
          </div>

          {/* Payment Methods */}
          <Card className="rounded-md border-[#2E6CC4]/20 bg-blue-50/30">
            <CardHeader><CardTitle className="text-sm">Payment Methods</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div className="bg-white rounded-md border border-slate-200 p-3">
                  <Building className="w-5 h-5 text-[#1B2A4A] mb-2" />
                  <p className="text-xs font-bold text-[#1B2A4A]">Bank Transfer (GH¢)</p>
                  <p className="text-[10px] text-slate-600 mt-1 font-semibold">Guaranty Trust Bank Limited</p>
                  <p className="text-[10px] text-slate-500">Acc No: <strong>3220001041098</strong></p>
                  <p className="text-[10px] text-slate-600 mt-1 font-semibold">Zenith Bank Ghana Limited</p>
                  <p className="text-[10px] text-slate-500">Acc No: <strong>6010718872</strong> (Spintex)</p>
                  <p className="text-[10px] text-slate-400 mt-1">Name: The RightWay Centre of Learning</p>
                  <p className="text-[10px] text-[#DC2626] mt-1">Email proof to: finance@rightwaycentre.tt</p>
                </div>
                <div className="bg-white rounded-md border border-slate-200 p-3">
                  <Smartphone className="w-5 h-5 text-[#F59E0B] mb-2" />
                  <p className="text-xs font-bold text-[#1B2A4A]">Mobile Money</p>
                  <p className="text-[10px] text-slate-600 mt-1"><strong>Merchant Name:</strong> The RightWay Centre of Learning</p>
                  <p className="text-[10px] text-slate-600"><strong>Merchant ID:</strong> 727799</p>
                  <p className="text-[10px] text-slate-600"><strong>Other Networks:</strong> 0593227076</p>
                  <p className="text-[10px] text-[#DC2626] font-semibold mt-2">Reference: Ward's name + purpose</p>
                  <p className="text-[10px] text-slate-400">e.g. "Ayeyi Forson - School Fees"</p>
                </div>
                <div className="bg-white rounded-md border border-slate-200 p-3">
                  <CreditCard className="w-5 h-5 text-[#2E6CC4] mb-2" />
                  <p className="text-xs font-bold text-[#1B2A4A]">US Dollar Accounts</p>
                  <p className="text-[10px] text-slate-600 mt-1 font-semibold">GT Bank Ghana</p>
                  <p className="text-[10px] text-slate-500">Acc: <strong>220108135220</strong></p>
                  <p className="text-[10px] text-slate-500">SWIFT: GTBIGHAC</p>
                  <p className="text-[10px] text-slate-600 mt-1 font-semibold">Zenith Bank Ghana</p>
                  <p className="text-[10px] text-slate-500">Acc: <strong>6040713747</strong> | SWIFT: ZEBLGHAC</p>
                  <p className="text-[10px] text-slate-400 mt-1">GH¢ rate: Call +233260499911</p>
                </div>
              </div>
              <Button className="w-full rounded-md bg-[#C5A55A]" onClick={() => setUploadDialog(true)} data-testid="upload-proof-btn">
                <Upload className="w-4 h-4 mr-2" /> Submit Payment & Upload Proof
              </Button>
              <Button className="w-full rounded-md bg-[#2E6CC4] hover:bg-[#2560B0]" onClick={() => { setOnlinePayAmount(summary.balance > 0 ? String(summary.balance) : ''); setPayOnlineDialog(true); }} data-testid="pay-online-btn">
                <CreditCard className="w-4 h-4 mr-2" /> Pay Online with Card
              </Button>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card className="rounded-md border-slate-200"><CardHeader><CardTitle className="text-sm">Fee Invoices</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Invoice</TableHead><TableHead className="bg-slate-50">Term</TableHead><TableHead className="bg-slate-50">Total</TableHead><TableHead className="bg-slate-50">Paid</TableHead><TableHead className="bg-slate-50">Balance</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Bill</TableHead></TableRow></TableHeader>
            <TableBody>{invoices.map(inv => (
              <TableRow key={inv.invoice_id}><TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell><TableCell>{inv.term}</TableCell><TableCell>TT$ {(inv.total_due||0).toLocaleString()}</TableCell><TableCell className="text-[#C5A55A]">TT$ {(inv.amount_paid||0).toLocaleString()}</TableCell><TableCell className="text-[#DC2626]">TT$ {((inv.total_due||0)-(inv.amount_paid||0)).toLocaleString()}</TableCell><TableCell><Badge className={inv.status==='paid'?'bg-[#C5A55A]/15 text-[#C5A55A]':inv.status==='partial'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}>{inv.status}</Badge></TableCell>
              <TableCell><Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { fetch(`${BACKEND}/api/finance/bill/${inv.invoice_id}/pdf`,{credentials:'include'}).then(r=>r.blob()).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='Bill.pdf';a.click();}).catch(()=>toast.error('Failed')); }}><Download className="w-3 h-3 mr-1" /> PDF</Button></TableCell></TableRow>
            ))}{invoices.length===0&&<TableRow><TableCell colSpan={7} className="text-center py-6 text-slate-400">No invoices yet</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card className="rounded-md border-slate-200"><CardHeader><CardTitle className="text-sm">Payment History</CardTitle></CardHeader><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Amount</TableHead><TableHead className="bg-slate-50">Method</TableHead><TableHead className="bg-slate-50">Reference</TableHead></TableRow></TableHeader>
              <TableBody>{payments.map(p => (
                <TableRow key={p.payment_id}><TableCell className="text-xs">{new Date(p.received_at||p.created_at).toLocaleDateString()}</TableCell><TableCell className="font-semibold text-[#C5A55A]">TT$ {p.amount?.toLocaleString()}</TableCell><TableCell><Badge variant="secondary">{p.method==='proof_upload'?'Proof Uploaded':p.method}</Badge></TableCell><TableCell className="text-xs text-slate-500 max-w-[200px] truncate">{p.reference||'-'}</TableCell></TableRow>
              ))}</TableBody></Table>
            </CardContent></Card>
          )}

          {/* Payment Submission Dialog */}
          <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Submit Payment for {selectedChild?.name}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="bg-red-50 rounded-md p-3 text-center">
                  <p className="text-xs text-slate-500">Outstanding Balance</p>
                  <p className="text-xl font-bold text-[#DC2626]">TT$ {summary.balance.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <Label>Amount Paid (GHS)</Label>
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount paid" className="text-lg font-bold h-12" data-testid="pay-amount-input" />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="momo">Mobile Money (MoMo)</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reference / Transaction ID</Label>
                  <Input value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="e.g. MoMo transaction ID or bank reference" data-testid="pay-ref-input" />
                </div>
                <div className="space-y-2">
                  <Label>Upload Proof of Payment (optional)</Label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleSelectFile} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#2E6CC4] file:text-white file:cursor-pointer" data-testid="pay-file-input" />
                  {payFileName && <p className="text-xs text-[#C5A55A] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {payFileName}</p>}
                  <p className="text-[10px] text-slate-400">Upload screenshot of MoMo confirmation, bank transfer receipt, or payment slip</p>
                </div>
                <Button className="w-full rounded-md bg-[#C5A55A] h-11" onClick={handleSubmitPayment} disabled={uploading} data-testid="submit-payment-btn">
                  <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Submitting...' : `Submit Payment of TT$ ${payAmount || '0'}`}
                </Button>
                <p className="text-[10px] text-slate-400 text-center">Payment will be reviewed and confirmed by the Finance Office</p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Pay Online Dialog */}
          <Dialog open={payOnlineDialog} onOpenChange={setPayOnlineDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#2E6CC4]" /> Pay Online</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1B2A4A] flex items-center justify-center text-white font-bold">{selectedChild?.name?.charAt(0)}</div>
                    <div><p className="font-semibold text-sm text-[#1B2A4A]">{selectedChild?.name}</p><p className="text-xs text-slate-500">{selectedChild?.year_group} &middot; {selectedChild?.admission_number}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="text-center bg-white rounded-md p-2 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase">Total Billed</p>
                      <p className="text-sm font-bold text-[#1B2A4A]">TT$ {summary.totalDue?.toLocaleString()}</p>
                    </div>
                    <div className="text-center bg-white rounded-md p-2 border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase">Outstanding</p>
                      <p className={`text-sm font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>TT$ {summary.balance?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount to Pay (GHS)</Label>
                  <Input type="number" value={onlinePayAmount} onChange={e => setOnlinePayAmount(e.target.value)} placeholder="Enter amount" className="text-lg font-bold h-12 text-center" data-testid="online-pay-amount" />
                </div>
                <div className="flex items-center gap-2 bg-[#2E6CC4]/5 border border-[#2E6CC4]/20 rounded-lg p-3">
                  <ShieldCheck className="w-5 h-5 text-[#2E6CC4] flex-shrink-0" />
                  <p className="text-xs text-slate-600">Payments are securely processed by <strong>Paystack</strong>. Your card details are never stored on our servers.</p>
                </div>
                <Button className="w-full h-12 rounded-lg bg-[#2E6CC4] hover:bg-[#2560B0] text-white font-semibold" onClick={handlePayOnline} disabled={processingOnline} data-testid="confirm-online-pay-btn">
                  <CreditCard className="w-4 h-4 mr-2" /> {processingOnline ? 'Processing...' : `Pay TT$ ${onlinePayAmount || '0'} Now`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>

    {/* Document Content Viewer Dialog */}
    <Dialog open={!!docViewer} onOpenChange={(v) => { if (!v) setDocViewer(null); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{docViewer?.title}</DialogTitle>
          <Badge className="w-fit text-[9px]">{docViewer?.type === 'scheme' ? 'Scheme of Work' : docViewer?.type === 'lesson' ? 'Lesson Plan' : docViewer?.type === 'assignment' ? 'Assignment' : 'Document'}</Badge>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-md bg-white">
          {docViewer?.loading ? (
            <div className="flex items-center justify-center py-20"><AppLoader /></div>
          ) : (
            <div className="p-5" style={{ fontSize: '13px', lineHeight: '1.7' }}>
              <style>{`
                .parent-doc-content table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                .parent-doc-content table th { background: #1B2A4A; color: white; padding: 8px 10px; text-align: left; border: 1px solid #334155; font-size: 12px; }
                .parent-doc-content table td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 12px; vertical-align: top; }
                .parent-doc-content table tr:nth-child(even) { background: #f8fafc; }
                .parent-doc-content table tr:hover { background: #eff6ff; }
                .parent-doc-content h1, .parent-doc-content h2, .parent-doc-content h3 { color: #1B2A4A; }
                .parent-doc-content ul { padding-left: 18px; }
                .parent-doc-content li { margin-bottom: 3px; }
              `}</style>
              <div className="parent-doc-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(docViewer?.content || '') }} />
            </div>
          )}
        </div>
        {docViewer?.fileIds?.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold self-center mr-1">Files:</span>
            {docViewer.fileIds.map((fid, fi) => (
              <Button key={fi} size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDocViewer(null); setViewingFile(`${BACKEND}/api/files/${fid}/download`); }} data-testid={`parent-file-${fi}`}>
                <FileText className="w-3 h-3 mr-1" /> Open File {fi + 1}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {viewingFile && <FileViewerModal url={viewingFile} onClose={() => setViewingFile(null)} />}
    </>
  );
}
