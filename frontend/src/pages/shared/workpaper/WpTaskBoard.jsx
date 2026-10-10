import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';
import { Plus, GripVertical, Calendar, User, Trash2, CheckCircle, Circle, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'border-t-slate-400', icon: Circle, iconColor: 'text-slate-400' },
  { key: 'in_progress', label: 'In Progress', color: 'border-t-blue-500', icon: Clock, iconColor: 'text-blue-500' },
  { key: 'review', label: 'Review', color: 'border-t-amber-500', icon: ArrowRight, iconColor: 'text-amber-500' },
  { key: 'completed', label: 'Completed', color: 'border-t-[#C5A55A]', icon: CheckCircle, iconColor: 'text-[#C5A55A]' },
];

const PRIORITY_STYLES = { high: 'bg-red-100 text-red-700 border-red-200', medium: 'bg-amber-100 text-amber-700 border-amber-200', low: 'bg-slate-100 text-slate-600 border-slate-200' };

export function WpTaskBoard({ staff }) {
  const [board, setBoard] = useState({ todo: [], in_progress: [], review: [], completed: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', assigned_to_name: '', due_date: '', priority: 'medium', document_id: '', folder_id: '' });
  const [saving, setSaving] = useState(false);

  const loadBoard = useCallback(async () => {
    try { const r = await api.get('/wp/tasks/board'); setBoard(r.data); } catch (err) { console.error("Error:", err); }
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Task title required'); return; }
    setSaving(true);
    try {
      await api.post('/wp/tasks', form);
      successToast('Task created');
      setShowCreate(false);
      setForm({ title: '', description: '', assigned_to: '', assigned_to_name: '', due_date: '', priority: 'medium', document_id: '', folder_id: '' });
      loadBoard();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const moveTask = async (taskId, newStatus) => {
    try {
      await api.put(`/wp/tasks/${taskId}`, { status: newStatus });
      loadBoard();
    } catch { toast.error('Failed to update'); }
  };

  const deleteTask = async (taskId) => {
    try { await api.delete(`/wp/tasks/${taskId}`); loadBoard(); } catch (err) { console.error("Error:", err); }
  };

  const totalTasks = Object.values(board).flat().length;

  return (
    <div className="space-y-4" data-testid="wp-task-board">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Task Board</h2><p className="text-xs text-slate-500">{totalTasks} tasks across all stages</p></div>
        <Button className="bg-[#1B2A4A] rounded-lg text-xs" onClick={() => setShowCreate(true)} data-testid="create-task-btn"><Plus className="w-3 h-3 mr-1" /> New Task</Button>
      </div>

      <div className="grid grid-cols-4 gap-3 min-h-[500px]">
        {COLUMNS.map(col => (
          <div key={col.key} className={`bg-slate-50/80 rounded-lg border-t-2 ${col.color} p-2`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-1.5"><col.icon className={`w-3.5 h-3.5 ${col.iconColor}`} /><span className="text-xs font-semibold text-[#1B2A4A]">{col.label}</span></div>
              <Badge variant="secondary" className="text-[9px] h-5">{board[col.key]?.length || 0}</Badge>
            </div>
            <div className="space-y-2 min-h-[300px]">
              {(board[col.key] || []).map(task => (
                <Card key={task.task_id} className="rounded-lg shadow-sm border-slate-100 hover:shadow-md transition-shadow" data-testid={`task-${task.task_id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-1.5">
                      <h4 className="text-xs font-semibold text-[#1B2A4A] leading-tight flex-1">{task.title}</h4>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-slate-400 hover:text-red-500" onClick={() => deleteTask(task.task_id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    {task.description && <p className="text-[10px] text-slate-500 mb-2 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      <Badge className={`text-[8px] border ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</Badge>
                      {task.due_date && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{new Date(task.due_date).toLocaleDateString()}</span>}
                    </div>
                    {task.assigned_to_name && <p className="text-[9px] text-slate-400 flex items-center gap-1"><User className="w-2.5 h-2.5" />{task.assigned_to_name}</p>}
                    <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                      {col.key !== 'todo' && <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={() => moveTask(task.task_id, COLUMNS[COLUMNS.findIndex(c => c.key === col.key) - 1].key)}>← Back</Button>}
                      {col.key !== 'completed' && <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 ml-auto" onClick={() => moveTask(task.task_id, COLUMNS[COLUMNS.findIndex(c => c.key === col.key) + 1].key)}>Next →</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-9 text-xs" data-testid="task-title-input" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="text-xs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Assign To</Label>
                <Select value={form.assigned_to} onValueChange={v => { const s = staff?.find(st => st.user_id === v); setForm(p => ({ ...p, assigned_to: v, assigned_to_name: s?.name || '' })); }}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{(staff || []).map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="h-9 text-xs" /></div>
            <Button className="w-full bg-[#1B2A4A] rounded-lg text-xs" onClick={handleCreate} disabled={saving} data-testid="submit-task-btn">{saving ? 'Creating...' : 'Create Task'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
