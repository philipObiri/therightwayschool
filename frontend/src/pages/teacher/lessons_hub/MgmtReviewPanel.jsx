import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { AppLoader } from '../../../components/AppLoader';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Progress } from '../../../components/ui/progress';
import {
  ArrowLeft, ArrowRight, Send, FileText, CheckCircle, Eye, BarChart3, Sparkles, BookOpen, Download,
  AlertTriangle, MessageSquare, Shield, History, RotateCcw, Loader2
} from 'lucide-react';
import { STATUS_CONFIG, ApprovalChainBadge, ApprovalChainDetail, lessonTableCSS, injectTableStyles } from './shared';

export default function MgmtReviewPanel({ lessonId, onBack }) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [audit, setAudit] = useState([]);
  const [reviewComment, setReviewComment] = useState('');
  const [tab, setTab] = useState('content');
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = async () => {
    try { const res = await api.get(`/lessons-v2/${lessonId}`); setLesson(res.data); setComments(res.data.comments || []); setAudit(res.data.audit_trail || []); if (res.data.evaluation) setEvaluation(res.data.evaluation); } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [lessonId]);

  const handleAction = async (action) => {
    if ((action === 'return' || action === 'approve') && !reviewComment.trim()) { toast.error('Please add a comment'); return; }
    try { await api.post(`/lessons-v2/${lessonId}/review`, { action, comment: reviewComment }); successToast(`Action '${action}' completed`); setReviewComment(''); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  const handleEvaluate = async () => { setEvaluating(true); try { const res = await api.post(`/lessons-v2/${lessonId}/ai-evaluate`); setEvaluation(res.data); setTab('evaluation'); successToast(`Score: ${res.data.overall_score}/100`); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } setEvaluating(false); };
  const prefillFeedback = async () => {
    if (!evaluation) return;
    const lines = [`EVALUATION SCORE: ${evaluation.overall_score}/100 (${evaluation.grade})`, `\n${evaluation.summary}`];
    if (evaluation.errors?.length) { lines.push('\nISSUES:'); evaluation.errors.forEach((e, i) => lines.push(`${i + 1}. [${e.severity?.toUpperCase()}] ${e.issue} → ${e.suggestion}`)); }
    try { await api.post(`/lessons-v2/${lessonId}/comments`, { text: lines.join('\n') }); successToast('Feedback sent'); setReviewComment(lines.join('\n')); load(); setTab('comments'); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading || !lesson) return createPortal(<div className="fixed inset-0 bg-white flex items-center justify-center" style={{ zIndex: 9999 }}><AppLoader /></div>, document.body);
  const sc = STATUS_CONFIG[lesson.status] || STATUS_CONFIG.draft;
  const approvalChain = lesson.approval_chain || [];
  const currentStepIdx = approvalChain.findIndex(s => s.status === 'pending');
  const nextStep = currentStepIdx >= 0 && currentStepIdx + 1 < approvalChain.length ? approvalChain[currentStepIdx + 1] : null;
  const isLastStep = currentStepIdx >= 0 && currentStepIdx === approvalChain.length - 1;
  const forwardLabel = isLastStep ? 'Give Final Approval' : nextStep ? `Approve & Forward to ${nextStep.label}` : 'Approve';

  return createPortal(
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden" style={{ zIndex: 9999 }} data-testid="lesson-mgmt-review-panel">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-from-lesson-review"><ArrowLeft className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Back</span></Button>
          <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
          {evaluation && <Badge className={`text-xs hidden sm:flex ${evaluation.overall_score >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : evaluation.overall_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{evaluation.overall_score}%</Badge>}
          <span className="text-xs text-slate-400 hidden md:inline">v{lesson.version}</span>
        </div>
        <div className="flex gap-1.5 md:gap-2 flex-wrap justify-end">
          <Button size="sm" className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-xs" onClick={handleEvaluate} disabled={evaluating} data-testid="evaluate-lesson-btn">{evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}<span className="hidden sm:inline ml-1">{evaluating ? 'Eval...' : 'Evaluate'}</span></Button>
          {lesson.status === 'approved' && <Button size="sm" className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e] text-xs" onClick={() => handleAction('publish')} data-testid="publish-lesson"><BookOpen className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Publish</span></Button>}
          <a href={`${import.meta.env.VITE_API_URL}/api/lessons-v2/${lesson.lesson_id}/export-pdf?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg text-xs text-[#C5A55A] border-[#C5A55A]/30" data-testid="mgmt-view-lesson-pdf"><Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">PDF</span></Button>
          </a>
        </div>
      </div>

      {/* Meta row */}
      <div className="px-3 md:px-4 py-2 border-b border-slate-100 flex-shrink-0">
        <h2 className="text-base md:text-lg font-bold text-[#1B2A4A] truncate">{lesson.title}</h2>
        <div className="flex gap-2 md:gap-4 text-[10px] md:text-xs text-slate-500 mt-1 flex-wrap">
          <span>Teacher: <strong>{lesson.teacher_name}</strong></span>
          <span>Subject: <strong>{lesson.subject_name}</strong></span>
          <span className="hidden sm:inline">Year: <strong>{lesson.year_group}</strong></span>
          <span className="hidden sm:inline">Term: <strong>{lesson.term}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 px-2 md:px-4 flex-shrink-0 overflow-x-auto">
        {[{ k: 'content', l: 'Content', icon: BookOpen }, { k: 'chain', l: 'Approval', icon: Shield }, { k: 'evaluation', l: evaluation ? `Eval (${evaluation.overall_score}%)` : 'Eval', icon: BarChart3 }, { k: 'comments', l: `Comments (${comments.length})`, icon: MessageSquare }, { k: 'history', l: 'Audit', icon: History }].map(t => (
          <button key={t.k} className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 flex items-center gap-1 whitespace-nowrap ${tab === t.k ? 'border-[#2E6CC4] text-[#2E6CC4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setTab(t.k)}>
            <t.icon className="w-3.5 h-3.5" />{t.l}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0"><div className="flex-1 overflow-y-auto p-3 md:p-4">
        {tab === 'content' && (lesson.rich_content ? <div className="lesson-html-view overflow-x-auto"><style>{lessonTableCSS}</style><div dangerouslySetInnerHTML={{ __html: injectTableStyles(lesson.rich_content) }} data-testid="lesson-content-display" /></div> : <div className="text-center py-12 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" /><p>No digital content</p></div>)}
        {tab === 'chain' && <div className="space-y-4"><h3 className="text-sm font-semibold text-[#1B2A4A]">Approval Chain</h3><ApprovalChainDetail chain={lesson.approval_chain} /></div>}
        {tab === 'evaluation' && (!evaluation ? <div className="text-center py-16 text-slate-400"><BarChart3 className="w-16 h-16 mx-auto mb-3 text-slate-200" /><p className="text-lg font-medium">No evaluation yet</p><p className="text-sm">Click <strong>"Evaluate"</strong></p></div> : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 bg-slate-50 rounded-lg p-4 md:p-6">
              <div className="text-center"><div className={`text-4xl md:text-5xl font-black ${evaluation.overall_score >= 80 ? 'text-[#C5A55A]' : evaluation.overall_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{evaluation.overall_score}</div><div className="text-xs text-slate-500 mt-1">out of 100</div><Badge className={`mt-2 ${evaluation.overall_score >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : evaluation.overall_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{evaluation.grade}</Badge></div>
              <div className="flex-1"><p className="text-sm text-slate-700">{evaluation.summary}</p>{evaluation.strengths?.length > 0 && <div className="mt-3"><p className="text-xs font-semibold text-[#C5A55A] uppercase">Strengths</p>{evaluation.strengths.map((s, i) => <p key={i} className="text-xs text-[#C5A55A]">+ {s}</p>)}</div>}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{(evaluation.categories || []).map((c, i) => (<div key={i} className="bg-white rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-[#1B2A4A]">{c.name}</span><span className={`text-sm font-bold ${c.score >= 80 ? 'text-[#C5A55A]' : c.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{c.score}%</span></div><Progress value={c.score} className="h-1.5 mb-2" /><p className="text-[10px] text-slate-500">{c.feedback}</p></div>))}</div>
            {evaluation.errors?.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold text-red-700 uppercase">Issues</h4>{evaluation.errors.map((e, i) => (<div key={i} className="bg-red-50 rounded-lg p-3 border border-red-200 text-xs"><div className="flex items-center gap-2 mb-1"><Badge className={`text-[9px] ${e.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{e.severity?.toUpperCase()}</Badge><span className="font-medium text-red-800">{e.issue}</span></div><p className="text-red-600">Fix: {e.suggestion}</p></div>))}</div>}
            <Button className="rounded-lg bg-[#2E6CC4] w-full text-xs md:text-sm" onClick={prefillFeedback} data-testid="send-evaluation-feedback"><Send className="w-4 h-4 mr-2" /> Send Evaluation as Feedback</Button>
          </div>
        ))}
        {tab === 'comments' && <Card className="rounded-lg border-slate-100"><CardContent className="p-3 md:p-4 space-y-3">
          {comments.map((c, i) => (<div key={i} className={`p-3 rounded-lg text-sm ${c.is_management ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}><div className="flex justify-between mb-1 flex-wrap gap-1"><strong className={c.is_management ? 'text-amber-800' : 'text-slate-700'}>{c.user_name}</strong><span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleString()}</span></div>{c.action && <Badge className="text-[10px] mb-1" variant="secondary">{c.action}</Badge>}<p className="text-slate-600">{c.text}</p></div>))}
          {comments.length === 0 && <p className="text-center text-slate-400 py-8">No comments</p>}
          <div className="flex gap-2 pt-2 border-t border-slate-100"><Input value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Add feedback..." className="rounded-lg" /><Button size="sm" className="rounded-lg bg-[#2E6CC4]" onClick={() => { if (reviewComment.trim()) { api.post(`/lessons-v2/${lessonId}/comments`, { text: reviewComment }).then(() => { setReviewComment(''); load(); }); }}}><Send className="w-3.5 h-3.5" /></Button></div>
        </CardContent></Card>}
        {tab === 'history' && <Card className="rounded-lg border-slate-100"><CardContent className="p-3 md:p-4"><div className="space-y-2">{audit.map((a, i) => (<div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"><div className="w-2 h-2 rounded-full bg-[#2E6CC4] mt-1.5 flex-shrink-0" /><div className="flex-1"><p className="text-sm text-[#1B2A4A]"><strong>{a.user_name}</strong> — {a.action}</p>{a.details && <p className="text-xs text-slate-400">{a.details}</p>}<p className="text-[10px] text-slate-300">{new Date(a.timestamp).toLocaleString()}</p></div></div>))}{audit.length === 0 && <p className="text-center text-slate-400 py-8">No activity</p>}</div></CardContent></Card>}
      </div></div>

      {/* Sticky review bar */}
      {['submitted', 'resubmitted', 'under_review'].includes(lesson.status) && (
        <div className="flex-shrink-0 border-t-2 border-[#2E6CC4] bg-slate-50 px-3 md:px-4 py-3" data-testid="lesson-review-bottom-bar">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <div className="flex-1 w-full">
              <Label className="text-xs font-semibold text-[#1B2A4A] uppercase mb-1.5 block flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Review Comment <span className="text-red-500">*</span></Label>
              <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={2} placeholder="Add review feedback..." className="rounded-lg font-mono text-sm resize-none" data-testid="lesson-review-comment" />
            </div>
            <div className="flex flex-row sm:flex-col gap-2 sm:pt-5 flex-wrap">
              {lesson.status !== 'under_review' && <Button size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap text-xs" onClick={() => handleAction('start_review')} data-testid="start-lesson-review"><Eye className="w-3.5 h-3.5 mr-1" /> Start Review</Button>}
              <Button size="sm" className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e] whitespace-nowrap text-xs" onClick={() => handleAction('approve')} data-testid="approve-lesson"><ArrowRight className="w-3.5 h-3.5 mr-1" /> {forwardLabel}</Button>
              <Button size="sm" className="rounded-lg bg-red-600 hover:bg-red-700 whitespace-nowrap text-xs" onClick={() => handleAction('return')} data-testid="return-lesson"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Return</Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
