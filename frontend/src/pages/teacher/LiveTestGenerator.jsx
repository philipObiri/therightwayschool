import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import {
  Upload, Zap, CheckCircle, XCircle, ArrowLeft, Send, Edit3,
  Save, Users, Eye, BarChart3, Trash2, Plus, EyeOff, FileDown, Award, ImagePlus, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';
import DiagramGenerator from '../../components/DiagramGenerator';

export default function LiveTestGenerator() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [mode, setMode] = useState('list'); // list, preview, edit, results
  const [editQuestions, setEditQuestions] = useState([]);
  const [editTitle, setEditTitle] = useState('');
  const [publishDialog, setPublishDialog] = useState(false);
  const [publishForm, setPublishForm] = useState({ class_ids: [], score_type: 'progressive_test_1', max_score: 100 });
  const [submissions, setSubmissions] = useState([]);
  const [questionType, setQuestionType] = useState('mcq');
  const [studentView, setStudentView] = useState(false);
  const [diagramIdx, setDiagramIdx] = useState(null);
  const fileInputRef = useRef(null);

  const BACKEND = import.meta.env.VITE_API_URL;
  const teacherYears = user?.assigned_year_groups || [];

  const downloadPdf = (quizId, withAnswers) => {
    const token = localStorage.getItem('rw_token');
    const url = `${BACKEND}/api/quiz/${quizId}/pdf?include_answers=${withAnswers}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `quiz_${withAnswers ? 'answers' : 'student'}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(withAnswers ? 'Answer key PDF downloaded' : 'Student copy PDF downloaded');
      })
      .catch(() => toast.error('Failed to download PDF'));
  };

  useEffect(() => {
    Promise.all([
      api.get('/quiz/list').then(r => setQuizzes(r.data)),
      api.get('/academic/classes').then(r => setClasses(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filteredClasses = teacherYears.length > 0 ? classes.filter(c => teacherYears.includes(c.year_group)) : classes;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) { toast.error('Only PDF files'); return; }
    setGenerating(true);
    const label = questionType === 'essay' ? '5 essay questions' : questionType === 'structured' ? '15 structured questions' : '40 MCQs';
    toast.info(`AI generating ${label}... this may take a minute`);
    try {
      const fd = new FormData(); fd.append('file', file);
      const endpoints = { mcq: '/quiz/generate-from-pdf', structured: '/quiz/generate-structured', essay: '/quiz/generate-essay' };
      const res = await api.post(endpoints[questionType], fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
      successToast(`Generated ${res.data.question_count} questions!`);
      setSelectedQuiz(res.data);
      setEditQuestions(JSON.parse(JSON.stringify(res.data.questions || [])));
      setEditTitle(res.data.title || '');
      setMode('preview');
      const list = await api.get('/quiz/list'); setQuizzes(list.data);
    } catch (err) {
      const msg = err.response?.data?.detail || (err.code === 'ECONNABORTED' ? 'Request timed out — please try again with a smaller PDF.' : 'Generation failed. Please try again.');
      toast.error(msg);
    }
    setGenerating(false);
    e.target.value = '';
  };

  const openQuiz = async (quiz) => {
    try {
      const res = await api.get(`/quiz/${quiz.quiz_id}`);
      setSelectedQuiz(res.data);
      setEditQuestions(JSON.parse(JSON.stringify(res.data.questions || [])));
      setEditTitle(res.data.title || '');
      setMode('preview');
    } catch { toast.error('Failed'); }
  };

  const saveEdits = async () => {
    try {
      await api.put(`/quiz/${selectedQuiz.quiz_id}`, { title: editTitle, questions: editQuestions });
      successToast('Quiz saved');
      setSelectedQuiz(p => ({ ...p, title: editTitle, questions: editQuestions, question_count: editQuestions.length }));
      setMode('preview');
    } catch { toast.error('Failed to save'); }
  };

  const updateQuestion = (idx, field, value) => {
    const qs = [...editQuestions];
    if (field.startsWith('option_')) { qs[idx].options[field.replace('option_', '')] = value; }
    else { qs[idx][field] = value; }
    setEditQuestions(qs);
  };

  const deleteQuestion = (idx) => {
    const qs = editQuestions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, number: i + 1 }));
    setEditQuestions(qs);
  };

  const addQuestion = () => {
    setEditQuestions([...editQuestions, { number: editQuestions.length + 1, question: '', options: { A: '', B: '', C: '', D: '' }, correct: 'A', explanation: '' }]);
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm('Delete this quiz permanently? This will also remove all student submissions.')) return;
    try {
      await api.delete(`/quiz/${quizId}`);
      successToast('Quiz deleted');
      setMode('list'); setSelectedQuiz(null);
      const list = await api.get('/quiz/list'); setQuizzes(list.data);
    } catch { toast.error('Failed'); }
  };

  const handleHideQuiz = async (quizId) => {
    try {
      await api.post(`/quiz/${quizId}/hide`);
      successToast('Quiz hidden from students');
      const list = await api.get('/quiz/list'); setQuizzes(list.data);
      if (selectedQuiz) setSelectedQuiz(p => ({ ...p, published: false, class_ids: [] }));
    } catch { toast.error('Failed'); }
  };

  const handlePublish = async () => {
    if (publishForm.class_ids.length === 0) { toast.error('Select at least one class'); return; }
    try {
      await api.post(`/quiz/${selectedQuiz.quiz_id}/publish`, publishForm);
      successToast('Quiz published! Students will see it when they log in.');
      setPublishDialog(false);
      const list = await api.get('/quiz/list'); setQuizzes(list.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handlePublishToStaff = async (quizId) => {
    try {
      const res = await api.post(`/quiz/${quizId}/publish-staff`);
      successToast(res.data.message);
      setSelectedQuiz(p => ({ ...p, published_to_staff: true }));
    } catch { toast.error('Failed'); }
  };

  const viewSubmissions = async (quiz) => {
    try {
      const [quizRes, subsRes] = await Promise.all([
        api.get(`/quiz/${quiz.quiz_id}`),
        api.get(`/quiz/${quiz.quiz_id}/submissions`),
      ]);
      setSelectedQuiz(quizRes.data);
      setSubmissions(subsRes.data);
      setMode('results');
    } catch { toast.error('Failed'); }
  };

  const togglePublishClass = (cid) => {
    const ids = publishForm.class_ids.includes(cid) ? publishForm.class_ids.filter(id => id !== cid) : [...publishForm.class_ids, cid];
    setPublishForm({ ...publishForm, class_ids: ids });
  };

  if (loading) return <AppLoader />;

  // ─── Edit Mode ───
  if (mode === 'edit' && selectedQuiz) {
    const isStructured = selectedQuiz.quiz_type === 'structured' || selectedQuiz.quiz_type === 'essay';
    return (
      <>
      <div className="space-y-6" data-testid="quiz-edit">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode('preview')}><ArrowLeft className="w-4 h-4 mr-1" /> Back to Preview</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-md text-xs" onClick={addQuestion}><Plus className="w-3 h-3 mr-1" /> Add Question</Button>
            <Button className="rounded-md bg-[#C5A55A]" onClick={saveEdits} data-testid="save-quiz"><Save className="w-4 h-4 mr-2" /> Save Changes</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Quiz Title</Label>
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-lg font-semibold" data-testid="edit-quiz-title" />
        </div>
        <p className="text-xs text-slate-500">{editQuestions.length} questions {isStructured && `| Total marks: ${editQuestions.reduce((a, q) => a + (q.marks || 0), 0)}`}</p>
        <div className="space-y-4">
          {editQuestions.map((q, idx) => (
            <Card key={idx} className="rounded-md border-slate-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2E6CC4] bg-blue-50 px-2 py-1 rounded">Q{q.number}</span>
                    {isStructured && <Badge className="bg-amber-50 text-amber-700 text-[10px]">{q.marks || 0} marks</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7" onClick={() => deleteQuestion(idx)}><Trash2 className="w-3 h-3" /></Button>
                </div>
                <Textarea value={q.question} onChange={e => updateQuestion(idx, 'question', e.target.value)} rows={isStructured ? 3 : 2} className="text-sm" data-testid={`edit-q-${q.number}`} />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs text-[#2E6CC4] border-blue-200 h-7" onClick={() => setDiagramIdx(idx)} data-testid={`diagram-btn-${q.number}`}><ImagePlus className="w-3 h-3 mr-1" /> AI Diagram</Button>
                  {q.image_url && <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7" onClick={() => updateQuestion(idx, 'image_url', null)}>Remove Image</Button>}
                </div>
                {q.image_url && <img src={q.image_url} alt={`Diagram for Q${q.number}`} className="w-full max-w-md rounded-lg border border-slate-200" data-testid={`diagram-img-${q.number}`} />}
                {isStructured ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs">Marks</Label><Input type="number" value={q.marks || 0} onChange={e => updateQuestion(idx, 'marks', parseInt(e.target.value) || 0)} className="h-8 text-xs" /></div>
                      <div className="space-y-1"><Label className="text-xs">Command Word</Label><Input value={q.command_word || ''} onChange={e => updateQuestion(idx, 'command_word', e.target.value)} placeholder="Explain, Discuss..." className="h-8 text-xs" /></div>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Model Answer</Label><Textarea value={q.model_answer || ''} onChange={e => updateQuestion(idx, 'model_answer', e.target.value)} rows={3} className="text-xs" /></div>
                    <div className="space-y-1"><Label className="text-xs">Marking Guide</Label><Textarea value={q.marking_guide || ''} onChange={e => updateQuestion(idx, 'marking_guide', e.target.value)} rows={2} className="text-xs" /></div>
                    {q.essay_guidance !== undefined && <div className="space-y-1"><Label className="text-xs">Essay Guidance</Label><Textarea value={q.essay_guidance || ''} onChange={e => updateQuestion(idx, 'essay_guidance', e.target.value)} rows={2} className="text-xs" /></div>}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <button onClick={() => updateQuestion(idx, 'correct', opt)} className={`w-7 h-7 rounded-md text-xs font-bold flex-shrink-0 border-2 ${q.correct === opt ? 'bg-[#C5A55A] text-white border-[#C5A55A]' : 'border-slate-300 text-slate-500'}`}>{opt}</button>
                          <Input value={q.options?.[opt] || ''} onChange={e => updateQuestion(idx, `option_${opt}`, e.target.value)} className="text-xs h-8" />
                        </div>
                      ))}
                    </div>
                    <Input value={q.explanation || ''} onChange={e => updateQuestion(idx, 'explanation', e.target.value)} placeholder="Explanation (optional)" className="text-xs h-8" />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <DiagramGenerator
        open={diagramIdx !== null}
        onClose={() => setDiagramIdx(null)}
        onInsert={(imageUrl) => {
          if (diagramIdx !== null) {
            updateQuestion(diagramIdx, 'image_url', imageUrl);
            setDiagramIdx(null);
          }
        }}
        defaultSubject={selectedQuiz?.subject_name || 'general'}
      />
    </>
    );
  }
  if (mode === 'preview' && selectedQuiz) {
    return (
      <div className="space-y-6" data-testid="quiz-preview">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setMode('list'); setSelectedQuiz(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant={studentView ? 'default' : 'outline'} className={`rounded-md ${studentView ? 'bg-amber-600 hover:bg-amber-700' : ''}`} onClick={() => setStudentView(!studentView)} data-testid="toggle-student-view"><Eye className="w-4 h-4 mr-2" /> {studentView ? 'Student View' : 'Teacher View'}</Button>
            <Button variant="outline" className="rounded-md" onClick={() => downloadPdf(selectedQuiz.quiz_id, true)} data-testid="download-pdf-answers"><FileDown className="w-4 h-4 mr-2" /> PDF (Answers)</Button>
            <Button variant="outline" className="rounded-md" onClick={() => downloadPdf(selectedQuiz.quiz_id, false)} data-testid="download-pdf-student"><FileDown className="w-4 h-4 mr-2" /> PDF (Student)</Button>
            <Button variant="outline" className="rounded-md" onClick={() => setMode('edit')} data-testid="edit-quiz-btn"><Edit3 className="w-4 h-4 mr-2" /> Edit</Button>
            {selectedQuiz.published && <Button variant="outline" className="rounded-md" onClick={() => viewSubmissions(selectedQuiz)} data-testid="view-results-btn"><BarChart3 className="w-4 h-4 mr-2" /> Results</Button>}
            {selectedQuiz.published && <Button variant="outline" className="rounded-md text-amber-600 border-amber-200" onClick={() => handleHideQuiz(selectedQuiz.quiz_id)} data-testid="hide-quiz-btn"><EyeOff className="w-4 h-4 mr-2" /> Hide from Students</Button>}
            <Button variant="outline" className="rounded-md text-red-600 border-red-200" onClick={() => handleDeleteQuiz(selectedQuiz.quiz_id)} data-testid="delete-quiz-btn"><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
            {!selectedQuiz.published && <Button className="rounded-md bg-[#2E6CC4]" onClick={() => setPublishDialog(true)} data-testid="publish-quiz-btn"><Send className="w-4 h-4 mr-2" /> Publish to Students</Button>}
            {!selectedQuiz.published_to_staff && <Button className="rounded-md bg-[#1B2A4A] hover:bg-[#0E2E68]" onClick={() => handlePublishToStaff(selectedQuiz.quiz_id)} data-testid="publish-staff-btn"><Award className="w-4 h-4 mr-2" /> Publish as CPD Test</Button>}
            {selectedQuiz.published_to_staff && <Badge className="bg-blue-100 text-[#1B2A4A]">CPD Test Active</Badge>}
          </div>
        </div>
        {studentView && <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 text-xs text-amber-700 font-medium">Showing student view — answers, model answers and marking guides are hidden</div>}
        <div className="bg-white rounded-md border border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#1B2A4A]">{selectedQuiz.title}</h2>
            <Badge className={selectedQuiz.quiz_type === 'essay' ? 'bg-amber-100 text-amber-700' : selectedQuiz.quiz_type === 'structured' ? 'bg-blue-100 text-[#1B2A4A]' : 'bg-blue-100 text-blue-700'}>{selectedQuiz.quiz_type === 'essay' ? 'Essay' : selectedQuiz.quiz_type === 'structured' ? 'Structured' : 'MCQ'}</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">{selectedQuiz.question_count} questions{selectedQuiz.total_marks ? ` | ${selectedQuiz.total_marks} marks` : ''} | {selectedQuiz.source_filename}</p>
          {selectedQuiz.published && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] mt-2">Published</Badge>}
          {studentView && <div className="mt-3 space-y-1"><p className="text-sm text-slate-500">Name: ___________________________  Class: _____________  Date: _____________</p></div>}
        </div>
        <div className="space-y-3">
          {(selectedQuiz.questions || []).map((q, idx) => (
            <Card key={idx} className="rounded-md border-slate-100">
              <CardContent className="p-4">
                {(selectedQuiz.quiz_type === 'structured' || selectedQuiz.quiz_type === 'essay') ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[#2E6CC4] font-bold text-sm">Q{q.number}.</span>
                      <Badge className="bg-amber-50 text-amber-700 text-[10px]">{q.marks} marks</Badge>
                      {q.command_word && <Badge variant="secondary" className="text-[10px]">{q.command_word}</Badge>}
                    </div>
                    <p className="text-sm text-[#1B2A4A] mb-3 whitespace-pre-wrap">{q.question}</p>
                    {q.image_url && <img src={q.image_url} alt={`Diagram for Q${q.number}`} className="w-full max-w-md rounded-lg border border-slate-200 mb-3" />}
                    {studentView ? (
                      <div className="space-y-1 mt-2">{Array.from({ length: Math.max(4, (q.marks || 4) * 2) }, (_, i) => <div key={i} className="border-b border-slate-200 h-6" />)}</div>
                    ) : (
                      <>
                        {q.essay_guidance && <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-2"><p className="text-[10px] font-semibold text-slate-600 mb-1">Essay Guidance</p><p className="text-xs text-slate-700 whitespace-pre-wrap">{q.essay_guidance}</p></div>}
                        {q.model_answer && <div className="bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-md p-3 mb-2"><p className="text-[10px] font-semibold text-[#C5A55A] mb-1">Model Answer</p><p className="text-xs text-[#1B2A4A] whitespace-pre-wrap">{q.model_answer}</p></div>}
                        {q.marking_guide && <div className="bg-blue-50 border border-blue-200 rounded-md p-3"><p className="text-[10px] font-semibold text-blue-700 mb-1">Marking Guide</p><p className="text-xs text-blue-900 whitespace-pre-wrap">{q.marking_guide}</p></div>}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[#1B2A4A] mb-2"><span className="text-[#2E6CC4] mr-1">Q{q.number}.</span> {q.question}</p>
                    {q.image_url && <img src={q.image_url} alt={`Diagram for Q${q.number}`} className="w-full max-w-md rounded-lg border border-slate-200 mb-2" />}
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(q.options || {}).map(([k, v]) => (
                        <div key={k} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${!studentView && k === q.correct ? 'bg-[#C5A55A]/10 border border-[#C5A55A]/40 text-[#C5A55A] font-semibold' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                          <span className="font-bold">{k}.</span> {v} {!studentView && k === q.correct && <CheckCircle className="w-3 h-3 ml-auto" />}
                        </div>
                      ))}
                    </div>
                    {!studentView && q.explanation && <p className="text-[10px] text-slate-400 mt-2">Explanation: {q.explanation}</p>}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Publish Dialog */}
        <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Publish Quiz to Students</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Classes</Label>
                <div className="grid grid-cols-3 gap-2">
                  {filteredClasses.map(c => (
                    <button key={c.class_id} onClick={() => togglePublishClass(c.class_id)} className={`px-3 py-2 rounded-md text-xs font-medium border-2 transition-all ${publishForm.class_ids.includes(c.class_id) ? 'border-[#2E6CC4] bg-blue-50 text-[#2E6CC4]' : 'border-slate-200 text-slate-600'}`}>{c.name}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Score Type</Label>
                  <Select value={publishForm.score_type} onValueChange={v => setPublishForm({...publishForm, score_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="progressive_test_1">Progressive Test 1</SelectItem>
                      <SelectItem value="progressive_test_2">Progressive Test 2</SelectItem>
                      <SelectItem value="progressive_test_3">Progressive Test 3</SelectItem>
                      <SelectItem value="mid_term">Mid Term</SelectItem>
                      <SelectItem value="mock">Mock Exam</SelectItem>
                      <SelectItem value="classwork">Classwork</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Max Score</Label><Input type="number" value={publishForm.max_score} onChange={e => setPublishForm({...publishForm, max_score: parseInt(e.target.value) || 100})} /></div>
              </div>
              <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-700">Students in the selected classes will see this quiz and it will be auto-marked when they answer. Score recorded as {publishForm.score_type.replace(/_/g, ' ')}.</div>
              <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={handlePublish} data-testid="confirm-publish"><Send className="w-4 h-4 mr-2" /> Publish to {publishForm.class_ids.length} Class(es)</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Results Mode ───
  if (mode === 'results' && selectedQuiz) {
    const avgScore = submissions.length > 0 ? (submissions.reduce((a, s) => a + s.percentage, 0) / submissions.length).toFixed(1) : 0;
    return (
      <div className="space-y-6" data-testid="quiz-results">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode('preview')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h2 className="text-sm font-semibold">{selectedQuiz.title} - Results</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card text-center"><p className="text-2xl font-bold">{submissions.length}</p><p className="text-xs text-slate-500">Submissions</p></div>
          <div className="stat-card text-center"><p className="text-2xl font-bold text-[#2E6CC4]">{avgScore}%</p><p className="text-xs text-slate-500">Average Score</p></div>
          <div className="stat-card text-center"><p className="text-2xl font-bold">{selectedQuiz.question_count}</p><p className="text-xs text-slate-500">Questions</p></div>
        </div>
        <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
          <table className="w-full"><thead><tr className="bg-slate-50"><th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Student</th><th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">Correct</th><th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">Score</th><th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">%</th><th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">Time</th></tr></thead>
          <tbody>{submissions.map(s => (
            <tr key={s.submission_id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-sm font-medium">{s.student_name}</td>
              <td className="text-center text-sm">{s.correct_count}/{s.total_questions}</td>
              <td className="text-center text-sm font-semibold">{s.score}/{s.max_score}</td>
              <td className="text-center"><Badge className={s.percentage >= 60 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : s.percentage >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{s.percentage}%</Badge></td>
              <td className="text-center text-xs text-slate-400">{new Date(s.submitted_at).toLocaleString()}</td>
            </tr>
          ))}{submissions.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No submissions yet</td></tr>}</tbody></table>
        </div>
      </div>
    );
  }

  // ─── Quiz List + Upload ───
  return (
    <div className="space-y-6" data-testid="live-test-generator">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">AI Live Test Generator</h1><p className="text-slate-500 mt-1">Upload PDF, AI creates questions, edit, then publish to students</p></div>
      <Card className="rounded-md border-2 border-dashed border-[#2E6CC4] bg-blue-50/30">
        <CardContent className="p-8 text-center">
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
          <Zap className="w-12 h-12 text-[#2E6CC4] mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[#1B2A4A] mb-2">Generate Test from PDF</h3>
          <p className="text-sm text-slate-500 mb-5">Upload any PDF and AI will generate questions automatically</p>
          <div className="flex justify-center gap-3 mb-5">
            <button onClick={() => setQuestionType('mcq')} className={`px-4 py-3 rounded-md text-sm font-semibold border-2 transition-all ${questionType === 'mcq' ? 'border-[#2E6CC4] bg-[#2E6CC4] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`} data-testid="type-mcq">
              Multiple Choice<br/><span className="text-[10px] font-normal opacity-80">40 MCQs, auto-marked</span>
            </button>
            <button onClick={() => setQuestionType('structured')} className={`px-4 py-3 rounded-md text-sm font-semibold border-2 transition-all ${questionType === 'structured' ? 'border-[#2E6CC4] bg-[#1B2A4A] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`} data-testid="type-structured">
              Structured<br/><span className="text-[10px] font-normal opacity-80">15 short/long answer Qs</span>
            </button>
            <button onClick={() => setQuestionType('essay')} className={`px-4 py-3 rounded-md text-sm font-semibold border-2 transition-all ${questionType === 'essay' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`} data-testid="type-essay">
              Essay<br/><span className="text-[10px] font-normal opacity-80">5 extended essays, 20 marks each</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">{questionType === 'mcq' ? '40 MCQs with A/B/C/D options, auto-marked when students submit' : questionType === 'structured' ? '15 structured questions with marks, model answers & marking guides' : '5 extended essay questions (300-500 words each) with model answers & band descriptors'}</p>
          <Button className="rounded-md bg-[#2E6CC4] h-11 px-8" onClick={() => fileInputRef.current?.click()} disabled={generating} data-testid="upload-pdf-btn">
            {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-md animate-spin mr-2" /> Generating...</> : <><Upload className="w-4 h-4 mr-2" /> Upload PDF</>}
          </Button>
        </CardContent>
      </Card>
      {quizzes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">My Tests ({quizzes.length})</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map(q => (
              <Card key={q.quiz_id} className="rounded-md border-slate-100 card-hover cursor-pointer" onClick={() => openQuiz(q)} data-testid={`quiz-${q.quiz_id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Zap className="w-5 h-5 text-[#2E6CC4]" />
                    <div className="flex gap-1">
                      <Badge className={q.quiz_type === 'essay' ? 'bg-amber-100 text-amber-700' : q.quiz_type === 'structured' ? 'bg-blue-100 text-[#1B2A4A]' : 'bg-blue-100 text-blue-700'}>{q.quiz_type === 'essay' ? 'Essay' : q.quiz_type === 'structured' ? 'Structured' : 'MCQ'}</Badge>
                      <Badge className="bg-blue-100 text-[#1B2A4A]">{q.question_count} Qs</Badge>
                      {q.published && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Published</Badge>}
                    </div>
                  </div>
                  <h3 className="font-semibold text-[#1B2A4A] mb-1 line-clamp-2">{q.title}</h3>
                  <p className="text-xs text-slate-400">{q.source_filename} | {new Date(q.created_at).toLocaleDateString()}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="text-xs h-7 rounded-md" onClick={e => { e.stopPropagation(); openQuiz(q); }}><Eye className="w-3 h-3 mr-1" /> View</Button>
                    {q.published && <Button size="sm" variant="outline" className="text-xs h-7 rounded-md text-amber-600 border-amber-200" onClick={e => { e.stopPropagation(); handleHideQuiz(q.quiz_id); }}><EyeOff className="w-3 h-3 mr-1" /> Hide</Button>}
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500" onClick={e => { e.stopPropagation(); handleDeleteQuiz(q.quiz_id); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
