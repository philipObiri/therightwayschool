import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  MessageSquare, Plus, Send, Filter, BarChart3,
  Clock, CheckCircle, AlertCircle, Loader2, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

const CATEGORIES = [
  { value: 'class_remark', label: 'Class Remark' },
  { value: 'subject_complaint', label: 'Subject Complaint' },
  { value: 'book_request', label: 'Book / Material Request' },
  { value: 'resource_need', label: 'Resource Need' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'general', label: 'General' },
];

const STATUS_MAP = {
  open: { label: 'Open', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-[#2E6CC4] border-blue-200', icon: Loader2 },
  resolved: { label: 'Resolved', color: 'bg-[#C5A55A]/15 text-[#C5A55A] border-[#C5A55A]/30', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle },
};

const PRIORITY_MAP = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  normal: 'bg-sky-100 text-sky-700 border-sky-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

const MANAGEMENT_ROLES = ['SuperAdmin', 'CEO', 'HeadTeacher', 'Admin', 'Principal', 'Founder'];

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.open;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full border ${s.color}`} data-testid={`status-badge-${status}`}>
      <Icon className="w-4 h-4" />{s.label}
    </span>
  );
}

function StatsBar({ stats }) {
  const cards = [
    { label: 'Total', value: stats.total, icon: BarChart3, color: 'bg-slate-50 text-[#1B2A4A]', iconColor: 'text-[#1B2A4A]' },
    { label: 'Open', value: stats.open, icon: AlertCircle, color: 'bg-amber-50 text-amber-700', iconColor: 'text-amber-600' },
    { label: 'In Progress', value: stats.in_progress, icon: Loader2, color: 'bg-[#2E6CC4]/10 text-[#2E6CC4]', iconColor: 'text-[#2E6CC4]' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'bg-[#C5A55A]/10 text-[#C5A55A]', iconColor: 'text-[#C5A55A]' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="remarks-stats">
      {cards.map(c => (
        <Card key={c.label} className="rounded-lg border-slate-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${c.color}`}>
              <c.icon className={`w-7 h-7 ${c.iconColor}`} />
            </div>
            <div>
              <p className="text-4xl font-bold text-[#1B2A4A]">{c.value}</p>
              <p className="text-base text-slate-500 mt-1">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NewRemarkForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', priority: 'normal', subject: '', year_group: '' });

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and description required'); return; }
    setLoading(true);
    try {
      await api.post('/remarks/', form);
      toast.success('Remark submitted');
      setForm({ title: '', body: '', category: 'general', priority: 'normal', subject: '', year_group: '' });
      setOpen(false);
      onCreated();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to submit'); }
    setLoading(false);
  };

  if (!open) return (
    <Button onClick={() => setOpen(true)} className="gap-2 bg-[#2E6CC4] hover:bg-[#2558A3] text-white font-semibold h-12 px-6 text-base" data-testid="new-remark-btn">
      <Plus className="w-5 h-5" /> New Remark
    </Button>
  );

  return (
    <Card className="rounded-xl border-slate-200 mb-6 animate-in fade-in duration-200" data-testid="new-remark-form">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#1B2A4A]">Submit a Remark</h3>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">Cancel</Button>
        </div>
        <Input placeholder="Title *" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} className="h-12 text-base border-slate-200" data-testid="remark-title-input" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
            <SelectTrigger className="h-12 text-base border-slate-200" data-testid="remark-category-select"><SelectValue /></SelectTrigger>
            <SelectContent className="text-base">{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-base py-3">{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.priority} onValueChange={v => setForm(p => ({...p, priority: v}))}>
            <SelectTrigger className="h-12 text-base border-slate-200" data-testid="remark-priority-select"><SelectValue /></SelectTrigger>
            <SelectContent className="text-base">
              <SelectItem value="low" className="text-base py-3">Low</SelectItem>
              <SelectItem value="normal" className="text-base py-3">Normal</SelectItem>
              <SelectItem value="high" className="text-base py-3">High</SelectItem>
              <SelectItem value="urgent" className="text-base py-3">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Subject (optional)" value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))} className="h-12 text-base border-slate-200" data-testid="remark-subject-input" />
        </div>
        <Input placeholder="Year Group (optional)" value={form.year_group} onChange={e => setForm(p => ({...p, year_group: e.target.value}))} className="h-12 text-base border-slate-200 max-w-xs" data-testid="remark-yeargroup-input" />
        <Textarea placeholder="Describe your remark, request, or complaint in detail... *" value={form.body} onChange={e => setForm(p => ({...p, body: e.target.value}))} rows={4} className="text-base border-slate-200 resize-none" data-testid="remark-body-input" />
        <div className="flex justify-end">
          <Button onClick={submit} disabled={loading} className="gap-2 bg-[#2E6CC4] hover:bg-[#2558A3] text-white font-semibold h-12 px-8 text-base" data-testid="submit-remark-btn">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Submit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RemarkCard({ remark, isManagement, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const respond = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const payload = { text: replyText };
      if (newStatus) payload.status = newStatus;
      await api.post(`/remarks/${remark.remark_id}/respond`, payload);
      toast.success('Response sent');
      setReplyText('');
      setNewStatus('');
      onRefresh();
    } catch (e) { toast.error('Failed to respond'); }
    setSending(false);
  };

  const updateStatus = async (status) => {
    try {
      await api.patch(`/remarks/${remark.remark_id}/status`, { status });
      toast.success(`Status updated to ${STATUS_MAP[status]?.label || status}`);
      onRefresh();
    } catch (e) { toast.error('Failed to update status'); }
  };

  const deleteRemark = async () => {
    setDeleting(true);
    try {
      await api.delete(`/remarks/${remark.remark_id}`);
      toast.success('Remark deleted');
      onRefresh();
    } catch (e) { toast.error('Cannot delete'); }
    setDeleting(false);
  };

  const catLabel = CATEGORIES.find(c => c.value === remark.category)?.label || remark.category;
  const timeAgo = formatTimeAgo(remark.created_at);

  return (
    <Card className="rounded-xl border-slate-200 overflow-hidden transition-all hover:border-slate-300" data-testid={`remark-card-${remark.remark_id}`}>
      <div className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h4 className="text-lg font-semibold text-[#1B2A4A] truncate">{remark.title}</h4>
              <StatusBadge status={remark.status} />
              <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${PRIORITY_MAP[remark.priority] || PRIORITY_MAP.normal}`}>
                {remark.priority}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="font-medium text-[#1B2A4A]">{remark.author_name}</span>
              <Badge variant="outline" className="text-xs border-slate-200 text-slate-500">{catLabel}</Badge>
              {remark.subject && <span>Subject: {remark.subject}</span>}
              {remark.year_group && <span>Year: {remark.year_group}</span>}
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{timeAgo}</span>
              {remark.responses?.length > 0 && (
                <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" />{remark.responses.length} replies</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
          <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{remark.body}</p>

          {isManagement && (
            <div className="flex items-center gap-3 flex-wrap" data-testid="status-controls">
              <span className="text-sm text-slate-500 mr-1">Set status:</span>
              {['acknowledged', 'in_progress', 'resolved', 'closed'].map(s => (
                <button key={s} onClick={() => updateStatus(s)} disabled={remark.status === s}
                  className={`text-sm px-4 py-2 rounded-lg border transition-all ${remark.status === s ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-600 hover:text-[#1B2A4A] hover:border-[#2E6CC4] hover:bg-blue-50'}`}
                  data-testid={`status-btn-${s}`}>
                  {STATUS_MAP[s]?.label}
                </button>
              ))}
            </div>
          )}

          {remark.responses?.length > 0 && (
            <div className="space-y-3 pl-4 border-l-2 border-[#2E6CC4]/20">
              {remark.responses.map(r => (
                <div key={r.response_id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-[#2E6CC4]">{r.author_name}</span>
                    <Badge variant="outline" className="text-xs border-slate-200 text-slate-500">{r.author_role}</Badge>
                    <span className="text-sm text-slate-400">{formatTimeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-base text-slate-700">{r.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3" data-testid="reply-area">
            <Input placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && respond()}
              className="border-slate-200 flex-1 h-12 text-base" data-testid="reply-input" />
            <Button onClick={respond} disabled={sending || !replyText.trim()} className="bg-[#2E6CC4] hover:bg-[#2558A3] h-12 px-6 text-base" data-testid="send-reply-btn">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
            <Button onClick={deleteRemark} disabled={deleting} variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 h-12 px-4" data-testid="delete-remark-btn">
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function TeacherRemarks() {
  const { user } = useAuth();
  const [remarks, setRemarks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const isManagement = MANAGEMENT_ROLES.includes(user?.role);

  const fetchRemarks = useCallback(async () => {
    try {
      const params = {};
      if (filterCat !== 'all') params.category = filterCat;
      if (filterStatus !== 'all') params.status = filterStatus;
      const res = await api.get('/remarks/', { params });
      setRemarks(res.data);
    } catch (e) { toast.error('Failed to load remarks'); }
    setLoading(false);
  }, [filterCat, filterStatus]);

  const fetchStats = useCallback(async () => {
    if (!isManagement) return;
    try {
      const res = await api.get('/remarks/stats');
      setStats(res.data);
    } catch (err) { console.error("Error:", err); }
  }, [isManagement]);

  useEffect(() => { fetchRemarks(); fetchStats(); }, [fetchRemarks, fetchStats]);

  const refresh = () => { fetchRemarks(); fetchStats(); };

  return (
    <div className="space-y-8" data-testid="teacher-remarks-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#1B2A4A]">
            {isManagement ? 'Staff Remarks & Requests' : 'My Remarks'}
          </h1>
          <p className="text-lg text-slate-500 mt-2">
            {isManagement ? 'Review and respond to teacher remarks, complaints, and material requests' : 'Submit remarks, complaints, and requests to management'}
          </p>
        </div>
        <NewRemarkForm onCreated={refresh} />
      </div>

      {isManagement && stats && <StatsBar stats={stats} />}

      <div className="flex items-center gap-4 flex-wrap" data-testid="remarks-filters">
        <Filter className="w-5 h-5 text-slate-400" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[200px] border-slate-200 h-12 text-base" data-testid="filter-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="text-base">
            <SelectItem value="all" className="text-base py-3">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-base py-3">{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] border-slate-200 h-12 text-base" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="text-base">
            <SelectItem value="all" className="text-base py-3">All Statuses</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k} className="text-base py-3">{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-base text-slate-400 ml-auto">{remarks.length} remark{remarks.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : remarks.length === 0 ? (
        <div className="text-center py-24 text-slate-400" data-testid="no-remarks">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-xl font-medium">No remarks yet</p>
          <p className="text-base mt-2">Click "New Remark" to submit one</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="remarks-list">
          {remarks.map(r => (
            <RemarkCard key={r.remark_id} remark={r} isManagement={isManagement} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
