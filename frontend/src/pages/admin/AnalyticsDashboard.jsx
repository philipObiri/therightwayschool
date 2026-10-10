import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { TrendingUp, BookOpen, DollarSign, Users, Clock, Award, FileText, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TABS = ['Academic', 'Financial', 'Staff'];

function StatCard({ label, value, icon: Icon, sub, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-700 border-blue-200', green: 'bg-[#C5A55A]/10 text-[#C5A55A] border-[#C5A55A]/30', amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-700 border-red-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200', slate: 'bg-slate-50 text-slate-700 border-slate-200' };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`} data-testid={`stat-${label.toLowerCase().replace(/\s/g,'-')}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-50" />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

function BarSimple({ items, valueKey = 'count', labelKey = 'label', maxItems = 8 }) {
  const data = items.slice(0, maxItems);
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-28 truncate text-slate-600 text-xs font-medium">{item[labelKey]}</span>
          <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-500 rounded-full transition-all" style={{ width: `${(item[valueKey] / max) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-700 w-10 text-right">{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

function AcademicTab({ data }) {
  if (!data) return <div className="text-center py-10 text-slate-400">Loading...</div>;
  const s = data.schemes;
  const statusColors = { draft: '#94a3b8', in_progress: '#3b82f6', submitted: '#6366f1', under_review: '#f59e0b', approved: '#10b981', returned: '#ef4444', published: '#8b5cf6' };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total Schemes" value={s.total} icon={FileText} color="blue" />
        <StatCard label="This Term" value={s.this_term} icon={BookOpen} sub={data.term} color="indigo" />
        <StatCard label="AI Enhanced" value={s.ai_enhanced} icon={TrendingUp} color="green" />
        <StatCard label="Resources" value={data.resources.total} icon={FileText} sub={`${data.resources.published} published`} color="amber" />
        <StatCard label="Quizzes" value={data.quizzes.total} icon={Award} color="indigo" />
        <StatCard label="Lessons (30d)" value={data.lessons.last_30d} icon={BookOpen} sub={`${data.lessons.total} total`} color="slate" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Schemes by Status</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(s.by_status).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: statusColors[status] + '18', color: statusColors[status] }}>
                <div className="w-2 h-2 rounded-full" style={{ background: statusColors[status] }} />
                {status.replace(/_/g, ' ')} ({count})
              </div>
            ))}
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-3 mt-5">By Department</h3>
          <BarSimple items={s.by_department.map(d => ({ label: d.department, count: d.total }))} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">By Year Group</h3>
          <BarSimple items={s.by_year_group.map(y => ({ label: y.year_group, count: y.count }))} />
          <h3 className="text-sm font-bold text-slate-800 mb-3 mt-5">Submission Trend</h3>
          {s.submission_trend.length > 0 ? (
            <div className="flex items-end gap-1 h-24">
              {s.submission_trend.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-indigo-400 rounded-t" style={{ height: `${Math.max(4, (t.count / Math.max(...s.submission_trend.map(x=>x.count),1)) * 80)}px` }} />
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">No submission data yet</p>}
        </div>
      </div>
    </div>
  );
}

function FinancialTab({ data }) {
  if (!data) return <div className="text-center py-10 text-slate-400">Loading...</div>;
  const r = data.revenue;
  const fmt = v => `TT$ ${(v || 0).toLocaleString('en', { minimumFractionDigits: 2 })}`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Invoiced" value={fmt(r.total_invoiced)} icon={DollarSign} color="blue" />
        <StatCard label="Total Collected" value={fmt(r.total_paid)} icon={ArrowUpRight} color="green" />
        <StatCard label="Outstanding" value={fmt(r.outstanding)} icon={ArrowDownRight} color="red" />
        <StatCard label="Collection Rate" value={`${r.collection_rate}%`} icon={TrendingUp} color={r.collection_rate > 50 ? 'green' : 'amber'} />
        <StatCard label="Expenses" value={fmt(data.expenses.total)} icon={DollarSign} color="amber" />
        <StatCard label="Budget Util." value={`${data.budget.utilization}%`} icon={BarChart3} sub={fmt(data.budget.total_allocated)} color="indigo" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Outstanding by Year Group</h3>
          <BarSimple items={data.by_year_group.map(y => ({ label: y.year_group, count: y.invoiced }))} valueKey="count" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Expense Categories</h3>
          {data.expenses.by_category.length > 0 ? (
            <BarSimple items={data.expenses.by_category.map(e => ({ label: e.category, count: e.total }))} />
          ) : <p className="text-xs text-slate-400">No expense data</p>}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Payment Trend</h3>
        {data.payment_trend.length > 0 ? (
          <div className="flex items-end gap-1 h-28">
            {data.payment_trend.map((p, i) => {
              const max = Math.max(...data.payment_trend.map(x => x.amount), 1);
              return (
                <div key={i} className="flex-1 group relative flex flex-col items-center">
                  <div className="absolute -top-5 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">{fmt(p.amount)}</div>
                  <div className="w-full bg-[#C5A55A] rounded-t transition-all" style={{ height: `${Math.max(3, (p.amount / max) * 100)}px` }} />
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-slate-400">No payment data</p>}
      </div>
    </div>
  );
}

function StaffTab({ data }) {
  if (!data) return <div className="text-center py-10 text-slate-400">Loading...</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total Staff" value={data.total_staff} icon={Users} color="blue" />
        <StatCard label="Clocked In Today" value={data.clock_in.today} icon={Clock} color="green" />
        <StatCard label="Actions (30d)" value={data.activity.total_30d} icon={TrendingUp} color="indigo" />
        <StatCard label="CPD Courses" value={data.cpd.courses} icon={Award} color="amber" />
        <StatCard label="Leave Pending" value={data.leave.pending} icon={Users} color="red" />
        <StatCard label="Leave Approved" value={data.leave.approved} icon={Users} color="green" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Staff by Role</h3>
          <BarSimple items={data.by_role.map(r => ({ label: r.role, count: r.count }))} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Staff by Department</h3>
          <BarSimple items={data.by_department.map(d => ({ label: d.department, count: d.count }))} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Most Active Staff (30d)</h3>
          <BarSimple items={data.activity.top_active_staff.map(a => ({ label: a.name, count: a.actions }))} />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Clock-In Trend (30 Days)</h3>
        {data.clock_in.trend.length > 0 ? (
          <div className="flex items-end gap-1 h-24">
            {data.clock_in.trend.map((c, i) => {
              const max = Math.max(...data.clock_in.trend.map(x => x.count), 1);
              return (
                <div key={i} className="flex-1 group relative flex flex-col items-center">
                  <div className="absolute -top-5 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100">{c.count}</div>
                  <div className="w-full bg-blue-400 rounded-t transition-all" style={{ height: `${Math.max(3, (c.count / max) * 80)}px` }} />
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-slate-400">No clock-in data</p>}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Academic');
  const [academic, setAcademic] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (tab === 'Academic' && !academic) {
          const r = await api.get('/analytics/academic');
          setAcademic(r.data);
        } else if (tab === 'Financial' && !financial) {
          const r = await api.get('/analytics/financial');
          setFinancial(r.data);
        } else if (tab === 'Staff' && !staff) {
          const r = await api.get('/analytics/staff');
          setStaff(r.data);
        }
      } catch (e) { console.error('Analytics load error:', e); }
      setLoading(false);
    };
    load();
  }, [tab]);

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Comprehensive insights across academics, finance, and staff</p>
        </div>
      </div>
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit" data-testid="analytics-tabs">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t.toLowerCase()}`}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>
      {loading && <div className="text-center py-8 text-slate-400">Loading analytics...</div>}
      {tab === 'Academic' && <AcademicTab data={academic} />}
      {tab === 'Financial' && <FinancialTab data={financial} />}
      {tab === 'Staff' && <StaffTab data={staff} />}
    </div>
  );
}
