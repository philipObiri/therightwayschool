import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { AppLoader } from '../../../components/AppLoader';
import { SchemeEditor as RichTextEditor } from '../../../components/SchemeEditor';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  ArrowLeft, Send, Upload, CheckCircle, Eye, Trash2, BarChart3, Sparkles, Download,
  PenSquare, AlertTriangle, Search, Users, MessageSquare, Shield, History,
  Zap, Save, Loader2, ImagePlus, Plus, FileText
} from 'lucide-react';
import DiagramGenerator from '../../../components/DiagramGenerator';
import { OfflineIndicator } from '../../../components/OfflineIndicator';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { STATUS_CONFIG, schemeTableCSS, injectTableStyles } from './shared';

export default function SchemeEditorView({ scheme: initialScheme, subjects, onBack }) {
  const { user } = useAuth();
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [tab, setTab] = useState('editor');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [audit, setAudit] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [aiIssues, setAiIssues] = useState([]);
  const [analyzingIssues, setAnalyzingIssues] = useState(false);
  const [fixingIssueId, setFixingIssueId] = useState(null);
  const [fixingAll, setFixingAll] = useState(false);
  const editorFileRef = useRef(null);
  const isReadOnly = ['approved', 'published', 'archived', 'submitted', 'under_review', 'resubmitted'].includes(scheme?.status);
  const hasUnprocessedFile = scheme?.original_file_id && !scheme?.ai_processed;

  const syncSchemeToServer = async (content) => {
    if (!scheme) return;
    await api.put(`/schemes/${scheme.scheme_id}`, { ...content });
  };
  const offlineSync = useOfflineSync('scheme', initialScheme?.scheme_id, syncSchemeToServer);

  const loadScheme = async () => {
    try {
      const res = await api.get(`/schemes/${initialScheme.scheme_id}`);
      setScheme(res.data); setComments(res.data.comments || []); setAudit(res.data.audit_trail || []);
      setAiIssues(res.data.ai_issues || []);
      if (res.data.original_file_id && !res.data.ai_processed) setShowAiPanel(true);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };
  useEffect(() => { loadScheme(); }, [initialScheme.scheme_id]);

  const handleSave = async () => { setSaving(true); try { await api.put(`/schemes/${scheme.scheme_id}`, { title: scheme.title, rich_content: scheme.rich_content, weeks: scheme.weeks, subject_id: scheme.subject_id, subject_name: scheme.subject_name, year_group: scheme.year_group, department: scheme.department, curriculum: scheme.curriculum }); successToast('Saved'); offlineSync.clearDraft(); loadScheme(); } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); await offlineSync.saveLocally({ title: scheme.title, rich_content: scheme.rich_content }); } setSaving(false); };
  const handleSubmit = async () => { try { await api.post(`/schemes/${scheme.scheme_id}/submit`); successToast('Submitted!'); loadScheme(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const handleWithdraw = async () => { try { await api.post(`/schemes/${scheme.scheme_id}/withdraw`); successToast('Withdrawn'); loadScheme(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const handleAI = async (promptType) => { setAiLoading(true); try { const ep = scheme.original_file_id && !scheme.ai_processed ? `/schemes/${scheme.scheme_id}/ai-process-file` : `/schemes/${scheme.scheme_id}/ai-improve`; await api.post(ep, { prompt_type: promptType, custom_prompt: aiPrompt }); successToast('AI done'); loadScheme(); } catch (err) { toast.error(err.response?.data?.detail || 'AI failed'); } setAiLoading(false); };
  const handleAddComment = async () => { if (!commentText.trim()) return; try { await api.post(`/schemes/${scheme.scheme_id}/comments`, { text: commentText }); setCommentText(''); loadScheme(); } catch (err) { console.error("Error:", err); } };
  const handleDelete = async () => { if (!window.confirm('Delete?')) return; try { await api.delete(`/schemes/${scheme.scheme_id}`); successToast('Deleted'); onBack(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const handleEditorFileUpload = async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); const fd = new FormData(); fd.append('file', file); try { const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); await api.put(`/schemes/${scheme.scheme_id}`, { ...scheme, original_file_id: res.data.file_id }); successToast('File attached'); loadScheme(); } catch { toast.error('Upload failed'); } setUploading(false); };
  const handleAnalyzeIssues = async () => { setAnalyzingIssues(true); try { const res = await api.post(`/schemes/${scheme.scheme_id}/ai-analyze`); setAiIssues(res.data.issues || []); successToast(res.data.issues?.length > 0 ? `Found ${res.data.issues.length} issues` : 'No issues!'); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } setAnalyzingIssues(false); };
  const handleFixIssue = async (issue) => { setFixingIssueId(issue.id); try { const res = await api.post(`/schemes/${scheme.scheme_id}/ai-fix-issue`, { issue_id: issue.id, issue_title: issue.title, issue_description: issue.description }); setAiIssues(res.data.remaining_issues || []); successToast(`Fixed: ${issue.title}`); loadScheme(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } setFixingIssueId(null); };
  const handleFixAllIssues = async () => { setFixingAll(true); try { const res = await api.post(`/schemes/${scheme.scheme_id}/ai-fix-all`); setAiIssues([]); successToast(`Fixed ${res.data.fixed_count} issues`); loadScheme(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } setFixingAll(false); };

  if (loading || !scheme) return <AppLoader />;
  const sc = STATUS_CONFIG[scheme.status] || STATUS_CONFIG.draft;

  return <>
    {createPortal(
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden" style={{ zIndex: 9999 }} data-testid="scheme-editor">
      <div className="flex items-center justify-between px-2 md:px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-from-editor"><ArrowLeft className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Back</span></Button>
          <Badge className={`${sc.color} text-xs`}>{sc.label}</Badge>
          {scheme.ai_processed && <Badge className="bg-blue-100 text-[#2E6CC4] text-[10px] hidden sm:flex"><Sparkles className="w-3 h-3 mr-1" />AI</Badge>}
        </div>
        <div className="flex gap-1.5 md:gap-2 flex-wrap justify-end">
          {!isReadOnly && !scheme.original_file_id && (<><input ref={editorFileRef} type="file" className="hidden" accept=".doc,.docx,.pdf" onChange={handleEditorFileUpload} /><Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => editorFileRef.current?.click()} disabled={uploading} data-testid="editor-upload-file"><Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Attach</span></Button></>)}
          {scheme.original_file_id && <a href={`${import.meta.env.VITE_API_URL}/api/files/${scheme.original_file_id}/download?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="rounded-lg text-xs text-indigo-600 border-indigo-200" data-testid="view-original-file"><Download className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Original</span></Button></a>}
          {scheme.rich_content && <a href={`${import.meta.env.VITE_API_URL}/api/schemes/${scheme.scheme_id}/export-pdf?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="rounded-lg text-xs text-[#C5A55A] border-[#C5A55A]/30" data-testid="view-pdf"><Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">PDF</span></Button></a>}
          {!isReadOnly && <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={handleSave} disabled={saving} data-testid="save-scheme"><Save className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">{saving ? 'Saving' : 'Save'}</span></Button>}
          <OfflineIndicator {...offlineSync} />
          {!isReadOnly && <Button size="sm" className="rounded-lg bg-[#2E6CC4] text-xs" onClick={() => setShowAiPanel(!showAiPanel)} data-testid="toggle-ai"><Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">AI</span></Button>}
          {!isReadOnly && <Button size="sm" className="rounded-lg bg-amber-600 hover:bg-amber-700 text-xs" onClick={() => setDiagramOpen(true)} data-testid="toolbar-diagram-btn"><ImagePlus className="w-3.5 h-3.5" /><span className="hidden md:inline ml-1">Diagram</span></Button>}
          {['draft', 'in_progress', 'returned'].includes(scheme.status) && <Button size="sm" className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e] text-xs" onClick={handleSubmit} data-testid="submit-scheme"><Send className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Submit</span></Button>}
          {['submitted', 'resubmitted'].includes(scheme.status) && <Button size="sm" variant="outline" className="rounded-lg text-xs text-amber-600 border-amber-300 hidden sm:flex" onClick={handleWithdraw}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Withdraw</Button>}
          {!['approved', 'published'].includes(scheme.status) && <Button size="sm" variant="ghost" className="text-red-500" onClick={handleDelete}><Trash2 className="w-3.5 h-3.5" /></Button>}
        </div>
      </div>

      <div className="px-3 md:px-4 py-2 border-b border-slate-100 flex-shrink-0">
        {!isReadOnly ? <Input value={scheme.title} onChange={e => setScheme({...scheme, title: e.target.value})} className="text-base md:text-lg font-bold border-slate-200 rounded-lg" data-testid="scheme-title-edit" /> : <h2 className="text-base md:text-lg font-bold text-[#1B2A4A]">{scheme.title}</h2>}
        <div className="flex gap-2 text-[10px] md:text-xs text-slate-500 mt-1 flex-wrap"><span>{scheme.subject_name}</span><span>|</span><span>{scheme.year_group}</span><span>|</span><span>{scheme.term}</span><span>|</span><span>{scheme.curriculum}</span></div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 px-2 md:px-4 flex-shrink-0 overflow-x-auto">
        {[{ k: 'editor', l: 'Editor', icon: PenSquare }, { k: 'issues', l: `Issues${aiIssues.length ? ` (${aiIssues.length})` : ''}`, icon: AlertTriangle }, { k: 'comments', l: `Comments (${comments.length})`, icon: MessageSquare }, { k: 'history', l: 'History', icon: History }].map(t => (
          <button key={t.k} className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 flex items-center gap-1 whitespace-nowrap ${tab === t.k ? 'border-[#2E6CC4] text-[#2E6CC4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setTab(t.k)}><t.icon className="w-3.5 h-3.5" />{t.l}</button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className={`flex-1 overflow-y-auto p-3 md:p-4 ${showAiPanel ? 'md:max-w-[60%]' : ''}`}>
          {hasUnprocessedFile && tab === 'editor' && (
            <Card className="rounded-lg border-blue-300 bg-gradient-to-r from-blue-50 to-blue-50 mb-4" data-testid="ai-upload-banner">
              <CardContent className="p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5 text-[#2E6CC4]" /></div>
                <div className="flex-1"><h3 className="text-sm font-bold text-[#1B2A4A]">Document Ready for AI Processing</h3><p className="text-xs text-[#2E6CC4] mt-0.5">Click to digitalize it.</p></div>
                <Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] h-10 px-4 text-xs" onClick={() => handleAI('digitalize')} disabled={aiLoading} data-testid="banner-ai-digitalize">{aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}{aiLoading ? 'Processing...' : 'Digitalize'}</Button>
              </CardContent>
            </Card>
          )}
          {tab === 'editor' && (
            <div className="h-full">
              {isReadOnly ? <div className="scheme-html-view overflow-x-auto"><style>{schemeTableCSS}</style><div dangerouslySetInnerHTML={{ __html: injectTableStyles(scheme.rich_content) || '<p class="text-slate-400">No content</p>' }} /></div>
              : !editMode ? (
                <div className="scheme-html-view overflow-x-auto"><style>{schemeTableCSS}</style>
                  <div className="flex justify-end mb-2"><Button size="sm" variant="outline" className="rounded-lg text-xs bg-white shadow-sm" onClick={() => setEditMode(true)} data-testid="switch-to-edit"><PenSquare className="w-3.5 h-3.5 mr-1" /> Edit Source</Button></div>
                  {scheme.rich_content ? <div dangerouslySetInnerHTML={{ __html: injectTableStyles(scheme.rich_content) }} /> : <div className="p-8 text-center text-slate-400"><p className="text-lg mb-2">No content yet</p><p className="text-sm">Use <strong>Edit Source</strong> or <strong>AI Assistant</strong></p></div>}
                </div>
              ) : (
                <div className="scheme-editor-fullscreen">
                  <div className="flex justify-end mb-2"><Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => setEditMode(false)} data-testid="switch-to-view"><Eye className="w-3.5 h-3.5 mr-1" /> View</Button></div>
                  <style>{`.scheme-editor-fullscreen .ql-container { min-height: 55vh; } .scheme-editor-fullscreen .ql-editor { min-height: 53vh; }`}</style>
                  <RichTextEditor value={scheme.rich_content || ''} onChange={v => setScheme({...scheme, rich_content: v})} subject={scheme.subject_name} />
                </div>
              )}
            </div>
          )}
          {tab === 'issues' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div><h3 className="text-sm font-semibold text-slate-700">AI Quality Analysis</h3></div>
                <div className="flex gap-2">
                  {aiIssues.length > 0 && <Button size="sm" className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e] text-xs" onClick={handleFixAllIssues} disabled={fixingAll || fixingIssueId} data-testid="fix-all-issues">{fixingAll ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}Fix All {aiIssues.length}</Button>}
                  <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={handleAnalyzeIssues} disabled={analyzingIssues} data-testid="analyze-issues">{analyzingIssues ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}Scan</Button>
                </div>
              </div>
              {aiIssues.length === 0 && !analyzingIssues && <div className="text-center py-12 text-slate-400"><AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Click "Scan" to analyze</p></div>}
              {aiIssues.length > 0 && <div className="space-y-2">{aiIssues.map(issue => {
                const sevBg = { high: 'border-red-200 bg-red-50/50', medium: 'border-amber-200 bg-amber-50/50', low: 'border-blue-200 bg-blue-50/50' };
                const sevColors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' };
                return (<div key={issue.id} className={`p-3 rounded-lg border ${sevBg[issue.severity] || sevBg.medium}`} data-testid={`issue-${issue.id}`}><div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1 flex-wrap"><Badge className={`text-[10px] ${sevColors[issue.severity] || sevColors.medium}`}>{issue.severity?.toUpperCase()}</Badge><Badge variant="outline" className="text-[10px]">{issue.category}</Badge></div><h4 className="text-sm font-semibold text-slate-800">{issue.title}</h4><p className="text-xs text-slate-500 mt-0.5">{issue.description}</p></div><Button size="sm" className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] flex-shrink-0 h-8 px-3 text-xs" onClick={() => handleFixIssue(issue)} disabled={fixingIssueId === issue.id || fixingAll} data-testid={`fix-${issue.id}`}>{fixingIssueId === issue.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}<span className="ml-1">Fix</span></Button></div></div>);
              })}</div>}
            </div>
          )}
          {tab === 'comments' && <Card className="rounded-lg border-slate-100"><CardContent className="p-3 md:p-4 space-y-3">{comments.map((c, i) => (<div key={i} className={`p-3 rounded-lg text-sm ${c.is_management ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}><div className="flex justify-between mb-1 flex-wrap gap-1"><strong className={c.is_management ? 'text-amber-800' : 'text-slate-700'}>{c.user_name}</strong><span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleString()}</span></div>{c.action && <Badge className="text-[10px] mb-1" variant="secondary">{c.action}</Badge>}<p className="text-slate-600">{c.text}</p></div>))}{comments.length === 0 && <p className="text-center text-slate-400 py-8">No comments</p>}<div className="flex gap-2 pt-2 border-t border-slate-100"><Input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." className="rounded-lg" onKeyDown={e => e.key === 'Enter' && handleAddComment()} /><Button size="sm" className="rounded-lg bg-[#2E6CC4]" onClick={handleAddComment}><Send className="w-3.5 h-3.5" /></Button></div></CardContent></Card>}
          {tab === 'history' && <Card className="rounded-lg border-slate-100"><CardContent className="p-3 md:p-4"><div className="space-y-2">{audit.map((a, i) => (<div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"><div className="w-2 h-2 rounded-full bg-[#2E6CC4] mt-1.5 flex-shrink-0" /><div className="flex-1"><p className="text-sm text-[#1B2A4A]"><strong>{a.user_name}</strong> — {a.action}</p>{a.details && <p className="text-xs text-slate-400">{a.details}</p>}<p className="text-[10px] text-slate-300">{new Date(a.timestamp).toLocaleString()}</p></div></div>))}{audit.length === 0 && <p className="text-center text-slate-400 py-8">No activity</p>}</div></CardContent></Card>}
        </div>
        {showAiPanel && !isReadOnly && (
          <div className="w-full md:w-[40%] overflow-y-auto p-3 md:p-4 border-t md:border-t-0 md:border-l border-slate-200" data-testid="ai-panel">
            <Card className="rounded-lg border-blue-200 bg-[#2E6CC4]/10/50"><CardContent className="p-3 md:p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#1B2A4A] flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Academic Assistant</h3>
              {scheme.original_file_id && !scheme.ai_processed && <Button className="w-full rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] h-10 text-xs" onClick={() => handleAI('digitalize')} disabled={aiLoading} data-testid="ai-digitalize">{aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Digitalize</Button>}
              <div className="grid grid-cols-2 gap-2">
                {[{ k: 'improve', l: 'Improve All', icon: Sparkles }, { k: 'standardise', l: 'School Standard', icon: Shield }, { k: 'expand', l: 'Expand Weak', icon: Plus }, { k: 'objectives', l: 'Fix Objectives', icon: CheckCircle }, { k: 'assessment', l: 'Assessments', icon: BarChart3 }, { k: 'gaps', l: 'Find Gaps', icon: AlertTriangle }, { k: 'digitalize', l: 'Table Format', icon: FileText }].map(a => (
                  <Button key={a.k} variant="outline" size="sm" className="rounded-lg text-xs text-[#2E6CC4] border-blue-200 hover:bg-blue-100 justify-start" onClick={() => handleAI(a.k)} disabled={aiLoading} data-testid={`ai-${a.k}`}><a.icon className="w-3 h-3 mr-1.5" /> {a.l}</Button>
                ))}
              </div>
              <div className="space-y-2"><Label className="text-[10px] text-[#2E6CC4] uppercase">Custom AI</Label><Textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2} className="text-xs rounded-lg border-blue-200" placeholder="e.g. Align to Cambridge..." /><Button className="w-full rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-xs" size="sm" onClick={() => handleAI('custom')} disabled={aiLoading || !aiPrompt.trim()} data-testid="ai-custom">{aiLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />} Run</Button></div>
              {aiLoading && <div className="text-center py-4"><Loader2 className="w-8 h-8 mx-auto text-[#2E6CC4] animate-spin mb-2" /><p className="text-xs text-[#2E6CC4]">Processing...</p></div>}
              {scheme.ai_version && (<div className="bg-white rounded-lg border border-blue-200 p-3"><p className="text-[10px] text-[#2E6CC4] uppercase font-semibold mb-2">AI Preview</p><div className="prose prose-sm max-w-none max-h-40 overflow-y-auto text-xs" dangerouslySetInnerHTML={{ __html: scheme.ai_version?.slice(0, 500) + '...' }} /><Button size="sm" className="w-full mt-2 rounded-lg bg-[#2E6CC4] text-xs" onClick={() => { setScheme({...scheme, rich_content: scheme.ai_version}); successToast('Applied'); }} data-testid="accept-ai"><CheckCircle className="w-3 h-3 mr-1" /> Accept</Button></div>)}
            </CardContent></Card>
          </div>
        )}
      </div>
    </div>, document.body)}
    <DiagramGenerator open={diagramOpen} onClose={() => setDiagramOpen(false)} onInsert={(imageUrl, altText) => { setScheme({...scheme, rich_content: (scheme.rich_content || '') + `<p><img src="${imageUrl}" alt="${altText}" style="max-width:100%;border-radius:8px;margin:12px 0;" /></p>`}); setDiagramOpen(false); successToast('Diagram inserted'); }} defaultSubject={scheme.subject_name} />
  </>;
}
