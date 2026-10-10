import React, { useEffect, useState } from 'react';
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
import { Plus, ListTodo, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const statusColors = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-[#C5A55A]/15 text-[#C5A55A]',
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-red-100 text-red-600',
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });

  const isAdmin = ['Admin', 'SuperAdmin', 'HeadOfAcademics', 'HoD'].includes(user?.role);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [tasksRes] = await Promise.all([api.get('/tasks')]);
      setTasks(tasksRes.data);
      if (isAdmin) {
        try {
          const usersRes = await api.get('/auth/users');
          setUsers(usersRes.data);
        } catch (err) { console.error("Error:", err); }
      }
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', form);
      toast.success('Task created');
      setCreateOpen(false);
      setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const updateStatus = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      toast.success('Task updated');
      fetchData();
    } catch (err) { toast.error('Failed to update'); }
  };

  if (loading) return <AppLoader />;

  const statusFlow = ['todo', 'in_progress', 'submitted', 'approved'];

  return (
    <div className="space-y-6" data-testid="tasks-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Tasks</h1>
          <p className="text-slate-500 mt-1">{tasks.length} tasks</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-md bg-[#2E6CC4]" data-testid="create-task-btn"><Plus className="w-4 h-4 mr-2" /> Assign Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required data-testid="task-title-input" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} data-testid="task-desc-input" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Select value={form.assigned_to} onValueChange={v => setForm({...form, assigned_to: v})}>
                      <SelectTrigger data-testid="task-assign-select"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {users.filter(u => u.user_id !== user?.user_id).map(u => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                      <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} data-testid="task-due-date" />
                </div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-task-btn">Create Task</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map(t => {
          const currentIdx = statusFlow.indexOf(t.status);
          const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

          return (
            <Card key={t.task_id} className="rounded-md border-slate-100 card-hover" data-testid={`task-card-${t.task_id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
                  <Badge className={statusColors[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
                </div>
                <h3 className="font-semibold text-[#1B2A4A] mb-1">{t.title}</h3>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{t.description || 'No description'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>To: {t.assigned_to_name}</span>
                  {t.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.due_date}</span>}
                </div>
                <div className="text-xs text-slate-400 mb-3">By: {t.assigned_by_name}</div>
                {nextStatus && (t.assigned_to === user?.user_id || isAdmin) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-md text-xs"
                    onClick={() => updateStatus(t.task_id, nextStatus)}
                    data-testid={`advance-task-${t.task_id}`}
                  >
                    Move to {nextStatus.replace(/_/g, ' ')} <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {tasks.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <ListTodo className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No tasks yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
