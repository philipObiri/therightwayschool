import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  BookOpen, ClipboardList, Users, TrendingUp, LogIn, LogOut, Clock, Timer,
  FileText, CheckCircle2, XCircle, ArrowRight, ChevronRight, RotateCcw, Shield,
  PenSquare, Presentation
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import TimetableWidget from '../../components/TimetableWidget';
import { AppLoader } from '../../components/AppLoader';

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
    <div className="flex items-center gap-1.5" data-testid="approval-dots">
      {chain.map((s, i) => (
        <div key={i} className={`w-3 h-3 rounded-full ${
          s.status === 'approved' || s.status === 'auto_approved' ? 'bg-[#C5A55A]/100' :
          s.status === 'returned' ? 'bg-red-500' : 'bg-slate-300'
        }`} title={`${s.label}: ${s.status}`} />
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockStatus, setClockStatus] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [todayHours, setTodayHours] = useState(0);
  const [reviews, setReviews] = useState(null);

  const userRoles = new Set([user?.role, ...(user?.roles || [])]);
  const isMgmt = ['SuperAdmin', 'Admin', 'CEO', 'Principal', 'HeadTeacher', 'Founder', 'HeadOfAcademics'].some(r => userRoles.has(r));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promises = [
          api.get('/lms/lessons', { params: { teacher_id: user?.user_id } }),
          api.get('/assignments', { params: { teacher_id: user?.user_id } }),
          api.get('/academic/classes'),
          api.get('/hr/clock/status'),
          api.get('/hr/clock/history'),
          api.get('/admin/dashboard-reviews').catch(() => ({ data: null })),
        ];
        const [lesRes, asgnRes, clsRes, clockRes, histRes, reviewsRes] = await Promise.all(promises);
        setLessons(lesRes.data);
        setAssignments(asgnRes.data);
        setClasses(clsRes.data);
        setClockStatus(clockRes.data);
        setReviews(reviewsRes.data);

        const today = new Date().toISOString().split('T')[0];
        let totalSec = 0;
        (histRes.data || []).forEach(entry => {
          if (entry.clock_in?.startsWith(today) && entry.clock_out) {
            totalSec += Math.floor((new Date(entry.clock_out) - new Date(entry.clock_in)) / 1000);
          }
        });
        setTodayHours(totalSec);
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (!clockStatus?.clocked_in || !clockStatus?.entry?.clock_in) return;
    const start = new Date(clockStatus.entry.clock_in);
    const update = () => setElapsed(Math.floor((new Date() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [clockStatus]);

  const handleClock = async (action) => {
    try {
      await api.post('/hr/clock', { action, method: 'manual' });
      toast.success(action === 'clock_in' ? 'Clocked in! Have a great day.' : `Clocked out! Session: ${formatDuration(elapsed)}`);
      const [clockRes, histRes] = await Promise.all([api.get('/hr/clock/status'), api.get('/hr/clock/history')]);
      setClockStatus(clockRes.data);
      const today = new Date().toISOString().split('T')[0];
      let totalSec = 0;
      (histRes.data || []).forEach(entry => {
        if (entry.clock_in?.startsWith(today) && entry.clock_out) {
          totalSec += Math.floor((new Date(entry.clock_out) - new Date(entry.clock_in)) / 1000);
        }
      });
      setTodayHours(totalSec);
      setElapsed(0);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <AppLoader />;

  const isClockedIn = clockStatus?.clocked_in;

  const stats = [
    { label: 'My Lessons', value: lessons.length, icon: BookOpen, color: 'bg-blue-50 text-[#2E6CC4]' },
    { label: 'Assignments', value: assignments.length, icon: ClipboardList, color: 'bg-[#C5A55A]/10 text-[#C5A55A]' },
    { label: 'Classes', value: classes.length, icon: Users, color: 'bg-blue-50 text-[#2E6CC4]' },
    { label: 'Pending Grading', value: assignments.reduce((acc, a) => acc + (a.submission_count || 0), 0), icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
  ];

  // Review data
  const myLessons = reviews?.my_lesson_submissions || [];
  const mySchemes = reviews?.my_scheme_submissions || [];
  const pendingLessons = reviews?.pending_lesson_reviews || [];
  const pendingSchemes = reviews?.pending_scheme_reviews || [];
  const returnedLessons = myLessons.filter(l => l.status === 'returned');
  const returnedSchemes = mySchemes.filter(s => s.status === 'returned');
  const totalReturned = returnedLessons.length + returnedSchemes.length;
  const submittedLessons = myLessons.filter(l => ['submitted', 'under_review', 'resubmitted'].includes(l.status));
  const submittedSchemes = mySchemes.filter(s => ['submitted', 'under_review', 'resubmitted'].includes(s.status));
  const approvedLessons = myLessons.filter(l => l.status === 'approved' || l.status === 'published');
  const approvedSchemes = mySchemes.filter(s => s.status === 'approved' || s.status === 'published');
  const totalPendingReviews = pendingLessons.length + pendingSchemes.length;

  return (
    <div className="space-y-8" data-testid="teacher-dashboard">
      {/* Hero Banner */}
      <div className="relative rounded-md overflow-hidden h-64">
        <img src="/campus-2.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A]/80 to-[#1B2A4A]/20 flex items-center px-12">
          <div>
            <h1 className="text-6xl font-bold text-white">Welcome, {user?.name}</h1>
            <p className="text-2xl text-white/70 mt-4">Here's your teaching overview</p>
          </div>
        </div>
      </div>

      {/* Returned Items Alert */}
      {totalReturned > 0 && (
        <div className="rounded-lg border-l-4 border-red-400 bg-gradient-to-r from-red-50 to-rose-50 p-6" data-testid="returned-items-alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center">
                <RotateCcw className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[#1B2A4A]">{totalReturned} item{totalReturned !== 1 ? 's' : ''} returned for revision</p>
                <p className="text-base text-slate-500">Review the feedback and resubmit</p>
              </div>
            </div>
            <Button variant="outline" size="default" className="border-red-200 text-red-600 hover:bg-red-50 h-14 px-8 text-lg font-semibold" onClick={() => navigate('/teacher/lessons')} data-testid="go-fix-returned">
              Review Now <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Pending Reviews Alert (Dual-role management teachers) */}
      {isMgmt && totalPendingReviews > 0 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 p-6" data-testid="mgmt-pending-reviews-alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[#1B2A4A]">{totalPendingReviews} item{totalPendingReviews !== 1 ? 's' : ''} awaiting your approval</p>
                <p className="text-base text-slate-500">{pendingLessons.length} lesson{pendingLessons.length !== 1 ? 's' : ''}, {pendingSchemes.length} scheme{pendingSchemes.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xl px-6 py-2">{totalPendingReviews}</Badge>
          </div>
        </div>
      )}

      {/* Clock In/Out Card */}
      <Card className={`rounded-md ${isClockedIn ? 'border-[#C5A55A]/30 bg-[#C5A55A]/10/30' : 'border-slate-200'}`}>
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${isClockedIn ? 'bg-[#C5A55A]/15' : 'bg-slate-100'}`}>
                <Timer className={`w-10 h-10 ${isClockedIn ? 'text-[#C5A55A]' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-md ${isClockedIn ? 'bg-[#C5A55A] animate-pulse' : 'bg-slate-300'}`} />
                  <p className="text-xl font-semibold text-[#1B2A4A]">{isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}</p>
                </div>
                {isClockedIn && (
                  <div className="mt-2">
                    <p className="text-5xl font-bold font-mono text-[#C5A55A]">{formatDuration(elapsed)}</p>
                    <p className="text-base text-slate-400 mt-1">Since {new Date(clockStatus?.entry?.clock_in).toLocaleTimeString()}</p>
                  </div>
                )}
                {!isClockedIn && todayHours > 0 && (
                  <p className="text-lg text-slate-500 mt-2">Today's total: <strong>{formatDuration(todayHours)}</strong></p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-4">
              {!isClockedIn ? (
                <Button onClick={() => handleClock('clock_in')} className="rounded-md bg-[#C5A55A] hover:bg-[#b8963e] h-16 px-12 text-xl font-semibold" data-testid="clock-in-btn">
                  <LogIn className="w-7 h-7 mr-3" /> Clock In
                </Button>
              ) : (
                <Button onClick={() => handleClock('clock_out')} className="rounded-md bg-[#DC2626] hover:bg-red-700 h-16 px-12 text-xl font-semibold" data-testid="clock-out-btn">
                  <LogOut className="w-7 h-7 mr-3" /> Clock Out
                </Button>
              )}
              {todayHours > 0 && (
                <p className="text-base text-slate-400">Today: {formatDuration(todayHours + (isClockedIn ? elapsed : 0))}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 stagger-children">
        {stats.map((s, i) => (
          <div key={i} className="stat-card animate-fade-in p-10" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`w-20 h-20 rounded-xl flex items-center justify-center mb-5 ${s.color}`}>
              <s.icon className="w-10 h-10" />
            </div>
            <p className="text-6xl font-bold text-[#1B2A4A]">{s.value}</p>
            <p className="text-xl text-slate-500 mt-3">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Access: Lessons / Scheme of Work / Lectures */}
      <div className="grid md:grid-cols-3 gap-8 stagger-children" data-testid="quick-access-tiles">
        <Card className="group cursor-pointer hover:shadow-xl hover:border-blue-400 transition-all border-2 border-transparent"
          onClick={() => navigate('/teacher/lessons')} data-testid="tile-lessons">
          <CardContent className="p-16 flex flex-col items-center text-center">
            <div className="w-36 h-36 rounded-2xl bg-blue-50 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <BookOpen className="w-20 h-20 text-[#2E6CC4]" />
            </div>
            <h3 className="text-4xl font-bold text-[#1B2A4A] mb-4">Lessons</h3>
            <p className="text-lg text-slate-500">Create, manage and submit lesson plans for approval</p>
            <Button variant="outline" className="mt-8 px-12 h-16 text-lg font-semibold border-blue-200 text-[#2E6CC4] group-hover:bg-blue-50">
              Open Lessons <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <Card className="group cursor-pointer hover:shadow-xl hover:border-amber-400 transition-all border-2 border-transparent"
          onClick={() => navigate('/scheme-of-work')} data-testid="tile-scheme">
          <CardContent className="p-16 flex flex-col items-center text-center">
            <div className="w-36 h-36 rounded-2xl bg-amber-50 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <PenSquare className="w-20 h-20 text-amber-600" />
            </div>
            <h3 className="text-4xl font-bold text-[#1B2A4A] mb-4">Scheme of Work</h3>
            <p className="text-lg text-slate-500">Build and manage term-based schemes of work</p>
            <Button variant="outline" className="mt-8 px-12 h-16 text-lg font-semibold border-amber-200 text-amber-600 group-hover:bg-amber-50">
              Open Schemes <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <Card className="group cursor-pointer hover:shadow-xl hover:border-[#2E6CC4] transition-all border-2 border-transparent"
          onClick={() => navigate('/lectures')} data-testid="tile-lectures">
          <CardContent className="p-16 flex flex-col items-center text-center">
            <div className="w-36 h-36 rounded-2xl bg-blue-50 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <Presentation className="w-20 h-20 text-[#2E6CC4]" />
            </div>
            <h3 className="text-4xl font-bold text-[#1B2A4A] mb-4">Lectures</h3>
            <p className="text-lg text-slate-500">Generate Cambridge-aligned lecture notes with AI</p>
            <Button variant="outline" className="mt-8 px-12 h-16 text-lg font-semibold border-blue-200 text-[#2E6CC4] group-hover:bg-blue-50">
              Open Lectures <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending My Review (Management teachers like Esther) */}
      {isMgmt && totalPendingReviews > 0 && (
        <Card className="rounded-lg border-amber-200" data-testid="pending-reviews-section">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-7 h-7 text-amber-600" />
                <CardTitle className="text-2xl">Pending My Review</CardTitle>
                <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300 text-base px-4 py-1">{totalPendingReviews}</Badge>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" size="default" className="text-base text-blue-600" onClick={() => navigate('/admin/lessons')}>
                  Lessons <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="ghost" size="default" className="text-base text-[#2E6CC4]" onClick={() => navigate('/scheme-of-work')}>
                  Schemes <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingLessons.slice(0, 4).map(l => (
              <div key={l.lesson_id} className="flex items-center gap-5 p-5 rounded-lg border border-amber-100 hover:bg-amber-50/50 transition-all cursor-pointer"
                onClick={() => navigate('/admin/lessons')} data-testid={`pending-review-${l.lesson_id}`}>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen className="w-6 h-6 text-blue-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{l.title}</p>
                  <p className="text-sm text-slate-400">{l.teacher_name} - {l.subject || l.subject_name}</p>
                </div>
                <ApprovalDots chain={l.approval_chain} />
                <StatusBadge status={l.status} />
                <ChevronRight className="w-6 h-6 text-slate-300" />
              </div>
            ))}
            {pendingSchemes.slice(0, 4).map(s => (
              <div key={s.scheme_id} className="flex items-center gap-5 p-5 rounded-lg border border-amber-100 hover:bg-amber-50/50 transition-all cursor-pointer"
                onClick={() => navigate('/scheme-of-work')} data-testid={`pending-review-${s.scheme_id}`}>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="w-6 h-6 text-[#2E6CC4]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{s.title || s.name}</p>
                  <p className="text-sm text-slate-400">{s.teacher_name} - {s.subject || s.subject_name}</p>
                </div>
                <ApprovalDots chain={s.approval_chain} />
                <StatusBadge status={s.status} />
                <ChevronRight className="w-6 h-6 text-slate-300" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* My Submissions Tracker */}
      {(myLessons.length > 0 || mySchemes.length > 0) && (
        <Card className="rounded-lg border-blue-200" data-testid="my-submissions-section">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-7 h-7 text-blue-600" />
                <CardTitle className="text-2xl">My Submissions</CardTitle>
              </div>
              <div className="flex gap-6 text-base">
                <span className="flex items-center gap-2 text-amber-600"><Clock className="w-5 h-5" /> {submittedLessons.length + submittedSchemes.length} Pending</span>
                <span className="flex items-center gap-2 text-[#C5A55A]"><CheckCircle2 className="w-5 h-5" /> {approvedLessons.length + approvedSchemes.length} Approved</span>
                {totalReturned > 0 && <span className="flex items-center gap-2 text-red-600"><XCircle className="w-5 h-5" /> {totalReturned} Returned</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Returned first */}
            {returnedLessons.map(l => (
              <div key={l.lesson_id} className="flex items-center gap-5 p-5 rounded-lg border border-red-200 bg-red-50/30 hover:bg-red-50/60 transition-all cursor-pointer"
                onClick={() => navigate('/teacher/lessons')} data-testid={`submission-${l.lesson_id}`}>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center"><XCircle className="w-6 h-6 text-red-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{l.title}</p>
                  <p className="text-sm text-red-500">{l.current_approver_label || 'Returned'}</p>
                </div>
                <ApprovalDots chain={l.approval_chain} />
                <StatusBadge status={l.status} />
              </div>
            ))}
            {returnedSchemes.map(s => (
              <div key={s.scheme_id} className="flex items-center gap-5 p-5 rounded-lg border border-red-200 bg-red-50/30 hover:bg-red-50/60 transition-all cursor-pointer"
                onClick={() => navigate('/scheme-of-work')} data-testid={`submission-${s.scheme_id}`}>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center"><XCircle className="w-6 h-6 text-red-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{s.title || s.name}</p>
                  <p className="text-sm text-red-500">{s.current_approver_label || 'Returned'}</p>
                </div>
                <ApprovalDots chain={s.approval_chain} />
                <StatusBadge status={s.status} />
              </div>
            ))}
            {/* Submitted / In Review */}
            {submittedLessons.slice(0, 4).map(l => (
              <div key={l.lesson_id} className="flex items-center gap-5 p-5 rounded-lg border border-slate-100 hover:bg-blue-50/30 transition-all cursor-pointer"
                onClick={() => navigate('/teacher/lessons')} data-testid={`submission-${l.lesson_id}`}>
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center"><Clock className="w-6 h-6 text-indigo-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{l.title}</p>
                  <p className="text-sm text-slate-400">{l.current_approver_label || 'Awaiting Review'}</p>
                </div>
                <ApprovalDots chain={l.approval_chain} />
                <StatusBadge status={l.status} />
              </div>
            ))}
            {submittedSchemes.slice(0, 4).map(s => (
              <div key={s.scheme_id} className="flex items-center gap-5 p-5 rounded-lg border border-slate-100 hover:bg-blue-50/30 transition-all cursor-pointer"
                onClick={() => navigate('/scheme-of-work')} data-testid={`submission-${s.scheme_id}`}>
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center"><Clock className="w-6 h-6 text-indigo-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{s.title || s.name}</p>
                  <p className="text-sm text-slate-400">{s.current_approver_label || 'Awaiting Review'}</p>
                </div>
                <ApprovalDots chain={s.approval_chain} />
                <StatusBadge status={s.status} />
              </div>
            ))}
            {/* Recently Approved */}
            {approvedLessons.slice(0, 2).map(l => (
              <div key={l.lesson_id} className="flex items-center gap-5 p-5 rounded-lg border border-[#C5A55A]/20 bg-[#C5A55A]/10/20 transition-all cursor-pointer"
                onClick={() => navigate('/teacher/lessons')} data-testid={`submission-${l.lesson_id}`}>
                <div className="w-12 h-12 rounded-lg bg-[#C5A55A]/15 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-[#C5A55A]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{l.title}</p>
                  <p className="text-sm text-[#C5A55A]">Fully Approved</p>
                </div>
                <ApprovalDots chain={l.approval_chain} />
                <StatusBadge status={l.status} />
              </div>
            ))}
            {approvedSchemes.slice(0, 2).map(s => (
              <div key={s.scheme_id} className="flex items-center gap-5 p-5 rounded-lg border border-[#C5A55A]/20 bg-[#C5A55A]/10/20 transition-all cursor-pointer"
                onClick={() => navigate('/scheme-of-work')} data-testid={`submission-${s.scheme_id}`}>
                <div className="w-12 h-12 rounded-lg bg-[#C5A55A]/15 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-[#C5A55A]" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium text-[#1B2A4A] truncate">{s.title || s.name}</p>
                  <p className="text-sm text-[#C5A55A]">Fully Approved</p>
                </div>
                <ApprovalDots chain={s.approval_chain} />
                <StatusBadge status={s.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Weekly Timetable */}
      <TimetableWidget />

      <div className="grid lg:grid-cols-2 gap-8">
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-2xl">Recent Lessons</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lessons.slice(0, 5).map(l => (
                <div key={l.lesson_id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-md">
                  <div className="w-12 h-12 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0"><BookOpen className="w-6 h-6 text-[#2E6CC4]" /></div>
                  <div className="flex-1 min-w-0"><p className="text-base font-medium text-[#1B2A4A] truncate">{l.title}</p><p className="text-sm text-slate-400">{l.subject_name} - {l.lesson_type}</p></div>
                </div>
              ))}
              {lessons.length === 0 && <p className="text-base text-slate-400 text-center py-6">No lessons yet</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-2xl">Recent Assignments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignments.slice(0, 5).map(a => (
                <div key={a.assignment_id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-md">
                  <div className="w-12 h-12 rounded-md bg-[#C5A55A]/15 flex items-center justify-center flex-shrink-0"><ClipboardList className="w-6 h-6 text-[#C5A55A]" /></div>
                  <div className="flex-1 min-w-0"><p className="text-base font-medium text-[#1B2A4A] truncate">{a.title}</p><p className="text-sm text-slate-400">{a.subject_name} - {a.submission_count} submissions</p></div>
                </div>
              ))}
              {assignments.length === 0 && <p className="text-base text-slate-400 text-center py-6">No assignments yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
