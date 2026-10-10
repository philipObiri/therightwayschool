import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import {
  Plus, ClipboardList, Eye, CheckCircle, Upload, Paperclip, X,
  FileText, Trash2, Calendar, Clock, BarChart3, Users,
  Shield, Loader2, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

export default function AssignmentsMarking() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subsDialog, setSubsDialog] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });
  const [gradingSubId, setGradingSubId] = useState(null);
  const [plagiarismLoading, setPlagiarismLoading] = useState(false);
  const [plagiarismResults, setPlagiarismResults] = useState(null);
  const [showPlagiarism, setShowPlagiarism] = useState(false);

  // Detailed form state
  const [form, setForm] = useState({
    title: '', description: '', instructions: '', subject_id: '', class_ids: [],
    due_date: '', due_time: '', max_score: 100, published: true,
    assignment_type: 'individual', category: 'homework',
    allow_late: false, late_penalty: 0,
    rubric: '', learning_objectives: '',
    file_ids: [], links: [''],
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Filter subjects/classes to teacher's assignments
  const teacherSubjects = user?.teaching_subjects || [];
  const teacherYears = user?.assigned_year_groups || [];
  const filteredSubjects = teacherSubjects.length > 0 ? subjects.filter(s => teacherSubjects.includes(s.name)) : subjects;
  const filteredClasses = teacherYears.length > 0 ? classes.filter(c => teacherYears.includes(c.year_group)) : classes;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [asgnRes, subjRes, clsRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/academic/subjects'),
        api.get('/academic/classes'),
      ]);
      setAssignments(asgnRes.data);
      setSubjects(subjRes.data);
      setClasses(clsRes.data);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const validLinks = form.links.filter(l => l.trim());
      await api.post('/assignments', {
        ...form,
        due_date: form.due_date + (form.due_time ? `T${form.due_time}` : ''),
        attachments: validLinks,
        file_ids: form.file_ids,
      });
      successToast('Assignment created');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const resetForm = () => {
    setForm({ title: '', description: '', instructions: '', subject_id: '', class_ids: [], due_date: '', due_time: '', max_score: 100, published: true, assignment_type: 'individual', category: 'homework', allow_late: false, late_penalty: 0, rubric: '', learning_objectives: '', file_ids: [], links: [''] });
    setUploadedFiles([]);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData(); fd.append('file', file);
      try {
        const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setForm(p => ({ ...p, file_ids: [...p.file_ids, res.data.file_id] }));
        setUploadedFiles(p => [...p, { id: res.data.file_id, name: file.name, size: res.data.size_bytes, type: file.type }]);
      } catch { toast.error(`Failed: ${file.name}`); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeFile = (id) => {
    setForm(p => ({ ...p, file_ids: p.file_ids.filter(f => f !== id) }));
    setUploadedFiles(p => p.filter(f => f.id !== id));
  };

  const addLink = () => setForm(p => ({ ...p, links: [...p.links, ''] }));
  const updateLink = (idx, val) => { const links = [...form.links]; links[idx] = val; setForm({ ...form, links }); };
  const removeLink = (idx) => setForm(p => ({ ...p, links: p.links.filter((_, i) => i !== idx) }));

  const toggleClass = (classId) => {
    const ids = form.class_ids.includes(classId) ? form.class_ids.filter(id => id !== classId) : [...form.class_ids, classId];
    setForm({ ...form, class_ids: ids });
  };

  const viewSubmissions = async (assignmentId) => {
    try { const res = await api.get(`/assignments/${assignmentId}/submissions`); setSubmissions(res.data); setSubsDialog(assignmentId); } catch { toast.error('Failed'); }
  };

  const handleGrade = async (assignmentId, submissionId) => {
    try {
      await api.post(`/assignments/${assignmentId}/grade/${submissionId}`, { grade: parseFloat(gradeForm.grade), feedback: gradeForm.feedback });
      successToast('Graded'); setGradingSubId(null); setGradeForm({ grade: '', feedback: '' }); viewSubmissions(assignmentId);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/assignments/${id}`); successToast('Deleted'); fetchData(); } catch (err) { console.error("Error:", err); }
  };

  const runPlagiarismCheck = async (assignmentId) => {
    setPlagiarismLoading(true);
    setPlagiarismResults(null);
    try {
      const res = await api.post('/plagiarism/check-batch', { assignment_id: assignmentId });
      setPlagiarismResults(res.data);
      setShowPlagiarism(true);
      if (res.data.total_comparisons === 0) {
        toast.info('Not enough text submissions to compare');
      } else {
        successToast(`Checked ${res.data.total_comparisons} pairs — ${res.data.flagged} flagged`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Plagiarism check failed');
    }
    setPlagiarismLoading(false);
  };

  const loadPlagiarismResults = async (assignmentId) => {
    try {
      const res = await api.get(`/plagiarism/results/${assignmentId}`);
      if (res.data.results?.length > 0) {
        setPlagiarismResults(res.data);
        setShowPlagiarism(true);
      } else {
        toast.info('No previous plagiarism checks found');
      }
    } catch { toast.error('Failed to load results'); }
  };

  const verdictColor = (v) => {
    if (v === 'clean') return 'bg-[#C5A55A]/15 text-[#C5A55A]';
    if (v === 'low_similarity') return 'bg-blue-100 text-blue-700';
    if (v === 'moderate_similarity') return 'bg-amber-100 text-amber-700';
    if (v === 'high_similarity') return 'bg-orange-100 text-orange-700';
    if (v === 'plagiarized') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
  };

  const fileIcon = (type) => {
    if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (type?.includes('image')) return <FileText className="w-4 h-4 text-[#C5A55A]" />;
    if (type?.includes('word') || type?.includes('doc')) return <FileText className="w-4 h-4 text-blue-500" />;
    if (type?.includes('presentation') || type?.includes('ppt')) return <FileText className="w-4 h-4 text-orange-500" />;
    return <Paperclip className="w-4 h-4 text-slate-400" />;
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="assignments-marking">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Assignments & Marking</h1>
          <p className="text-slate-500 mt-1">{assignments.length} assignments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-md bg-[#2E6CC4]" data-testid="create-assignment-btn"><Plus className="w-4 h-4 mr-2" /> Create Assignment</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-lg">Create New Assignment</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">

              {/* Basic Info */}
              <Section title="Basic Information">
                <div className="space-y-2"><Label>Assignment Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="e.g. Chapter 5 Practice Questions" data-testid="asgn-title" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger data-testid="asgn-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homework">Homework</SelectItem>
                        <SelectItem value="classwork">Classwork</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="essay">Essay</SelectItem>
                        <SelectItem value="lab_report">Lab Report</SelectItem>
                        <SelectItem value="presentation">Presentation</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="exam_prep">Exam Preparation</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Type</Label>
                    <Select value={form.assignment_type} onValueChange={v => setForm({...form, assignment_type: v})}>
                      <SelectTrigger data-testid="asgn-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="group">Group Work</SelectItem>
                        <SelectItem value="paired">Paired</SelectItem>
                      </SelectContent>
                    </Select></div>
                </div>
              </Section>

              {/* Subject & Classes */}
              <Section title="Subject & Classes">
                <div className="space-y-2"><Label>Subject</Label>
                  <Select value={form.subject_id} onValueChange={v => setForm({...form, subject_id: v})}>
                    <SelectTrigger data-testid="asgn-subject"><SelectValue placeholder="Select your subject" /></SelectTrigger>
                    <SelectContent>{filteredSubjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-2">
                  <Label>Assign to Classes</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {filteredClasses.map(c => (
                      <button key={c.class_id} type="button" onClick={() => toggleClass(c.class_id)} className={`px-3 py-2 rounded-md text-xs font-medium border-2 transition-all ${form.class_ids.includes(c.class_id) ? 'border-[#2E6CC4] bg-blue-50 text-[#2E6CC4]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`} data-testid={`asgn-class-${c.class_id}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Instructions & Description */}
              <Section title="Description & Instructions">
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="Brief overview of the assignment..." data-testid="asgn-desc" /></div>
                <div className="space-y-2"><Label>Detailed Instructions</Label><Textarea value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} rows={4} placeholder="Step-by-step instructions for students:&#10;1. Read Chapter 5 pages 45-60&#10;2. Answer questions 1-15&#10;3. Show all working for calculations&#10;4. Submit as PDF or handwritten photo" data-testid="asgn-instructions" /></div>
                <div className="space-y-2"><Label>Learning Objectives</Label><Textarea value={form.learning_objectives} onChange={e => setForm({...form, learning_objectives: e.target.value})} rows={2} placeholder="What students should learn/demonstrate from this assignment..." data-testid="asgn-objectives" /></div>
              </Section>

              {/* Scoring & Deadlines */}
              <Section title="Scoring & Deadlines">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Max Score</Label><Input type="number" value={form.max_score} onChange={e => setForm({...form, max_score: parseInt(e.target.value) || 100})} data-testid="asgn-score" /></div>
                  <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} data-testid="asgn-due-date" /></div>
                  <div className="space-y-2"><Label>Due Time</Label><Input type="time" value={form.due_time} onChange={e => setForm({...form, due_time: e.target.value})} data-testid="asgn-due-time" /></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                  <div><p className="text-sm font-medium">Allow Late Submissions</p><p className="text-[10px] text-slate-500">Students can submit after the deadline with a penalty</p></div>
                  <Switch checked={form.allow_late} onCheckedChange={v => setForm({...form, allow_late: v})} data-testid="asgn-allow-late" />
                </div>
                {form.allow_late && (
                  <div className="space-y-2"><Label>Late Penalty (% deduction per day)</Label><Input type="number" value={form.late_penalty} onChange={e => setForm({...form, late_penalty: parseInt(e.target.value) || 0})} placeholder="e.g. 5" data-testid="asgn-penalty" /></div>
                )}
                <div className="space-y-2"><Label>Rubric / Marking Criteria</Label><Textarea value={form.rubric} onChange={e => setForm({...form, rubric: e.target.value})} rows={3} placeholder="Describe how the assignment will be graded:&#10;- Content & accuracy: 40%&#10;- Presentation & neatness: 20%&#10;- Working shown: 30%&#10;- Submitted on time: 10%" data-testid="asgn-rubric" /></div>
              </Section>

              {/* Attachments */}
              <Section title="Attachments & Resources">
                <p className="text-xs text-slate-500">Attach question papers, worksheets, PDFs, images, or reference materials</p>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv,.mp4" />
                <Button type="button" variant="outline" className="w-full rounded-md border-dashed border-2 h-14" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="asgn-upload">
                  <Upload className="w-5 h-5 mr-2 text-slate-400" /> {uploading ? 'Uploading...' : 'Click to upload files (PDF, Word, PowerPoint, Images, etc.)'}
                </Button>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedFiles.map(f => (
                      <div key={f.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
                        {fileIcon(f.type)}
                        <div className="flex-1 min-w-0"><p className="text-xs font-medium text-[#1B2A4A] truncate">{f.name}</p><p className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(0)} KB</p></div>
                        <button type="button" onClick={() => removeFile(f.id)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Links */}
              <Section title="Reference Links">
                <p className="text-xs text-slate-500">Add YouTube videos, websites, Google Drive links, or other online resources</p>
                {form.links.map((link, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input value={link} onChange={e => updateLink(idx, e.target.value)} placeholder={`Link ${idx + 1}: https://...`} className="flex-1" data-testid={`asgn-link-${idx}`} />
                    {form.links.length > 1 && <button type="button" onClick={() => removeLink(idx)} className="text-slate-400 hover:text-red-500 px-1"><X className="w-4 h-4" /></button>}
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addLink} className="text-xs text-[#2E6CC4]"><Plus className="w-3 h-3 mr-1" /> Add Another Link</Button>
              </Section>

              {/* Publish toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md border border-slate-200">
                <div><p className="text-sm font-semibold text-[#1B2A4A]">Publish immediately</p><p className="text-[10px] text-slate-500">Students will see this assignment right away</p></div>
                <Switch checked={form.published} onCheckedChange={v => setForm({...form, published: v})} />
              </div>

              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4] h-11 text-sm font-semibold" data-testid="submit-assignment">
                {form.published ? 'Create & Publish Assignment' : 'Save as Draft'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assignment cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map(a => (
          <Card key={a.assignment_id} className="rounded-md border-slate-100 card-hover" data-testid={`asgn-card-${a.assignment_id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-[#C5A55A]" /></div>
                <Badge className={a.published ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-slate-100 text-slate-500'}>{a.published ? 'Active' : 'Draft'}</Badge>
              </div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">{a.title}</h3>
              <p className="text-sm text-slate-500 mb-2 line-clamp-2">{a.description || 'No description'}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                <span>{a.subject_name}</span>
                {a.due_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {a.due_date}</span>}
              </div>
              <div className="flex gap-1 mb-3 flex-wrap">
                <Badge variant="secondary" className="text-[10px]"><BarChart3 className="w-2.5 h-2.5 mr-0.5" />{a.max_score} pts</Badge>
                <Badge variant="secondary" className="text-[10px]"><Users className="w-2.5 h-2.5 mr-0.5" />{a.submission_count} submitted</Badge>
                {(a.file_ids || a.attachments || []).length > 0 && <Badge variant="secondary" className="text-[10px]"><Paperclip className="w-2.5 h-2.5 mr-0.5" />{(a.file_ids || a.attachments || []).length}</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-md text-xs flex-1" onClick={() => viewSubmissions(a.assignment_id)} data-testid={`view-subs-${a.assignment_id}`}><Eye className="w-3 h-3 mr-1" /> Submissions</Button>
                <Button variant="ghost" size="sm" className="text-xs text-red-500" onClick={() => handleDelete(a.assignment_id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {assignments.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400"><ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>No assignments yet</p></div>
        )}
      </div>

      {/* Submissions dialog */}
      <Dialog open={!!subsDialog} onOpenChange={() => { setSubsDialog(null); setGradingSubId(null); setPlagiarismResults(null); setShowPlagiarism(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Student Submissions</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-md text-xs" onClick={() => loadPlagiarismResults(subsDialog)} data-testid="view-plagiarism-btn">
                  <Eye className="w-3 h-3 mr-1" /> Past Results
                </Button>
                <Button size="sm" className="rounded-md text-xs bg-amber-600 hover:bg-amber-700" onClick={() => runPlagiarismCheck(subsDialog)} disabled={plagiarismLoading || submissions.length < 2} data-testid="check-plagiarism-btn">
                  {plagiarismLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                  {plagiarismLoading ? 'Checking...' : 'Check Plagiarism'}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Plagiarism Results Panel */}
          {showPlagiarism && plagiarismResults && (
            <div className="border border-amber-200 bg-amber-50 rounded-md p-4 space-y-3" data-testid="plagiarism-results-panel">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-sm text-[#1B2A4A]">Plagiarism Report</span>
                  <Badge className="bg-slate-100 text-slate-600 text-[10px]">{plagiarismResults.total_comparisons || plagiarismResults.total_checks} pairs</Badge>
                  {(plagiarismResults.flagged > 0) && <Badge className="bg-red-100 text-red-700 text-[10px]">{plagiarismResults.flagged} flagged</Badge>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPlagiarism(false)} className="text-xs"><X className="w-3 h-3" /></Button>
              </div>
              {plagiarismResults.results?.length > 0 ? (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {plagiarismResults.results.map((r, idx) => (
                    <PlagiarismResultCard key={r.check_id || idx} result={r} verdictColor={verdictColor} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-2">No comparisons available. Need at least 2 text submissions.</p>
              )}
            </div>
          )}

          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Response</TableHead><TableHead>Grade</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {submissions.map(s => (
                <TableRow key={s.submission_id}>
                  <TableCell className="font-medium">{s.student_name}</TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">{s.content || s.file_url || '-'}</TableCell>
                  <TableCell>{s.grade !== null && s.grade !== undefined ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">{s.grade}</Badge> : <span className="text-slate-400">Ungraded</span>}</TableCell>
                  <TableCell>
                    {gradingSubId === s.submission_id ? (
                      <div className="flex gap-2 items-end">
                        <Input type="number" placeholder="Score" className="w-20 h-8" value={gradeForm.grade} onChange={e => setGradeForm({...gradeForm, grade: e.target.value})} data-testid="grade-input" />
                        <Input placeholder="Feedback" className="w-32 h-8" value={gradeForm.feedback} onChange={e => setGradeForm({...gradeForm, feedback: e.target.value})} />
                        <Button size="sm" className="h-8 bg-[#C5A55A]" onClick={() => handleGrade(subsDialog, s.submission_id)} data-testid="submit-grade"><CheckCircle className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setGradingSubId(s.submission_id)} data-testid={`grade-btn-${s.submission_id}`}>Grade</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {submissions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-4">No submissions yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlagiarismResultCard({ result, verdictColor }) {
  const [expanded, setExpanded] = React.useState(false);
  const score = result.similarity_score || 0;
  return (
    <div className="bg-white border border-slate-200 rounded-md p-3" data-testid={`plagiarism-result-${result.check_id}`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold ${score >= 70 ? 'bg-red-100 text-red-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-[#C5A55A]/15 text-[#C5A55A]'}`}>
            {score}%
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#1B2A4A] truncate">{result.student_1_name} vs {result.student_2_name}</p>
            <p className="text-[10px] text-slate-500 truncate">{result.summary}</p>
          </div>
          <Badge className={`${verdictColor(result.verdict)} text-[10px] shrink-0`}>{(result.verdict || '').replace(/_/g, ' ')}</Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
          {result.recommendation && <p className="text-xs text-slate-600"><span className="font-semibold">Recommendation:</span> {result.recommendation}</p>}
          {result.matching_passages?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Matching Passages</p>
              {result.matching_passages.map((m, i) => (
                <div key={i} className="bg-slate-50 rounded p-2 text-[11px] space-y-1">
                  <p className="text-slate-600"><span className="font-medium text-[#1B2A4A]">{result.student_1_name}:</span> "{m.text1_excerpt}"</p>
                  <p className="text-slate-600"><span className="font-medium text-[#1B2A4A]">{result.student_2_name}:</span> "{m.text2_excerpt}"</p>
                  <Badge className={`${m.similarity === 'high' ? 'bg-red-50 text-red-600' : m.similarity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'} text-[9px]`}>{m.similarity} match</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
      <div className="bg-slate-50 rounded-md p-4 space-y-3">{children}</div>
    </div>
  );
}
