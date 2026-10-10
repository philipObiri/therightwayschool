import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  FolderOpen, FileText, Clock, CheckCircle, Archive, TrendingUp,
  ListTodo, AlertCircle, Users, Activity, Share2, MessageSquare
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AppLoader } from '../../../components/AppLoader';

const STATUS_COLORS_MAP = {
  draft: '#94a3b8', under_review: '#f59e0b', approved: '#16a34a',
  rejected: '#dc2626', published: '#2563eb', archived: '#6b7280'
};
const PRIORITY_COLORS = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' };

export function WpDashboard({ data, onNavigate, onOpenDoc }) {
  if (!data) return <AppLoader />;

  const statusData = (data.status_breakdown || []).map(s => ({ name: s.status, value: s.count }));
  const COLORS = ['#94a3b8', '#f59e0b', '#16a34a', '#dc2626', '#2563eb', '#6b7280'];

  return (
    <div className="space-y-5" data-testid="wp-dashboard">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { icon: FolderOpen, label: 'Folders', value: data.total_folders, color: 'text-amber-500', bg: 'bg-amber-50' },
          { icon: FileText, label: 'Documents', value: data.total_documents, color: 'text-[#2E6CC4]', bg: 'bg-blue-50' },
          { icon: Clock, label: 'Pending', value: data.pending_approval, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: CheckCircle, label: 'Approved', value: data.approved, color: 'text-[#C5A55A]', bg: 'bg-[#C5A55A]/10' },
          { icon: ListTodo, label: 'My Tasks', value: (data.tasks_todo || 0) + (data.tasks_in_progress || 0), color: 'text-[#2E6CC4]', bg: 'bg-blue-50' },
          { icon: Activity, label: 'Today', value: data.today_activity, color: 'text-red-500', bg: 'bg-red-50' },
        ].map((s, i) => (
          <Card key={i} className="rounded-lg border-slate-100 hover:shadow-sm transition-shadow">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
              <div><p className="text-lg font-bold text-[#1B2A4A]">{s.value}</p><p className="text-[10px] text-slate-400">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Status Chart */}
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Document Status</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-slate-400 text-sm py-8">No documents yet</p>}
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Recent Documents</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {(data.recent_documents || []).map(d => (
                <div key={d.document_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onOpenDoc?.(d.document_id)}>
                  <FileText className="w-4 h-4 text-[#2E6CC4] shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{d.title}</p><p className="text-[9px] text-slate-400">{d.author_name} | {d.file_type?.toUpperCase()}</p></div>
                  <Badge className={`text-[8px] ${d.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : d.status === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{d.status}</Badge>
                </div>
              ))}
              {(!data.recent_documents || data.recent_documents.length === 0) && <p className="text-center text-slate-400 text-xs py-4">No recent documents</p>}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1B2A4A]">Upcoming Tasks</h3>
              <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => onNavigate?.('tasks')}>View All</Button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {(data.upcoming_tasks || []).map(t => (
                <div key={t.task_id} className="flex items-center gap-2 p-2 rounded-md border border-slate-50">
                  <div className={`w-1.5 h-6 rounded-full ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{t.title}</p>
                    <p className="text-[9px] text-slate-400">{t.assigned_to_name || 'Unassigned'}{t.due_date ? ` | Due: ${new Date(t.due_date).toLocaleDateString()}` : ''}</p>
                  </div>
                  <Badge className={`text-[8px] ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium}`}>{t.priority}</Badge>
                </div>
              ))}
              {(!data.upcoming_tasks || data.upcoming_tasks.length === 0) && <p className="text-center text-slate-400 text-xs py-4">No upcoming tasks</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access + Activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Quick Access Smart Folders */}
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Quick Access</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'pending_approval', label: 'Pending Approval', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', count: data.pending_approval },
                { key: 'my_documents', label: 'My Documents', icon: FileText, color: 'text-[#2E6CC4]', bg: 'bg-blue-50', count: null },
                { key: 'shared_with_me', label: 'Shared With Me', icon: Users, color: 'text-[#2E6CC4]', bg: 'bg-blue-50', count: null },
                { key: 'recently_edited', label: 'Recently Edited', icon: TrendingUp, color: 'text-[#C5A55A]', bg: 'bg-[#C5A55A]/10', count: data.edited_this_week },
                { key: 'flagged', label: 'Flagged', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', count: null },
                { key: 'archived', label: 'Archived', icon: Archive, color: 'text-slate-500', bg: 'bg-slate-50', count: data.archived },
              ].map(f => (
                <div key={f.key} className={`flex items-center gap-2 p-2.5 rounded-lg ${f.bg} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => onNavigate?.('smart', f.key)} data-testid={`quick-access-${f.key}`}>
                  <f.icon className={`w-4 h-4 ${f.color}`} />
                  <div className="flex-1"><p className="text-xs font-medium text-[#1B2A4A]">{f.label}</p></div>
                  {f.count != null && <span className="text-xs font-bold text-[#1B2A4A]">{f.count}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Activity Feed</h3>
            <div className="space-y-1 max-h-[220px] overflow-y-auto">
              {(data.recent_activity || []).map((a, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2E6CC4] mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px]"><span className="font-semibold">{a.user_name}</span> <span className="text-slate-500">{a.action?.replace(/_/g, ' ')}</span></p>
                    <p className="text-[9px] text-slate-400">{new Date(a.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(!data.recent_activity || data.recent_activity.length === 0) && <p className="text-center text-slate-400 text-xs py-4">No recent activity</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      {data.department_breakdown?.length > 0 && (
        <Card className="rounded-lg border-slate-100">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Documents by Department</h3>
            <div className="flex flex-wrap gap-2">
              {data.department_breakdown.map((d, i) => (
                <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-center"><p className="text-lg font-bold text-[#1B2A4A]">{d.count}</p><p className="text-[9px] text-slate-500">{d.department}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
