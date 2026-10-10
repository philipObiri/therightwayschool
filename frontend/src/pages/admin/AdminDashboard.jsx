import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { OnlineUsersWidget } from '../../components/dashboard/OnlineUsersWidget';
import {
  Users, GraduationCap, BookOpen, ClipboardList, DollarSign, Calendar,
  TrendingUp, AlertCircle, Megaphone, FileText, CheckCircle2, Clock, XCircle,
  ArrowRight, Shield, ChevronRight, RotateCcw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';
import { useNavigate } from 'react-router-dom';

const STATUS_STYLES = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  submitted: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Submitted' },
  under_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Under Review' },
  returned: { bg: 'bg-red-100', text: 'text-red-700', label: 'Returned' },
  resubmitted: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Resubmitted' },
  approved: { bg: 'bg-[#C5A55A]/15', text: 'text-[#C5A55A]', label: 'Approved' },
  published: { bg: 'bg-[#C5A55A]/15', text: 'text-[#C5A55A]', label: 'Published' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Archived' },
};

function ApprovalDots({ chain }) {
  if (!chain || chain.length === 0) return null;
  return (
    <div className="flex items-center gap-1" data-testid="approval-dots">
      {chain.map((s, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${
          s.status === 'approved' || s.status === 'auto_approved' ? 'bg-[#C5A55A]/100' :
          s.status === 'returned' ? 'bg-red-500' :
          s.status === 'pending' ? 'bg-slate-300' : 'bg-slate-300'
        }`} title={`${s.label}: ${s.status}`} />
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
}

function ReviewCard({ item, type, onClick }) {
  const id = type === 'lesson' ? item.lesson_id : item.scheme_id;
  const title = item.title || item.name || 'Untitled';
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-pointer group"
      onClick={onClick}
      data-testid={`review-card-${id}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${type === 'lesson' ? 'bg-blue-100' : 'bg-blue-100'}`}>
        {type === 'lesson' ? <BookOpen className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-[#2E6CC4]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1B2A4A] truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400">{item.teacher_name || 'Unknown'}</span>
          <span className="text-[10px] text-slate-300">|</span>
          <span className="text-[10px] text-slate-400">{item.subject || item.subject_name || ''} {item.year_group || ''}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ApprovalDots chain={item.approval_chain} />
        <StatusBadge status={item.status} />
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
      </div>
    </div>
  );
}

function SubmissionCard({ item, type, onClick }) {
  const id = type === 'lesson' ? item.lesson_id : item.scheme_id;
  const title = item.title || item.name || 'Untitled';
  const isReturned = item.status === 'returned';
  const isApproved = item.status === 'approved' || item.status === 'published';
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${
        isReturned ? 'border-red-200 bg-red-50/30 hover:bg-red-50/60' :
        isApproved ? 'border-[#C5A55A]/30 bg-[#C5A55A]/10/30 hover:bg-[#C5A55A]/10/60' :
        'border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
      }`}
      onClick={onClick}
      data-testid={`submission-card-${id}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isReturned ? 'bg-red-100' : isApproved ? 'bg-[#C5A55A]/15' : type === 'lesson' ? 'bg-blue-100' : 'bg-blue-100'
      }`}>
        {isReturned ? <XCircle className="w-4 h-4 text-red-500" /> :
         isApproved ? <CheckCircle2 className="w-4 h-4 text-[#C5A55A]" /> :
         type === 'lesson' ? <BookOpen className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-[#2E6CC4]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1B2A4A] truncate">{title}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {item.current_approver_label || (isApproved ? 'Fully Approved' : item.status)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ApprovalDots chain={item.approval_chain} />
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [annDialog, setAnnDialog] = useState(false);
  const [annForm, setAnnForm] = useState({ title: '', body: '', priority: 'normal' });

  const userRoles = new Set([user?.role, ...(user?.roles || [])]);
  const isMgmt = ['SuperAdmin', 'Admin', 'CEO', 'Principal', 'HeadTeacher', 'Founder', 'HeadOfAcademics'].some(r => userRoles.has(r));
  const isTeacher = userRoles.has('Teacher');
  const isReceptionist = user?.role === 'Receptionist';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, reviewsRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/dashboard-reviews'),
        ]);
        setStats(statsRes.data);
        setReviews(reviewsRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <AppLoader />;

  const handleAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/live/announcements', annForm);
      successToast('Announcement posted to all students');
      setAnnDialog(false);
      setAnnForm({ title: '', body: '', priority: 'normal' });
    } catch (err) { toast.error('Failed'); }
  };

  const allStatCards = [
    { label: 'Students', value: stats?.total_students || 0, icon: GraduationCap, color: 'bg-blue-50 text-[#2E6CC4]', link: '/admin/students' },
    { label: 'Teachers', value: stats?.total_teachers || 0, icon: Users, color: 'bg-[#C5A55A]/10 text-[#C5A55A]', link: '/admin/staff' },
    { label: 'Classes', value: stats?.total_classes || 0, icon: Calendar, color: 'bg-amber-50 text-amber-600', link: '/admin/academics' },
    { label: 'Subjects', value: stats?.total_subjects || 0, icon: BookOpen, color: 'bg-blue-50 text-[#2E6CC4]', link: '/admin/academics' },
    { label: 'Lessons', value: stats?.total_lessons || 0, icon: BookOpen, color: 'bg-blue-50 text-[#2E6CC4]', link: '/admin/lessons' },
    { label: 'Assignments', value: stats?.total_assignments || 0, icon: ClipboardList, color: 'bg-red-50 text-red-600', link: '/admin/assignments' },
    { label: 'Collected (GHS)', value: `${(stats?.total_payments || 0).toLocaleString()}`, icon: TrendingUp, color: 'bg-[#C5A55A]/10 text-[#C5A55A]', link: '/admin/finance?tab=payments', feeRelated: true },
    { label: 'Outstanding (GHS)', value: `${(stats?.outstanding_fees || 0).toLocaleString()}`, icon: AlertCircle, color: 'bg-red-50 text-red-600', link: '/admin/finance?tab=arrears', feeRelated: true },
  ];
  const statCards = isReceptionist ? allStatCards.filter(s => !s.feeRelated) : allStatCards;

  const feeData = [
    { name: 'Collected', value: stats?.total_payments || 0 },
    { name: 'Outstanding', value: stats?.outstanding_fees || 0 },
  ];
  const COLORS = ['#19C37D', '#EF4444'];

  const barData = [
    { name: 'Students', count: stats?.total_students || 0 },
    { name: 'Teachers', count: stats?.total_teachers || 0 },
    { name: 'Classes', count: stats?.total_classes || 0 },
    { name: 'Lessons', count: stats?.total_lessons || 0 },
    { name: 'Assignments', count: stats?.total_assignments || 0 },
  ];

  const pendingLessons = reviews?.pending_lesson_reviews || [];
  const pendingSchemes = reviews?.pending_scheme_reviews || [];
  const myLessons = reviews?.my_lesson_submissions || [];
  const mySchemes = reviews?.my_scheme_submissions || [];
  const recentReviewedLessons = reviews?.recently_reviewed_lessons || [];
  const recentReviewedSchemes = reviews?.recently_reviewed_schemes || [];
  const totalPending = pendingLessons.length + pendingSchemes.length;
  const returnedLessons = myLessons.filter(l => l.status === 'returned');
  const returnedSchemes = mySchemes.filter(s => s.status === 'returned');
  const totalReturned = returnedLessons.length + returnedSchemes.length;
  const submittedLessons = myLessons.filter(l => ['submitted', 'under_review', 'resubmitted'].includes(l.status));
  const submittedSchemes = mySchemes.filter(s => ['submitted', 'under_review', 'resubmitted'].includes(s.status));
  const approvedLessons = myLessons.filter(l => l.status === 'approved' || l.status === 'published');
  const approvedSchemes = mySchemes.filter(s => s.status === 'approved' || s.status === 'published');

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      {/* Hero Banner — Premium */}
      <div className="relative w-full rounded-2xl bg-[#1B2A4A] overflow-hidden shadow-lg">
        <img src="/campus-1.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.2]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] via-[#1B2A4A]/90 to-transparent" />
        <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-8 md:py-10">
          <div>
            <p className="text-[#C5A55A] text-sm md:text-base font-semibold tracking-wide mb-1">Welcome back, {user?.name}</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Admin Dashboard</h1>
            <p className="text-slate-300 mt-2 text-xs md:text-sm flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Dialog open={annDialog} onOpenChange={setAnnDialog}>
            <DialogTrigger asChild><Button className="rounded-xl bg-[#C5A55A] hover:bg-[#B09444] text-white shadow-lg shadow-[#C5A55A]/20 h-11 px-6"><Megaphone className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Post Announcement</span><span className="sm:hidden">Post</span></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
              <form onSubmit={handleAnnouncement} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={annForm.title} onChange={e => setAnnForm({...annForm, title: e.target.value})} required placeholder="e.g. School Reopening Date" /></div>
                <div className="space-y-2"><Label>Message</Label><Textarea value={annForm.body} onChange={e => setAnnForm({...annForm, body: e.target.value})} rows={4} required placeholder="Type your announcement..." /></div>
                <div className="space-y-2"><Label>Priority</Label>
                  <Select value={annForm.priority} onValueChange={v => setAnnForm({...annForm, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="important">Important</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                  </Select></div>
                <Button type="submit" className="w-full rounded-md bg-[#C5A55A] hover:bg-[#B09444]"><Megaphone className="w-4 h-4 mr-2" /> Post to All Students</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending Reviews Alert (Management) */}
      {isMgmt && totalPending > 0 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 p-4" data-testid="pending-reviews-alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1B2A4A]">{totalPending} item{totalPending !== 1 ? 's' : ''} awaiting your review</p>
                <p className="text-xs text-slate-500">{pendingLessons.length} lesson{pendingLessons.length !== 1 ? 's' : ''}, {pendingSchemes.length} scheme{pendingSchemes.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Badge className="bg-amber-500 text-white hover:bg-amber-600">{totalPending}</Badge>
          </div>
        </div>
      )}

      {/* Returned Items Alert (Teacher/Dual-role) */}
      {(isTeacher || !isMgmt) && totalReturned > 0 && (
        <div className="rounded-lg border-l-4 border-red-400 bg-gradient-to-r from-red-50 to-rose-50 p-4" data-testid="returned-items-alert">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1B2A4A]">{totalReturned} item{totalReturned !== 1 ? 's' : ''} returned for revision</p>
              <p className="text-xs text-slate-500">Please review feedback and resubmit</p>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards — Modern Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 stagger-children">
        {statCards.map((s, i) => (
          <div key={i} onClick={() => s.link && navigate(s.link)} className="bg-white rounded-xl border border-slate-200/60 p-5 md:p-6 shadow-[0_2px_10px_rgba(27,42,74,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(27,42,74,0.08)] hover:-translate-y-1 relative overflow-hidden group cursor-pointer" style={{ animationDelay: `${i * 0.05}s` }} data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z]/g, '-')}`}>
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#2E6CC4] to-[#C5A55A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className={`w-10 h-10 rounded-lg bg-[#F8FAFC] flex items-center justify-center border border-slate-100 mb-4 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl md:text-3xl font-bold tracking-tight text-[#1B2A4A]" style={{ fontFamily: 'Outfit, sans-serif' }}>{s.value}</p>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending My Review Section (Management) */}
      {isMgmt && (pendingLessons.length > 0 || pendingSchemes.length > 0) && (
        <Card className="rounded-lg border-amber-200" data-testid="pending-reviews-section">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-lg">Pending My Review</CardTitle>
                <Badge variant="outline" className="ml-1 text-amber-600 border-amber-300">{totalPending}</Badge>
              </div>
              <div className="flex gap-2">
                {pendingLessons.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700" onClick={() => navigate('/admin/lessons')} data-testid="go-to-lessons-review">
                    All Lessons <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
                {pendingSchemes.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-[#2E6CC4] hover:text-[#1B2A4A]" onClick={() => navigate('/scheme-of-work')} data-testid="go-to-schemes-review">
                    All Schemes <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingLessons.slice(0, 5).map(l => (
              <ReviewCard key={l.lesson_id} item={l} type="lesson" onClick={() => navigate('/admin/lessons')} />
            ))}
            {pendingSchemes.slice(0, 5).map(s => (
              <ReviewCard key={s.scheme_id} item={s} type="scheme" onClick={() => navigate('/scheme-of-work')} />
            ))}
            {totalPending > 10 && (
              <p className="text-xs text-center text-slate-400 pt-2">+ {totalPending - 10} more items</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Submissions Section (Teacher / Dual-role) */}
      {(isTeacher || !isMgmt) && (myLessons.length > 0 || mySchemes.length > 0) && (
        <Card className="rounded-lg border-blue-200" data-testid="my-submissions-section">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-lg">My Submissions</CardTitle>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" /> {submittedLessons.length + submittedSchemes.length} Pending</span>
                <span className="flex items-center gap-1 text-[#C5A55A]"><CheckCircle2 className="w-3 h-3" /> {approvedLessons.length + approvedSchemes.length} Approved</span>
                {totalReturned > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> {totalReturned} Returned</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Show returned first (needs attention) */}
            {returnedLessons.map(l => (
              <SubmissionCard key={l.lesson_id} item={l} type="lesson" onClick={() => navigate(user?.role === 'Teacher' ? '/teacher/lessons' : '/admin/lessons')} />
            ))}
            {returnedSchemes.map(s => (
              <SubmissionCard key={s.scheme_id} item={s} type="scheme" onClick={() => navigate('/scheme-of-work')} />
            ))}
            {/* Then submitted/in-review */}
            {submittedLessons.slice(0, 3).map(l => (
              <SubmissionCard key={l.lesson_id} item={l} type="lesson" onClick={() => navigate(user?.role === 'Teacher' ? '/teacher/lessons' : '/admin/lessons')} />
            ))}
            {submittedSchemes.slice(0, 3).map(s => (
              <SubmissionCard key={s.scheme_id} item={s} type="scheme" onClick={() => navigate('/scheme-of-work')} />
            ))}
            {/* Then recently approved */}
            {approvedLessons.slice(0, 2).map(l => (
              <SubmissionCard key={l.lesson_id} item={l} type="lesson" onClick={() => navigate(user?.role === 'Teacher' ? '/teacher/lessons' : '/admin/lessons')} />
            ))}
            {approvedSchemes.slice(0, 2).map(s => (
              <SubmissionCard key={s.scheme_id} item={s} type="scheme" onClick={() => navigate('/scheme-of-work')} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recently Reviewed (Management) */}
      {isMgmt && (recentReviewedLessons.length > 0 || recentReviewedSchemes.length > 0) && (
        <Card className="rounded-lg border-slate-100" data-testid="recently-reviewed-section">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#C5A55A]" />
              <CardTitle className="text-lg">Recently Reviewed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-2">
              {[...recentReviewedLessons.slice(0, 4).map(l => ({ ...l, _type: 'lesson' })),
                ...recentReviewedSchemes.slice(0, 4).map(s => ({ ...s, _type: 'scheme' }))
              ].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 6).map(item => {
                const id = item._type === 'lesson' ? item.lesson_id : item.scheme_id;
                return (
                  <div key={id} className="flex items-center gap-2 p-2 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(item._type === 'lesson' ? '/admin/lessons' : '/scheme-of-work')}
                    data-testid={`recent-reviewed-${id}`}>
                    <div className={`w-7 h-7 rounded flex items-center justify-center ${item._type === 'lesson' ? 'bg-blue-100' : 'bg-blue-100'}`}>
                      {item._type === 'lesson' ? <BookOpen className="w-3.5 h-3.5 text-blue-600" /> : <FileText className="w-3.5 h-3.5 text-[#2E6CC4]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1B2A4A] truncate">{item.title || item.name || 'Untitled'}</p>
                      <p className="text-[10px] text-slate-400">{item.teacher_name}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts + Online Users */}
      <div className="grid lg:grid-cols-3 gap-6 stagger-children">
        <Card className="rounded-xl border-slate-200/60 shadow-[0_2px_10px_rgba(27,42,74,0.02)]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Platform Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2E6CC4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {!isReceptionist && (
        <Card className="rounded-xl border-slate-200/60 shadow-[0_2px_10px_rgba(27,42,74,0.02)]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Fee Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={feeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {feeData.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Online Users */}
        <OnlineUsersWidget />
      </div>

      {/* Recent activity */}
      <Card className="rounded-md border-slate-100">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stats?.recent_activities || []).slice(0, 8).map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-2 h-2 rounded-md bg-[#2E6CC4]" />
                <div className="flex-1">
                  <p className="text-sm text-[#1B2A4A]">
                    <span className="font-medium">{log.user_name}</span> {log.action.replace(/_/g, ' ')} {log.entity_type}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {(!stats?.recent_activities || stats.recent_activities.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
