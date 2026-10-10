import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, ListTodo, Clock, Play, Pause, Square, CheckCircle, ArrowRight, AlertCircle, Timer, Send } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const statusColors = {
  draft: 'bg-slate-100 text-slate-600', assigned: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-blue-100 text-[#2E6CC4]',
  blocked: 'bg-red-100 text-red-700', submitted: 'bg-amber-100 text-amber-700',
  returned: 'bg-orange-100 text-orange-700', approved: 'bg-[#C5A55A]/15 text-[#C5A55A]',
  closed: 'bg-slate-200 text-slate-600',
};
const priorityColors = { low: 'bg-slate-100 text-slate-600', medium: 'bg-blue-100 text-blue-600', high: 'bg-orange-100 text-orange-600', critical: 'bg-red-100 text-red-600' };

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function DigitalClock({ task, onRefresh }) {
  const [elapsed, setElapsed] = useState(0);
  const [serverTime, setServerTime] = useState(new Date());
  const timerRef = useRef(null);
  const isRunning = task.has_active_timer;

  useEffect(() => {
    const interval = setInterval(() => setServerTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isRunning && task.active_timer?.start_at) {
      const start = new Date(task.active_timer.start_at);
      const updateElapsed = () => {
        const now = new Date();
        setElapsed(Math.floor((now - start) / 1000));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
      return () => clearInterval(timerRef.current);
    } else {
      setElapsed(0);
    }
  }, [isRunning, task.active_timer]);

  const totalSpent = (task.total_time_seconds || 0) + (isRunning ? elapsed : 0);

  // Due countdown
  let dueCountdown = null;
  if (task.due_date) {
    const due = new Date(task.due_date + 'T23:59:59');
    const diff = Math.max(0, Math.floor((due - new Date()) / 1000));
    dueCountdown = diff;
  }

  const handleTimer = async (action) => {
    try {
      await api.post(`/tasks/${task.task_id}/time/${action}`);
      successToast(`Timer ${action}ed`);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="bg-[#1B2A4A] rounded-md p-4 text-white" data-testid={`task-clock-${task.task_id}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#2E6CC4]" />
          <span className="text-xs text-slate-400 font-mono">{serverTime.toLocaleTimeString()}</span>
        </div>
        {isRunning && <span className="flex items-center gap-1 text-xs text-[#C5A55A]"><span className="w-2 h-2 rounded-md bg-[#C5A55A] animate-pulse" /> Recording</span>}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Session</p>
          <p className="text-lg font-mono font-bold text-[#2E6CC4]">{formatTime(elapsed)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Spent</p>
          <p className="text-lg font-mono font-bold">{formatTime(totalSpent)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Due In</p>
          <p className={`text-lg font-mono font-bold ${dueCountdown !== null && dueCountdown < 86400 ? 'text-[#DC2626]' : 'text-[#F59E0B]'}`}>
            {dueCountdown !== null ? formatTime(dueCountdown) : '--:--:--'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {!isRunning ? (
          <Button size="sm" className="flex-1 rounded-md bg-[#C5A55A] hover:bg-[#b8963e] text-white" onClick={() => handleTimer('start')} data-testid={`start-timer-${task.task_id}`}>
            <Play className="w-3 h-3 mr-1" /> Start
          </Button>
        ) : (
          <>
            <Button size="sm" className="flex-1 rounded-md bg-[#F59E0B] hover:bg-amber-600 text-white" onClick={() => handleTimer('pause')} data-testid={`pause-timer-${task.task_id}`}>
              <Pause className="w-3 h-3 mr-1" /> Pause
            </Button>
            <Button size="sm" className="flex-1 rounded-md bg-[#DC2626] hover:bg-red-700 text-white" onClick={() => handleTimer('stop')} data-testid={`stop-timer-${task.task_id}`}>
              <Square className="w-3 h-3 mr-1" /> Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function TasksEnhanced() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', task_type: 'Operations', assigned_to: '',
    department: '', priority: 'medium', due_date: '', start_date: '',
    estimated_minutes: 0, acceptance_criteria: '', tags: '',
    checklist: '', sla_hours: 0, assign_mode: 'individual',
  });

  const isAdmin = ['Admin', 'SuperAdmin', 'HeadOfAcademics', 'HoD'].includes(user?.role);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes] = await Promise.all([api.get('/tasks')]);
      setTasks(tasksRes.data);
      if (isAdmin) {
        try { const u = await api.get('/auth/users'); setUsers(u.data); } catch (err) { console.error("Error:", err); }
      }
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        checklist: form.checklist.split('\n').map(c => c.trim()).filter(Boolean),
        estimated_minutes: parseInt(form.estimated_minutes) || 0,
        sla_hours: parseInt(form.sla_hours) || 0,
      };

      if (form.assign_mode === 'all_teachers') {
        // Send to all teachers via bulk endpoint
        await api.post('/tasks/bulk', payload);
        successToast('Task sent to all teachers');
      } else if (form.assign_mode === 'department' && form.department) {
        await api.post('/tasks/bulk', { ...payload, assign_role: 'Teacher', department: form.department });
        successToast(`Task sent to all ${form.department} teachers`);
      } else {
        await api.post('/tasks', payload);
        successToast('Task created');
      }
      setCreateOpen(false);
      setForm({ title: '', description: '', task_type: 'Operations', assigned_to: '', department: '', priority: 'medium', due_date: '', start_date: '', estimated_minutes: 0, acceptance_criteria: '', tags: '', checklist: '', sla_hours: 0, assign_mode: 'individual' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAction = async (taskId, action, body = {}) => {
    try {
      await api.post(`/tasks/${taskId}/${action}`, body);
      successToast(`Task ${action}d`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleChecklist = async (taskId, itemId) => {
    try {
      await api.post(`/tasks/${taskId}/checklist/${itemId}/toggle`);
      fetchData();
    } catch (err) { console.error("Error:", err); }
  };

  if (loading) return <AppLoader />;

  const myTasks = tasks.filter(t => t.assigned_to === user?.user_id);
  const createdTasks = tasks.filter(t => t.assigned_by === user?.user_id);
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0] && !['approved', 'closed'].includes(t.status));

  return (
    <div className="space-y-6" data-testid="tasks-enhanced">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Task Centre</h1>
          <p className="text-slate-500 mt-1">{tasks.length} tasks | {overdueTasks.length} overdue</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-md bg-[#2E6CC4]" data-testid="create-task-btn"><Plus className="w-4 h-4 mr-2" /> New Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required data-testid="task-title-input" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} data-testid="task-desc-input" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Type</Label>
                    <Select value={form.task_type} onValueChange={v => setForm({...form, task_type: v})}>
                      <SelectTrigger data-testid="task-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{['Academic', 'Finance', 'HR', 'Operations', 'IT', 'Student Support'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                      <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{['low', 'medium', 'high', 'critical'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Assign To</Label>
                    <Select value={form.assign_mode} onValueChange={v => setForm({...form, assign_mode: v, assigned_to: ''})}>
                      <SelectTrigger data-testid="task-assign-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual Person</SelectItem>
                        <SelectItem value="all_teachers">All Teachers</SelectItem>
                        <SelectItem value="department">Department Teachers</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>SLA (hours)</Label><Input type="number" value={form.sla_hours} onChange={e => setForm({...form, sla_hours: e.target.value})} data-testid="task-sla-input" /></div>
                </div>
                {form.assign_mode === 'individual' && (
                  <div className="space-y-2"><Label>Select Person</Label>
                    <Select value={form.assigned_to} onValueChange={v => setForm({...form, assigned_to: v})}>
                      <SelectTrigger data-testid="task-assign-select"><SelectValue placeholder="Select person" /></SelectTrigger>
                      <SelectContent>{users.filter(u => u.user_id !== user?.user_id).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.role})</SelectItem>)}</SelectContent>
                    </Select></div>
                )}
                {form.assign_mode === 'department' && (
                  <div className="space-y-2"><Label>Department</Label>
                    <Select value={form.department} onValueChange={v => setForm({...form, department: v})}>
                      <SelectTrigger data-testid="task-dept-select"><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>{[...new Set(users.filter(u => u.department).map(u => u.department))].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select></div>
                )}
                {form.assign_mode === 'all_teachers' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-700 flex items-center gap-2">
                    <Users className="w-4 h-4" /> This task will be assigned to all {users.filter(u => u.role === 'Teacher').length} teachers
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} data-testid="task-due-date" /></div>
                  <div className="space-y-2"><Label>Est. Minutes</Label><Input type="number" value={form.estimated_minutes} onChange={e => setForm({...form, estimated_minutes: e.target.value})} data-testid="task-est-minutes" /></div>
                </div>
                <div className="space-y-2"><Label>Acceptance Criteria</Label><Textarea value={form.acceptance_criteria} onChange={e => setForm({...form, acceptance_criteria: e.target.value})} rows={2} data-testid="task-criteria" /></div>
                <div className="space-y-2"><Label>Checklist (one item per line)</Label><Textarea value={form.checklist} onChange={e => setForm({...form, checklist: e.target.value})} rows={3} placeholder="Upload lesson plans&#10;Review feedback&#10;Submit report" data-testid="task-checklist" /></div>
                <div className="space-y-2"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="marking, term-1" data-testid="task-tags" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-task-btn">Create Task</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="my-tasks">
        <TabsList className="bg-white border" data-testid="task-tabs">
          <TabsTrigger value="my-tasks">My Tasks ({myTasks.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>}
          <TabsTrigger value="overdue" className="text-red-600">Overdue ({overdueTasks.length})</TabsTrigger>
        </TabsList>

        {['my-tasks', 'all', 'overdue'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(tab === 'my-tasks' ? myTasks : tab === 'overdue' ? overdueTasks : tasks).map(t => (
                <Card key={t.task_id} className="rounded-md border-slate-100 card-hover" data-testid={`task-card-${t.task_id}`}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
                      <Badge className={statusColors[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1B2A4A] line-clamp-1">{t.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1">{t.description || 'No description'}</p>
                    </div>

                    {/* Checklist progress */}
                    {t.checklist?.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Checklist</span><span>{t.checklist_progress}%</span>
                        </div>
                        <Progress value={t.checklist_progress} className="h-1.5" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>To: {t.assigned_to_name}</span>
                      {t.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.due_date}</span>}
                    </div>
                    {t.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">{t.tags.slice(0, 3).map((tag, i) => <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>)}</div>
                    )}

                    {/* Digital Clock */}
                    {(t.assigned_to === user?.user_id && !['approved', 'closed', 'draft'].includes(t.status)) && (
                      <DigitalClock task={t} onRefresh={fetchData} />
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {t.status === 'assigned' && t.assigned_to === user?.user_id && (
                        <Button size="sm" variant="outline" className="rounded-md text-xs" onClick={() => handleAction(t.task_id, 'acknowledge')} data-testid={`ack-task-${t.task_id}`}>Acknowledge</Button>
                      )}
                      {['in_progress', 'acknowledged', 'returned'].includes(t.status) && t.assigned_to === user?.user_id && (
                        <Button size="sm" className="rounded-md text-xs bg-[#2E6CC4]" onClick={() => handleAction(t.task_id, 'submit', { comment: '' })} data-testid={`submit-task-${t.task_id}`}>
                          <Send className="w-3 h-3 mr-1" /> Submit
                        </Button>
                      )}
                      {t.status === 'submitted' && isAdmin && (
                        <>
                          <Button size="sm" className="rounded-md text-xs bg-[#C5A55A]" onClick={() => handleAction(t.task_id, 'approve', { approved: true, feedback: 'Good work' })} data-testid={`approve-task-${t.task_id}`}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-md text-xs text-red-600" onClick={() => handleAction(t.task_id, 'approve', { approved: false, feedback: 'Needs revision' })} data-testid={`return-task-${t.task_id}`}>
                            Return
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Checklist items */}
                    {t.checklist?.length > 0 && t.assigned_to === user?.user_id && (
                      <div className="space-y-1 border-t border-slate-100 pt-2">
                        {t.checklist.map(item => (
                          <div key={item.id} className="flex items-center gap-2">
                            <Checkbox checked={item.done} onCheckedChange={() => handleChecklist(t.task_id, item.id)} data-testid={`checklist-${item.id}`} />
                            <span className={`text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-600'}`}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Time info */}
                    {t.total_time_seconds > 0 && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1"><Timer className="w-3 h-3" /> Total: {formatTime(t.total_time_seconds)}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
