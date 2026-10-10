import React, { useState, useEffect } from 'react';
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
import { Plus, ArrowRight, Check, X, Clock, AlertTriangle } from 'lucide-react';

const STATUS_COLORS = { requested: 'bg-amber-100 text-amber-700', dept_reviewed: 'bg-blue-100 text-blue-700', finance_reviewed: 'bg-indigo-100 text-indigo-700', leadership_approved: 'bg-[#C5A55A]/15 text-[#C5A55A]', payment_processed: 'bg-blue-100 text-[#2E6CC4]', completed: 'bg-slate-100 text-slate-700', rejected: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { requested: 'Requested', dept_reviewed: 'Dept Reviewed', finance_reviewed: 'Finance Reviewed', leadership_approved: 'Leadership Approved', payment_processed: 'Payment Done', completed: 'Completed', rejected: 'Rejected' };

export function ProcurementTab() {
  const [items, setItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', department: '', estimated_amount: '', vendor_name: '', urgency: 'normal' });
  const [saving, setSaving] = useState(false);

  const load = async () => { try { const r = await api.get('/finance/procurement'); setItems(r.data); } catch (err) { console.error("Error:", err); } };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.estimated_amount) { toast.error('Title and amount required'); return; }
    setSaving(true);
    try {
      await api.post('/finance/procurement', { ...form, estimated_amount: parseFloat(form.estimated_amount) });
      successToast('Procurement request created'); setShowCreate(false); load();
      setForm({ title: '', description: '', department: '', estimated_amount: '', vendor_name: '', urgency: 'normal' });
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleAdvance = async (id, action, notes = '') => {
    try { await api.post(`/finance/procurement/${id}/advance`, { action, notes }); successToast('Updated'); load(); setDetail(null); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4" data-testid="procurement-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Procurement & Approvals</h2><p className="text-xs text-slate-500">Manage procurement requests through approval workflow</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(true)} data-testid="create-procurement-btn"><Plus className="w-3 h-3 mr-1" /> New Request</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{items.length}</p><p className="text-xs text-slate-500">Total Requests</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-amber-600">{items.filter(i => !['completed', 'rejected'].includes(i.status)).length}</p><p className="text-xs text-slate-500">In Progress</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]">{items.filter(i => i.status === 'completed').length}</p><p className="text-xs text-slate-500">Completed</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">TT$ {items.reduce((s, i) => s + (i.final_amount || i.estimated_amount || 0), 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Value</p></div>
      </div>

      <Card className="rounded-md"><CardContent className="pt-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Title</th><th className="pb-2">Department</th><th className="pb-2 text-right">Amount</th><th className="pb-2">Status</th><th className="pb-2">Urgency</th><th className="pb-2">By</th></tr></thead>
          <tbody>{items.map(p => (
            <tr key={p.procurement_id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setDetail(p)}>
              <td className="py-2 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="py-2 font-medium text-[#1B2A4A]">{p.title}</td>
              <td className="py-2 text-xs">{p.department}</td>
              <td className="py-2 text-right font-semibold">TT$ {(p.estimated_amount || 0).toLocaleString()}</td>
              <td className="py-2"><Badge className={`text-[9px] ${STATUS_COLORS[p.status] || ''}`}>{STATUS_LABELS[p.status] || p.status}</Badge></td>
              <td className="py-2"><Badge variant={p.urgency === 'urgent' ? 'destructive' : 'secondary'} className="text-[9px]">{p.urgency}</Badge></td>
              <td className="py-2 text-xs text-slate-500">{p.requested_by_name?.split(' ')[0]}</td>
            </tr>
          ))}</tbody>
        </table>
        {items.length === 0 && <p className="text-center py-8 text-sm text-slate-400">No procurement requests</p>}
      </CardContent></Card>

      {/* Detail */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{detail.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Amount:</span> <span className="font-bold">TT$ {(detail.estimated_amount || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-500">Department:</span> {detail.department}</div>
                <div><span className="text-slate-500">Vendor:</span> {detail.vendor_name}</div>
                <div><span className="text-slate-500">Status:</span> <Badge className={`text-[9px] ${STATUS_COLORS[detail.status]}`}>{STATUS_LABELS[detail.status]}</Badge></div>
              </div>
              {detail.description && <p className="text-xs bg-slate-50 p-2 rounded">{detail.description}</p>}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#1B2A4A]">Workflow History</p>
                {(detail.workflow || []).map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-600">
                    <div className="w-2 h-2 rounded-full bg-[#2E6CC4]" />
                    <span className="font-medium">{STATUS_LABELS[w.step] || w.step}</span> by {w.by_name} — {new Date(w.at).toLocaleString()}
                    {w.notes && <span className="text-slate-400">({w.notes})</span>}
                  </div>
                ))}
              </div>
              {!['completed', 'rejected'].includes(detail.status) && (
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#2E6CC4] text-xs rounded-md" onClick={() => handleAdvance(detail.procurement_id, 'approve')}><ArrowRight className="w-3 h-3 mr-1" /> Advance</Button>
                  <Button size="sm" variant="destructive" className="text-xs rounded-md" onClick={() => handleAdvance(detail.procurement_id, 'reject', 'Rejected')}>Reject</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Procurement Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Estimated Amount (GHS)</Label><Input type="number" value={form.estimated_amount} onChange={e => setForm(p => ({ ...p, estimated_amount: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Department</Label><Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Urgency</Label><Select value={form.urgency} onValueChange={v => setForm(p => ({ ...p, urgency: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label className="text-xs">Vendor</Label><Input value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} className="h-9 text-xs" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="text-xs" /></div>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Submit Request'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
