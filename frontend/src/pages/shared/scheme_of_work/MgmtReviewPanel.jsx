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
import { STATUS_CONFIG, ApprovalChainBadge, ApprovalChainDetail, schemeTableCSS, injectTableStyles } from './shared';

export default function MgmtReviewPanel({ schemeId, onBack }) {
  const { user } = useAuth();
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [audit, setAudit] = useState([]);
  const [reviewComment, setReviewComment] = useState('');
  const [tab, setTab] = useState('content');
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = async () => {
    try { const res = await api.get(`/schemes/${schemeId}`); setScheme(res.data); setComments(res.data.comments || []); setAudit(res.data.audit_trail || []); if (res.data.evaluation) setEvaluation(res.data.evaluation); } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [schemeId]);

  const handleAction = async (action) => {
    if ((action === 'return' || action === 'approve') && !reviewComment.trim()) { toast.error('Please add a comment'); return; }
    try { await api.post(`/schemes/${schemeId}/review`, { action, comment: reviewComment }); successToast(`Action '${action}' completed`); setReviewComment(''); load(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  const handleEvaluate = async () => { setEvaluating(true); try { const res = await api.post(`/schemes/${schemeId}/ai-evaluate`); setEvaluation(res.data); setTab('evaluation'); successToast(`Score: ${res.data.overall_score}/100`); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } setEvaluating(false); };
  const prefillFeedback = async () => {
    if (!evaluation) return;
    const lines = [`EVALUATION SCORE: ${evaluation.overall_score}/100 (${evaluation.grade})`, `\n${evaluation.summary}`];
    if (evaluation.errors?.length) { lines.push('\nISSUES:'); evaluation.errors.forEach((e, i) => lines.push(`${i + 1}. [${e.severity?.toUpperCase()}] Week ${e.week}: ${e.issue} → ${e.suggestion}`)); }
    try { await api.post(`/schemes/${schemeId}/comments`, { text: lines.join('\n') }); successToast('Feedback sent'); setReviewComment(lines.join('\n')); load(); setTab('comments'); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading || !scheme) return createPortal(<div className="fixed inset-0 bg-white flex items-center justify-center" style={{ zIndex: 9999 }}><AppLoader /></div>, document.body);
  const sc = STATUS_CONFIG[scheme.status] || STATUS_CONFIG.draft;
  const scoreColor = (s) => s >= 80 ? 'text-[#C5A55A]' : s >= 60 ? 'text-amber-600' : 'text-red-600';
  const approvalChain = scheme.approval_chain || [];
  const currentStepIdx = approvalChain.findIndex(s => s.status === 'pending');
  const nextStep = currentStepIdx >= 0 && currentStepIdx + 1 < approvalChain.length ? approvalChain[currentStepIdx + 1] : null;
  const isLastStep = currentStepIdx >= 0 && currentStepIdx === approvalChain.length - 1;
  const forwardLabel = isLastStep ? 'Give Final Approval' : nextStep ? `Approve & Forward to ${nextStep.label}` : 'Approve';

  return createPortal(
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden" style={{ zIndex: 9999 }} data-testid="mgmt-review-panel">
      <div className="flex items-center justify-between px-2 md:px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-from-review"><ArrowLeft className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Back</span></Button>
          <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
          {evaluation && <Badge className={`text-xs hidden sm:flex ${evaluation.overall_score >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : evaluation.overall_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{evaluation.overall_score}%</Badge>}
        </div>
        <div className="flex gap-1.5 md:gap-2 flex-wrap justify-end">
          <Button size="sm" className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-xs" onClick={handleEvaluate} disabled={evaluating} data-testid="evaluate-btn">{evaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}<span className="hidden sm:inline ml-1">{evaluating ? 'Eval...' : 'Evaluate'}</span></Button>
          {scheme.status === 'approved' && <Button size="sm" className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e] text-xs" onClick={() => handleAction('publish')} data-testid="publish-scheme"><BookOpen className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Publish</span></Button>}
          <a href={`${import.meta.env.VITE_API_URL}/api/schemes/${scheme.scheme_id}/export-pdf?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="rounded-lg text-xs text-[#C5A55A] border-[#C5A55A]/30" data-testid="mgmt-view-scheme-pdf"><Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">PDF</span></Button></a>
        </div>
      </div>

      <div className="px-3 md:px-4 py-2 border-b border-slate-100 flex-shrink-0">
        <h2 className="text-base md:text-lg font-bold text-[#1B2A4A] truncate">{scheme.title}</h2>
        <div className="flex gap-2 md:gap-4 text-[10px] md:text-xs text-slate-500 mt-1 flex-wrap">
          <span>Teacher: <strong>{scheme.teacher_name}</strong></span><span>Subject: <strong>{scheme.subject_name}</strong></span><span className="hidden sm:inline">Year: <strong>{scheme.year_group}</strong></span><span className="hidden sm:inline">Term: <strong>{scheme.term}</strong></span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 px-2 md:px-4 flex-shrink-0 overflow-x-auto">
        {[{ k: 'content', l: 'Content', icon: BookOpen }, { k: 'chain', l: 'Approval', icon: Shield }, { k: 'evaluation', l: evaluation ? `Eval (${evaluation.overall_score}%)` : 'Eval', icon: BarChart3 }, { k: 'comments', l: `Comments (${comments.length})`, icon: MessageSquare }, { k: 'history', l: 'Audit', icon: History }].map(t => (
          <button key={t.k} className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 flex items-center gap-1 whitespace-nowrap ${tab === t.k ? 'border-[#2E6CC4] text-[#2E6CC4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setTab(t.k)}><t.icon className="w-3.5 h-3.5" />{t.l}</button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0"><div className="flex-1 overflow-y-auto p-3 md:p-4">
        {tab === 'content' && (scheme.rich_content ? <div className="scheme-html-view overflow-x-auto"><style>{schemeTableCSS}</style><div dangerouslySetInnerHTML={{ __html: injectTableStyles(scheme.rich_content) }} data-testid="scheme-content-display" /></div> : <div className="text-center py-12 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" /><p>No content</p></div>)}
        {tab === 'chain' && <div className="space-y-4"><h3 className="text-sm font-semibold text-[#1B2A4A]">Approval Chain</h3><ApprovalChainDetail chain={scheme.approval_chain} /></div>}
        {tab === 'evaluation' && (!evaluation ? <div className="text-center py-16 text-slate-400"><BarChart3 className="w-14 h-14 mx-auto mb-4 text-slate-200" /><p className="text-slate-500 mb-4">No evaluation yet</p><Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A]" onClick={handleEvaluate} disabled={evaluating}>{evaluating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Evaluate Now</Button></div> : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 bg-slate-50 rounded-lg p-4 md:p-6">
              <div className="text-center"><div className={`text-4xl md:text-5xl font-black ${scoreColor(evaluation.overall_score)}`}>{evaluation.overall_score}</div><span className="text-[10px] text-slate-400">/ 100</span><br/><Badge className={`mt-2 ${evaluation.overall_score >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : evaluation.overall_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{evaluation.grade}</Badge></div>
              <div className="flex-1"><p className="text-sm text-slate-700">{evaluation.summary}</p>{evaluation.strengths?.length > 0 && <div className="mt-3 flex gap-2 flex-wrap">{evaluation.strengths.map((s, i) => <Badge key={i} variant="outline" className="text-[10px] text-[#C5A55A] border-[#C5A55A]/30">{s}</Badge>)}</div>}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{(evaluation.categories || []).map((cat, i) => (<div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100"><div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-slate-700">{cat.name}</span><span className={`text-sm font-bold ${scoreColor(cat.score)}`}>{cat.score}%</span></div><Progress value={cat.score} className="h-1.5 mb-1.5" /><p className="text-[11px] text-slate-500">{cat.feedback}</p></div>))}</div>
            {evaluation.errors?.length > 0 && <div className="space-y-2">{evaluation.errors.map((err, i) => (<div key={i} className="p-3 rounded-lg bg-red-50/50 border border-red-100 text-xs"><div className="flex items-center gap-2 mb-1"><Badge className={`text-[9px] ${err.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{err.severity?.toUpperCase()}</Badge><span className="text-[10px] text-slate-400">Week {err.week}</span></div><p className="text-sm font-medium text-red-800">{err.issue}</p><p className="text-xs text-slate-500 mt-0.5">Fix: {err.suggestion}</p></div>))}</div>}
            <Button className="rounded-lg bg-[#2E6CC4] w-full text-xs md:text-sm" onClick={prefillFeedback} data-testid="send-as-feedback"><Send className="w-4 h-4 mr-2" /> Send as Feedback</Button>
          </div>
        ))}
        {tab === 'comments' && <div className="space-y-3">{comments.map((c, i) => (<div key={i} className={`p-3 rounded-lg text-sm ${c.is_management ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}><div className="flex justify-between mb-1 flex-wrap gap-1"><strong className={c.is_management ? 'text-amber-800' : 'text-slate-700'}>{c.user_name}</strong><span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleString()}</span></div>{c.action && <Badge className="text-[10px] mb-1" variant="secondary">{c.action}</Badge>}<p className="text-slate-600">{c.text}</p></div>))}{comments.length === 0 && <p className="text-center text-slate-400 py-6">No comments</p>}<div className="flex gap-2 pt-2 border-t border-slate-200"><Input value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Add a comment..." className="rounded-lg flex-1" data-testid="mgmt-comment-input" /><Button size="sm" className="rounded-lg bg-[#2E6CC4]" onClick={() => { if (!reviewComment.trim()) return; api.post(`/schemes/${schemeId}/comments`, { text: reviewComment }).then(() => { setReviewComment(''); load(); successToast('Comment added'); }).catch(() => toast.error('Failed')); }} data-testid="mgmt-send-comment"><Send className="w-3.5 h-3.5" /></Button></div></div>}
        {tab === 'history' && <div className="space-y-1">{audit.map((a, i) => (<div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"><div className="w-2 h-2 rounded-full bg-[#2E6CC4] mt-1.5 flex-shrink-0" /><div><p className="text-sm text-[#1B2A4A]"><strong>{a.user_name}</strong> — {a.action}</p>{a.details && <p className="text-xs text-slate-400">{a.details}</p>}<p className="text-[10px] text-slate-300">{new Date(a.timestamp).toLocaleString()}</p></div></div>))}</div>}
      </div></div>

      {['submitted', 'resubmitted', 'under_review'].includes(scheme.status) && (
        <div className="flex-shrink-0 border-t-2 border-[#2E6CC4] bg-slate-50 px-3 md:px-4 py-3" data-testid="review-bottom-bar">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <div className="flex-1 w-full">
              <Label className="text-xs font-semibold text-[#1B2A4A] uppercase mb-1.5 block flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Review Comment <span className="text-red-500">*</span></Label>
              <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={2} placeholder="Add review feedback..." className="rounded-lg font-mono text-sm resize-none" data-testid="review-comment" />
            </div>
            <div className="flex flex-row sm:flex-col gap-2 sm:pt-5 flex-wrap">
              {evaluation && <Button size="sm" variant="outline" className="rounded-lg text-xs whitespace-nowrap" onClick={prefillFeedback} data-testid="prefill-feedback"><BarChart3 className="w-3 h-3 mr-1" /> Pre-fill</Button>}
              {scheme.status !== 'under_review' && <Button size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap text-xs" onClick={() => handleAction('start_review')} data-testid="start-review"><Eye className="w-3.5 h-3.5 mr-1" /> Start Review</Button>}
              <Button size="sm" className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e] whitespace-nowrap text-xs" onClick={() => handleAction('approve')} data-testid="approve-scheme"><ArrowRight className="w-3.5 h-3.5 mr-1" /> {forwardLabel}</Button>
              <Button size="sm" className="rounded-lg bg-red-600 hover:bg-red-700 whitespace-nowrap text-xs" onClick={() => handleAction('return')} data-testid="return-scheme"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Return</Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
