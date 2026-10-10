import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { DollarSign, TrendingUp, AlertCircle, Plus, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function FinanceDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ student_id: '', term: 'Term 1', academic_year: '2024-2025', items: [{ description: 'Tuition Fee', amount: 3500 }], due_date: '' });
  const [paymentForm, setPaymentForm] = useState({ invoice_id: '', amount: 0, method: 'cash', reference: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [dashRes, invRes, studRes] = await Promise.all([
        api.get('/finance/dashboard'),
        api.get('/finance/invoices'),
        api.get('/admin/students'),
      ]);
      setDashboard(dashRes.data);
      setInvoices(invRes.data);
      setStudents(studRes.data);
    } catch { toast.error('Failed to load finance data'); }
    setLoading(false);
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/invoices', invoiceForm);
      toast.success('Invoice created');
      setInvoiceDialog(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/payments', paymentForm);
      toast.success('Payment recorded');
      setPaymentDialog(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <AppLoader />;

  const chartData = [
    { name: 'Invoiced', amount: dashboard?.total_invoiced || 0 },
    { name: 'Collected', amount: dashboard?.total_collected || 0 },
    { name: 'Outstanding', amount: dashboard?.total_outstanding || 0 },
  ];

  return (
    <div className="space-y-6" data-testid="finance-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Finance Dashboard</h1>
          <p className="text-slate-500 mt-1">Fee collection and payment tracking</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-md bg-[#2E6CC4] hover:bg-[#2E6CC4]" data-testid="create-invoice-btn"><Plus className="w-4 h-4 mr-2" /> Invoice</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={invoiceForm.student_id} onValueChange={v => setInvoiceForm({...invoiceForm, student_id: v})}>
                    <SelectTrigger data-testid="invoice-student-select"><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Term</Label>
                    <Input value={invoiceForm.term} onChange={e => setInvoiceForm({...invoiceForm, term: e.target.value})} data-testid="invoice-term-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm({...invoiceForm, due_date: e.target.value})} data-testid="invoice-due-date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount (GHS)</Label>
                  <Input type="number" value={invoiceForm.items[0].amount} onChange={e => setInvoiceForm({...invoiceForm, items: [{ description: 'Tuition Fee', amount: parseFloat(e.target.value) || 0 }]})} data-testid="invoice-amount-input" />
                </div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-invoice-btn">Create Invoice</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-md" data-testid="record-payment-btn"><Receipt className="w-4 h-4 mr-2" /> Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice</Label>
                  <Select value={paymentForm.invoice_id} onValueChange={v => setPaymentForm({...paymentForm, invoice_id: v})}>
                    <SelectTrigger data-testid="payment-invoice-select"><SelectValue placeholder="Select invoice" /></SelectTrigger>
                    <SelectContent>{invoices.filter(i => i.status !== 'paid').map(i => <SelectItem key={i.invoice_id} value={i.invoice_id}>{i.student_name} - TT$ {i.balance}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})} data-testid="payment-amount-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={paymentForm.method} onValueChange={v => setPaymentForm({...paymentForm, method: v})}>
                      <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="momo">Mobile Money</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} data-testid="payment-ref-input" />
                </div>
                <Button type="submit" className="w-full rounded-md bg-[#19C37D] hover:bg-[#C5A55A]" data-testid="submit-payment-btn">Record Payment</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#2E6CC4]" /></div>
            <span className="text-sm text-slate-500">Total Invoiced</span>
          </div>
          <p className="text-2xl font-bold text-[#1B2A4A]" data-testid="total-invoiced">TT$ {(dashboard?.total_invoiced || 0).toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#19C37D]" /></div>
            <span className="text-sm text-slate-500">Collected</span>
          </div>
          <p className="text-2xl font-bold text-[#19C37D]" data-testid="total-collected">TT$ {(dashboard?.total_collected || 0).toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-md bg-red-50 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div>
            <span className="text-sm text-slate-500">Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-red-500" data-testid="total-outstanding">TT$ {(dashboard?.total_outstanding || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Chart */}
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="amount" fill="#2E6CC4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Invoices table */}
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-50">Student</TableHead>
                <TableHead className="bg-slate-50">Term</TableHead>
                <TableHead className="bg-slate-50">Total</TableHead>
                <TableHead className="bg-slate-50">Paid</TableHead>
                <TableHead className="bg-slate-50">Balance</TableHead>
                <TableHead className="bg-slate-50">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.slice(0, 10).map(inv => (
                <TableRow key={inv.invoice_id} data-testid={`invoice-row-${inv.invoice_id}`}>
                  <TableCell className="font-medium">{inv.student_name}</TableCell>
                  <TableCell className="text-slate-500">{inv.term}</TableCell>
                  <TableCell>TT$ {inv.total?.toLocaleString()}</TableCell>
                  <TableCell className="text-[#19C37D]">TT$ {inv.paid?.toLocaleString()}</TableCell>
                  <TableCell className="text-red-500">TT$ {inv.balance?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={inv.status === 'paid' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : inv.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
