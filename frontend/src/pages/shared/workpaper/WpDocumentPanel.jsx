import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import {
  CheckCircle, XCircle, Clock, ArrowRight, User, MessageSquare,
  Send, Flag, Link2, Copy, Lock, Eye, Download, Trash2, Share2, History, AlertTriangle,
  PenTool, Droplets, CalendarClock, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { AppLoader } from '../../../components/AppLoader';
import { CollabEditor } from './CollabEditor';
import { SignaturePad } from '../../../components/SignaturePad';
import { OfflineIndicator } from '../../../components/OfflineIndicator';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { useAuth } from '../../../contexts/AuthContext';

const BACKEND = import.meta.env.VITE_API_URL;
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600', under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-[#C5A55A]/15 text-[#C5A55A]', rejected: 'bg-red-100 text-red-700',
  published: 'bg-blue-100 text-blue-700', archived: 'bg-slate-200 text-slate-500'
};

export function WpDocumentPanel({ doc, isAdmin, isFolderOwner, staff, onBack, onRefresh }) {
  const { user } = useAuth();
  const [chain, setChain] = useState(null);
  const [discussions, setDiscussions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [shareLinks, setShareLinks] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [tab, setTab] = useState('overview');
  const [showApprovalSetup, setShowApprovalSetup] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [approvalSteps, setApprovalSteps] = useState([{ user_id: '', role_label: '', user_name: '' }]);
  const [shareForm, setShareForm] = useState({ password: '', expires_hours: 168, permissions: ['view'] });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');

  // Offline sync for collaborative editing
  const offlineSync = useOfflineSync('workpaper', doc?.document_id, null);

  const isLocked = doc?.locked === true;
  const [watermarkVal, setWatermarkVal] = useState('');
  const [expiryForm, setExpiryForm] = useState({ expires_at: '', reminder_days: 7, auto_archive: true });

  useEffect(() => {
    if (!doc) return;
    api.get(`/wp/documents/${doc.document_id}/approval-chain`).then(r => setChain(r.data?.chain_id ? r.data : null)).catch(() => {});
    api.get(`/wp/documents/${doc.document_id}/discussions`).then(r => setDiscussions(r.data)).catch(() => {});
    api.get(`/wp/documents/${doc.document_id}/timeline`).then(r => setTimeline(r.data)).catch(() => {});
    api.get(`/wp/documents/${doc.document_id}/share-links`).then(r => setShareLinks(r.data)).catch(() => {});
    api.get(`/wp/documents/${doc.document_id}/signatures`).then(r => setSignatures(r.data)).catch(() => {});
    setWatermarkVal(doc.watermark || '');
  }, [doc?.document_id]);

  useEffect(() => {
    if (!doc?.file_id) return;
    const token = localStorage.getItem('rw_token');
    setPreviewUrl(`${BACKEND}/api/files/${doc.file_id}/preview?token=${encodeURIComponent(token)}`);
  }, [doc?.file_id]);

  if (!doc) return null;

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    try {
      await api.post(`/wp/documents/${doc.document_id}/discussions`, { content: msgText });
      setMsgText('');
      const r = await api.get(`/wp/documents/${doc.document_id}/discussions`);
      setDiscussions(r.data);
    } catch { toast.error('Failed'); }
  };

  const setupApprovalChain = async () => {
    const validSteps = approvalSteps.filter(s => s.user_id);
    if (!validSteps.length) { toast.error('Add at least one reviewer'); return; }
    try {
      const stepsWithNames = validSteps.map(s => {
        const u = staff?.find(st => st.user_id === s.user_id);
        return { ...s, user_name: u?.name || '' };
      });
      await api.post(`/wp/documents/${doc.document_id}/approval-chain`, { steps: stepsWithNames });
      successToast('Approval workflow started');
      setShowApprovalSetup(false);
      const r = await api.get(`/wp/documents/${doc.document_id}/approval-chain`);
      setChain(r.data?.chain_id ? r.data : null);
      onRefresh?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const reviewStep = async (action) => {
    try {
      await api.post(`/wp/documents/${doc.document_id}/review-step`, { action, feedback: reviewFeedback });
      successToast(`Step ${action}d`);
      setReviewFeedback('');
      const r = await api.get(`/wp/documents/${doc.document_id}/approval-chain`);
      setChain(r.data?.chain_id ? r.data : null);
      onRefresh?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const createShareLink = async () => {
    try {
      const r = await api.post(`/wp/documents/${doc.document_id}/share`, shareForm);
      const link = `${BACKEND}/api/wp/shared/${r.data.token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      successToast('Share link created & copied');
      setShowShare(false);
      const links = await api.get(`/wp/documents/${doc.document_id}/share-links`);
      setShareLinks(links.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const revokeLink = async (linkId) => {
    try { await api.delete(`/wp/share-links/${linkId}`); const r = await api.get(`/wp/documents/${doc.document_id}/share-links`); setShareLinks(r.data); successToast('Link revoked'); } catch (err) { console.error("Error:", err); }
  };

  const toggleFlag = async () => {
    try {
      await api.put(`/wp/documents/${doc.document_id}/flag`, { flagged: !doc.flagged });
      successToast(doc.flagged ? 'Unflagged' : 'Flagged');
      onRefresh?.();
    } catch (err) { console.error("Error:", err); }
  };

  const handleSign = async (sigData) => {
    try {
      const r = await api.post(`/wp/documents/${doc.document_id}/sign`, sigData);
      successToast(`Signed & locked (${r.data.sig_hash})`);
      setShowSign(false);
      const sigs = await api.get(`/wp/documents/${doc.document_id}/signatures`);
      setSignatures(sigs.data);
      onRefresh?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleWatermark = async (val) => {
    try { await api.put(`/wp/documents/${doc.document_id}/watermark`, { watermark: val }); successToast(val ? `Watermark: ${val}` : 'Watermark removed'); setWatermarkVal(val); setShowWatermark(false); onRefresh?.(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleExpiry = async () => {
    try { await api.put(`/wp/documents/${doc.document_id}/expiry`, expiryForm); successToast('Expiry set'); setShowExpiry(false); onRefresh?.(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const TABS = [
    { key: 'overview', label: 'Overview' }, { key: 'collab_edit', label: 'Collaborative Edit' },
    { key: 'discussion', label: `Discussion (${discussions.length})` },
    { key: 'timeline', label: 'Timeline' }, { key: 'versions', label: `Versions (${doc.versions?.length || 0})` },
    { key: 'signatures', label: `Signatures (${signatures.length})` },
    { key: 'sharing', label: `Sharing (${shareLinks.length})` },
  ];

  return (
    <div className="space-y-4" data-testid="wp-doc-panel">
      {/* Header */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-[#1B2A4A]">{doc.title}</h2>
              {doc.flagged && <Flag className="w-4 h-4 text-red-500" />}
              {doc.locked && <Lock className="w-4 h-4 text-amber-500" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={STATUS_COLORS[doc.status]}>{doc.status?.replace('_', ' ')}</Badge>
              {doc.watermark && <Badge className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold tracking-wider">{doc.watermark}</Badge>}
              {doc.expires_at && <Badge className="bg-orange-50 text-orange-700 text-[9px]"><CalendarClock className="w-3 h-3 mr-0.5 inline" />Expires {new Date(doc.expires_at).toLocaleDateString()}</Badge>}
              <span className="text-xs text-slate-400">v{doc.version} | {doc.author_name} | {new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.file_type && <Badge variant="secondary" className="text-[9px]">{doc.file_type.toUpperCase()}</Badge>}
            </div>
            {doc.description && <p className="text-sm text-slate-600 mt-2">{doc.description}</p>}
            {doc.tags?.length > 0 && <div className="flex gap-1 mt-2">{doc.tags.map(t => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}</div>}
          </div>
          <div className="flex gap-1.5">
            <OfflineIndicator {...offlineSync} />
            {doc.file_id && <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => window.open(`${BACKEND}/api/files/${doc.file_id}/download?token=${localStorage.getItem('rw_token')}`, '_blank')} data-testid="download-doc-btn"><Download className="w-3 h-3 mr-1" /> Download</Button>}
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={toggleFlag} data-testid="flag-doc-btn"><Flag className={`w-3 h-3 mr-1 ${doc.flagged ? 'text-red-500' : ''}`} /> {doc.flagged ? 'Unflag' : 'Flag'}</Button>
            {!isLocked && <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowSign(true)} data-testid="sign-doc-btn"><PenTool className="w-3 h-3 mr-1" /> Sign</Button>}
            {isLocked && <Badge className="bg-amber-100 text-amber-700 text-[10px]"><Lock className="w-3 h-3 mr-1" /> Signed & Locked</Badge>}
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowWatermark(true)} data-testid="watermark-btn"><Droplets className="w-3 h-3 mr-1" /> Watermark</Button>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => { setExpiryForm({ expires_at: doc.expires_at || '', reminder_days: doc.expiry_reminder_days || 7, auto_archive: doc.expiry_auto_archive !== false }); setShowExpiry(true); }} data-testid="expiry-btn"><CalendarClock className="w-3 h-3 mr-1" /> Expiry</Button>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowShare(true)} data-testid="share-doc-btn"><Share2 className="w-3 h-3 mr-1" /> Share</Button>
            {!chain && doc.status === 'draft' && <Button size="sm" className="rounded-lg text-xs bg-[#1B2A4A]" onClick={() => setShowApprovalSetup(true)} data-testid="start-approval-btn">Start Approval</Button>}
          </div>
        </div>
      </div>

      {/* Approval Chain Progress */}
      {chain && (
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Approval Workflow</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {chain.steps?.map((step, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border min-w-[160px] ${step.status === 'approved' ? 'bg-[#C5A55A]/10 border-[#C5A55A]/30' : step.status === 'rejected' ? 'bg-red-50 border-red-200' : chain.current_step === step.step ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                    {step.status === 'approved' ? <CheckCircle className="w-4 h-4 text-[#C5A55A] shrink-0" /> : step.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : <Clock className="w-4 h-4 text-slate-400 shrink-0" />}
                    <div>
                      <p className="text-[10px] font-semibold">{step.role_label || `Step ${step.step}`}</p>
                      <p className="text-[9px] text-slate-500">{step.user_name || 'Unassigned'}</p>
                      {step.feedback && <p className="text-[9px] text-slate-400 italic mt-0.5">"{step.feedback}"</p>}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {chain.status === 'in_progress' && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-medium text-[#1B2A4A] mb-2">Current Step: {chain.current_step} of {chain.steps?.length}</p>
                <Input placeholder="Add feedback (optional)..." value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} className="h-8 text-xs mb-2" />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#C5A55A] rounded-lg text-xs" onClick={() => reviewStep('approve')} data-testid="approve-step-btn"><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                  <Button size="sm" variant="destructive" className="rounded-lg text-xs" onClick={() => reviewStep('reject')} data-testid="reject-step-btn"><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.key} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#1B2A4A] text-[#1B2A4A]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && doc.file_id && (
        <div className="bg-white rounded-lg border overflow-hidden" style={{ height: '500px' }}>
          {previewUrl ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2E6CC4] hover:underline font-medium"><Eye className="w-3 h-3 inline mr-1" />Open in New Tab</a>
                <a href={previewUrl.replace('/preview?', '/download?')} className="text-xs text-[#C5A55A] hover:underline font-medium"><Download className="w-3 h-3 inline mr-1" />Download</a>
              </div>
              <iframe src={previewUrl} title={doc.title} className="w-full flex-1 border-0" sandbox="allow-same-origin allow-scripts allow-popups" />
            </div>
          ) : <AppLoader size="sm" />}
        </div>
      )}

      {tab === 'collab_edit' && (
        <CollabEditor doc={doc} onRefresh={onRefresh} />
      )}

      {tab === 'discussion' && (
        <Card className="rounded-lg"><CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Type a message..." value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} className="flex-1 h-9 text-xs" data-testid="discussion-input" />
            <Button size="sm" className="bg-[#1B2A4A] rounded-lg" onClick={sendMessage}><Send className="w-3 h-3" /></Button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {discussions.map(m => (
              <div key={m.msg_id} className={`flex gap-2 ${m.is_decision ? 'bg-amber-50 border border-amber-100 rounded-lg p-2' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-[9px] font-bold shrink-0">{m.author_name?.charAt(0)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5"><span className="text-xs font-semibold">{m.author_name}</span><Badge variant="secondary" className="text-[8px]">{m.author_role}</Badge>
                    {m.is_decision && <Badge className="bg-amber-100 text-amber-700 text-[8px]">Decision</Badge>}
                    <span className="text-[9px] text-slate-400 ml-auto">{new Date(m.created_at).toLocaleString()}</span></div>
                  <p className="text-xs text-slate-600 mt-0.5">{m.content}</p>
                </div>
              </div>
            ))}
            {discussions.length === 0 && <p className="text-center text-slate-400 text-xs py-6">No discussions yet. Start a conversation about this document.</p>}
          </div>
        </CardContent></Card>
      )}

      {tab === 'timeline' && (
        <Card className="rounded-lg"><CardContent className="p-4">
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {timeline.map((e, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center"><div className={`w-2.5 h-2.5 rounded-full shrink-0 ${e.type === 'approval' ? 'bg-[#C5A55A]/100' : e.type === 'version' ? 'bg-blue-500' : e.type === 'discussion' ? 'bg-blue-500' : 'bg-slate-400'}`} />{i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200" />}</div>
                <div className="flex-1 pb-4">
                  <p className="text-xs"><span className="font-semibold">{e.user}</span> <span className="text-slate-500">{e.action?.replace(/_/g, ' ')}</span></p>
                  {e.details?.text && <p className="text-[10px] text-slate-500 mt-0.5 bg-slate-50 rounded p-1.5">"{e.details.text}"</p>}
                  {e.details?.content && <p className="text-[10px] text-slate-500 mt-0.5 bg-slate-50 rounded p-1.5">"{e.details.content}"</p>}
                  {e.details?.feedback && <p className="text-[10px] text-slate-500 mt-0.5 italic">Feedback: {e.details.feedback}</p>}
                  {e.details?.summary && <p className="text-[10px] text-slate-500 mt-0.5">Summary: {e.details.summary}</p>}
                  <p className="text-[9px] text-slate-400 mt-0.5">{new Date(e.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {timeline.length === 0 && <p className="text-center text-slate-400 text-xs py-6">No activity recorded yet</p>}
          </div>
        </CardContent></Card>
      )}

      {tab === 'versions' && (
        <Card className="rounded-lg"><CardContent className="p-4 space-y-2">
          {(doc.versions || []).map(v => (
            <div key={v.version_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
              <div className="flex items-center gap-3"><History className="w-4 h-4 text-[#2E6CC4]" />
                <div><p className="text-xs font-semibold">v{v.version} {v.version_name ? `— ${v.version_name}` : ''}</p><p className="text-[10px] text-slate-500">{v.change_summary} by {v.edited_by_name}</p><p className="text-[9px] text-slate-400">{new Date(v.created_at).toLocaleString()}</p></div>
              </div>
              <Button variant="outline" size="sm" className="text-xs rounded-lg" onClick={async () => { try { await api.post(`/wp/documents/${doc.document_id}/restore/${v.version}`); successToast('Version restored'); onRefresh?.(); } catch { toast.error('Failed'); } }}>Restore</Button>
            </div>
          ))}
          {(!doc.versions || doc.versions.length === 0) && <p className="text-center text-slate-400 text-xs py-6">No version history</p>}
        </CardContent></Card>
      )}

      {tab === 'sharing' && (
        <Card className="rounded-lg"><CardContent className="p-4 space-y-3">
          <Button size="sm" className="bg-[#1B2A4A] rounded-lg text-xs" onClick={() => setShowShare(true)}><Link2 className="w-3 h-3 mr-1" /> Create Share Link</Button>
          {shareLinks.map(l => (
            <div key={l.link_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
              <div><p className="text-xs font-mono">{l.token?.slice(0, 16)}...</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-slate-400">Expires: {new Date(l.expires_at).toLocaleDateString()}</span>
                  <span className="text-[9px] text-slate-400">Accessed: {l.access_count}x</span>
                  {l.password_hash && <Lock className="w-3 h-3 text-amber-500" />}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${BACKEND}/api/wp/shared/${l.token}`); successToast('Copied'); }}><Copy className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm" className="h-7 text-red-500" onClick={() => revokeLink(l.link_id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          {shareLinks.length === 0 && <p className="text-center text-slate-400 text-xs py-4">No active share links</p>}
        </CardContent></Card>
      )}

      {tab === 'signatures' && (
        <Card className="rounded-lg"><CardContent className="p-4 space-y-3">
          <Button size="sm" className="bg-[#1B2A4A] rounded-lg text-xs" onClick={() => setShowSign(true)} data-testid="add-signature-btn"><PenTool className="w-3 h-3 mr-1" /> Add Signature</Button>
          {signatures.map(s => (
            <div key={s.sig_id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-[#C5A55A]/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#C5A55A]" /></div>
              <div className="flex-1">
                <p className="text-xs font-semibold">{s.signer_name} <Badge variant="secondary" className="text-[8px] ml-1">{s.signer_role}</Badge></p>
                <p className="text-[10px] text-slate-500">{s.reason}</p>
                <p className="text-[9px] text-slate-400 font-mono">Hash: {s.sig_hash?.slice(0, 16)}... | {new Date(s.signed_at).toLocaleString()}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-[#C5A55A]" />
            </div>
          ))}
          {signatures.length === 0 && <p className="text-center text-slate-400 text-xs py-6">No signatures yet</p>}
        </CardContent></Card>
      )}

      {/* Approval Setup Dialog */}
      <Dialog open={showApprovalSetup} onOpenChange={setShowApprovalSetup}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Setup Approval Workflow</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 mb-3">Add reviewers in order. The document will be routed through each step.</p>
          <div className="space-y-2">
            {approvalSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <Badge className="bg-[#1B2A4A] text-white text-[9px] h-5 w-5 flex items-center justify-center p-0 rounded-full">{i + 1}</Badge>
                <Select value={step.user_id} onValueChange={v => { const s = [...approvalSteps]; const u = staff?.find(st => st.user_id === v); s[i] = { ...s[i], user_id: v, user_name: u?.name || '' }; setApprovalSteps(s); }}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select reviewer" /></SelectTrigger>
                  <SelectContent>{(staff || []).map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name} ({s.role})</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Label" value={step.role_label} onChange={e => { const s = [...approvalSteps]; s[i].role_label = e.target.value; setApprovalSteps(s); }} className="h-8 text-xs w-24" />
                {approvalSteps.length > 1 && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => setApprovalSteps(approvalSteps.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setApprovalSteps([...approvalSteps, { user_id: '', role_label: '', user_name: '' }])}>+ Add Step</Button>
          <Button className="w-full bg-[#1B2A4A] rounded-lg text-xs mt-2" onClick={setupApprovalChain} data-testid="confirm-approval-chain-btn">Start Approval Workflow</Button>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Share Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Password Protection (optional)</Label><Input type="password" value={shareForm.password} onChange={e => setShareForm(p => ({ ...p, password: e.target.value }))} className="h-9 text-xs" placeholder="Leave empty for no password" /></div>
            <div><Label className="text-xs">Link Expiry</Label>
              <Select value={String(shareForm.expires_hours)} onValueChange={v => setShareForm(p => ({ ...p, expires_hours: parseInt(v) }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="24">24 hours</SelectItem><SelectItem value="72">3 days</SelectItem><SelectItem value="168">7 days</SelectItem><SelectItem value="720">30 days</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Permissions</Label>
              <div className="flex gap-2 mt-1">
                {['view', 'download'].map(p => (
                  <label key={p} className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer ${shareForm.permissions.includes(p) ? 'border-[#1B2A4A] bg-blue-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={shareForm.permissions.includes(p)} onChange={e => setShareForm(prev => ({ ...prev, permissions: e.target.checked ? [...prev.permissions, p] : prev.permissions.filter(x => x !== p) }))} className="rounded" />{p}
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full bg-[#1B2A4A] rounded-lg text-xs" onClick={createShareLink} data-testid="create-share-link-btn">Create & Copy Link</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Document - New SignaturePad */}
      <SignaturePad
        open={showSign}
        onClose={() => setShowSign(false)}
        onSign={handleSign}
        signerName={user?.name || ''}
        signerRole={user?.role || ''}
      />

      {/* Watermark Dialog */}
      <Dialog open={showWatermark} onOpenChange={setShowWatermark}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Droplets className="w-4 h-4 text-[#2E6CC4]" /> Set Watermark</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 mb-3">Apply a classification watermark to this document. This will be displayed as a badge on the document header.</p>
          <div className="grid grid-cols-2 gap-2">
            {['CONFIDENTIAL', 'DRAFT', 'APPROVED', 'INTERNAL', 'FOR REVIEW', 'FINAL'].map(w => (
              <button key={w} onClick={() => handleWatermark(w)} className={`p-3 rounded-lg border text-xs font-bold tracking-wider text-center transition-all hover:shadow-md ${watermarkVal === w ? 'border-[#1B2A4A] bg-[#1B2A4A]/5 ring-2 ring-[#1B2A4A]/20' : 'border-slate-200 hover:border-slate-300'} ${w === 'CONFIDENTIAL' ? 'text-red-600' : w === 'DRAFT' ? 'text-amber-600' : w === 'APPROVED' ? 'text-[#C5A55A]' : w === 'INTERNAL' ? 'text-blue-600' : w === 'FOR REVIEW' ? 'text-[#2E6CC4]' : 'text-slate-700'}`} data-testid={`watermark-${w.toLowerCase().replace(/ /g, '-')}`}>{w}</button>
            ))}
          </div>
          {watermarkVal && (
            <Button variant="outline" className="w-full rounded-lg text-xs mt-2 text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleWatermark('')} data-testid="remove-watermark-btn"><Trash2 className="w-3 h-3 mr-1" /> Remove Watermark</Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Expiry Dialog */}
      <Dialog open={showExpiry} onOpenChange={setShowExpiry}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-[#2E6CC4]" /> Set Document Expiry</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500 mb-3">Set an expiration date for this document. Expired documents can be automatically archived.</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Expiry Date</Label>
              <Input type="datetime-local" value={expiryForm.expires_at} onChange={e => setExpiryForm(p => ({ ...p, expires_at: e.target.value }))} className="h-9 text-xs" data-testid="expiry-date-input" />
            </div>
            <div>
              <Label className="text-xs">Reminder (days before expiry)</Label>
              <Select value={String(expiryForm.reminder_days)} onValueChange={v => setExpiryForm(p => ({ ...p, reminder_days: parseInt(v) }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">7 days before</SelectItem>
                  <SelectItem value="14">14 days before</SelectItem>
                  <SelectItem value="30">30 days before</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={expiryForm.auto_archive} onChange={e => setExpiryForm(p => ({ ...p, auto_archive: e.target.checked }))} className="rounded" />
              <div>
                <p className="text-xs font-medium text-[#1B2A4A]">Auto-archive on expiry</p>
                <p className="text-[10px] text-slate-500">Automatically move to archive when document expires</p>
              </div>
            </label>
            <div className="flex gap-2">
              <Button className="flex-1 bg-[#1B2A4A] rounded-lg text-xs" onClick={handleExpiry} data-testid="confirm-expiry-btn"><CalendarClock className="w-3 h-3 mr-1" /> Set Expiry</Button>
              {doc.expires_at && <Button variant="outline" className="rounded-lg text-xs text-red-500 border-red-200" onClick={() => { setExpiryForm({ expires_at: '', reminder_days: 7, auto_archive: true }); handleExpiry(); }} data-testid="remove-expiry-btn"><Trash2 className="w-3 h-3 mr-1" /> Remove</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
