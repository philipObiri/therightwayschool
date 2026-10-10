import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

export function BudgetsTab() {
  const [budgets, setBudgets] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', period: 'annual', academic_year: '2025-2026', lines: [{ department: '', category: '', description: '', allocated: 0 }] });
  const [saving, setSaving] = useState(false);

  const load = async () => { try { const r = await api.get('/finance/budgets'); setBudgets(r.data); } catch (err) { console.error("Error:", err); } };
  useEffect(() => { load(); }, []);

  const loadDetail = async (id) => { try { const r = await api.get(`/finance/budgets/${id}`); setDetail(r.data); } catch (err) { console.error("Error:", err); } };

  const addLine = () => setForm(p => ({ ...p, lines: [...p.lines, { department: '', category: '', description: '', allocated: 0 }] }));
  const updateLine = (i, k, v) => setForm(p => ({ ...p, lines: p.lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l) }));
  const removeLine = (i) => setForm(p => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }));

  const handleCreate = async () => {
    if (!form.name) { toast.error('Budget name required'); return; }
    setSaving(true);
    try {
      await api.post('/finance/budgets', { ...form, lines: form.lines.map(l => ({ ...l, allocated: parseFloat(l.allocated) || 0 })) });
      successToast('Budget created'); setShowCreate(false); load();
      setForm({ name: '', period: 'annual', academic_year: '2025-2026', lines: [{ department: '', category: '', description: '', allocated: 0 }] });
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleApprove = async (id) => {
    try { await api.post(`/finance/budgets/${id}/approve`); successToast('Budget approved'); load(); loadDetail(id); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const totalBudgeted = budgets.reduce((s, b) => s + (b.total_amount || 0), 0);

  return (
    <div className="space-y-4" data-testid="budgets-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Budget Management</h2><p className="text-xs text-slate-500">Create and monitor departmental budgets</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(true)} data-testid="create-budget-btn"><Plus className="w-3 h-3 mr-1" /> Create Budget</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{budgets.length}</p><p className="text-xs text-slate-500">Total Budgets</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">TT$ {totalBudgeted.toLocaleString()}</p><p className="text-xs text-slate-500">Total Budgeted</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]">{budgets.filter(b => b.status === 'approved').length}</p><p className="text-xs text-slate-500">Approved</p></div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map(b => (
          <Card key={b.budget_id} className="rounded-md hover:border-[#2E6CC4]/30 cursor-pointer transition-colors" onClick={() => loadDetail(b.budget_id)}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-[#1B2A4A]">{b.name}</h3>
                <Badge className={`text-[9px] ${b.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-amber-100 text-amber-700'}`}>{b.status}</Badge>
              </div>
              <p className="text-xs text-slate-500">{b.period} | {b.academic_year}</p>
              <p className="text-lg font-bold text-[#2E6CC4] mt-2">TT$ {(b.total_amount || 0).toLocaleString()}</p>
              <p className="text-[9px] text-slate-400">{b.lines?.length || 0} budget lines | By {b.created_by_name}</p>
            </CardContent>
          </Card>
        ))}
        {budgets.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400"><p className="text-sm">No budgets yet</p></div>}
      </div>

      {/* Detail Modal */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{detail.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Allocated</p><p className="text-lg font-bold text-[#2E6CC4]">TT$ {(detail.total_amount || 0).toLocaleString()}</p></div>
                <div className="bg-red-50 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Spent</p><p className="text-lg font-bold text-red-600">TT$ {(detail.total_spent || 0).toLocaleString()}</p></div>
                <div className="bg-[#C5A55A]/10 p-3 rounded-lg text-center"><p className="text-xs text-slate-500">Remaining</p><p className="text-lg font-bold text-[#C5A55A]">TT$ {(detail.total_remaining || 0).toLocaleString()}</p></div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-slate-500"><th className="pb-2 text-left">Department</th><th className="pb-2 text-left">Category</th><th className="pb-2 text-right">Allocated</th><th className="pb-2 text-right">Spent</th><th className="pb-2 text-right">Remaining</th><th className="pb-2 text-right">Used</th></tr></thead>
                <tbody>{(detail.lines || []).map(l => (
                  <tr key={l.line_id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{l.department}</td>
                    <td className="py-2 text-xs">{l.category}</td>
                    <td className="py-2 text-right">TT$ {(l.allocated || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600">TT$ {(l.spent || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-[#C5A55A]">TT$ {(l.remaining || 0).toLocaleString()}</td>
                    <td className="py-2 text-right"><Badge className={`text-[9px] ${l.utilisation > 90 ? 'bg-red-100 text-red-700' : l.utilisation > 70 ? 'bg-amber-100 text-amber-700' : 'bg-[#C5A55A]/15 text-[#C5A55A]'}`}>{l.utilisation || 0}%</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
              {detail.status === 'draft' && <Button className="bg-[#C5A55A] rounded-md text-xs" onClick={() => handleApprove(detail.budget_id)}>Approve Budget</Button>}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Budget Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Period</Label><Select value={form.period} onValueChange={v => setForm(p => ({ ...p, period: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Annual</SelectItem><SelectItem value="term">Term</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Academic Year</Label><Select value={form.academic_year} onValueChange={v => setForm(p => ({ ...p, academic_year: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025-2026">2025-2026</SelectItem><SelectItem value="2024-2025">2024-2025</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Budget Lines</Label><button onClick={addLine} className="text-xs text-[#2E6CC4]">+ Add Line</button></div>
            {form.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Input value={l.department} onChange={e => updateLine(i, 'department', e.target.value)} placeholder="Department" className="text-xs h-8" /></div>
                <div className="col-span-3"><Input value={l.category} onChange={e => updateLine(i, 'category', e.target.value)} placeholder="Category" className="text-xs h-8" /></div>
                <div className="col-span-3"><Input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Description" className="text-xs h-8" /></div>
                <div className="col-span-2"><Input type="number" value={l.allocated} onChange={e => updateLine(i, 'allocated', e.target.value)} placeholder="Amount" className="text-xs h-8" /></div>
                <div className="col-span-1">{form.lines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
              </div>
            ))}
            <p className="text-xs font-semibold text-[#2E6CC4]">Total: TT$ {form.lines.reduce((s, l) => s + (parseFloat(l.allocated) || 0), 0).toLocaleString()}</p>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Budget'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
