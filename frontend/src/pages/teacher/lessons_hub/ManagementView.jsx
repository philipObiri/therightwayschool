import React, { useState, useEffect } from 'react';
import { useTerm } from '../../../contexts/TermContext';
import api from '../../../lib/api';
import { AppLoader } from '../../../components/AppLoader';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Progress } from '../../../components/ui/progress';
import {
  FileText, FolderOpen, CheckCircle, Clock, Eye, BarChart3, Sparkles, Download,
  AlertTriangle, Search, RotateCcw, LayoutTemplate
} from 'lucide-react';
import { STATUS_CONFIG, ApprovalChainBadge } from './shared';
import MgmtReviewPanel from './MgmtReviewPanel';
import TemplateManager from './TemplateManager';

export default function ManagementView() {
  const { activeTerm } = useTerm();
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pendingMyReview, setPendingMyReview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [filter, setFilter] = useState({ status: 'all_submitted', department: '', teacher_id: '' });
  const [searchQ, setSearchQ] = useState('');

  const refresh = async () => {
    try {
      const [dRes, lRes, cRes, tRes, pRes] = await Promise.all([
        api.get('/lessons-v2/management-dashboard'),
        api.get('/lessons-v2/', { params: { status: filter.status || 'all_submitted', department: filter.department, teacher_id: filter.teacher_id } }),
        api.get('/lessons-v2/management/compliance'),
        api.get('/lessons-v2/templates/list'),
        api.get('/lessons-v2/my-pending-reviews'),
      ]);
      setDashboard(dRes.data); setLessons(lRes.data); setCompliance(cRes.data); setTemplates(tRes.data); setPendingMyReview(pRes.data);
    } catch (err) { console.error("API error:", err); }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [activeTerm, filter]);

  if (loading) return <AppLoader />;
  if (selectedLesson) return <MgmtReviewPanel lessonId={selectedLesson.lesson_id} onBack={() => { setSelectedLesson(null); refresh(); }} />;

  const d = dashboard || {};
  const filtered = searchQ ? lessons.filter(l => l.teacher_name?.toLowerCase().includes(searchQ.toLowerCase()) || l.subject_name?.toLowerCase().includes(searchQ.toLowerCase()) || l.title?.toLowerCase().includes(searchQ.toLowerCase())) : lessons;

  return (
    <div className="space-y-4 md:space-y-5 p-1" data-testid="lesson-mgmt-view">
      <div><h1 className="text-xl md:text-2xl font-bold text-[#1B2A4A]">Lessons — Management</h1><p className="text-xs md:text-sm text-slate-500">{activeTerm} — Review, approve, and monitor compliance</p></div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        {[
          { label: 'Total Submitted', value: d.total || 0, icon: FolderOpen, color: '#1B2A4A' },
          { label: 'Pending Review', value: d.pending || 0, icon: Clock, color: '#f59e0b' },
          { label: 'Under Review', value: d.under_review || 0, icon: Eye, color: '#6366f1' },
          { label: 'Approved', value: d.approved || 0, icon: CheckCircle, color: '#10b981' },
          { label: 'Returned', value: d.returned || 0, icon: RotateCcw, color: '#ef4444' },
        ].map(s => (
          <Card key={s.label} className="rounded-lg border-slate-100">
            <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                <s.icon className="w-4 h-4 md:w-5 md:h-5" style={{ color: s.color }} />
              </div>
              <div><p className="text-lg md:text-2xl font-bold" style={{ color: s.color }}>{s.value}</p><p className="text-[9px] md:text-[10px] text-slate-400 uppercase">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending My Review */}
      {pendingMyReview.length > 0 && (
        <Card className="rounded-lg border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50" data-testid="pending-my-review-section">
          <CardContent className="p-3 md:p-4">
            <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Your Review ({pendingMyReview.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {pendingMyReview.map(item => (
                <div key={item.lesson_id} className="bg-white rounded-lg border border-amber-200 p-3 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all"
                  onClick={() => setSelectedLesson(item)} data-testid={`pending-review-${item.lesson_id}`}>
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="text-xs font-semibold text-[#1B2A4A] truncate">{item.title}</h4><p className="text-[10px] text-slate-400">{item.teacher_name} | {item.subject_name}</p></div><ApprovalChainBadge chain={item.approval_chain} /></div>
                  <p className="text-[10px] text-amber-600 font-medium mt-1">{item.current_approver_label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {[{ k: 'dashboard', l: 'Submissions', icon: FileText }, { k: 'compliance', l: 'Compliance', icon: BarChart3 }, { k: 'overdue', l: `Overdue (${d.overdue_staff?.length || 0})`, icon: AlertTriangle }, { k: 'templates', l: `Templates (${templates.length})`, icon: LayoutTemplate }].map(t => (
          <button key={t.k} className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap ${tab === t.k ? 'border-[#2E6CC4] text-[#2E6CC4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setTab(t.k)}>
            <t.icon className="w-3.5 h-3.5" />{t.l}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 items-stretch sm:items-center">
            <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." className="pl-9 rounded-lg" data-testid="lesson-mgmt-search" /></div>
            <Select value={filter.status} onValueChange={v => setFilter({...filter, status: v})}>
              <SelectTrigger className="w-full sm:w-44 rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_submitted">All Submitted</SelectItem><SelectItem value="submitted">Pending</SelectItem><SelectItem value="under_review">Under Review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="returned">Returned</SelectItem><SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-lg border border-slate-100 overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50"><tr className="text-xs text-slate-500 uppercase">
                <th className="text-left px-3 md:px-4 py-3">Staff</th><th className="text-left px-3 md:px-4 py-3">Subject / Year</th>
                <th className="text-left px-3 md:px-4 py-3">Term</th><th className="text-left px-3 md:px-4 py-3">Status</th>
                <th className="text-left px-3 md:px-4 py-3">Chain</th><th className="text-left px-3 md:px-4 py-3">AI</th><th className="px-3 md:px-4 py-3">Action</th>
              </tr></thead>
              <tbody>
                {filtered.map(l => {
                  const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG.draft;
                  return (
                    <tr key={l.lesson_id} className="border-t border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedLesson(l)} data-testid={`mgmt-lesson-${l.lesson_id}`}>
                      <td className="px-3 md:px-4 py-3"><p className="text-sm font-medium text-[#1B2A4A]">{l.teacher_name}</p><p className="text-[10px] text-slate-400">{l.department}</p></td>
                      <td className="px-3 md:px-4 py-3"><p className="text-sm text-[#1B2A4A]">{l.subject_name}</p><p className="text-[10px] text-slate-400">{l.year_group}</p></td>
                      <td className="px-3 md:px-4 py-3 text-xs text-slate-500">{l.term}</td>
                      <td className="px-3 md:px-4 py-3"><Badge className={`${sc.color} text-[10px]`}>{sc.label}</Badge></td>
                      <td className="px-3 md:px-4 py-3"><ApprovalChainBadge chain={l.approval_chain} /></td>
                      <td className="px-3 md:px-4 py-3">{l.ai_processed ? <Sparkles className="w-4 h-4 text-[#2E6CC4]" /> : <span className="text-xs text-slate-300">Manual</span>}</td>
                      <td className="px-3 md:px-4 py-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Button size="sm" variant="outline" className="rounded-lg text-xs"><Eye className="w-3 h-3 mr-1" /> Review</Button>
                          <a href={`${import.meta.env.VITE_API_URL}/api/lessons-v2/${l.lesson_id}/export-pdf?token=${localStorage.getItem('rw_token')}&download=1`} download onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="rounded-lg text-xs text-blue-600" data-testid={`download-pdf-${l.lesson_id}`}><Download className="w-3 h-3" /></Button>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-slate-400"><p>No lessons match your filters</p></div>}
          </div>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="bg-white rounded-lg border border-slate-100 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-50"><tr className="text-xs text-slate-500 uppercase">
              <th className="text-left px-4 py-3">Teacher</th><th className="text-left px-4 py-3">Dept</th>
              <th className="text-center px-4 py-3">Required</th><th className="text-center px-4 py-3">Submitted</th>
              <th className="text-center px-4 py-3">Approved</th><th className="text-center px-4 py-3">Missing</th>
              <th className="text-left px-4 py-3">Rate</th>
            </tr></thead>
            <tbody>{compliance.map(c => (
              <tr key={c.user_id} className="border-t border-slate-50" data-testid={`lesson-compliance-${c.user_id}`}>
                <td className="px-4 py-3 text-sm font-medium text-[#1B2A4A]">{c.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{c.department || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{c.required}</td>
                <td className="px-4 py-3 text-center text-sm text-blue-600 font-medium">{c.submitted}</td>
                <td className="px-4 py-3 text-center text-sm text-[#C5A55A] font-medium">{c.approved}</td>
                <td className="px-4 py-3 text-center text-sm font-medium">{c.missing > 0 ? <span className="text-red-600">{c.missing}</span> : <CheckCircle className="w-4 h-4 text-[#C5A55A] mx-auto" />}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Progress value={c.rate} className="h-2 flex-1" /><span className={`text-xs font-bold ${c.rate >= 100 ? 'text-[#C5A55A]' : c.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.rate}%</span></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'overdue' && (
        <div className="space-y-3">
          {(d.overdue_staff || []).length === 0 ? (
            <div className="text-center py-16"><CheckCircle className="w-16 h-16 text-[#C5A55A] mx-auto mb-3" /><p className="text-lg font-medium text-[#C5A55A]">All staff have submitted!</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(d.overdue_staff || []).map(s => (
                <Card key={s.user_id} className="rounded-lg border-red-200 bg-red-50/30">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
                    <div><p className="text-sm font-semibold text-red-800">{s.name}</p><p className="text-xs text-red-600">{s.department || 'No department'}</p></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && <TemplateManager templates={templates} onRefresh={refresh} />}
    </div>
  );
}
