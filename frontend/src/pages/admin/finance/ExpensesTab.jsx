import React, { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Plus, Check, X, Clock, AlertTriangle, DollarSign, Paperclip, Eye } from 'lucide-react';

const STATUS_COLORS = { pending: 'bg-amber-100 text-amber-700', reviewed: 'bg-blue-100 text-blue-700', approved: 'bg-[#C5A55A]/15 text-[#C5A55A]', completed: 'bg-slate-100 text-slate-700', rejected: 'bg-red-100 text-red-700' };

export function ExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'Miscellaneous', department: '', amount: '', vendor_name: '', expense_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const [receiptFileId, setReceiptFileId] = useState('');

  const load = async () => { try { const q = filter !== 'all' ? `?status=${filter}` : ''; const r = await api.get(`/finance/expenses${q}`); setExpenses(r.data); } catch (err) { console.error("Error:", err); } };
  useEffect(() => { load(); }, [filter]);

  const handleCreate = async () => {
    if (!form.title || !form.amount) { toast.error('Title and amount required'); return; }
    setSaving(true);
    try {
      await api.post('/finance/expenses', { ...form, amount: parseFloat(form.amount), receipt_file_id: receiptFileId });
      successToast('Expense recorded');
      setShowCreate(false); setForm({ title: '', description: '', category: 'Miscellaneous', department: '', amount: '', vendor_name: '', expense_date: new Date().toISOString().split('T')[0] }); setReceiptFileId(''); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleUploadReceipt = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const fd = new FormData(); fd.append('file', file); const r = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setReceiptFileId(r.data.file_id); successToast('Receipt uploaded'); } catch { toast.error('Upload failed'); }
  };

  const handleAction = async (id, endpoint, body = {}) => {
    try { await api.post(`/finance/expenses/${id}/${endpoint}`, body); successToast('Updated'); load(); setDetail(null); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const totalPending = expenses.filter(e => e.status === 'pending').length;
  const totalApproved = expenses.filter(e => e.status === 'approved' || e.status === 'completed').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4" data-testid="expenses-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Expense Management</h2><p className="text-xs text-slate-500">Track, approve, and manage all school expenses</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(true)} data-testid="create-expense-btn"><Plus className="w-3 h-3 mr-1" /> Record Expense</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{expenses.length}</p><p className="text-xs text-slate-500">Total Expenses</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-amber-600">{totalPending}</p><p className="text-xs text-slate-500">Pending Approval</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]">TT$ {totalApproved.toLocaleString()}</p><p className="text-xs text-slate-500">Approved/Paid</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">TT$ {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Amount</p></div>
      </div>

      <div className="flex gap-2 items-center">
        {['all', 'pending', 'reviewed', 'approved', 'completed', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === s ? 'bg-[#2E6CC4] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
        ))}
      </div>

      <Card className="rounded-md"><CardContent className="pt-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Title</th><th className="pb-2">Category</th><th className="pb-2">Department</th><th className="pb-2 text-right">Amount</th><th className="pb-2">Status</th><th className="pb-2">By</th><th className="pb-2"></th></tr></thead>
          <tbody>{expenses.map(exp => (
            <tr key={exp.expense_id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setDetail(exp)}>
              <td className="py-2 text-xs">{exp.expense_date}</td>
              <td className="py-2 font-medium text-[#1B2A4A]">{exp.title}</td>
              <td className="py-2 text-xs">{exp.category}</td>
              <td className="py-2 text-xs">{exp.department}</td>
              <td className="py-2 text-right font-semibold">TT$ {exp.amount?.toLocaleString()}</td>
              <td className="py-2"><Badge className={`text-[9px] ${STATUS_COLORS[exp.status] || ''}`}>{exp.status}</Badge></td>
              <td className="py-2 text-xs text-slate-500">{exp.raised_by_name?.split(' ')[0]}</td>
              <td className="py-2"><Eye className="w-3.5 h-3.5 text-slate-400" /></td>
            </tr>
          ))}</tbody>
        </table>
        {expenses.length === 0 && <p className="text-center py-8 text-sm text-slate-400">No expenses found</p>}
      </CardContent></Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Amount (GHS)</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Category</Label><Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['Salaries & Wages','Utilities','Transport','Teaching Materials','Maintenance','ICT & Software','Fuel','Events','Repairs','Marketing','Stationery','Catering','Outsourced Services','Insurance','Rent','Subscriptions','Miscellaneous'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Department</Label><Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="h-9 text-xs" placeholder="e.g. Academics" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Vendor</Label><Input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="text-xs" /></div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={handleUploadReceipt} />
              <Button variant="outline" size="sm" className="text-xs rounded-md" onClick={() => fileRef.current?.click()}><Paperclip className="w-3 h-3 mr-1" /> {receiptFileId ? 'Receipt Attached' : 'Attach Receipt'}</Button>
              {receiptFileId && <Check className="w-4 h-4 text-[#C5A55A]" />}
            </div>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleCreate} disabled={saving}>{saving ? 'Saving...' : 'Submit Expense'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{detail.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-500">Amount:</span> <span className="font-bold">TT$ {detail.amount?.toLocaleString()}</span></div>
                <div><span className="text-slate-500">Category:</span> {detail.category}</div>
                <div><span className="text-slate-500">Department:</span> {detail.department}</div>
                <div><span className="text-slate-500">Vendor:</span> {detail.vendor_name}</div>
                <div><span className="text-slate-500">Date:</span> {detail.expense_date}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={`text-[9px] ${STATUS_COLORS[detail.status]}`}>{detail.status}</Badge></div>
                <div><span className="text-slate-500">Raised by:</span> {detail.raised_by_name}</div>
                {detail.approved_by && <div><span className="text-slate-500">Approved at:</span> {new Date(detail.approved_at).toLocaleDateString()}</div>}
              </div>
              {detail.description && <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded">{detail.description}</p>}
              <div className="flex gap-2 flex-wrap">
                {detail.status === 'pending' && <Button size="sm" className="bg-blue-600 text-xs rounded-md" onClick={() => handleAction(detail.expense_id, 'review', { action: 'approve' })}>Review & Approve</Button>}
                {detail.status === 'reviewed' && <Button size="sm" className="bg-[#C5A55A] text-xs rounded-md" onClick={() => handleAction(detail.expense_id, 'approve')}>Final Approve</Button>}
                {detail.status === 'approved' && <Button size="sm" className="bg-[#2E6CC4] text-xs rounded-md" onClick={() => handleAction(detail.expense_id, 'pay')}>Mark Paid</Button>}
                {['pending', 'reviewed'].includes(detail.status) && <Button size="sm" variant="destructive" className="text-xs rounded-md" onClick={() => handleAction(detail.expense_id, 'review', { action: 'reject', notes: 'Rejected' })}>Reject</Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
