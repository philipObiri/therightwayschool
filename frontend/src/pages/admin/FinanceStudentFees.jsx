import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Search, ArrowLeft, DollarSign, Download, Plus, X, Receipt, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;
const statusColors = { draft: 'bg-slate-100 text-slate-600', issued: 'bg-blue-100 text-blue-700', partial: 'bg-amber-100 text-amber-700', paid: 'bg-[#C5A55A]/15 text-[#C5A55A]', overdue: 'bg-red-100 text-red-700', cancelled: 'bg-slate-200 text-slate-500' };

export default function FinanceStudentFees() {
  const { activeTerm } = useTerm();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [feeDialog, setFeeDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [feeItems, setFeeItems] = useState([{ name: 'Tuition Fee', category: 'tuition', amount: 0 }]);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'cash', reference: '', invoice_id: '' });

  useEffect(() => {
    api.get('/finance/student-ledger').then(r => setStudents(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [activeTerm]);

  const openProfile = async (student) => {
    setSelectedStudent(student);
    try {
      const res = await api.get(`/finance/student-profile/${student.user_id}`);
      setProfile(res.data);
    } catch { toast.error('Failed to load'); }
  };

  const refresh = async () => {
    try {
      const [listRes, profRes] = await Promise.all([
        api.get('/finance/student-ledger'),
        selectedStudent ? api.get(`/finance/student-profile/${selectedStudent.user_id}`) : Promise.resolve(null),
      ]);
      setStudents(listRes.data);
      if (profRes) setProfile(profRes.data);
    } catch (err) { console.error("Error:", err); }
  };

  const handleAssignFee = async () => {
    const validItems = feeItems.filter(fi => fi.name && fi.amount > 0);
    if (validItems.length === 0) { toast.error('Add at least one fee item'); return; }
    try {
      await api.post('/finance/invoices', {
        student_id: selectedStudent.user_id,
        term: activeTerm || 'Term 1',
        academic_year: '2025-2026',
        due_at: '',
        items: validItems,
      });
      toast.success('Fee assigned to ' + selectedStudent.name);
      setFeeDialog(false);
      setFeeItems([{ name: 'Tuition Fee', category: 'tuition', amount: 0 }]);
      refresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || paymentForm.amount <= 0) { toast.error('Enter amount'); return; }
    try {
      // Record payment
      const payRes = await api.post('/finance/payments', {
        student_id: selectedStudent.user_id,
        amount: paymentForm.amount,
        method: paymentForm.method,
        reference: paymentForm.reference,
      });
      // Auto-allocate to oldest invoice
      if (payRes.data.payment_id) {
        try { await api.post(`/finance/payments/${payRes.data.payment_id}/auto-allocate`); } catch (err) { console.error("Error:", err); }
      }
      toast.success(`TT$ ${paymentForm.amount} payment recorded for ${selectedStudent.name}`);
      setPaymentDialog(false);
      setPaymentForm({ amount: 0, method: 'cash', reference: '', invoice_id: '' });
      refresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const downloadBill = (invoiceId) => {
    const token = localStorage.getItem('rw_token');
    fetch(`${BACKEND}/api/finance/bill/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Bill_${invoiceId}.pdf`; a.click(); toast.success('Downloaded'); })
      .catch(() => toast.error('Failed'));
  };

  const addFeeItem = () => setFeeItems([...feeItems, { name: '', category: 'other', amount: 0 }]);
  const updateFeeItem = (idx, field, val) => { const items = [...feeItems]; items[idx][field] = field === 'amount' ? parseFloat(val) || 0 : val; setFeeItems(items); };
  const removeFeeItem = (idx) => setFeeItems(feeItems.filter((_, i) => i !== idx));

  const filtered = students.filter(s =>
    (yearFilter === 'All' || s.year_group === yearFilter) &&
    (s.name?.toLowerCase().includes(search.toLowerCase()) || s.admission_number?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <AppLoader />;

  // ─── Student Fee Profile ───
  if (selectedStudent && profile) {
    const { summary, invoices, payments } = profile;
    return (
      <div className="space-y-5" data-testid="student-fee-profile">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setProfile(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back to Students</Button>
          <div className="flex gap-2">
            <Button className="rounded-md bg-[#2E6CC4]" onClick={() => setFeeDialog(true)} data-testid="assign-fee-btn"><Plus className="w-4 h-4 mr-2" /> Assign Fee</Button>
            <Button className="rounded-md bg-[#C5A55A]" onClick={() => setPaymentDialog(true)} data-testid="record-payment-btn"><Receipt className="w-4 h-4 mr-2" /> Record Payment</Button>
          </div>
        </div>

        {/* Student header */}
        <div className="bg-white rounded-md border border-slate-200 p-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{selectedStudent.name?.charAt(0)}</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1B2A4A]">{selectedStudent.name}</h2>
            <div className="flex gap-2 mt-1"><Badge variant="secondary">{selectedStudent.year_group}</Badge><Badge variant="secondary">{selectedStudent.admission_number}</Badge><Badge className="bg-blue-100 text-[#1B2A4A]">{selectedStudent.boarding_status}</Badge></div>
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card text-center border border-slate-200"><DollarSign className="w-6 h-6 text-[#2E6CC4] mx-auto mb-1" /><p className="text-xl font-bold">TT$ {summary.total_billed.toLocaleString()}</p><p className="text-xs text-slate-500">Total Fee to Pay</p></div>
          <div className="stat-card text-center bg-[#C5A55A]/10 border border-[#C5A55A]/30"><TrendingUp className="w-6 h-6 text-[#C5A55A] mx-auto mb-1" /><p className="text-xl font-bold text-[#C5A55A]">TT$ {summary.total_paid.toLocaleString()}</p><p className="text-xs text-slate-500">Actual Paid</p></div>
          <div className="stat-card text-center bg-red-50 border border-red-200"><AlertCircle className="w-6 h-6 text-[#DC2626] mx-auto mb-1" /><p className="text-xl font-bold text-[#DC2626]">TT$ {summary.balance.toLocaleString()}</p><p className="text-xs text-slate-500">Balance Owing</p></div>
        </div>

        {/* Invoices */}
        <Card className="rounded-md border-slate-200">
          <CardHeader><CardTitle className="text-sm">Fee Invoices</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Invoice</TableHead><TableHead className="bg-slate-50">Term</TableHead><TableHead className="bg-slate-50">Fee to Pay</TableHead><TableHead className="bg-slate-50">Paid</TableHead><TableHead className="bg-slate-50">Owing</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Bill</TableHead></TableRow></TableHeader>
            <TableBody>{invoices.map(inv => (
              <TableRow key={inv.invoice_id}>
                <TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell>
                <TableCell className="text-sm">{inv.term}</TableCell>
                <TableCell className="font-semibold">TT$ {(inv.total_due||0).toLocaleString()}</TableCell>
                <TableCell className="text-[#C5A55A] font-semibold">TT$ {(inv.amount_paid||0).toLocaleString()}</TableCell>
                <TableCell className="text-[#DC2626] font-semibold">TT$ {((inv.total_due||0)-(inv.amount_paid||0)).toLocaleString()}</TableCell>
                <TableCell><Badge className={statusColors[inv.status]}>{inv.status}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => downloadBill(inv.invoice_id)}><Download className="w-3 h-3 mr-1" /> PDF</Button></TableCell>
              </TableRow>
            ))}{invoices.length===0&&<TableRow><TableCell colSpan={7} className="text-center py-6 text-slate-400">No invoices yet - click "Assign Fee" to create one</TableCell></TableRow>}</TableBody></Table>
            {/* Fee breakdown per invoice */}
            {invoices.map(inv => (inv.line_items||[]).length > 0 && (
              <div key={inv.invoice_id} className="px-4 py-2 bg-slate-50 border-t">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">{inv.invoice_number} Breakdown:</p>
                {inv.line_items.map((li,i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span>{li.fee_item_name} <span className="text-slate-400">({li.category})</span></span>
                    <span>Fee: TT$ {li.amount?.toLocaleString()} | Paid: TT$ {li.amount_paid?.toLocaleString()} | Owing: TT$ {li.amount_outstanding?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment History */}
        {payments.length > 0 && (
          <Card className="rounded-md border-slate-200"><CardHeader><CardTitle className="text-sm">Payment History</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Amount</TableHead><TableHead className="bg-slate-50">Method</TableHead><TableHead className="bg-slate-50">Reference</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Proof</TableHead><TableHead className="bg-slate-50">Action</TableHead></TableRow></TableHeader>
            <TableBody>{payments.map(p => (
              <TableRow key={p.payment_id} className={p.status === 'unmatched' ? 'bg-amber-50/50' : ''}>
                <TableCell className="text-xs">{new Date(p.received_at||p.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold text-[#C5A55A]">TT$ {p.amount?.toLocaleString()}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{p.method === 'proof_upload' ? 'Parent Upload' : p.method}</Badge></TableCell>
                <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{p.reference||'-'}</TableCell>
                <TableCell><Badge className={p.status === 'allocated' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : p.status === 'matched' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>{p.status}</Badge></TableCell>
                <TableCell>{p.proof_file_id ? <a href={`${BACKEND}/api/files/${p.proof_file_id}/download`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" className="h-6 text-[10px] text-[#2E6CC4]"><Download className="w-3 h-3 mr-1" /> View</Button></a> : <span className="text-[10px] text-slate-400">-</span>}</TableCell>
                <TableCell>{(p.status === 'unmatched' || p.status === 'matched') && p.amount > 0 && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-md text-[#C5A55A] border-[#C5A55A]/30" onClick={async () => { try { await api.post(`/finance/payments/${p.payment_id}/auto-allocate`); toast.success('Payment confirmed & allocated'); refresh(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } }} data-testid={`confirm-pay-${p.payment_id}`}>Confirm & Allocate</Button>
                )}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </CardContent></Card>
        )}

        {/* Assign Fee Dialog */}
        <Dialog open={feeDialog} onOpenChange={setFeeDialog}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Assign Fee to {selectedStudent.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Term: <strong>{activeTerm}</strong> | Year: 2025-2026</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Fee Items</Label><Button variant="ghost" size="sm" className="text-xs text-[#2E6CC4]" onClick={addFeeItem}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
                {feeItems.map((fi, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5"><Input value={fi.name} onChange={e => updateFeeItem(i, 'name', e.target.value)} placeholder="Fee name" className="text-xs h-9" /></div>
                    <div className="col-span-3">
                      <Select value={fi.category} onValueChange={v => updateFeeItem(i, 'category', v)}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['tuition','boarding','feeding','uniform','technology','activity','exam','books','transport','capital_levy','admission','other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="col-span-3"><Input type="number" value={fi.amount} onChange={e => updateFeeItem(i, 'amount', e.target.value)} placeholder="GHS" className="text-xs h-9" /></div>
                    <div className="col-span-1">{feeItems.length > 1 && <button onClick={() => removeFeeItem(i)} className="text-red-400"><X className="w-4 h-4" /></button>}</div>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-md p-3 text-right"><p className="text-sm font-bold">Total: TT$ {feeItems.reduce((s, f) => s + (f.amount || 0), 0).toLocaleString()}</p></div>
              </div>
              <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={handleAssignFee}>Assign Fee (TT$ {feeItems.reduce((s, f) => s + (f.amount || 0), 0).toLocaleString()})</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment for {selectedStudent.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Outstanding balance: <strong className="text-[#DC2626]">TT$ {summary.balance.toLocaleString()}</strong></p>
              <div className="space-y-2"><Label>Amount (GHS)</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})} className="text-lg font-bold h-12" data-testid="payment-amount" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Method</Label>
                  <Select value={paymentForm.method} onValueChange={v => setPaymentForm({...paymentForm, method: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="momo">Mobile Money</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Reference</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} placeholder="Receipt/Ref no." /></div>
              </div>
              <Button className="w-full rounded-md bg-[#C5A55A] h-11" onClick={handleRecordPayment}>Record Payment TT$ {paymentForm.amount.toLocaleString()}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Student List ───
  const totalOwing = filtered.reduce((s, st) => s + (st.balance || 0), 0);
  const totalPaid = filtered.reduce((s, st) => s + (st.total_paid || 0), 0);

  return (
    <div className="space-y-5" data-testid="finance-student-fees">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Student Fees</h1>
        <p className="text-slate-500 mt-1">View and manage fees for each student | {activeTerm}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center"><p className="text-xl font-bold">{filtered.length}</p><p className="text-xs text-slate-500">Students</p></div>
        <div className="stat-card text-center bg-[#C5A55A]/10"><p className="text-xl font-bold text-[#C5A55A]">TT$ {totalPaid.toLocaleString()}</p><p className="text-xs text-slate-500">Total Collected</p></div>
        <div className="stat-card text-center bg-red-50"><p className="text-xl font-bold text-[#DC2626]">TT$ {totalOwing.toLocaleString()}</p><p className="text-xs text-slate-500">Total Outstanding</p></div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="fee-search" />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-36 rounded-md"><SelectValue /></SelectTrigger><SelectContent>{['All','Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">#</TableHead>
            <TableHead className="bg-slate-50">Student</TableHead>
            <TableHead className="bg-slate-50">Year</TableHead>
            <TableHead className="bg-slate-50">Type</TableHead>
            <TableHead className="bg-slate-50">Fee to Pay</TableHead>
            <TableHead className="bg-slate-50">Paid</TableHead>
            <TableHead className="bg-slate-50">Owing</TableHead>
          </TableRow></TableHeader>
          <TableBody>{filtered.map((s, i) => (
            <TableRow key={s.user_id} className="cursor-pointer hover:bg-blue-50/50" onClick={() => openProfile(s)} data-testid={`fee-student-${s.user_id}`}>
              <TableCell className="text-xs text-slate-400">{i+1}</TableCell>
              <TableCell className="font-medium"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-[#2E6CC4] text-xs font-bold">{s.name?.charAt(0)}</div>{s.name}</div></TableCell>
              <TableCell><Badge variant="secondary" className="text-xs">{s.year_group}</Badge></TableCell>
              <TableCell><Badge className={s.boarding_status==='boarding'?'bg-blue-100 text-[#1B2A4A]':'bg-slate-100 text-slate-600'}>{s.boarding_status}</Badge></TableCell>
              <TableCell className="font-semibold">TT$ {(s.total_billed||0).toLocaleString()}</TableCell>
              <TableCell className="text-[#C5A55A] font-semibold">TT$ {(s.total_paid||0).toLocaleString()}</TableCell>
              <TableCell className={`font-bold ${(s.balance||0)>0?'text-[#DC2626]':'text-[#C5A55A]'}`}>TT$ {(s.balance||0).toLocaleString()}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );
}
