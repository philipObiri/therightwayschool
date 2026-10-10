import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus, Receipt, Printer, XCircle, Search } from 'lucide-react';

export function ReceiptsTab() {
  const [receipts, setReceipts] = useState([]);
  const [students, setStudents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showVoid, setShowVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ student_id: '', student_name: '', payer_name: '', amount: '', payment_method: 'cash', reference_number: '', category: 'School Fees', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState(null);

  const load = async () => { try { const r = await api.get('/finance/receipts'); setReceipts(r.data); } catch (err) { console.error("Error:", err); } };
  const loadStudents = async () => { try { const r = await api.get('/admin/students'); setStudents(r.data); } catch (err) { console.error("Error:", err); } };
  useEffect(() => { load(); loadStudents(); }, []);

  const handleStudentSelect = async (studentId) => {
    const s = students.find(st => st.user_id === studentId);
    setForm(p => ({ ...p, student_id: studentId, payer_name: s?.name || '' }));
    setBalance(null);
    if (studentId) {
      try {
        const r = await api.get(`/finance/student-balance/${studentId}`);
        setBalance(r.data);
      } catch { /* ignore */ }
    }
  };

  const handleCreate = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    try {
      const student = students.find(s => s.user_id === form.student_id);
      await api.post('/finance/receipts', { ...form, amount: parseFloat(form.amount), student_name: student?.name || form.payer_name });
      successToast('Receipt generated');
      setShowCreate(false);
      setForm({ student_id: '', student_name: '', payer_name: '', amount: '', payment_method: 'cash', reference_number: '', category: 'School Fees', remarks: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleVoid = async (receiptId) => {
    try {
      await api.post(`/finance/receipts/${receiptId}/void`, { reason: voidReason });
      successToast('Receipt voided');
      setShowVoid(null); setVoidReason(''); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const printReceipt = async (receipt) => {
    let balanceInfo = '';
    if (receipt.student_id) {
      try {
        const r = await api.get(`/finance/student-balance/${receipt.student_id}`);
        const b = r.data;
        balanceInfo = `
        <div style="margin:12px 0;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
          <div class="row"><span class="label">Total Billed:</span><span class="value">TT$ ${b.total_billed?.toLocaleString()}</span></div>
          <div class="row"><span class="label">Total Paid:</span><span class="value" style="color:#C5A55A">TT$ ${b.total_paid?.toLocaleString()}</span></div>
          <div class="row"><span class="label">Outstanding:</span><span class="value" style="color:${b.outstanding > 0 ? '#DC2626' : '#059669'}">TT$ ${b.outstanding?.toLocaleString()}</span></div>
        </div>`;
      } catch { /* ignore */ }
    }
    const win = window.open('', '_blank');
    win.document.body.innerHTML = DOMPurify.sanitize(`
      <html><head><title>Receipt ${receipt.receipt_number}</title>
      <style>body{font-family:'DM Sans',Arial,sans-serif;padding:40px;max-width:500px;margin:auto}
      .header{text-align:center;border-bottom:2px solid #1B2A4A;padding-bottom:12px;margin-bottom:20px}
      .header h1{color:#1B2A4A;font-size:18px;margin:0} .header p{color:#666;font-size:11px;margin:4px 0 0}
      .details{margin:16px 0} .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
      .row .label{color:#666} .row .value{font-weight:600} .total{font-size:20px;text-align:center;padding:16px;background:#f0f9ff;border-radius:8px;margin:16px 0}
      .footer{text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px dashed #ccc;padding-top:12px}
      @media print{body{padding:20px}}</style></head>
      <body><div class="header"><h1>The RightWay Centre of Learning</h1><p>Official Payment Receipt</p></div>
      <div class="details">
        <div class="row"><span class="label">Receipt #:</span><span class="value">${receipt.receipt_number}</span></div>
        <div class="row"><span class="label">Date:</span><span class="value">${new Date(receipt.created_at).toLocaleDateString()}</span></div>
        <div class="row"><span class="label">Student:</span><span class="value">${receipt.student_name || '-'}</span></div>
        <div class="row"><span class="label">Payer:</span><span class="value">${receipt.payer_name || '-'}</span></div>
        <div class="row"><span class="label">Category:</span><span class="value">${receipt.category}</span></div>
        <div class="row"><span class="label">Method:</span><span class="value">${receipt.payment_method}</span></div>
        ${receipt.reference_number ? `<div class="row"><span class="label">Reference:</span><span class="value">${receipt.reference_number}</span></div>` : ''}
        ${receipt.remarks ? `<div class="row"><span class="label">Remarks:</span><span class="value">${receipt.remarks}</span></div>` : ''}
      </div>
      <div class="total"><p style="margin:0;color:#666;font-size:12px">Amount Received</p><p style="margin:4px 0 0;color:#2E6CC4;font-weight:700">TT$ ${receipt.amount?.toLocaleString()}</p></div>
      ${balanceInfo}
      <div class="row"><span class="label">Received by:</span><span class="value">${receipt.received_by_name}</span></div>
      <div class="footer"><p>This is a computer-generated receipt. Thank you for your payment.</p></div>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const totalToday = receipts.filter(r => r.created_at?.startsWith(new Date().toISOString().split('T')[0])).reduce((s, r) => s + (r.amount || 0), 0);
  const filtered = receipts.filter(r =>
    r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.payer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4" data-testid="receipts-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Receipt Management</h2><p className="text-xs text-slate-500">Generate, print, and manage payment receipts</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(true)} data-testid="create-receipt-btn"><Plus className="w-3 h-3 mr-1" /> Generate Receipt</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{receipts.length}</p><p className="text-xs text-slate-500">Total Receipts</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]">TT$ {totalToday.toLocaleString()}</p><p className="text-xs text-slate-500">Today's Receipts</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">TT$ {receipts.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Amount</p></div>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-md border px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search receipts..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="receipt-search" />
      </div>

      <Card className="rounded-md"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">Receipt #</TableHead>
            <TableHead className="bg-slate-50">Date</TableHead>
            <TableHead className="bg-slate-50">Student/Payer</TableHead>
            <TableHead className="bg-slate-50">Category</TableHead>
            <TableHead className="bg-slate-50">Method</TableHead>
            <TableHead className="bg-slate-50 text-right">Amount</TableHead>
            <TableHead className="bg-slate-50">Status</TableHead>
            <TableHead className="bg-slate-50">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.receipt_id} data-testid={`receipt-${r.receipt_id}`}>
                <TableCell className="text-xs font-mono font-medium">{r.receipt_number}</TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-sm font-medium">{r.student_name || r.payer_name || '-'}</TableCell>
                <TableCell className="text-xs">{r.category}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[9px]">{r.payment_method}</Badge></TableCell>
                <TableCell className="text-right font-semibold">TT$ {r.amount?.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={`text-[9px] ${r.voided ? 'bg-red-100 text-red-700' : 'bg-[#C5A55A]/15 text-[#C5A55A]'}`}>
                    {r.voided ? 'voided' : 'active'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => printReceipt(r)} data-testid={`print-receipt-${r.receipt_id}`}><Printer className="w-3 h-3" /></Button>
                    {!r.voided && <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => setShowVoid(r)} data-testid={`void-receipt-${r.receipt_id}`}><XCircle className="w-3 h-3" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400 text-sm">No receipts found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Create Receipt Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Generate Receipt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Student</Label>
              <SearchableSelect
                options={students.map(s => ({ value: s.user_id, label: `${s.name} (${s.year_group})` }))}
                value={form.student_id}
                onValueChange={handleStudentSelect}
                placeholder="Search student..."
                className="h-9 text-xs w-full"
              />
            </div>
            {balance && (
              <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Total Billed</p>
                  <p className="text-sm font-bold text-[#1B2A4A]">TT$ {balance.total_billed?.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Total Paid</p>
                  <p className="text-sm font-bold text-[#C5A55A]">TT$ {balance.total_paid?.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase">Outstanding</p>
                  <p className={`text-sm font-bold ${balance.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>TT$ {balance.outstanding?.toLocaleString()}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Payer Name</Label><Input value={form.payer_name} onChange={e => setForm(p => ({ ...p, payer_name: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Amount (GHS) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="h-9 text-xs" data-testid="receipt-amount-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Payment Method</Label>
                <SearchableSelect
                  options={[{value:'cash',label:'Cash'},{value:'bank_transfer',label:'Bank Transfer'},{value:'momo',label:'Mobile Money'},{value:'card',label:'Card'},{value:'cheque',label:'Cheque'}]}
                  value={form.payment_method}
                  onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}
                  placeholder="Method"
                  className="h-9 text-xs w-full"
                />
              </div>
              <div><Label className="text-xs">Reference #</Label><Input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Category</Label>
              <SearchableSelect
                options={['School Fees', 'Boarding Fees', 'Exam Fees', 'Transport', 'Books', 'Uniform', 'Activity Fee', 'Other'].map(c => ({value: c, label: c}))}
                value={form.category}
                onValueChange={v => setForm(p => ({ ...p, category: v }))}
                placeholder="Select category"
                className="h-9 text-xs w-full"
              />
            </div>
            <div><Label className="text-xs">Remarks</Label><Input value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} className="h-9 text-xs" /></div>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleCreate} disabled={saving} data-testid="submit-receipt-btn">
              {saving ? 'Generating...' : 'Generate Receipt'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      {showVoid && (
        <Dialog open={!!showVoid} onOpenChange={() => { setShowVoid(null); setVoidReason(''); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Void Receipt {showVoid.receipt_number}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">This will permanently void this receipt. Amount: <span className="font-bold">TT$ {showVoid.amount?.toLocaleString()}</span></p>
              <div><Label className="text-xs">Reason for voiding *</Label><Input value={voidReason} onChange={e => setVoidReason(e.target.value)} className="h-9 text-xs" placeholder="Enter reason" /></div>
              <Button variant="destructive" className="w-full rounded-md text-xs" onClick={() => handleVoid(showVoid.receipt_id)} disabled={!voidReason}>Void Receipt</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
