import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  BarChart3, BookOpen, FileText, ClipboardList, Clock, CheckCircle,
  TrendingUp, Paperclip, Shield, AlertCircle, UserCheck, Eye, LinkIcon,
  Star, MessageSquare, Send, FolderOpen
} from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

const COMMENT_CAT_COLORS = {
  general: 'bg-slate-100 text-slate-600', performance: 'bg-blue-100 text-blue-700', improvement: 'bg-amber-100 text-amber-700',
  praise: 'bg-[#C5A55A]/15 text-[#C5A55A]', lesson_feedback: 'bg-indigo-100 text-indigo-700', assignment_feedback: 'bg-blue-100 text-[#1B2A4A]',
  attendance: 'bg-blue-100 text-[#2E6CC4]', professional_dev: 'bg-blue-100 text-[#2E6CC4]', warning: 'bg-red-100 text-red-700', directive: 'bg-orange-100 text-orange-700',
};

export default function MyMonitoring() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');

  const token = localStorage.getItem('rw_token');
  const fileUrl = (fileId, action = 'preview') => `${import.meta.env.VITE_API_URL}/api/files/${fileId}/${action}?token=${token}`;

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/monitoring/my-review');
      setData(res.data);
    } catch { toast.error('Failed to load your monitoring data'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtDate = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
  };
  const fmtShort = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return iso; }
  };

  if (loading) return <AppLoader />;
  if (!data) return <p className="text-center py-20 text-slate-400">Unable to load monitoring data.</p>;

  const { lessons, lesson_plans: plans, assignments, uploaded_files, staff_documents, clock_history, audit_logs, remarks, wp_documents, wp_audit, scorecard, summary, activity_metrics: metrics, management_comments, daily_metrics: daily } = data;
  const kpis = scorecard?.kpis || {};
  const breakdown = metrics?.breakdown || {};
  const dailyBreakdown = daily?.breakdown || {};

  const sections = [
    { key: 'overview', label: 'My Overview', icon: BarChart3 },
    { key: 'daily_score', label: 'Daily Score', icon: Clock },
    { key: 'activity_score', label: 'Monthly Score', icon: TrendingUp },
    { key: 'feedback', label: `Mgmt Feedback (${(management_comments || []).length})`, icon: MessageSquare },
    { key: 'lessons', label: `Lessons (${summary.total_lessons})`, icon: BookOpen },
    { key: 'plans', label: `Plans (${summary.total_plans})`, icon: FileText },
    { key: 'assignments', label: `Assignments (${summary.total_assignments})`, icon: ClipboardList },
    { key: 'files', label: `Files (${summary.total_files})`, icon: Paperclip },
    { key: 'documents', label: `Docs (${summary.total_staff_docs})`, icon: Shield },
    { key: 'remarks', label: `Remarks (${summary.total_remarks})`, icon: AlertCircle },
    { key: 'clock', label: 'Clock History', icon: UserCheck },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5" data-testid="my-monitoring-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-[#2E6CC4] flex items-center justify-center text-white text-lg font-bold">{user?.name?.charAt(0)}</div>
        <div>
          <h1 className="text-xl font-bold text-[#1B2A4A]">My Performance & Monitoring</h1>
          <p className="text-sm text-slate-500">{user?.name} | {user?.department || ''} | {(user?.teaching_subjects || []).join(', ')}</p>
        </div>
        <div className="ml-auto text-center">
          <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= (kpis.observations?.avg_rating || 0) ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div>
          <p className="text-[10px] text-slate-400">{kpis.observations?.avg_rating || 0}/5 avg</p>
        </div>
      </div>

      {/* Section Nav */}
      <div className="flex gap-1 flex-wrap bg-white rounded-lg border border-slate-100 p-1.5" data-testid="my-sections">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeSection === s.key ? 'bg-[#2E6CC4] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              data-testid={`my-section-${s.key}`}>
              <Icon className="w-3.5 h-3.5" />{s.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview ── */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Dual Score Banners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Score */}
            <div className={`rounded-xl p-5 border ${(daily?.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/10 border-[#C5A55A]/30' : (daily?.overall_score || 0) >= 60 ? 'bg-blue-50 border-blue-200' : (daily?.overall_score || 0) >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`} data-testid="my-daily-score-banner">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today's Score</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black">{daily?.overall_score || 0}</span>
                    <span className="text-sm text-slate-400">/100</span>
                    <Badge className={`ml-1 text-[10px] ${(daily?.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : (daily?.overall_score || 0) >= 60 ? 'bg-blue-100 text-blue-700' : (daily?.overall_score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {daily?.activity_level || 'N/A'}
                    </Badge>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={(daily?.overall_score || 0) >= 80 ? '#10b981' : (daily?.overall_score || 0) >= 60 ? '#3b82f6' : (daily?.overall_score || 0) >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeDasharray={`${(daily?.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{daily?.overall_score || 0}%</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">{daily?.date || 'Today'} — Your daily progress resets at midnight</p>
            </div>

            {/* Monthly Score */}
            <div className={`rounded-xl p-5 border ${(metrics?.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/10 border-[#C5A55A]/30' : (metrics?.overall_score || 0) >= 60 ? 'bg-blue-50 border-blue-200' : (metrics?.overall_score || 0) >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`} data-testid="my-score-banner">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monthly Score (30d)</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black">{metrics?.overall_score || 0}</span>
                    <span className="text-sm text-slate-400">/100</span>
                    <Badge className={`ml-1 text-[10px] ${(metrics?.overall_score || 0) >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : (metrics?.overall_score || 0) >= 60 ? 'bg-blue-100 text-blue-700' : (metrics?.overall_score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {metrics?.activity_level || 'N/A'}
                    </Badge>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={(metrics?.overall_score || 0) >= 80 ? '#10b981' : (metrics?.overall_score || 0) >= 60 ? '#3b82f6' : (metrics?.overall_score || 0) >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeDasharray={`${(metrics?.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{metrics?.overall_score || 0}%</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Rolling 30-day average of all teaching activities</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { v: summary.total_lessons, l: 'Lessons' }, { v: summary.total_plans, l: 'Plans' },
              { v: summary.total_assignments, l: 'Assignments' }, { v: summary.total_files, l: 'Files' },
              { v: summary.total_staff_docs, l: 'Docs' }, { v: summary.total_remarks, l: 'Remarks' },
              { v: summary.total_wp_docs, l: 'WP Docs' },
            ].map(s => (
              <div key={s.l} className="bg-white rounded-lg border border-slate-100 p-3 text-center">
                <p className="text-xl font-bold text-[#1B2A4A]">{s.v}</p><p className="text-xs text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Management Feedback Preview */}
          {(management_comments || []).length > 0 && (
            <Card className="rounded-lg border-slate-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#2E6CC4]" /> Latest Management Feedback</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(management_comments || []).slice(0, 3).map(c => (
                    <div key={c.comment_id} className={`rounded-lg p-3 border ${c.pinned ? 'border-[#F59E0B] bg-amber-50/50' : 'border-slate-100 bg-slate-50'}`} data-testid={`my-comment-${c.comment_id}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#1B2A4A]">{c.author_name}</span>
                        <Badge variant="secondary" className="text-[9px]">{c.author_role}</Badge>
                        <Badge className={`text-[9px] ${COMMENT_CAT_COLORS[c.category] || COMMENT_CAT_COLORS.general}`}>{(c.category || '').replace(/_/g, ' ')}</Badge>
                        {c.pinned && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />}
                      </div>
                      <p className="text-sm text-slate-700">{c.text}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{fmtDate(c.created_at)}</p>
                    </div>
                  ))}
                  {(management_comments || []).length > 3 && (
                    <button onClick={() => setActiveSection('feedback')} className="text-xs text-[#2E6CC4] hover:underline" data-testid="view-all-feedback">View all {management_comments.length} comments</button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Daily Score Breakdown ── */}
      {activeSection === 'daily_score' && (
        <div className="space-y-4" data-testid="my-daily-score-section">
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="flex items-center gap-8">
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={(daily?.overall_score || 0) >= 80 ? '#10b981' : (daily?.overall_score || 0) >= 60 ? '#3b82f6' : (daily?.overall_score || 0) >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(daily?.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black">{daily?.overall_score || 0}</span>
                  <span className="text-[10px] text-slate-400">/100</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#1B2A4A]">Today's Score: {daily?.activity_level || 'N/A'}</h3>
                <p className="text-sm text-slate-500 mt-1">This tracks your daily progress ({daily?.date || 'today'}). Create lessons, set assignments, upload files, and clock in to improve your daily score. It resets at midnight.</p>
                <div className="mt-3 flex gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C5A55A]/100"></span> 80+ Excellent</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 60-79 Good</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 40-59 Fair</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 0-39 Needs Work</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'lessons', label: 'Lessons Created', icon: BookOpen, color: '#2E6CC4', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0}` },
              { key: 'assignments', label: 'Assignments Set', icon: ClipboardList, color: '#7c3aed', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0}` },
              { key: 'plans', label: 'Lesson Plans', icon: FileText, color: '#059669', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0}` },
              { key: 'files', label: 'File Uploads', icon: Paperclip, color: '#0891b2', detail: (b) => `${b.count_today || 0} today / target: ${b.target || 0}` },
              { key: 'clock_hours', label: 'Clock-In Hours', icon: Clock, color: '#d97706', detail: (b) => `${b.hours_today || 0}h today / target: ${b.target || 0}h` },
              { key: 'platform_activity', label: 'Platform Actions', icon: TrendingUp, color: '#4f46e5', detail: (b) => `${b.actions_today || 0} actions / target: ${b.target || 0}` },
              { key: 'wp_documents', label: 'Working Paper Docs', icon: FolderOpen, color: '#be185d', detail: (b) => `${b.count_today || 0} uploaded / target: ${b.target || 0}` },
              { key: 'wp_actions', label: 'Working Paper Actions', icon: Shield, color: '#0d9488', detail: (b) => `${b.count_today || 0} actions / target: ${b.target || 0}` },
            ].map(m => {
              const b = dailyBreakdown[m.key] || {};
              const Icon = m.icon;
              return (
                <div key={m.key} className="bg-white rounded-lg border border-slate-100 p-4" data-testid={`my-daily-${m.key}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color: m.color }} /><span className="text-sm font-semibold text-[#1B2A4A]">{m.label}</span></div>
                    <span className="text-xs text-slate-400">{b.weight || 0}%</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold" style={{ color: m.color }}>{b.score || 0}</span>
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${b.score || 0}%`, backgroundColor: m.color }}></div>
                  </div>
                  <p className="text-[10px] text-slate-400">{m.detail(b)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Activity Score Breakdown (Monthly) ── */}
      {activeSection === 'activity_score' && (
        <div className="space-y-4" data-testid="my-activity-score">
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="flex items-center gap-8">
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={(metrics?.overall_score || 0) >= 80 ? '#10b981' : (metrics?.overall_score || 0) >= 60 ? '#3b82f6' : (metrics?.overall_score || 0) >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" strokeDasharray={`${(metrics?.overall_score || 0) * 2.64} 264`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black">{metrics?.overall_score || 0}</span>
                  <span className="text-[10px] text-slate-400">/100</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#1B2A4A]">Your Activity Score: {metrics?.activity_level}</h3>
                <p className="text-sm text-slate-500 mt-1">This score reflects how actively you are engaging with teaching, grading, and platform activities over the last 30 days. Keep uploading lessons, grading assignments, and clocking in to improve your score.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'lessons', label: 'Lessons Created', icon: BookOpen, color: '#2E6CC4', detail: `${breakdown.lessons?.count_30d || 0} in 30d / ${breakdown.lessons?.total || 0} total / ${breakdown.lessons?.published || 0} published` },
              { key: 'assignments', label: 'Assignments', icon: ClipboardList, color: '#7c3aed', detail: `${breakdown.assignments?.count_30d || 0} in 30d / ${breakdown.assignments?.total || 0} total` },
              { key: 'plans', label: 'Lesson Plans', icon: FileText, color: '#059669', detail: `${breakdown.plans?.count_30d || 0} in 30d / ${breakdown.plans?.total || 0} total / ${breakdown.plans?.approval_rate || 0}% approved` },
              { key: 'files', label: 'File Uploads', icon: Paperclip, color: '#0891b2', detail: `${breakdown.files?.count_30d || 0} in 30d / ${breakdown.files?.total || 0} total` },
              { key: 'clock_hours', label: 'Clock-In Hours', icon: Clock, color: '#d97706', detail: `${breakdown.clock_hours?.hours_30d || 0}h in 30d / ${breakdown.clock_hours?.total_hours || 0}h total` },
              { key: 'grading', label: 'Grading Rate', icon: CheckCircle, color: '#dc2626', detail: `${breakdown.grading?.graded || 0}/${breakdown.grading?.total_submissions || 0} graded (${breakdown.grading?.rate || 0}%)` },
              { key: 'platform_activity', label: 'Platform Activity', icon: TrendingUp, color: '#4f46e5', detail: `${breakdown.platform_activity?.actions_30d || 0} actions in 30d` },
              { key: 'wp_documents', label: 'Working Paper Docs', icon: FolderOpen, color: '#be185d', detail: `${breakdown.wp_documents?.count_30d || 0} in 30d / ${breakdown.wp_documents?.total || 0} total` },
              { key: 'wp_actions', label: 'Working Paper Actions', icon: Shield, color: '#0d9488', detail: `${breakdown.wp_actions?.count_30d || 0} in 30d / ${breakdown.wp_actions?.total || 0} total` },
            ].map(m => {
              const b = breakdown[m.key] || {};
              const Icon = m.icon;
              return (
                <div key={m.key} className="bg-white rounded-lg border border-slate-100 p-4" data-testid={`my-metric-${m.key}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color: m.color }} /><span className="text-sm font-semibold text-[#1B2A4A]">{m.label}</span></div>
                    <span className="text-xs text-slate-400">{b.weight || 0}% weight</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold" style={{ color: m.color }}>{b.score || 0}</span>
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                  <Progress value={b.score || 0} className="h-2 mb-2" />
                  <p className="text-[10px] text-slate-400">{m.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Management Feedback (full list) ── */}
      {activeSection === 'feedback' && (
        <Card className="rounded-lg border-slate-100" data-testid="my-feedback-section">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#2E6CC4]" /> Management Feedback ({(management_comments || []).length})</CardTitle></CardHeader>
          <CardContent>
            {(management_comments || []).length > 0 ? (
              <div className="space-y-3">
                {(management_comments || []).map(c => (
                  <div key={c.comment_id} className={`rounded-lg p-4 border ${c.pinned ? 'border-[#F59E0B] bg-amber-50/50' : 'border-slate-100 bg-slate-50'}`} data-testid={`my-fb-${c.comment_id}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-semibold text-[#1B2A4A]">{c.author_name}</span>
                      <Badge variant="secondary" className="text-[9px]">{c.author_role}</Badge>
                      <Badge className={`text-[9px] ${COMMENT_CAT_COLORS[c.category] || COMMENT_CAT_COLORS.general}`}>{(c.category || '').replace(/_/g, ' ')}</Badge>
                      {c.pinned && <Badge className="text-[9px] bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30">Pinned</Badge>}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.text}</p>
                    <p className="text-[10px] text-slate-400 mt-2">{fmtDate(c.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400 text-center py-8">No management feedback yet.</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Lessons ── */}
      {activeSection === 'lessons' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#2E6CC4]" /> My Lessons ({lessons.length})</CardTitle></CardHeader>
          <CardContent>
            {lessons.length > 0 ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Title</TableHead><TableHead className="bg-slate-50">Subject</TableHead>
                  <TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">Date</TableHead>
                  <TableHead className="bg-slate-50">Files</TableHead><TableHead className="bg-slate-50">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{lessons.map(l => (
                  <TableRow key={l.lesson_id}>
                    <TableCell className="font-medium text-sm">{l.title}</TableCell>
                    <TableCell className="text-sm text-slate-500">{l.subject_name}</TableCell>
                    <TableCell className="text-xs text-slate-400">{l.lesson_type}</TableCell>
                    <TableCell className="text-xs text-slate-400">{fmtShort(l.created_at)}</TableCell>
                    <TableCell>{(l.file_ids || []).map(fid => (
                      <span key={fid} className="inline-flex gap-1 mr-1">
                        <a href={fileUrl(fid, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] text-[10px]">View</a>
                        <a href={fileUrl(fid, 'download')} className="text-[#C5A55A] text-[10px]">DL</a>
                      </span>
                    ))}{(!l.file_ids || !l.file_ids.length) && <span className="text-[10px] text-slate-300">-</span>}</TableCell>
                    <TableCell><Badge className={l.published ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : 'bg-slate-100 text-slate-500 text-[10px]'}>{l.published ? 'Published' : 'Draft'}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No lessons yet</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Plans ── */}
      {activeSection === 'plans' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-[#C5A55A]" /> My Lesson Plans ({plans.length})</CardTitle></CardHeader>
          <CardContent>
            {plans.length > 0 ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Topic</TableHead><TableHead className="bg-slate-50">Subject</TableHead>
                  <TableHead className="bg-slate-50">Class</TableHead><TableHead className="bg-slate-50">Week</TableHead>
                  <TableHead className="bg-slate-50">Files</TableHead><TableHead className="bg-slate-50">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{plans.map(p => (
                  <TableRow key={p.plan_id}>
                    <TableCell className="font-medium text-sm">{p.topic}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.subject_name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.class_name}</TableCell>
                    <TableCell className="text-xs text-slate-400">{p.week}</TableCell>
                    <TableCell>{(p.evidence_file_ids || []).map(fid => (
                      <span key={fid} className="inline-flex gap-1 mr-1">
                        <a href={fileUrl(fid, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] text-[10px]">View</a>
                        <a href={fileUrl(fid, 'download')} className="text-[#C5A55A] text-[10px]">DL</a>
                      </span>
                    ))}{(!p.evidence_file_ids || !p.evidence_file_ids.length) && <span className="text-[10px] text-slate-300">-</span>}</TableCell>
                    <TableCell><Badge className={p.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : p.status === 'returned' ? 'bg-red-100 text-red-700 text-[10px]' : 'bg-amber-100 text-amber-700 text-[10px]'}>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No plans submitted yet</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Assignments ── */}
      {activeSection === 'assignments' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#2E6CC4]" /> My Assignments ({assignments.length})</CardTitle></CardHeader>
          <CardContent>
            {assignments.length > 0 ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Title</TableHead><TableHead className="bg-slate-50">Subject</TableHead>
                  <TableHead className="bg-slate-50">Due</TableHead><TableHead className="bg-slate-50">Submissions</TableHead>
                  <TableHead className="bg-slate-50">Graded</TableHead><TableHead className="bg-slate-50">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{assignments.map(a => (
                  <TableRow key={a.assignment_id}>
                    <TableCell className="font-medium text-sm">{a.title}</TableCell>
                    <TableCell className="text-sm text-slate-500">{a.subject_name}</TableCell>
                    <TableCell className="text-xs text-slate-400">{a.due_date || '-'}</TableCell>
                    <TableCell className="text-sm">{a.total_submissions || 0}</TableCell>
                    <TableCell className="text-sm">{a.graded_count || 0}</TableCell>
                    <TableCell><Badge className={a.published ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : 'bg-slate-100 text-slate-500 text-[10px]'}>{a.published ? 'Active' : 'Draft'}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No assignments yet</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Files ── */}
      {activeSection === 'files' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Paperclip className="w-4 h-4 text-[#2E6CC4]" /> My Uploaded Files ({uploaded_files.length})</CardTitle></CardHeader>
          <CardContent>
            {uploaded_files.length > 0 ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Filename</TableHead><TableHead className="bg-slate-50">Type</TableHead>
                  <TableHead className="bg-slate-50">Size</TableHead><TableHead className="bg-slate-50">Uploaded</TableHead>
                  <TableHead className="bg-slate-50">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>{uploaded_files.map(f => (
                  <TableRow key={f.file_id}>
                    <TableCell className="font-medium text-sm">{f.original_filename}</TableCell>
                    <TableCell className="text-xs text-slate-400">{f.content_type?.split('/').pop() || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-400">{f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : '-'}</TableCell>
                    <TableCell className="text-xs text-slate-400">{fmtDate(f.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <a href={fileUrl(f.file_id, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] hover:underline text-xs"><Eye className="w-3.5 h-3.5 inline mr-0.5" />View</a>
                        <a href={fileUrl(f.file_id, 'download')} className="text-[#C5A55A] hover:underline text-xs"><LinkIcon className="w-3.5 h-3.5 inline mr-0.5" />Download</a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No files uploaded</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Documents ── */}
      {activeSection === 'documents' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-[#2E6CC4]" /> My Documents ({staff_documents.length})</CardTitle></CardHeader>
          <CardContent>
            {staff_documents.length > 0 ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Title</TableHead><TableHead className="bg-slate-50">Type</TableHead>
                  <TableHead className="bg-slate-50">Uploaded</TableHead><TableHead className="bg-slate-50">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>{staff_documents.map(d => (
                  <TableRow key={d.doc_id}>
                    <TableCell className="font-medium text-sm">{d.title || d.filename}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{d.doc_type || 'other'}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-400">{fmtDate(d.created_at)}</TableCell>
                    <TableCell>{d.file_id && (
                      <div className="flex gap-2">
                        <a href={fileUrl(d.file_id, 'preview')} target="_blank" rel="noreferrer" className="text-[#2E6CC4] text-xs"><Eye className="w-3.5 h-3.5 inline mr-0.5" />View</a>
                        <a href={fileUrl(d.file_id, 'download')} className="text-[#C5A55A] text-xs"><LinkIcon className="w-3.5 h-3.5 inline mr-0.5" />Download</a>
                      </div>
                    )}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No documents on file</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Remarks ── */}
      {activeSection === 'remarks' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> My Remarks ({remarks.length})</CardTitle></CardHeader>
          <CardContent>
            {remarks.length > 0 ? (
              <div className="space-y-3">{remarks.map(r => (
                <div key={r.remark_id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-[#1B2A4A]">{r.title}</h4>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-[10px]">{(r.category || '').replace(/_/g, ' ')}</Badge>
                      <Badge className={r.status === 'resolved' || r.status === 'closed' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]' : r.status === 'open' ? 'bg-amber-100 text-amber-700 text-[10px]' : 'bg-blue-100 text-blue-700 text-[10px]'}>{r.status}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-1">{r.body}</p>
                  <p className="text-[10px] text-slate-400">{fmtDate(r.created_at)}</p>
                  {r.responses?.length > 0 && <p className="text-xs text-[#2E6CC4] mt-1">{r.responses.length} response(s)</p>}
                </div>
              ))}</div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No remarks submitted</p>}
          </CardContent>
        </Card>
      )}

      {/* ── Clock History ── */}
      {activeSection === 'clock' && (
        <Card className="rounded-lg border-slate-100">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="w-4 h-4 text-[#C5A55A]" /> My Clock History ({clock_history.length})</CardTitle></CardHeader>
          <CardContent>
            {clock_history.length > 0 ? (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead className="bg-slate-50">Clock In</TableHead><TableHead className="bg-slate-50">Clock Out</TableHead>
                  <TableHead className="bg-slate-50">Duration</TableHead><TableHead className="bg-slate-50">Method</TableHead>
                </TableRow></TableHeader>
                <TableBody>{clock_history.map(c => {
                  let dur = '-';
                  if (c.clock_in && c.clock_out) {
                    const ms = new Date(c.clock_out) - new Date(c.clock_in);
                    dur = `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
                  }
                  return (
                    <TableRow key={c.entry_id}>
                      <TableCell className="text-sm">{fmtDate(c.clock_in)}</TableCell>
                      <TableCell className="text-sm">{c.clock_out ? fmtDate(c.clock_out) : <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]">Active</Badge>}</TableCell>
                      <TableCell className="text-sm font-medium">{dur}</TableCell>
                      <TableCell className="text-xs text-slate-400 capitalize">{(c.method || '').replace(/_/g, ' ')}</TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table></div>
            ) : <p className="text-sm text-slate-400 text-center py-4">No clock entries</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
