import React, { useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import RichTextEditor from '../../components/RichTextEditor';
import DiagramGenerator from '../../components/DiagramGenerator';
import { AppLoader } from '../../components/AppLoader';
import {
  BookOpen, Plus, Search, Download, Eye, FileText, Sparkles, Upload,
  ArrowLeft, Trash2, Copy, Edit, Filter, BarChart3, Clock, Users,
  RefreshCw, ChevronDown, Wand2, FileDown, Printer, BookMarked,
  GraduationCap, Activity, AlertCircle, ImagePlus
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';

const BACKEND = import.meta.env.VITE_API_URL;
const MGMT_ROLES = ['SuperAdmin', 'Admin', 'CEO', 'Principal', 'HeadTeacher', 'Founder', 'HeadOfAcademics'];

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  published: 'bg-[#C5A55A]/15 text-[#C5A55A]',
  archived: 'bg-gray-100 text-gray-500',
};

// ─── MAIN MODULE ───
export default function LectureModule() {
  const { user } = useAuth();
  const isMgmt = MGMT_ROLES.includes(user?.role);
  const [view, setView] = useState('list');
  const [lectures, setLectures] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [filters, setFilters] = useState({ subject: '', year_group: '', status: '', search: '' });
  const [adminTab, setAdminTab] = useState('overview');

  const fetchLectures = useCallback(async () => {
    try {
      const endpoint = isMgmt && adminTab === 'all-lectures' ? '/lectures/admin-all' : '/lectures/my-lectures';
      const params = {};
      if (filters.subject) params.subject = filters.subject;
      if (filters.year_group) params.year_group = filters.year_group;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const r = await api.get(endpoint, { params });
      setLectures(r.data);
    } catch (e) {
      toast.error('Failed to load lectures');
    }
  }, [isMgmt, adminTab, filters]);

  const fetchConfig = async () => {
    try {
      const r = await api.get('/lectures/config');
      setConfig(r.data);
    } catch (err) { console.error("Error:", err); }
  };

  const fetchAdminStats = async () => {
    try {
      const r = await api.get('/lectures/admin-stats');
      setAdminStats(r.data);
    } catch (err) { console.error("Error:", err); }
  };

  const fetchLogs = async () => {
    try {
      const r = await api.get('/lectures/activity-logs');
      setActivityLogs(r.data);
    } catch (err) { console.error("Error:", err); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchLectures(), ...(isMgmt ? [fetchAdminStats(), fetchLogs()] : [])]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  const openLecture = async (lecture) => {
    try {
      const r = await api.get(`/lectures/${lecture.lecture_id}`);
      setSelectedLecture(r.data);
      setView('detail');
    } catch { toast.error('Failed to load lecture'); }
  };

  const deleteLecture = async (id) => {
    if (!window.confirm('Delete this lecture permanently?')) return;
    try {
      await api.delete(`/lectures/${id}`);
      successToast('Lecture deleted');
      setView('list');
      setSelectedLecture(null);
      fetchLectures();
      if (isMgmt) fetchAdminStats();
    } catch { toast.error('Delete failed'); }
  };

  const duplicateLecture = async (id) => {
    try {
      const r = await api.post(`/lectures/${id}/duplicate`);
      successToast('Lecture duplicated');
      fetchLectures();
      openLecture(r.data);
    } catch { toast.error('Duplicate failed'); }
  };

  const publishLecture = async (id) => {
    try {
      await api.put(`/lectures/${id}`, { status: 'published' });
      successToast('Lecture published');
      if (selectedLecture?.lecture_id === id) {
        setSelectedLecture(prev => ({ ...prev, status: 'published' }));
      }
      fetchLectures();
      if (isMgmt) fetchAdminStats();
    } catch { toast.error('Publish failed'); }
  };

  if (loading) return <AppLoader />;

  // ─── DETAIL VIEW ───
  if (view === 'detail' && selectedLecture) {
    return <LectureDetail
      lecture={selectedLecture}
      setLecture={setSelectedLecture}
      config={config}
      user={user}
      isMgmt={isMgmt}
      onBack={() => { setView('list'); setSelectedLecture(null); fetchLectures(); }}
      onDelete={deleteLecture}
      onDuplicate={duplicateLecture}
      onPublish={publishLecture}
    />;
  }

  // ─── CREATE VIEW ───
  if (view === 'create') {
    return <LectureCreate
      config={config}
      user={user}
      onBack={() => setView('list')}
      onCreated={(lec) => { fetchLectures(); openLecture(lec); if (isMgmt) fetchAdminStats(); }}
    />;
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-8" data-testid="lecture-module">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#1B2A4A]" data-testid="lecture-module-title">Lectures</h1>
          <p className="text-lg text-slate-500 mt-1">Cambridge-aligned lecture notes with AI generation</p>
        </div>
        <Button onClick={() => setView('create')} className="bg-[#1B2A4A] hover:bg-[#2E6CC4] h-12 px-6 text-base" data-testid="create-lecture-btn">
          <Plus className="w-5 h-5 mr-2" /> New Lecture
        </Button>
      </div>

      {/* Management tabs */}
      {isMgmt ? (
        <Tabs value={adminTab} onValueChange={setAdminTab}>
          <TabsList data-testid="admin-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="my-lectures" data-testid="tab-my-lectures">My Lectures</TabsTrigger>
            <TabsTrigger value="all-lectures" data-testid="tab-all-lectures">All Lectures</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview stats={adminStats} onRefresh={() => { fetchAdminStats(); fetchLogs(); }} logs={activityLogs} />
          </TabsContent>
          <TabsContent value="my-lectures">
            <LectureList lectures={lectures} config={config} filters={filters} setFilters={setFilters}
              onOpen={openLecture} onDelete={deleteLecture} onPublish={publishLecture} />
          </TabsContent>
          <TabsContent value="all-lectures">
            <LectureList lectures={lectures} config={config} filters={filters} setFilters={setFilters}
              onOpen={openLecture} onDelete={deleteLecture} onPublish={publishLecture} showTeacher />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityLog logs={activityLogs} onRefresh={fetchLogs} />
          </TabsContent>
        </Tabs>
      ) : (
        <LectureList lectures={lectures} config={config} filters={filters} setFilters={setFilters}
          onOpen={openLecture} onDelete={deleteLecture} onPublish={publishLecture} />
      )}
    </div>
  );
}

// ─── ADMIN OVERVIEW ───
function AdminOverview({ stats, onRefresh, logs }) {
  if (!stats) return <AppLoader />;
  const statCards = [
    { label: 'Total Lectures', value: stats.total, icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
    { label: 'Published', value: stats.published, icon: FileText, color: 'text-[#C5A55A] bg-[#C5A55A]/10' },
    { label: 'Drafts', value: stats.drafts, icon: Edit, color: 'text-amber-600 bg-amber-50' },
    { label: 'AI Generated', value: stats.ai_generated, icon: Sparkles, color: 'text-[#2E6CC4] bg-blue-50' },
  ];

  return (
    <div className="space-y-8" data-testid="admin-overview">
      <div className="flex justify-end">
        <Button variant="outline" size="default" onClick={onRefresh} data-testid="refresh-stats-btn" className="h-11 px-5 text-base">
          <RefreshCw className="w-5 h-5 mr-2" /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${s.color}`}><s.icon className="w-7 h-7" /></div>
              <div>
                <p className="text-3xl font-bold text-[#1B2A4A]">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By Subject */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">By Subject</CardTitle></CardHeader>
          <CardContent>
            {Object.entries(stats.by_subject || {}).length === 0 ? (
              <p className="text-sm text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.by_subject).map(([subj, count]) => (
                  <div key={subj} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{subj}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Teachers */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Contributors</CardTitle></CardHeader>
          <CardContent>
            {(stats.by_teacher || []).length === 0 ? (
              <p className="text-sm text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-2">
                {stats.by_teacher.map((t, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{t.name}</span>
                    <Badge variant="secondary">{t.count} lectures</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {(logs || []).slice(0, 8).map((log, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <Activity className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate"><strong>{log.user_name}</strong> {log.action}</p>
                {log.details && <p className="text-xs text-slate-400 truncate">{log.details}</p>}
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleDateString()}</span>
            </div>
          ))}
          {(!logs || logs.length === 0) && <p className="text-sm text-slate-400">No activity yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ACTIVITY LOG ───
function ActivityLog({ logs, onRefresh }) {
  return (
    <div className="space-y-4" data-testid="activity-log">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs || []).map((log, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{log.user_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{log.action}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-[300px] truncate">{log.details}</TableCell>
                  <TableCell className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">No activity logs</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── LECTURE LIST ───
function LectureList({ lectures, config, filters, setFilters, onOpen, onDelete, onPublish, showTeacher }) {
  return (
    <div className="space-y-6" data-testid="lecture-list">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Search lectures..." value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="h-12 text-base" data-testid="lecture-search-input" />
        </div>
        <Select value={filters.subject || 'all'} onValueChange={v => setFilters(f => ({ ...f, subject: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-[200px] h-12 text-base" data-testid="filter-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent className="text-base">
            <SelectItem value="all" className="text-base py-3">All Subjects</SelectItem>
            {(config?.subjects || []).map(s => <SelectItem key={s.name} value={s.name} className="text-base py-3">{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.year_group || 'all'} onValueChange={v => setFilters(f => ({ ...f, year_group: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-[180px] h-12 text-base" data-testid="filter-year"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent className="text-base">
            <SelectItem value="all" className="text-base py-3">All Years</SelectItem>
            {(config?.year_groups || []).map(y => <SelectItem key={y} value={y} className="text-base py-3">{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-[170px] h-12 text-base" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="text-base">
            <SelectItem value="all" className="text-base py-3">All Status</SelectItem>
            <SelectItem value="draft" className="text-base py-3">Draft</SelectItem>
            <SelectItem value="published" className="text-base py-3">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {lectures.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-xl text-slate-500 font-medium">No lectures found</p>
            <p className="text-base text-slate-400 mt-2">Create your first lecture to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lectures.map(lec => (
            <Card key={lec.lecture_id} className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onOpen(lec)} data-testid={`lecture-card-${lec.lecture_id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge className={`text-sm ${statusColors[lec.status] || statusColors.draft}`}>{lec.status}</Badge>
                  <div className="flex gap-2">
                    {lec.ai_generated && <Badge variant="outline" className="text-xs border-blue-200 text-[#2E6CC4]">AI</Badge>}
                    {lec.source_type === 'upload' && <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">Upload</Badge>}
                  </div>
                </div>
                <h3 className="font-semibold text-lg text-[#1B2A4A] line-clamp-2 mb-2">{lec.title}</h3>
                <div className="space-y-1.5 text-sm text-slate-500">
                  <p>{lec.subject} {lec.year_group && `- ${lec.year_group}`}</p>
                  {lec.topic && <p className="truncate">Topic: {lec.topic}</p>}
                  {showTeacher && <p className="text-slate-400">By: {lec.teacher_name}</p>}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-400">v{lec.version} - {new Date(lec.updated_at).toLocaleDateString()}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {lec.status === 'draft' && (
                      <Button variant="ghost" size="sm" className="h-8 px-3 text-sm" onClick={() => onPublish(lec.lecture_id)}>Publish</Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                      onClick={() => onDelete(lec.lecture_id)} data-testid={`delete-lecture-${lec.lecture_id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LECTURE CREATE ───
function LectureCreate({ config, user, onBack, onCreated }) {
  const [mode, setMode] = useState(null); // 'manual', 'ai', 'upload'
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    title: '', subject: '', year_group: '', cambridge_stage: 'IGCSE',
    topic: '', subtopic: '', learning_objectives: '',
    difficulty_level: 'moderate', duration: 'standard',
    output_style: 'standard_lecture', tone: 'formal', depth: 'moderate',
    additional_instructions: '', rich_content: '',
  });
  const [uploadFile, setUploadFile] = useState(null);

  const updateForm = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleManualCreate = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    try {
      const r = await api.post('/lectures/', form);
      successToast('Lecture created');
      onCreated(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Create failed'); }
  };

  const handleAIGenerate = async () => {
    if (!form.topic.trim()) return toast.error('Topic is required for AI generation');
    setGenerating(true);
    try {
      const r = await api.post('/lectures/ai-generate', form);
      successToast('Lecture generated by AI');
      onCreated(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI generation failed');
    } finally { setGenerating(false); }
  };

  const handleUploadGenerate = async () => {
    if (!uploadFile) return toast.error('Please select a file');
    setGenerating(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('subject', form.subject);
      fd.append('year_group', form.year_group);
      fd.append('cambridge_stage', form.cambridge_stage);
      fd.append('topic', form.topic);
      fd.append('output_style', form.output_style);
      fd.append('tone', form.tone);
      fd.append('depth', form.depth);
      const r = await api.post('/lectures/upload-and-generate', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      successToast('Lecture generated from upload');
      onCreated(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload generation failed');
    } finally { setGenerating(false); }
  };

  // Mode selection
  if (!mode) {
    return (
      <div className="space-y-6" data-testid="lecture-create">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h2 className="text-xl font-bold text-[#1B2A4A]">Create New Lecture</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl">
          <Card className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all" onClick={() => setMode('ai')} data-testid="mode-ai">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-[#2E6CC4]" />
              </div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">AI Generate</h3>
              <p className="text-xs text-slate-500">Generate a complete Cambridge-aligned lecture using AI</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all" onClick={() => setMode('upload')} data-testid="mode-upload">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">Upload & Generate</h3>
              <p className="text-xs text-slate-500">Upload existing material and restructure it with AI</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all" onClick={() => setMode('manual')} data-testid="mode-manual">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#C5A55A]/10 flex items-center justify-center mx-auto mb-4">
                <Edit className="w-7 h-7 text-[#C5A55A]" />
              </div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">Write Manually</h3>
              <p className="text-xs text-slate-500">Create a lecture from scratch with the rich text editor</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lecture-create-form">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} data-testid="back-to-mode-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold text-[#1B2A4A]">
          {mode === 'ai' ? 'AI Generate Lecture' : mode === 'upload' ? 'Upload & Generate' : 'Create Lecture'}
        </h2>
        {mode === 'ai' && <Badge className="bg-blue-100 text-[#1B2A4A] text-xs">AI Powered</Badge>}
      </div>

      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        {/* Subject */}
        <div>
          <Label>Subject *</Label>
          <Select value={form.subject} onValueChange={v => updateForm('subject', v)}>
            <SelectTrigger data-testid="select-subject"><SelectValue placeholder="Choose subject" /></SelectTrigger>
            <SelectContent>
              {(config?.subjects || []).map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Year Group */}
        <div>
          <Label>Year Group *</Label>
          <Select value={form.year_group} onValueChange={v => updateForm('year_group', v)}>
            <SelectTrigger data-testid="select-year-group"><SelectValue placeholder="Choose year" /></SelectTrigger>
            <SelectContent>
              {(config?.year_groups || []).map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Cambridge Stage */}
        <div>
          <Label>Cambridge Stage</Label>
          <Select value={form.cambridge_stage} onValueChange={v => updateForm('cambridge_stage', v)}>
            <SelectTrigger data-testid="select-stage"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(config?.cambridge_stages || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Topic */}
        <div>
          <Label>Topic *</Label>
          <Input value={form.topic} onChange={e => updateForm('topic', e.target.value)}
            placeholder="e.g., Photosynthesis" data-testid="input-topic" />
        </div>
        {/* Subtopic */}
        <div>
          <Label>Subtopic</Label>
          <Input value={form.subtopic} onChange={e => updateForm('subtopic', e.target.value)}
            placeholder="e.g., Light-dependent reactions" data-testid="input-subtopic" />
        </div>
        {/* Title (manual only) */}
        {mode === 'manual' && (
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => updateForm('title', e.target.value)}
              placeholder="Lecture title" data-testid="input-title" />
          </div>
        )}
      </div>

      {/* AI-specific options */}
      {(mode === 'ai' || mode === 'upload') && (
        <div className="grid md:grid-cols-3 gap-4 max-w-4xl">
          <div>
            <Label>Output Style</Label>
            <Select value={form.output_style} onValueChange={v => updateForm('output_style', v)}>
              <SelectTrigger data-testid="select-style"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.output_styles || []).map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tone</Label>
            <Select value={form.tone} onValueChange={v => updateForm('tone', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.tone_options || []).map(t => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Depth</Label>
            <Select value={form.depth} onValueChange={v => updateForm('depth', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.depth_options || []).map(d => (
                  <SelectItem key={d} value={d}>{d.replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={form.difficulty_level} onValueChange={v => updateForm('difficulty_level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duration</Label>
            <Select value={form.duration} onValueChange={v => updateForm('duration', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(config?.duration_options || []).map(d => (
                  <SelectItem key={d} value={d}>{d === 'short' ? 'Short (25-30 min)' : d === 'standard' ? 'Standard (45-60 min)' : 'Extended (75-90 min)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Learning Objectives</Label>
            <Input value={form.learning_objectives} onChange={e => updateForm('learning_objectives', e.target.value)}
              placeholder="Optional: custom objectives" />
          </div>
          <div className="md:col-span-3">
            <Label>Additional Instructions</Label>
            <Textarea value={form.additional_instructions} onChange={e => updateForm('additional_instructions', e.target.value)}
              placeholder="Any specific requirements for the AI..." rows={2} />
          </div>
        </div>
      )}

      {/* Upload file input */}
      {mode === 'upload' && (
        <div className="max-w-lg">
          <Label>Upload Material</Label>
          <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)}
            accept=".txt,.md,.pdf,.docx,.doc" data-testid="upload-file-input" />
          <p className="text-xs text-slate-400 mt-1">Supported: .txt, .md, .pdf, .docx</p>
        </div>
      )}

      {/* Manual editor */}
      {mode === 'manual' && (
        <div className="max-w-4xl">
          <Label>Content</Label>
          <RichTextEditor value={form.rich_content} onChange={v => updateForm('rich_content', v)} placeholder="Write your lecture content..." subject={form.subject} />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 max-w-4xl">
        <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
        {mode === 'ai' && (
          <Button onClick={handleAIGenerate} disabled={generating} className="bg-[#1B2A4A] hover:bg-[#0E2E68]" data-testid="ai-generate-btn">
            {generating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</>}
          </Button>
        )}
        {mode === 'upload' && (
          <Button onClick={handleUploadGenerate} disabled={generating} className="bg-blue-600 hover:bg-blue-700" data-testid="upload-generate-btn">
            {generating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : <><Upload className="w-4 h-4 mr-2" /> Upload & Generate</>}
          </Button>
        )}
        {mode === 'manual' && (
          <Button onClick={handleManualCreate} className="bg-[#1B2A4A] hover:bg-[#2E6CC4]" data-testid="manual-create-btn">
            <Plus className="w-4 h-4 mr-2" /> Create Lecture
          </Button>
        )}
      </div>

      {generating && (
        <Card className="max-w-4xl border-blue-200 bg-blue-50/50">
          <CardContent className="py-8 text-center">
            <Sparkles className="w-10 h-10 text-[#2E6CC4] mx-auto mb-3 animate-pulse" />
            <p className="font-medium text-[#1B2A4A]">GPT-5 is generating your Cambridge-aligned lecture...</p>
            <p className="text-xs text-[#2E6CC4] mt-1">This may take 30-60 seconds for comprehensive content</p>
            <Progress className="mt-4 max-w-sm mx-auto" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── LECTURE DETAIL ───
function LectureDetail({ lecture, setLecture, config, user, isMgmt, onBack, onDelete, onDuplicate, onPublish }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(lecture.rich_content || '');
  const [editTitle, setEditTitle] = useState(lecture.title || '');
  const [saving, setSaving] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [refineCommand, setRefineCommand] = useState('');
  const [refining, setRefining] = useState(false);
  const [showComponent, setShowComponent] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState('');
  const [generatingComponent, setGeneratingComponent] = useState(false);
  const [componentResult, setComponentResult] = useState('');
  const [lecDiagramOpen, setLecDiagramOpen] = useState(false);
  const token = localStorage.getItem('rw_token');

  const saveLecture = async () => {
    setSaving(true);
    try {
      await api.put(`/lectures/${lecture.lecture_id}`, { title: editTitle, rich_content: editContent });
      setLecture(prev => ({ ...prev, title: editTitle, rich_content: editContent, version: prev.version + 1 }));
      setEditing(false);
      successToast('Lecture saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleRefine = async () => {
    if (!refineCommand.trim()) return toast.error('Enter a refinement command');
    setRefining(true);
    try {
      const r = await api.post(`/lectures/${lecture.lecture_id}/ai-refine`, {
        command: refineCommand,
        section_content: editContent || lecture.rich_content,
      });
      setEditContent(r.data.refined_content);
      setEditing(true);
      setShowRefine(false);
      setRefineCommand('');
      successToast('Content refined by AI');
    } catch (e) { toast.error(e.response?.data?.detail || 'Refinement failed'); }
    finally { setRefining(false); }
  };

  const handleGenerateComponent = async () => {
    if (!selectedComponent) return;
    setGeneratingComponent(true);
    try {
      const r = await api.post(`/lectures/${lecture.lecture_id}/ai-generate-component`, { component: selectedComponent });
      setComponentResult(r.data.content);
    } catch (e) { toast.error(e.response?.data?.detail || 'Component generation failed'); }
    finally { setGeneratingComponent(false); }
  };

  const appendComponent = () => {
    const newContent = (editContent || lecture.rich_content) + '\n\n' + componentResult;
    setEditContent(newContent);
    setEditing(true);
    setComponentResult('');
    setShowComponent(false);
    successToast('Component added to lecture');
  };

  const pdfUrl = `${BACKEND}/api/lectures/${lecture.lecture_id}/export-pdf?token=${token}`;

  return (
    <div className="space-y-6" data-testid="lecture-detail">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-to-list-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <div>
            {editing ? (
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-lg font-bold h-9" data-testid="edit-title-input" />
            ) : (
              <h2 className="text-xl font-bold text-[#1B2A4A]">{lecture.title}</h2>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] ${statusColors[lecture.status] || statusColors.draft}`}>{lecture.status}</Badge>
              {lecture.ai_generated && <Badge variant="outline" className="text-[10px] border-blue-200 text-[#2E6CC4]">AI Generated</Badge>}
              <span className="text-xs text-slate-400">v{lecture.version}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(true); setEditContent(lecture.rich_content || ''); setEditTitle(lecture.title); }}
                data-testid="edit-lecture-btn"><Edit className="w-4 h-4 mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" onClick={() => setShowRefine(true)} data-testid="refine-btn">
                <Wand2 className="w-4 h-4 mr-1" /> AI Refine
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowComponent(true)} data-testid="component-btn">
                <Sparkles className="w-4 h-4 mr-1" /> AI Component
              </Button>
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setLecDiagramOpen(true)} data-testid="lecture-diagram-btn">
                <ImagePlus className="w-4 h-4 mr-1" /> AI Diagram
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDuplicate(lecture.lecture_id)} data-testid="duplicate-btn">
                <Copy className="w-4 h-4 mr-1" /> Duplicate
              </Button>
              {lecture.status === 'draft' && (
                <Button variant="outline" size="sm" onClick={() => onPublish(lecture.lecture_id)} className="border-[#C5A55A]/40 text-[#C5A55A] hover:bg-[#C5A55A]/10"
                  data-testid="publish-btn"><FileText className="w-4 h-4 mr-1" /> Publish</Button>
              )}
              {/* PDF */}
              <Button variant="outline" size="sm" onClick={() => window.open(`${pdfUrl}&variant=teacher`, '_blank')} data-testid="view-pdf-btn">
                <Eye className="w-4 h-4 mr-1" /> View PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`${pdfUrl}&variant=teacher&download=1`, '_blank')} data-testid="download-pdf-btn">
                <Download className="w-4 h-4 mr-1" /> Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(`${pdfUrl}&variant=student&download=1`, '_blank')} data-testid="download-student-pdf-btn">
                <GraduationCap className="w-4 h-4 mr-1" /> Student PDF
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => onDelete(lecture.lecture_id)} data-testid="delete-detail-btn">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={saveLecture} disabled={saving} className="bg-[#1B2A4A] hover:bg-[#2E6CC4]" data-testid="save-lecture-btn">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setLecDiagramOpen(true)} data-testid="lecture-diagram-btn-edit">
                <ImagePlus className="w-4 h-4 mr-1" /> AI Diagram
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Subject', value: lecture.subject },
          { label: 'Year Group', value: lecture.year_group },
          { label: 'Cambridge Stage', value: lecture.cambridge_stage },
          { label: 'Topic', value: lecture.topic },
          { label: 'Subtopic', value: lecture.subtopic },
          { label: 'Teacher', value: lecture.teacher_name },
        ].filter(m => m.value).map(m => (
          <div key={m.label} className="bg-slate-50 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">{m.label}</p>
            <p className="text-sm text-[#1B2A4A] font-medium truncate">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {editing ? (
            <RichTextEditor value={editContent} onChange={setEditContent} placeholder="Write lecture content..." subject={lecture?.subject} />
          ) : (
            <div className="prose prose-sm max-w-none text-slate-700
              [&_h2]:text-[#1B2A4A] [&_h2]:text-lg [&_h2]:font-bold [&_h2]:border-b [&_h2]:border-blue-200 [&_h2]:pb-1 [&_h2]:mb-3 [&_h2]:mt-6
              [&_h3]:text-[#2E6CC4] [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4
              [&_h4]:text-slate-600 [&_h4]:font-semibold
              [&_table]:w-full [&_table]:border-collapse [&_th]:bg-[#1B2A4A] [&_th]:text-white [&_th]:p-2 [&_th]:text-xs [&_th]:text-left
              [&_td]:p-2 [&_td]:border [&_td]:border-slate-200 [&_td]:text-sm
              [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1
              [&_strong]:text-[#1B2A4A]"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lecture.rich_content || '<p class="text-slate-400">No content yet. Click Edit to add content or use AI to generate.</p>') }}
              data-testid="lecture-content-display"
            />
          )}
        </CardContent>
      </Card>

      {/* AI Refine Dialog */}
      <Dialog open={showRefine} onOpenChange={setShowRefine}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>AI Refine Content</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Describe how you want to refine or improve this lecture content.</p>
            <div className="flex flex-wrap gap-2">
              {['Expand explanations', 'Add more examples', 'Simplify language', 'Add exam tips', 'Improve structure', 'Add Cambridge keywords'].map(cmd => (
                <Badge key={cmd} variant="outline" className="cursor-pointer hover:bg-slate-100"
                  onClick={() => setRefineCommand(cmd)}>{cmd}</Badge>
              ))}
            </div>
            <Textarea value={refineCommand} onChange={e => setRefineCommand(e.target.value)}
              placeholder="e.g., Add more worked examples to the step-by-step explanation" rows={3} data-testid="refine-command-input" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRefine(false)}>Cancel</Button>
              <Button onClick={handleRefine} disabled={refining} className="bg-[#1B2A4A] hover:bg-[#0E2E68]" data-testid="run-refine-btn">
                {refining ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Refining...</> : <><Wand2 className="w-4 h-4 mr-1" /> Refine</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Component Dialog */}
      <Dialog open={showComponent} onOpenChange={v => { setShowComponent(v); if (!v) setComponentResult(''); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate AI Component</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Generate supplementary teaching materials for this lecture.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'glossary', label: 'Keyword Glossary' },
                { key: 'homework', label: 'Homework Sheet' },
                { key: 'quiz', label: 'Quick Quiz' },
                { key: 'starter', label: 'Starter Activity' },
                { key: 'plenary', label: 'Plenary Activity' },
                { key: 'worksheet', label: 'Student Worksheet' },
                { key: 'exam_questions', label: 'Exam Questions' },
                { key: 'discussion_points', label: 'Discussion Points' },
              ].map(c => (
                <Button key={c.key} variant={selectedComponent === c.key ? 'default' : 'outline'} size="sm"
                  onClick={() => setSelectedComponent(c.key)} className={selectedComponent === c.key ? 'bg-[#1B2A4A]' : ''}
                  data-testid={`component-${c.key}`}>
                  {c.label}
                </Button>
              ))}
            </div>
            {!componentResult ? (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowComponent(false)}>Cancel</Button>
                <Button onClick={handleGenerateComponent} disabled={generatingComponent || !selectedComponent} className="bg-[#1B2A4A] hover:bg-[#0E2E68]">
                  {generatingComponent ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-1" /> Generate</>}
                </Button>
              </div>
            ) : (
              <>
                <Separator />
                <div className="prose prose-sm max-w-none border rounded-lg p-4 bg-slate-50 max-h-[300px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(componentResult) }} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setComponentResult('')}>Regenerate</Button>
                  <Button onClick={appendComponent} className="bg-[#1B2A4A] hover:bg-[#2E6CC4]" data-testid="append-component-btn">
                    <Plus className="w-4 h-4 mr-1" /> Add to Lecture
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <DiagramGenerator
        open={lecDiagramOpen}
        onClose={() => setLecDiagramOpen(false)}
        onInsert={(imageUrl, altText) => {
          const imgHtml = `<p><img src="${imageUrl}" alt="${altText}" style="max-width:100%;border-radius:8px;margin:12px 0;" /></p>`;
          const cur = lecture.rich_content || '';
          setLecture(prev => ({...prev, rich_content: cur + imgHtml}));
          setEditContent(prev => (prev || '') + imgHtml);
          setLecDiagramOpen(false);
          toast.success('Diagram inserted');
        }}
        defaultSubject={lecture.subject}
      />
    </div>
  );
}
