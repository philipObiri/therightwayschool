import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  DollarSign, TrendingUp, AlertCircle, Plus, Receipt, FileText,
  CreditCard, Users, ArrowRight, CheckCircle, Clock, Search,
  Link2, Upload, Download, BarChart3, Eye, ArrowLeft, User, Trash2, Edit
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { ExpensesTab } from './finance/ExpensesTab';
import { BudgetsTab } from './finance/BudgetsTab';
import { ProcurementTab } from './finance/ProcurementTab';
import { VendorsTab } from './finance/VendorsTab';
import { PettyCashTab } from './finance/PettyCashTab';
import { ReceiptsTab } from './finance/ReceiptsTab';
import { AuditLogTab } from './finance/AuditLogTab';
import { PayrollTab } from './finance/PayrollTab';
import { ReportsTab } from './finance/ReportsTab';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

const statusColors = {
  draft: 'bg-slate-100 text-slate-600', issued: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700', paid: 'bg-[#C5A55A]/15 text-[#C5A55A]',
  overdue: 'bg-red-100 text-red-700', cancelled: 'bg-slate-200 text-slate-500',
  unmatched: 'bg-orange-100 text-orange-700', matched: 'bg-blue-100 text-blue-700',
  allocated: 'bg-[#C5A55A]/15 text-[#C5A55A]', reversed: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700', approved: 'bg-blue-100 text-blue-700',
  applied: 'bg-[#C5A55A]/15 text-[#C5A55A]',
};
const COLORS = ['#2E6CC4', '#C5A55A', '#F59E0B', '#DC2626', '#8B5CF6'];

export default function FinanceModule() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const canEdit = ['SuperAdmin', 'FinanceOfficer', 'CEO', 'Founder', 'Admin', 'Accounts'].includes(user?.role);
  // Read tab from URL query params (e.g. ?tab=payments)
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState(urlTab || 'overview');
  const [dashboard, setDashboard] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [credits, setCredits] = useState([]);
  const [students, setStudents] = useState([]);
  const [arrears, setArrears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extendedStats, setExtendedStats] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);

  const initialLoadDone = React.useRef(false);
  const fetchData = async () => {
    if (!initialLoadDone.current) setLoading(true);
    try {
      const [dashRes, invRes, payRes, studRes] = await Promise.all([
        api.get('/finance/dashboard'),
        api.get('/finance/invoices'),
        api.get('/finance/payments'),
        api.get('/admin/students'),
      ]);
      setDashboard(dashRes.data);
      setInvoices(invRes.data);
      setPayments(payRes.data);
      setStudents(studRes.data);
    } catch (err) { console.error("Error:", err); }
    try { const r = await api.get('/finance/dashboard/extended'); setExtendedStats(r.data); } catch (err) { console.error("Error:", err); }
    setLoading(false);
    initialLoadDone.current = true;
  };

  useEffect(() => { fetchData(); }, [activeTerm]);

  const loadArrears = async () => {
    try { const r = await api.get('/finance/reports/arrears-ageing'); setArrears(r.data); } catch (err) { console.error("Error:", err); }
  };
  const loadCredits = async () => {
    try { const r = await api.get('/finance/credit-notes'); setCredits(r.data); } catch (err) { console.error("Error:", err); }
  };

  if (loading) return <AppLoader />;

  const handleResetAll = async () => {
    if (resetConfirm !== 'RESET') { toast.error('Type RESET to confirm'); return; }
    setResetting(true);
    try {
      const r = await api.post('/finance/reset-all', { confirm: 'RESET' });
      successToast(r.data.message || 'All billing data cleared');
      setShowReset(false); setResetConfirm('');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Reset failed'); }
    setResetting(false);
  };

  return (
    <div className="space-y-6" data-testid="finance-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1B2A4A]">Finance & Accounting</h1>
          <p className="text-slate-500 mt-1 text-xs md:text-base">Student billing, payments, and reconciliation</p>
        </div>
        {canEdit && (
          <Button variant="outline" className="text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-md" onClick={() => setShowReset(true)} data-testid="reset-billing-btn">
            <Trash2 className="w-3 h-3 mr-1" /> Reset All Billing
          </Button>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showReset} onOpenChange={v => { setShowReset(v); if (!v) setResetConfirm(''); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Reset All Student Fee Records</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-medium">This will permanently delete:</p>
              <ul className="text-xs text-red-600 mt-1 space-y-0.5 list-disc pl-4">
                <li>All invoices and line items</li>
                <li>All payment records</li>
                <li>All allocations and credit notes</li>
                <li>All student balances reset to TT$ 0</li>
              </ul>
            </div>
            <div>
              <Label className="text-xs">Type <span className="font-bold text-red-600">RESET</span> to confirm</Label>
              <Input value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} className="h-9 text-xs mt-1" placeholder="Type RESET" data-testid="reset-confirm-input" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs rounded-md" onClick={() => { setShowReset(false); setResetConfirm(''); }}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-xs rounded-md" onClick={handleResetAll} disabled={resetting || resetConfirm !== 'RESET'} data-testid="reset-confirm-btn">
                {resetting ? 'Clearing...' : 'Clear All Records'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Banner */}
      <div className="relative rounded-md overflow-hidden h-24 md:h-28">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] via-[#2E6CC4] to-[#C5A55A]" />
        <div className="absolute inset-0 flex items-center justify-between px-4 md:px-6">
          <div><p className="text-base md:text-lg font-bold text-white">Financial Management</p><p className="text-[10px] md:text-xs text-white/70">Invoicing, payments, allocations & reporting</p></div>
          <a href={`${BACKEND}/api/finance/report/whole-school-pdf?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noopener noreferrer">
            <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-md text-xs" data-testid="download-finance-report">
              <Download className="w-4 h-4 mr-1 md:mr-2" /><span className="hidden sm:inline">Download Finance Report</span><span className="sm:hidden">Report</span>
            </Button>
          </a>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'arrears') loadArrears(); if (v === 'credits') loadCredits(); }} data-testid="finance-tabs">
        <TabsList className="bg-white border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs" data-testid="tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="budgets" className="text-xs" data-testid="tab-budgets">Budgets</TabsTrigger>
          <TabsTrigger value="procurement" className="text-xs" data-testid="tab-procurement">Procurement</TabsTrigger>
          <TabsTrigger value="vendors" className="text-xs" data-testid="tab-vendors">Vendors</TabsTrigger>
          <TabsTrigger value="pettycash" className="text-xs" data-testid="tab-pettycash">Petty Cash</TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs" data-testid="tab-payroll">Payroll</TabsTrigger>
          <TabsTrigger value="receipts" className="text-xs" data-testid="tab-receipts">Receipts</TabsTrigger>
          <TabsTrigger value="allocations" className="text-xs" data-testid="tab-allocations">Allocations</TabsTrigger>
          <TabsTrigger value="arrears" className="text-xs" data-testid="tab-arrears">Arrears</TabsTrigger>
          <TabsTrigger value="credits" className="text-xs" data-testid="tab-credits">Credits</TabsTrigger>
          <TabsTrigger value="billing" className="text-xs" data-testid="tab-billing">Student Billing</TabsTrigger>
          <TabsTrigger value="assign" className="text-xs" data-testid="tab-assign">Assign Fees</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs" data-testid="tab-templates">Fee Templates</TabsTrigger>
          <TabsTrigger value="termbilling" className="text-xs" data-testid="tab-termbilling">Term Billing</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs" data-testid="tab-audit">Audit Log</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs" data-testid="tab-reports">Reports</TabsTrigger>
          <TabsTrigger value="reconciliation" className="text-xs" data-testid="tab-reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <OverviewTab dashboard={dashboard} invoices={invoices} extendedStats={extendedStats} />
        </TabsContent>

        {/* INVOICES TAB */}
        <TabsContent value="invoices" className="mt-4 space-y-4">
          <InvoicesTab invoices={invoices} students={students} onRefresh={fetchData} user={user} />
        </TabsContent>

        {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <PaymentsTab payments={payments} students={students} onRefresh={fetchData} user={user} />
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>

        {/* BUDGETS TAB */}
        <TabsContent value="budgets" className="mt-4">
          <BudgetsTab />
        </TabsContent>

        {/* PROCUREMENT TAB */}
        <TabsContent value="procurement" className="mt-4">
          <ProcurementTab />
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="mt-4">
          <VendorsTab />
        </TabsContent>

        {/* PETTY CASH TAB */}
        <TabsContent value="pettycash" className="mt-4">
          <PettyCashTab />
        </TabsContent>

        {/* PAYROLL TAB */}
        <TabsContent value="payroll" className="mt-4">
          <PayrollTab />
        </TabsContent>

        {/* RECEIPTS TAB */}
        <TabsContent value="receipts" className="mt-4">
          <ReceiptsTab />
        </TabsContent>

        {/* ALLOCATION WORKBENCH */}
        <TabsContent value="allocations" className="mt-4 space-y-4">
          <AllocationWorkbench payments={payments} invoices={invoices} students={students} onRefresh={fetchData} user={user} />
        </TabsContent>

        {/* ARREARS */}
        <TabsContent value="arrears" className="mt-4 space-y-4">
          <ArrearsTab arrears={arrears} />
        </TabsContent>

        {/* CREDITS */}
        <TabsContent value="credits" className="mt-4 space-y-4">
          <CreditsTab credits={credits} students={students} onRefresh={() => { loadCredits(); fetchData(); }} user={user} />
        </TabsContent>

        {/* STUDENT BILLING */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <StudentBillingTab />
        </TabsContent>

        {/* ASSIGN FEES */}
        <TabsContent value="assign" className="mt-4 space-y-4">
          <AssignFeesTab onRefresh={fetchData} />
        </TabsContent>

        {/* FEE TEMPLATES */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <FeeTemplatesTab />
        </TabsContent>

        {/* TERM BILLING */}
        <TabsContent value="termbilling" className="mt-4 space-y-4">
          <TermBillingTab />
        </TabsContent>

        {/* AUDIT LOG */}
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <ReportsTab />
        </TabsContent>

        {/* RECONCILIATION */}
        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <ReconciliationTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ dashboard, invoices, extendedStats }) {
  const [drilldown, setDrilldown] = useState(null);
  const [drillRows, setDrillRows] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const openDrilldown = async (filterType, label) => {
    setDrilldown(label);
    setDrillLoading(true);
    try {
      const res = await api.get('/finance/overview-drilldown', { params: { filter_type: filterType } });
      setDrillRows(res.data.students || []);
    } catch { toast.error('Failed to load details'); }
    setDrillLoading(false);
  };

  if (!dashboard) return null;
  const pieData = Object.entries(dashboard.invoice_counts || {}).map(([k, v]) => ({ name: k, value: v }));
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger-children">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all" onClick={() => openDrilldown('invoiced', 'Total Invoiced')} data-testid="card-invoiced"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><DollarSign className="w-4 h-4 md:w-5 md:h-5 text-[#2E6CC4]" /></div><p className="text-lg md:text-2xl font-bold" data-testid="total-invoiced">TT$ {(dashboard.total_invoiced || 0).toLocaleString()}</p><p className="text-xs md:text-sm text-slate-500">Total Invoiced</p></div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-[#C5A55A]/30 transition-all" onClick={() => openDrilldown('collected', 'Collected')} data-testid="card-collected"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-[#C5A55A]" /></div><p className="text-lg md:text-2xl font-bold text-[#C5A55A]" data-testid="total-collected">TT$ {(dashboard.total_collected || 0).toLocaleString()}</p><p className="text-xs md:text-sm text-slate-500">Collected</p></div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-red-200 transition-all" onClick={() => openDrilldown('outstanding', 'Outstanding')} data-testid="card-outstanding"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-red-50 flex items-center justify-center mb-2"><AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-[#DC2626]" /></div><p className="text-lg md:text-2xl font-bold text-[#DC2626]" data-testid="total-outstanding">TT$ {(dashboard.total_outstanding || 0).toLocaleString()}</p><p className="text-xs md:text-sm text-slate-500">Outstanding</p></div>
        <div className="stat-card"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-amber-50 flex items-center justify-center mb-2"><Receipt className="w-4 h-4 md:w-5 md:h-5 text-[#F59E0B]" /></div><p className="text-lg md:text-2xl font-bold">{dashboard.collection_rate || 0}%</p><p className="text-xs md:text-sm text-slate-500">Collection Rate</p></div>
      </div>

      {/* Drilldown Panel */}
      {drilldown && (
        <Card className="rounded-md border-slate-100" data-testid="drilldown-panel">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">{drilldown} — {drillRows.length} students</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDrilldown(null)}>Close</Button>
          </CardHeader>
          <CardContent className="p-0">
            {drillLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
              <div className="max-h-[400px] overflow-auto">
                <Table className="min-w-[550px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-[10px]">#</TableHead>
                      <TableHead className="text-[10px]">Student Name</TableHead>
                      <TableHead className="text-[10px]">Year Group</TableHead>
                      <TableHead className="text-[10px] text-right">Total Due (GHS)</TableHead>
                      <TableHead className="text-[10px] text-right">Total Paid (GHS)</TableHead>
                      <TableHead className="text-[10px] text-right">Balance (GHS)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRows.map((r, i) => (
                      <TableRow key={r.student_id} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                        <TableCell className="text-[10px] text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{r.name}</TableCell>
                        <TableCell className="text-[10px] text-slate-500">{r.year_group}</TableCell>
                        <TableCell className="text-xs text-right">{(r.total_due || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                        <TableCell className="text-xs text-right text-[#C5A55A]">{(r.total_paid || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                        <TableCell className={`text-xs text-right font-semibold ${r.balance > 0 ? 'text-red-600' : 'text-[#C5A55A]'}`}>{(r.balance || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                      </TableRow>
                    ))}
                    {drillRows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-slate-400 text-sm">No records</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extended Operations Stats */}
      {extendedStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-100 rounded-md p-3"><p className="text-xs text-slate-500">Expenses (Month)</p><p className="text-lg font-bold text-[#1B2A4A]">TT$ {(extendedStats.total_expenses_month || 0).toLocaleString()}</p></div>
          <div className="bg-white border border-slate-100 rounded-md p-3"><p className="text-xs text-slate-500">Pending Approvals</p><p className="text-lg font-bold text-amber-600">{extendedStats.pending_approvals || 0}</p></div>
          <div className="bg-white border border-slate-100 rounded-md p-3"><p className="text-xs text-slate-500">Petty Cash</p><p className="text-lg font-bold text-[#2E6CC4]">TT$ {(extendedStats.petty_cash_balance || 0).toLocaleString()}</p></div>
          <div className="bg-white border border-slate-100 rounded-md p-3"><p className="text-xs text-slate-500">Vendors</p><p className="text-lg font-bold">{extendedStats.vendor_count || 0}</p></div>
          <div className="bg-white border border-slate-100 rounded-md p-3"><p className="text-xs text-slate-500">Receipts Today</p><p className="text-lg font-bold text-[#C5A55A]">{extendedStats.receipts_today || 0} (TT$ {(extendedStats.receipts_total_today || 0).toLocaleString()})</p></div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-base">Invoice Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>{pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(dashboard.recent_payments || []).slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div><p className="text-sm font-medium">{p.student_name || p.payer_name}</p><p className="text-xs text-slate-400">{p.method} | {new Date(p.created_at || p.received_at).toLocaleDateString()}</p></div>
                  <span className="text-sm font-semibold text-[#C5A55A]">TT$ {p.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense by Category (from extended stats) */}
      {extendedStats?.expense_by_category?.length > 0 && (
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-base">Monthly Expense Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={extendedStats.expense_by_category.map(c => ({ name: c._id || 'Other', total: c.total }))}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `TT$ ${v.toLocaleString()}`} />
                <Bar dataKey="total" fill="#2E6CC4" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function InvoicesTab({ invoices, students, onRefresh, user }) {
  const canEdit = ['SuperAdmin', 'FinanceOfficer', 'CEO', 'Founder', 'Admin', 'Accounts'].includes(user?.role);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ student_id: '', term: 'Term 1', academic_year: '2025-2026', due_at: '', items: [{ name: 'Tuition Fee', code: 'TUI', category: 'tuition', amount: 3500 }] });
  const [editInvoice, setEditInvoice] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/invoices', form);
      successToast('Invoice created');
      setDialog(false);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', code: '', category: 'other', amount: 0 }] });
  const updateItem = (idx, field, val) => { const items = [...form.items]; items[idx][field] = field === 'amount' ? parseFloat(val) || 0 : val; setForm({ ...form, items }); };
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const openEditInvoice = (inv) => {
    setEditInvoice(inv);
    setEditForm({
      status: inv.status || 'issued',
      due_at: inv.due_at ? inv.due_at.split('T')[0] : '',
      notes: inv.notes || '',
      discount_total: inv.discount_total || 0,
      penalty_total: inv.penalty_total || 0,
    });
  };

  const saveEditInvoice = async () => {
    try {
      await api.patch(`/finance/invoices/${editInvoice.invoice_id}`, editForm);
      successToast('Invoice updated');
      setEditInvoice(null);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed'); }
  };

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number || inv.invoice_id.slice(0,10)}? This will reverse all allocations.`)) return;
    try {
      await api.delete(`/finance/invoices/${inv.invoice_id}`);
      successToast('Invoice deleted');
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{invoices.length} invoices</p>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>{canEdit && <Button className="rounded-md bg-[#2E6CC4]" data-testid="create-invoice-btn"><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>}</DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Student</Label>
                <SearchableSelect
                  options={students.map(s => ({ value: s.user_id, label: `${s.name} (${s.year_group})` }))}
                  value={form.student_id}
                  onValueChange={v => setForm({...form, student_id: v})}
                  placeholder="Search student..."
                  className="w-full h-10"
                  data-testid="inv-student"
                /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Term</Label><Input value={form.term} onChange={e => setForm({...form, term: e.target.value})} data-testid="inv-term" /></div>
                <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_at} onChange={e => setForm({...form, due_at: e.target.value})} data-testid="inv-due" /></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Fee Items</Label><Button type="button" variant="ghost" size="sm" onClick={addItem} className="text-xs text-[#2E6CC4]">+ Add Item</Button></div>
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5"><Input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Fee name" className="text-xs h-8" /></div>
                    <div className="col-span-3">
                      <Select value={item.category} onValueChange={v => updateItem(i, 'category', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{['tuition','boarding','transport','exam','books','other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div className="col-span-3"><Input type="number" value={item.amount} onChange={e => updateItem(i, 'amount', e.target.value)} className="text-xs h-8" /></div>
                    <div className="col-span-1">{form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-400 text-xs">x</button>}</div>
                  </div>
                ))}
                <p className="text-right text-sm font-semibold">Total: TT$ {form.items.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString()}</p>
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-invoice">Create Invoice</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">Invoice #</TableHead><TableHead className="bg-slate-50">Student</TableHead>
            <TableHead className="bg-slate-50">Term</TableHead><TableHead className="bg-slate-50">Total</TableHead>
            <TableHead className="bg-slate-50">Paid</TableHead><TableHead className="bg-slate-50">Balance</TableHead>
            <TableHead className="bg-slate-50">Status</TableHead>
            {canEdit && <TableHead className="bg-slate-50">Actions</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {invoices.map(inv => (
              <TableRow key={inv.invoice_id} data-testid={`inv-row-${inv.invoice_id}`}>
                <TableCell className="text-xs font-mono">{inv.invoice_number || inv.invoice_id.slice(0,10)}</TableCell>
                <TableCell className="font-medium text-sm">{inv.student_name}</TableCell>
                <TableCell className="text-sm text-slate-500">{inv.term}</TableCell>
                <TableCell className="text-sm">TT$ {(inv.total_due || inv.total || 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-[#C5A55A]">TT$ {(inv.amount_paid || inv.paid || 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-[#DC2626]">TT$ {((inv.total_due || inv.total || 0) - (inv.amount_paid || inv.paid || 0)).toLocaleString()}</TableCell>
                <TableCell><Badge className={statusColors[inv.status] || 'bg-slate-100'}>{inv.status}</Badge></TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => openEditInvoice(inv)} data-testid={`edit-inv-${inv.invoice_id}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteInvoice(inv)} data-testid={`delete-inv-${inv.invoice_id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Invoice Dialog */}
      <Dialog open={!!editInvoice} onOpenChange={() => setEditInvoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Invoice: {editInvoice?.invoice_number || editInvoice?.invoice_id?.slice(0,10)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-md p-3 text-sm">
              <p><strong>{editInvoice?.student_name}</strong> &middot; {editInvoice?.term}</p>
              <p className="text-xs text-slate-500 mt-1">Total: TT$ {(editInvoice?.total_due || 0).toLocaleString()} &middot; Paid: TT$ {(editInvoice?.amount_paid || 0).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30" data-testid="edit-inv-status">
                {['draft','issued','partial','paid','overdue','cancelled','void'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={editForm.due_at} onChange={e => setEditForm({...editForm, due_at: e.target.value})} data-testid="edit-inv-due" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount (GHS)</Label>
                <Input type="number" value={editForm.discount_total} onChange={e => setEditForm({...editForm, discount_total: parseFloat(e.target.value) || 0})} data-testid="edit-inv-discount" />
              </div>
              <div className="space-y-2">
                <Label>Penalty (GHS)</Label>
                <Input type="number" value={editForm.penalty_total} onChange={e => setEditForm({...editForm, penalty_total: parseFloat(e.target.value) || 0})} data-testid="edit-inv-penalty" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2} placeholder="Invoice notes..." data-testid="edit-inv-notes" />
            </div>
            <Button onClick={saveEditInvoice} className="w-full rounded-md bg-[#2E6CC4]" data-testid="save-edit-inv-btn">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentsTab({ payments, students, onRefresh, user }) {
  const canEdit = ['SuperAdmin', 'FinanceOfficer', 'CEO', 'Founder', 'Admin', 'Accounts'].includes(user?.role);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ student_id: '', amount: 0, method: 'cash', bank: '', reference: '', payer_name: '', payment_date: new Date().toISOString().split('T')[0] });
  const [proofFiles, setProofFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [evidenceDialog, setEvidenceDialog] = useState(null);
  const [attachingEvidence, setAttachingEvidence] = useState(null);
  const [requestingEvidence, setRequestingEvidence] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [editPayment, setEditPayment] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleDeletePayment = async (p, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete payment of TT$ ${p.amount?.toLocaleString()} (${p.receipt_number || p.payment_id.slice(0,10)})? This will reverse all allocations.`)) return;
    try {
      await api.delete(`/finance/payments/${p.payment_id}`);
      successToast('Payment deleted');
      onRefresh();
    } catch (e2) { toast.error(e2.response?.data?.detail || 'Delete failed'); }
  };

  const openEditPayment = (p) => {
    setEditPayment(p);
    setEditForm({
      amount: p.amount || 0,
      method: p.method || 'cash',
      bank: p.bank || '',
      reference: p.reference || '',
      receipt_number: p.receipt_number || '',
      payer_name: p.payer_name || p.student_name || '',
      payment_date: p.payment_date || (p.received_at || p.created_at || '').split('T')[0],
      notes: p.notes || '',
    });
  };

  const saveEditPayment = async () => {
    try {
      await api.put(`/finance/payments/${editPayment.payment_id}`, editForm);
      successToast('Payment updated');
      setEditPayment(null);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed'); }
  };

  const handleRecord = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let proof_file_id = '';
      const evidence_file_ids = [];
      for (const file of proofFiles) {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        evidence_file_ids.push(uploadRes.data.file_id);
      }
      if (evidence_file_ids.length > 0) proof_file_id = evidence_file_ids[0];
      await api.post('/finance/payments', { ...form, proof_file_id, evidence_file_ids });
      successToast('Payment recorded');
      setDialog(false);
      setForm({ student_id: '', amount: 0, method: 'cash', bank: '', reference: '', payer_name: '', payment_date: new Date().toISOString().split('T')[0] });
      setProofFiles([]);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setUploading(false);
  };

  const viewEvidence = async (paymentId) => {
    try {
      const res = await api.get(`/finance/payments/${paymentId}/evidence`);
      setEvidenceDialog(res.data);
    } catch { toast.error('Failed to load evidence'); }
  };

  const handleAttachEvidence = async (paymentId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      setAttachingEvidence(paymentId);
      try {
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          await api.post(`/finance/payments/${paymentId}/attach-evidence`, { file_id: uploadRes.data.file_id });
        }
        successToast(`${files.length} evidence file(s) attached`);
        onRefresh();
      } catch (err) { toast.error('Upload failed'); }
      setAttachingEvidence(null);
    };
    input.click();
  };

  const handleRequestEvidence = async (paymentId) => {
    try {
      await api.post(`/finance/payments/${paymentId}/request-evidence`, { reason: requestReason || 'Payment evidence required' });
      successToast('Evidence request sent to finance team');
      setRequestingEvidence(null);
      setRequestReason('');
      onRefresh();
    } catch (err) { toast.error('Failed to request'); }
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{payments.length} payments | {payments.filter(p => p.status === 'unmatched').length} unmatched</p>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>{canEdit && <Button className="rounded-md bg-[#C5A55A] hover:bg-[#b8963e]" data-testid="record-payment-btn"><Plus className="w-4 h-4 mr-2" /> Record Payment</Button>}</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <form onSubmit={handleRecord} className="space-y-4">
              <div className="space-y-2"><Label>Student (optional for unmatched)</Label>
                <SearchableSelect
                  options={students.map(s => ({ value: s.user_id, label: s.name }))}
                  value={form.student_id}
                  onValueChange={v => setForm({...form, student_id: v})}
                  placeholder="Search student..."
                  className="w-full h-10"
                  data-testid="pay-student"
                /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Amount (GHS)</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} required data-testid="pay-amount" /></div>
                <div className="space-y-2"><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} data-testid="pay-date" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Method</Label>
                  <SearchableSelect
                    options={[{value:'cash',label:'Cash'},{value:'bank_transfer',label:'Bank Transfer'},{value:'momo',label:'Mobile Money'},{value:'card',label:'Card'},{value:'cheque',label:'Cheque'}]}
                    value={form.method}
                    onValueChange={v => setForm({...form, method: v})}
                    placeholder="Select method"
                    className="w-full h-10"
                    data-testid="pay-method"
                  /></div>
                <div className="space-y-2"><Label>Bank</Label>
                  <SearchableSelect
                    options={[{value:'',label:'N/A'},{value:'GT Bank',label:'GT Bank'},{value:'Stanbic Bank',label:'Stanbic Bank'},{value:'Zenith Bank',label:'Zenith Bank'}]}
                    value={form.bank}
                    onValueChange={v => setForm({...form, bank: v})}
                    placeholder="Select bank"
                    className="w-full h-10"
                    data-testid="pay-bank"
                  /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} data-testid="pay-ref" /></div>
                <div className="space-y-2"><Label>Payer Name</Label><Input value={form.payer_name} onChange={e => setForm({...form, payer_name: e.target.value})} data-testid="pay-payer" /></div>
              </div>
              <div className="space-y-2">
                <Label>Payment Evidence (bank slips, MoMo screenshots, receipts — multiple allowed)</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center cursor-pointer hover:border-[#2E6CC4] transition-colors" onClick={() => document.getElementById('proof-upload-main').click()}>
                  <input id="proof-upload-main" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={e => setProofFiles(prev => [...prev, ...Array.from(e.target.files)])} data-testid="proof-file-input" />
                  <div className="text-slate-400"><Upload className="w-5 h-5 mx-auto mb-1" /><p className="text-xs">Click to upload evidence (select multiple)</p></div>
                </div>
                {proofFiles.length > 0 && (
                  <div className="space-y-1">
                    {proofFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-md px-3 py-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#2E6CC4]" />
                        <span className="truncate flex-1 text-xs font-medium">{f.name}</span>
                        <span className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                        <button type="button" className="text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); setProofFiles(prev => prev.filter((_, j) => j !== i)); }}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400">{proofFiles.length} file(s) selected</p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#C5A55A]" disabled={uploading} data-testid="submit-payment">{uploading ? 'Uploading...' : 'Record Payment'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Student/Payer</TableHead>
            <TableHead className="bg-slate-50">Amount</TableHead><TableHead className="bg-slate-50">Method</TableHead>
            <TableHead className="bg-slate-50">Reference</TableHead><TableHead className="bg-slate-50">Receipt #</TableHead><TableHead className="bg-slate-50">Evidence</TableHead>
            <TableHead className="bg-slate-50">Status</TableHead>
            <TableHead className="bg-slate-50">Unallocated</TableHead>
            {canEdit && <TableHead className="bg-slate-50">Actions</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.payment_id} data-testid={`pay-row-${p.payment_id}`}>
                <TableCell className="text-xs text-slate-500">{new Date(p.received_at || p.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium text-sm">{p.student_name || p.payer_name || '-'}</TableCell>
                <TableCell className="text-sm font-semibold">TT$ {p.amount?.toLocaleString()}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{p.method}</Badge></TableCell>
                <TableCell className="text-xs text-slate-500">{p.reference || '-'}</TableCell>
                <TableCell className="text-xs text-slate-500">{p.receipt_number || '-'}</TableCell>
                <TableCell>
                  {p.proof_file_id || p.evidence_files?.length > 0 ? (
                    <div className="flex gap-1 items-center">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-[#2E6CC4] bg-blue-50 px-2" onClick={() => viewEvidence(p.payment_id)} data-testid={`view-evidence-${p.payment_id}`}>
                        <Eye className="w-3 h-3 mr-1" />View ({p.evidence_files?.length || 1})
                      </Button>
                      {canEdit && <Button variant="ghost" size="sm" className="h-7 text-xs text-[#C5A55A] bg-[#C5A55A]/10 px-2" onClick={() => handleAttachEvidence(p.payment_id)} disabled={attachingEvidence === p.payment_id} data-testid={`add-evidence-${p.payment_id}`}>
                        <Upload className="w-3 h-3 mr-1" />{attachingEvidence === p.payment_id ? '...' : '+'}
                      </Button>}
                    </div>
                  ) : (
                    <div className="flex gap-1 items-center">
                      {p.evidence_status === 'requested' ? (
                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">Requested</Badge>
                      ) : (
                        <span className="text-[10px] text-slate-300">No evidence</span>
                      )}
                      {canEdit && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-[#2E6CC4]" onClick={() => handleAttachEvidence(p.payment_id)} disabled={attachingEvidence === p.payment_id} data-testid={`attach-evidence-${p.payment_id}`}>
                        <Upload className="w-3 h-3 mr-0.5" />{attachingEvidence === p.payment_id ? '...' : 'Attach'}
                      </Button>}
                      {!canEdit && !p.proof_file_id && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-amber-600" onClick={() => setRequestingEvidence(p.payment_id)} data-testid={`request-evidence-${p.payment_id}`}>
                        <AlertCircle className="w-3 h-3 mr-0.5" />Request
                      </Button>}
                    </div>
                  )}
                </TableCell>
                <TableCell><Badge className={statusColors[p.status] || 'bg-slate-100'}>{p.status}</Badge></TableCell>
                <TableCell className="text-sm">{p.unallocated_amount != null ? `TT$ ${p.unallocated_amount.toLocaleString()}` : '-'}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); openEditPayment(p); }} data-testid={`edit-pay-${p.payment_id}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => handleDeletePayment(p, e)} data-testid={`delete-pay-${p.payment_id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Evidence Viewer Dialog */}
      <Dialog open={!!evidenceDialog} onOpenChange={v => { if (!v) setEvidenceDialog(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg">Payment Evidence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {evidenceDialog?.evidence_status === 'requested' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">Evidence requested by <strong>{evidenceDialog.evidence_requested_by_name}</strong></p>
                {evidenceDialog.evidence_request_reason && <p className="text-xs text-amber-600 mt-1">Reason: {evidenceDialog.evidence_request_reason}</p>}
              </div>
            )}
            {(evidenceDialog?.evidence_files || []).length > 0 ? (
              <div className="space-y-4">
                {(evidenceDialog?.evidence_files || []).map((ef, i) => {
                  const token = localStorage.getItem('rw_token');
                  const previewUrl = `${BACKEND}/api/files/${ef.file_id}/preview?token=${token}`;
                  const downloadUrl = `${BACKEND}/api/files/${ef.file_id}/download?token=${token}`;
                  const isImage = (ef.content_type || ef.filename || '').match(/image|png|jpg|jpeg|gif|webp/i);
                  const isPdf = (ef.content_type || ef.filename || '').match(/pdf/i);
                  return (
                    <div key={i} className="border rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-[#2E6CC4]" /></div>
                          <div>
                            <p className="text-sm font-semibold">{ef.filename || 'Evidence file'}</p>
                            <p className="text-xs text-slate-400">{ef.attached_by_name ? `By ${ef.attached_by_name}` : ''} {ef.attached_at ? `— ${new Date(ef.attached_at).toLocaleString()}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a href={downloadUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="h-8 text-xs text-[#C5A55A]" data-testid={`evidence-dl-${i}`}><Download className="w-3 h-3 mr-1" />Download</Button></a>
                        </div>
                      </div>
                      {/* Inline preview */}
                      <div className="p-2 bg-white">
                        {isImage ? (
                          <img src={previewUrl} alt="Evidence" className="w-full max-h-[500px] object-contain rounded-lg" />
                        ) : isPdf ? (
                          <object data={previewUrl} type="application/pdf" className="w-full h-[500px] rounded-lg border">
                            <iframe src={previewUrl} className="w-full h-[500px] rounded-lg border" title="Evidence PDF" />
                          </object>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                            <p className="text-sm">Preview not available — click Download</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">No evidence files attached</p>
              </div>
            )}
            {canEdit && <Button variant="outline" className="w-full" onClick={() => { const pid = evidenceDialog?.payment_id; setEvidenceDialog(null); handleAttachEvidence(pid); }} data-testid="add-more-evidence"><Upload className="w-4 h-4 mr-2" /> Add More Evidence</Button>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Evidence Dialog */}
      <Dialog open={!!requestingEvidence} onOpenChange={v => { if (!v) { setRequestingEvidence(null); setRequestReason(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Request Payment Evidence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">This will send a notification to the finance team to attach evidence for this payment.</p>
            <div className="space-y-2"><Label className="text-xs">Reason (optional)</Label><Input value={requestReason} onChange={e => setRequestReason(e.target.value)} placeholder="e.g. Need bank slip for audit" data-testid="request-evidence-reason" /></div>
            <Button className="w-full bg-amber-500 hover:bg-amber-600" onClick={() => handleRequestEvidence(requestingEvidence)} data-testid="confirm-request-evidence"><AlertCircle className="w-4 h-4 mr-2" /> Send Evidence Request</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editPayment} onOpenChange={v => { if (!v) setEditPayment(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <p className="text-xs text-slate-500">ID: {editPayment?.payment_id} &middot; Student: {editPayment?.student_name || editPayment?.payer_name || '-'}</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Amount (GHS)</Label><Input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({...p, amount: parseFloat(e.target.value) || 0}))} className="h-9" data-testid="edit-pay-amount" /></div>
              <div className="space-y-1"><Label className="text-xs">Payment Date</Label><Input type="date" value={editForm.payment_date} onChange={e => setEditForm(p => ({...p, payment_date: e.target.value}))} className="h-9" data-testid="edit-pay-date" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Method</Label>
                <SearchableSelect
                  options={[{value:'cash',label:'Cash'},{value:'bank_transfer',label:'Bank Transfer'},{value:'momo',label:'Mobile Money'},{value:'card',label:'Card'},{value:'cheque',label:'Cheque'}]}
                  value={editForm.method}
                  onValueChange={v => setEditForm(p => ({...p, method: v}))}
                  placeholder="Method"
                  className="h-9 text-xs w-full"
                  data-testid="edit-pay-method"
                /></div>
              <div className="space-y-1"><Label className="text-xs">Bank</Label>
                <SearchableSelect
                  options={[{value:'',label:'N/A'},{value:'GT Bank',label:'GT Bank'},{value:'Stanbic Bank',label:'Stanbic Bank'},{value:'Zenith Bank',label:'Zenith Bank'}]}
                  value={editForm.bank || ''}
                  onValueChange={v => setEditForm(p => ({...p, bank: v}))}
                  placeholder="Select bank"
                  className="h-9 text-xs w-full"
                  data-testid="edit-pay-bank"
                /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={editForm.reference} onChange={e => setEditForm(p => ({...p, reference: e.target.value}))} className="h-9" data-testid="edit-pay-ref" /></div>
              <div className="space-y-1"><Label className="text-xs">Receipt Number</Label><Input value={editForm.receipt_number} onChange={e => setEditForm(p => ({...p, receipt_number: e.target.value}))} className="h-9" data-testid="edit-pay-receipt" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Payer Name</Label><Input value={editForm.payer_name} onChange={e => setEditForm(p => ({...p, payer_name: e.target.value}))} className="h-9" data-testid="edit-pay-payer" /></div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Input value={editForm.notes} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} className="h-9" placeholder="Add notes..." data-testid="edit-pay-notes" /></div>
            <Button className="w-full rounded-md bg-[#2E6CC4] hover:bg-[#2560B0]" onClick={saveEditPayment} data-testid="save-edit-payment">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AllocationWorkbench({ payments, invoices, students, onRefresh, user }) {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [allocAmounts, setAllocAmounts] = useState({});
  const unmatchedPayments = payments.filter(p => p.status === 'unmatched' || (p.status === 'matched' && p.unallocated_amount > 0));
  const matchedUnallocated = payments.filter(p => p.status === 'matched' && p.unallocated_amount > 0);

  const handleMatchAndAllocate = async (paymentId) => {
    const allocs = Object.entries(allocAmounts).filter(([_, amt]) => amt > 0).map(([invId, amt]) => ({ invoice_id: invId, amount: parseFloat(amt), type: 'invoice_level' }));
    if (allocs.length === 0) { toast.error('Enter allocation amounts'); return; }
    try {
      await api.post(`/finance/payments/${paymentId}/allocate`, { allocations: allocs });
      successToast('Payment allocated');
      setSelectedPayment(null);
      setAllocAmounts({});
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAutoAllocate = async (paymentId) => {
    try {
      await api.post(`/finance/payments/${paymentId}/auto-allocate`);
      successToast('Auto-allocated');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleMatchStudent = async (paymentId, studentId) => {
    try {
      await api.post(`/finance/payments/${paymentId}/match-student`, { student_id: studentId });
      successToast('Matched to student');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-center gap-3">
        <Link2 className="w-5 h-5 text-amber-600" />
        <div><p className="text-sm font-medium text-amber-800">Payment Allocation Workbench</p>
        <p className="text-xs text-amber-600">{unmatchedPayments.length} unmatched payments | {matchedUnallocated.length} awaiting allocation</p></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Unmatched/Unallocated Payments */}
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-base">Payments to Allocate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...unmatchedPayments, ...matchedUnallocated].map(p => (
              <div key={p.payment_id} className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedPayment?.payment_id === p.payment_id ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`} onClick={() => setSelectedPayment(p)} data-testid={`alloc-pay-${p.payment_id}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">TT$ {(p.unallocated_amount || p.amount)?.toLocaleString()}</p>
                  <Badge className={statusColors[p.status]}>{p.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">{p.student_name || p.payer_name || 'Unknown'} | {p.method} | {p.reference || 'No ref'}</p>
                <div className="flex gap-2 mt-2">
                  {p.status === 'unmatched' && (
                    <SearchableSelect
                      options={students.map(s => ({ value: s.user_id, label: s.name }))}
                      value=""
                      onValueChange={v => handleMatchStudent(p.payment_id, v)}
                      placeholder="Match student"
                      className="h-7 text-xs w-44"
                    />
                  )}
                  {p.student_id && p.unallocated_amount > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleAutoAllocate(p.payment_id); }} data-testid={`auto-alloc-${p.payment_id}`}>Auto-Allocate</Button>
                  )}
                </div>
              </div>
            ))}
            {unmatchedPayments.length === 0 && matchedUnallocated.length === 0 && <p className="text-center text-slate-400 py-6 text-sm">All payments allocated</p>}
          </CardContent>
        </Card>

        {/* Allocation Panel */}
        <Card className="rounded-md border-slate-100">
          <CardHeader><CardTitle className="text-base">Allocate to Invoices</CardTitle></CardHeader>
          <CardContent>
            {selectedPayment && selectedPayment.student_id ? (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-md p-3">
                  <p className="text-sm font-medium">Allocating: <span className="text-[#2E6CC4]">TT$ {(selectedPayment.unallocated_amount || selectedPayment.amount)?.toLocaleString()}</span></p>
                  <p className="text-xs text-slate-500">For: {selectedPayment.student_name}</p>
                </div>
                {invoices.filter(i => i.student_id === selectedPayment.student_id && ['issued', 'partial', 'overdue'].includes(i.status)).map(inv => {
                  const outstanding = (inv.total_due || inv.total || 0) - (inv.amount_paid || inv.paid || 0);
                  return (
                    <div key={inv.invoice_id} className="flex items-center gap-3 p-2 border border-slate-100 rounded-md">
                      <div className="flex-1">
                        <p className="text-xs font-medium">{inv.invoice_number || inv.invoice_id.slice(0,10)} - {inv.term}</p>
                        <p className="text-xs text-slate-400">Outstanding: TT$ {outstanding.toLocaleString()}</p>
                      </div>
                      <Input type="number" className="w-28 h-8 text-xs" placeholder="Amount" value={allocAmounts[inv.invoice_id] || ''} onChange={e => setAllocAmounts({...allocAmounts, [inv.invoice_id]: e.target.value})} data-testid={`alloc-amt-${inv.invoice_id}`} />
                    </div>
                  );
                })}
                <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={() => handleMatchAndAllocate(selectedPayment.payment_id)} data-testid="confirm-allocation-btn">
                  <CheckCircle className="w-4 h-4 mr-2" /> Confirm Allocation
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400"><Link2 className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="text-sm">Select a payment to allocate</p></div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ArrearsTab({ arrears }) {
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  arrears.forEach(a => { buckets[a.bucket] = (buckets[a.bucket] || 0) + a.arrears; });
  const barData = Object.entries(buckets).map(([name, value]) => ({ name, value: Math.round(value) }));

  return (
    <>
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle className="text-base">Arrears Ageing</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" fill="#DC2626" radius={[6,6,0,0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">Student</TableHead><TableHead className="bg-slate-50">Year</TableHead>
            <TableHead className="bg-slate-50">Class</TableHead><TableHead className="bg-slate-50">Arrears</TableHead>
            <TableHead className="bg-slate-50">Days</TableHead><TableHead className="bg-slate-50">Bucket</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {arrears.map((a, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{a.student_name}</TableCell>
                <TableCell className="text-slate-500">{a.year_group}</TableCell>
                <TableCell className="text-slate-500">{a.class_name || '-'}</TableCell>
                <TableCell className="text-[#DC2626] font-semibold">TT$ {a.arrears?.toLocaleString()}</TableCell>
                <TableCell>{a.days_outstanding}</TableCell>
                <TableCell><Badge className={a.bucket === '90+' ? 'bg-red-100 text-red-700' : a.bucket === '61-90' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}>{a.bucket} days</Badge></TableCell>
              </TableRow>
            ))}
            {arrears.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No arrears data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function CreditsTab({ credits, students, onRefresh, user }) {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ student_id: '', amount: 0, reason: '', type: 'discount' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/credit-notes', form);
      successToast('Credit note created');
      setDialog(false);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAction = async (creditId, action) => {
    try {
      await api.post(`/finance/credit-notes/${creditId}/${action}`);
      toast.success(`Credit ${action}d`);
      onRefresh();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{credits.length} credit notes</p>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="create-credit-btn"><Plus className="w-4 h-4 mr-2" /> New Credit Note</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Credit Note</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Student</Label><SearchableSelect options={students.map(s => ({ value: s.user_id, label: s.name }))} value={form.student_id} onValueChange={v => setForm({...form, student_id: v})} placeholder="Search student..." className="w-full h-10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-2"><Label>Type</Label><Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['discount','scholarship','waiver','overpayment_credit'].map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} /></div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-credit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead className="bg-slate-50">Student</TableHead><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">Amount</TableHead><TableHead className="bg-slate-50">Reason</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {credits.map(c => (
              <TableRow key={c.credit_id}>
                <TableCell className="font-medium">{c.student_name}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{c.type?.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell className="font-semibold">TT$ {c.amount?.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">{c.reason}</TableCell>
                <TableCell><Badge className={statusColors[c.status]}>{c.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {c.status === 'pending' && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleAction(c.credit_id, 'approve')}>Approve</Button>}
                    {c.status === 'approved' && <Button size="sm" variant="ghost" className="text-xs h-7 text-[#C5A55A]" onClick={() => handleAction(c.credit_id, 'apply')}>Apply</Button>}
                    {c.status === 'applied' && <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500" onClick={() => handleAction(c.credit_id, 'reverse')}>Reverse</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function StudentBillingTab() {
  const [students, setStudents] = useState([]);
  const [yearFilter, setYearFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference: '' });
  const [paying, setPaying] = useState(false);
  // Term fee assignment
  const { activeTerm, academicYear } = useTerm();
  const [feeTerm, setFeeTerm] = useState(activeTerm || 'Term 1');
  useEffect(() => { setFeeTerm(activeTerm); }, [activeTerm]);
  const [feeDueDate, setFeeDueDate] = useState('');
  const [feeItems, setFeeItems] = useState([{ name: 'Tuition', category: 'tuition', amount: '' }]);
  const [assigning, setAssigning] = useState(false);
  const [showFeeSection, setShowFeeSection] = useState(false);

  const loadStudents = () => {
    api.get('/finance/student-ledger').then(r => setStudents(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadStudents(); }, [activeTerm]);

  const openProfile = async (student) => {
    setSelectedStudent(student);
    setShowFeeSection(false);
    try {
      const res = await api.get(`/finance/student-profile/${student.user_id}`);
      setProfile(res.data);
    } catch { toast.error('Failed'); }
  };

  const refreshProfile = async () => {
    if (!selectedStudent) return;
    try {
      const res = await api.get(`/finance/student-profile/${selectedStudent.user_id}`);
      setProfile(res.data);
    } catch (err) { console.error("Error:", err); }
    loadStudents();
  };

  const handleRecordPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await api.post('/finance/payments', {
        student_id: selectedStudent.user_id,
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        reference: payForm.reference,
      });
      successToast('Payment recorded and allocated');
      setShowPayDialog(false);
      setPayForm({ amount: '', method: 'cash', reference: '' });
      refreshProfile();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setPaying(false);
  };

  const downloadBill = (invoiceId) => {
    const token = localStorage.getItem('rw_token');
    fetch(`${BACKEND}/api/finance/bill/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `RightWay_Bill_${invoiceId}.pdf`; a.click(); successToast('Bill downloaded'); })
      .catch(() => toast.error('Download failed'));
  };

  // Fee items management
  const addFeeItem = () => setFeeItems([...feeItems, { name: '', category: 'other', amount: '' }]);
  const updateFeeItem = (idx, field, value) => { const items = [...feeItems]; items[idx] = { ...items[idx], [field]: value }; setFeeItems(items); };
  const removeFeeItem = (idx) => setFeeItems(feeItems.filter((_, i) => i !== idx));
  const feeTotal = feeItems.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

  // Pre-fill fee items from existing invoice
  const loadExistingFees = (inv) => {
    if (inv.line_items?.length > 0) {
      setFeeItems(inv.line_items.map(li => ({ name: li.fee_item_name, category: li.category, amount: String(li.amount) })));
    }
    setFeeTerm(inv.term);
    setFeeDueDate(inv.due_at?.slice(0, 10) || '');
    setShowFeeSection(true);
  };

  const handleAssignTermFees = async () => {
    const validItems = feeItems.filter(fi => fi.name && parseFloat(fi.amount) > 0).map(fi => ({ ...fi, amount: parseFloat(fi.amount) }));
    if (!validItems.length) { toast.error('Add at least one fee item with name and amount'); return; }
    setAssigning(true);
    try {
      const res = await api.post(`/finance/student/${selectedStudent.user_id}/assign-term-fees`, {
        term: feeTerm, academic_year: academicYear || '2025-2026', due_date: feeDueDate, fee_items: validItems
      });
      successToast(res.data.message);
      setShowFeeSection(false);
      refreshProfile();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setAssigning(false);
  };

  // Delete invoice
  const [showDeleteInvoice, setShowDeleteInvoice] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const handleDeleteInvoice = async (invoiceId) => {
    setDeleting(true);
    try {
      const res = await api.delete(`/finance/invoices/${invoiceId}`);
      successToast(res.data.message);
      setShowDeleteInvoice(null);
      refreshProfile();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
    setDeleting(false);
  };

  const filtered = students.filter(s =>
    (yearFilter === 'All' || s.year_group === yearFilter) &&
    (s.name?.toLowerCase().includes(search.toLowerCase()) || s.admission_number?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <AppLoader />;

  // Student detail view
  if (selectedStudent && profile) {
    const { summary, invoices, payments } = profile;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setProfile(null); loadStudents(); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-md text-xs border-[#2E6CC4]/30 text-[#2E6CC4]" onClick={() => { setShowFeeSection(!showFeeSection); if (!showFeeSection) setFeeItems([{ name: 'Tuition', category: 'tuition', amount: '' }]); }} data-testid="assign-term-fees-btn">
              <Edit className="w-3 h-3 mr-1" /> {showFeeSection ? 'Cancel' : 'Assign / Edit Term Fees'}
            </Button>
            <Button className="bg-[#C5A55A] hover:bg-[#b8963e] rounded-md text-xs" onClick={() => setShowPayDialog(true)} data-testid="record-student-payment-btn"><Plus className="w-3 h-3 mr-1" /> Record Payment</Button>
          </div>
        </div>
        <div className="bg-white rounded-md border border-slate-100 p-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-xl font-bold">{selectedStudent.name?.charAt(0)}</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1B2A4A]">{selectedStudent.name}</h2>
            <div className="flex gap-2 mt-1"><Badge variant="secondary">{selectedStudent.year_group}</Badge><Badge variant="secondary">{selectedStudent.admission_number}</Badge><Badge className="bg-blue-100 text-[#1B2A4A]">{selectedStudent.boarding_status}</Badge></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card text-center"><p className="text-[10px] text-slate-500">Total Billed</p><p className="text-xl font-bold" data-testid="student-billed">TT$ {summary.total_billed.toLocaleString()}</p></div>
          <div className="stat-card text-center bg-[#C5A55A]/10"><p className="text-[10px] text-slate-500">Total Paid</p><p className="text-xl font-bold text-[#C5A55A]" data-testid="student-paid">TT$ {summary.total_paid.toLocaleString()}</p></div>
          <div className="stat-card text-center bg-red-50"><p className="text-[10px] text-slate-500">Balance Owing</p><p className="text-xl font-bold text-[#DC2626]" data-testid="student-balance">TT$ {summary.balance.toLocaleString()}</p></div>
        </div>

        {/* Assign / Edit Term Fees Section */}
        {showFeeSection && (
          <Card className="rounded-md border-[#2E6CC4]/30 bg-blue-50/30">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Edit className="w-4 h-4 text-[#2E6CC4]" /> Assign Term Fees for {selectedStudent.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Term</Label>
                  <Select value={feeTerm} onValueChange={setFeeTerm}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent></Select>
                </div>
                <div><Label className="text-xs">Due Date</Label><Input type="date" value={feeDueDate} onChange={e => setFeeDueDate(e.target.value)} className="h-9" /></div>
              </div>
              {invoices.filter(inv => inv.term === feeTerm && inv.status !== 'cancelled').length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">This student already has a <span className="font-bold">{feeTerm}</span> invoice. Saving will update the existing invoice's fee items.</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Fee Items (enter custom amounts)</Label>
                <Button variant="ghost" size="sm" className="text-xs text-[#2E6CC4]" onClick={addFeeItem} data-testid="add-student-fee-item"><Plus className="w-3 h-3 mr-1" /> Add Item</Button>
              </div>
              {feeItems.map((fi, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`student-fee-item-${i}`}>
                  <div className="col-span-5"><Input value={fi.name} onChange={e => updateFeeItem(i, 'name', e.target.value)} placeholder="e.g. Tuition, Boarding, ICT Levy" className="text-xs h-9 bg-white" data-testid={`student-fee-name-${i}`} /></div>
                  <div className="col-span-3">
                    <Select value={fi.category} onValueChange={v => updateFeeItem(i, 'category', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>{['tuition','boarding','feeding','uniform','technology','activity','exam','books','transport','capital_levy','admission','other'].map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3"><Input type="number" value={fi.amount} onChange={e => updateFeeItem(i, 'amount', e.target.value)} placeholder="Amount (GHS)" className="text-xs h-9 bg-white font-semibold" data-testid={`student-fee-amount-${i}`} /></div>
                  <div className="col-span-1">{feeItems.length > 1 && <button onClick={() => removeFeeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                </div>
              ))}
              <div className="bg-white rounded-md p-3 flex justify-between border">
                <span className="text-sm text-slate-600">Total Term Fees:</span>
                <span className="text-lg font-bold text-[#2E6CC4]" data-testid="student-fee-total">TT$ {feeTotal.toLocaleString()}</span>
              </div>
              {invoices.filter(inv => inv.term === feeTerm && inv.status !== 'cancelled').length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => { const inv = invoices.find(inv => inv.term === feeTerm && inv.status !== 'cancelled'); if (inv) loadExistingFees(inv); }} data-testid="load-existing-fees-btn">Load current {feeTerm} fees to edit</Button>
              )}
              <Button className="w-full rounded-md bg-[#2E6CC4] h-11" onClick={handleAssignTermFees} disabled={assigning || feeTotal <= 0} data-testid="save-term-fees-btn">
                {assigning ? 'Saving...' : `Save ${feeTerm} Fees — TT$ ${feeTotal.toLocaleString()}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Record Payment Dialog */}
        <Dialog open={showPayDialog} onOpenChange={v => { setShowPayDialog(v); if (!v) setPayForm({ amount: '', method: 'cash', reference: '' }); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Record Payment for {selectedStudent.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {summary.balance > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-xs text-red-700">Outstanding balance: <span className="font-bold">TT$ {summary.balance.toLocaleString()}</span></p></div>}
              <div><Label className="text-xs">Amount (GHS)</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} placeholder={summary.balance > 0 ? `e.g. ${summary.balance}` : '0'} className="h-9 text-lg font-bold" data-testid="student-pay-amount" /></div>
              <div><Label className="text-xs">Payment Method</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm(p => ({ ...p, method: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="momo">Mobile Money</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Reference (optional)</Label><Input value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} className="h-9 text-xs" placeholder="e.g. receipt number" /></div>
              {payForm.amount && parseFloat(payForm.amount) > 0 && (
                <div className="bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-lg p-3">
                  <p className="text-xs text-[#C5A55A]">Payment of <span className="font-bold">TT$ {parseFloat(payForm.amount).toLocaleString()}</span> will be auto-allocated to oldest unpaid invoices.</p>
                  {summary.balance > 0 && <p className="text-xs text-[#C5A55A] mt-1">New balance: <span className="font-bold">TT$ {Math.max(0, summary.balance - (parseFloat(payForm.amount) || 0)).toLocaleString()}</span></p>}
                </div>
              )}
              <Button className="w-full bg-[#C5A55A] hover:bg-[#b8963e] rounded-md" onClick={handleRecordPayment} disabled={paying || !payForm.amount} data-testid="submit-student-payment">{paying ? 'Recording...' : 'Record & Allocate Payment'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invoices */}
        <Card className="rounded-md border-slate-100"><CardHeader><CardTitle className="text-sm flex items-center justify-between">Invoices
          {invoices.length > 0 && !showFeeSection && <Button variant="ghost" size="sm" className="text-xs text-[#2E6CC4]" onClick={() => { const inv = invoices[0]; if (inv) loadExistingFees(inv); }}>Edit fees</Button>}
        </CardTitle></CardHeader><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Invoice #</TableHead><TableHead className="bg-slate-50">Term</TableHead><TableHead className="bg-slate-50">Total</TableHead><TableHead className="bg-slate-50">Paid</TableHead><TableHead className="bg-slate-50">Balance</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{invoices.map(inv => (
            <TableRow key={inv.invoice_id}>
              <TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell>
              <TableCell className="text-sm">{inv.term}</TableCell>
              <TableCell>TT$ {(inv.total_due||0).toLocaleString()}</TableCell>
              <TableCell className="text-[#C5A55A]">TT$ {(inv.amount_paid||0).toLocaleString()}</TableCell>
              <TableCell className="text-[#DC2626]">TT$ {((inv.total_due||0)-(inv.amount_paid||0)).toLocaleString()}</TableCell>
              <TableCell><Badge className={statusColors[inv.status]||'bg-slate-100'}>{inv.status}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => downloadBill(inv.invoice_id)} data-testid={`dl-bill-${inv.invoice_id}`}><Download className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-[#2E6CC4]" onClick={() => loadExistingFees(inv)} data-testid={`edit-fees-${inv.invoice_id}`} title="Edit fees"><Edit className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setShowDeleteInvoice(inv)} data-testid={`delete-inv-${inv.invoice_id}`} title="Delete invoice"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}{invoices.length===0&&<TableRow><TableCell colSpan={7} className="text-center py-6 text-slate-400">No invoices</TableCell></TableRow>}</TableBody></Table>
          {invoices.map(inv => inv.line_items?.length > 0 && (
            <div key={inv.invoice_id} className="px-4 py-2 bg-slate-50 border-t">
              <p className="text-[10px] font-semibold text-slate-500 mb-1">{inv.invoice_number} - Fee Breakdown:</p>
              {inv.line_items.map((li,i) => (
                <div key={i} className="flex justify-between text-xs py-0.5"><span>{li.fee_item_name} <span className="text-slate-400">({li.category})</span></span><span>TT$ {li.amount?.toLocaleString()} | Paid: {li.amount_paid?.toLocaleString()} | Owing: {li.amount_outstanding?.toLocaleString()}</span></div>
              ))}
            </div>
          ))}
        </CardContent></Card>

        {/* Delete Invoice Confirmation */}
        <Dialog open={!!showDeleteInvoice} onOpenChange={() => setShowDeleteInvoice(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Invoice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Are you sure you want to delete invoice <span className="font-bold font-mono">{showDeleteInvoice?.invoice_number}</span>?</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p className="text-xs text-red-700">This will permanently remove:</p>
                <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
                  <li>Invoice total: <span className="font-bold">TT$ {(showDeleteInvoice?.total_due || 0).toLocaleString()}</span></li>
                  <li>All fee line items on this invoice</li>
                  <li>All payment allocations to this invoice</li>
                </ul>
                {(showDeleteInvoice?.amount_paid || 0) > 0 && (
                  <p className="text-xs text-amber-700 font-medium mt-1">TT$ {showDeleteInvoice.amount_paid.toLocaleString()} in payments will be unallocated and available for re-allocation.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-xs rounded-md" onClick={() => setShowDeleteInvoice(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-xs rounded-md" onClick={() => handleDeleteInvoice(showDeleteInvoice.invoice_id)} disabled={deleting} data-testid="confirm-delete-invoice">{deleting ? 'Deleting...' : 'Delete Invoice'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Payments */}
        <Card className="rounded-md border-slate-100"><CardHeader><CardTitle className="text-sm">Payment History ({payments.length})</CardTitle></CardHeader><CardContent className="p-0">
          {payments.length > 0 ? (
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Amount</TableHead><TableHead className="bg-slate-50">Method</TableHead><TableHead className="bg-slate-50">Reference</TableHead><TableHead className="bg-slate-50">Proof</TableHead><TableHead className="bg-slate-50">Status</TableHead></TableRow></TableHeader>
            <TableBody>{payments.map(p => (
              <TableRow key={p.payment_id}><TableCell className="text-xs">{new Date(p.received_at||p.created_at).toLocaleDateString()}</TableCell><TableCell className="font-semibold text-[#C5A55A]">TT$ {p.amount?.toLocaleString()}</TableCell><TableCell><Badge variant="secondary" className="text-xs">{p.method}</Badge></TableCell><TableCell className="text-xs text-slate-500">{p.reference||'-'}</TableCell>
              <TableCell>
                {p.proof_file_id ? (
                  <div className="flex gap-1">
                    <a href={`${BACKEND}/api/files/${p.proof_file_id}/preview?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noreferrer" className="text-[10px] text-[#2E6CC4] hover:underline bg-blue-50 px-1.5 py-0.5 rounded" data-testid={`student-proof-view-${p.payment_id}`}><Eye className="w-3 h-3 inline mr-0.5" />View</a>
                    <a href={`${BACKEND}/api/files/${p.proof_file_id}/download?token=${localStorage.getItem('rw_token')}`} target="_blank" rel="noreferrer" className="text-[10px] text-[#C5A55A] hover:underline bg-[#C5A55A]/10 px-1.5 py-0.5 rounded" data-testid={`student-proof-dl-${p.payment_id}`}><Download className="w-3 h-3 inline mr-0.5" />DL</a>
                  </div>
                ) : <span className="text-[10px] text-slate-300">—</span>}
              </TableCell>
              <TableCell><Badge className={statusColors[p.status]||'bg-slate-100'} >{p.status}</Badge></TableCell></TableRow>
            ))}</TableBody></Table>
          ) : <p className="text-center py-6 text-sm text-slate-400">No payments recorded</p>}
        </CardContent></Card>
      </div>
    );
  }

  // Student list
  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-36 rounded-md"><SelectValue /></SelectTrigger><SelectContent>{['All','Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50">#</TableHead><TableHead className="bg-slate-50">Student</TableHead><TableHead className="bg-slate-50">Year</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Billed</TableHead><TableHead className="bg-slate-50">Paid</TableHead><TableHead className="bg-slate-50">Balance</TableHead>
          </TableRow></TableHeader>
          <TableBody>{filtered.map((s,i) => (
            <TableRow key={s.user_id} className="cursor-pointer hover:bg-blue-50/50" onClick={() => openProfile(s)} data-testid={`billing-${s.user_id}`}>
              <TableCell className="text-xs text-slate-400">{i+1}</TableCell>
              <TableCell className="font-medium"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-[#2E6CC4] text-xs font-bold">{s.name?.charAt(0)}</div>{s.name}</div></TableCell>
              <TableCell><Badge variant="secondary" className="text-xs">{s.year_group}</Badge></TableCell>
              <TableCell><Badge className={s.boarding_status==='boarding'?'bg-blue-100 text-[#1B2A4A]':'bg-slate-100 text-slate-600'}>{s.boarding_status}</Badge></TableCell>
              <TableCell className="text-sm">TT$ {(s.total_billed||0).toLocaleString()}</TableCell>
              <TableCell className="text-sm text-[#C5A55A]">TT$ {(s.total_paid||0).toLocaleString()}</TableCell>
              <TableCell className={`text-sm font-semibold ${s.balance>0?'text-[#DC2626]':'text-[#C5A55A]'}`}>TT$ {(s.balance||0).toLocaleString()}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );
}

function AssignFeesTab({ onRefresh }) {
  const { activeTerm } = useTerm();
  const [mode, setMode] = useState('individual');
  const [yearGroup, setYearGroup] = useState('Year 7');
  const [term, setTerm] = useState(activeTerm || 'Term 1');
  useEffect(() => { setTerm(activeTerm); }, [activeTerm]);
  const [dueDate, setDueDate] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [feeDesc, setFeeDesc] = useState('School Fees');
  const [assigning, setAssigning] = useState(false);
  const [feeItems, setFeeItems] = useState([{ name: '', category: 'tuition', amount: '', applies_to: 'all' }]);

  useEffect(() => { api.get('/admin/students').then(r => setStudents(r.data)).catch(() => {}); }, []);

  const ygStudents = students.filter(s => s.year_group === yearGroup && (s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || s.admission_number?.toLowerCase().includes(studentSearch.toLowerCase())));

  const toggleStudent = (uid) => {
    setSelectedStudents(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };
  const selectAll = () => {
    const ids = ygStudents.map(s => s.user_id);
    setSelectedStudents(prev => ids.every(id => prev.includes(id)) ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  const addItem = () => setFeeItems([...feeItems, { name: '', category: 'tuition', amount: '', applies_to: 'all' }]);
  const updateItem = (idx, field, value) => {
    const items = [...feeItems];
    items[idx] = { ...items[idx], [field]: value };
    setFeeItems(items);
  };
  const removeItem = (idx) => setFeeItems(feeItems.filter((_, i) => i !== idx));

  const handleIndividualAssign = async () => {
    if (!selectedStudent || !feeAmount) { toast.error('Select student and enter fee amount'); return; }
    setAssigning(true);
    try {
      const res = await api.post('/finance/quick-assign', {
        student_id: selectedStudent, fee_amount: parseFloat(feeAmount),
        paid_amount: parseFloat(paidAmount) || 0, description: feeDesc, term
      });
      successToast(res.data.message);
      setSelectedStudent(''); setFeeAmount(''); setPaidAmount(''); setFeeDesc('School Fees');
      if (onRefresh) onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setAssigning(false);
  };

  const handleMultiOrBulkBill = async () => {
    const validItems = feeItems.filter(fi => fi.name && parseFloat(fi.amount) > 0).map(fi => ({ ...fi, amount: parseFloat(fi.amount) }));
    if (!validItems.length) { toast.error('Add at least one fee item with name and amount'); return; }
    setAssigning(true);
    try {
      if (mode === 'selected') {
        if (!selectedStudents.length) { toast.error('Select at least one student'); setAssigning(false); return; }
        const res = await api.post('/finance/bill-selected-students', {
          student_ids: selectedStudents, fee_items: validItems, term, academic_year: '2025-2026', due_date: dueDate
        });
        successToast(res.data.message);
        setSelectedStudents([]);
      } else {
        const res = await api.post('/finance/assign-fees-bulk', {
          year_group: yearGroup, term, academic_year: '2025-2026', due_date: dueDate, fee_items: validItems
        });
        successToast(res.data.message);
      }
      if (onRefresh) onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setAssigning(false);
  };

  const totalAll = feeItems.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

  return (
    <div className="space-y-4" data-testid="assign-fees-tab">
      <div className="flex gap-2">
        <Button variant={mode === 'individual' ? 'default' : 'outline'} className="rounded-md text-xs" onClick={() => setMode('individual')} data-testid="mode-individual">Individual Student</Button>
        <Button variant={mode === 'selected' ? 'default' : 'outline'} className="rounded-md text-xs" onClick={() => setMode('selected')} data-testid="mode-selected">Select Students</Button>
        <Button variant={mode === 'bulk' ? 'default' : 'outline'} className="rounded-md text-xs" onClick={() => setMode('bulk')} data-testid="mode-bulk">Entire Year Group</Button>
      </div>

      {/* Common: Year Group + Term Selection */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1"><Label className="text-xs">Year Group</Label>
          <Select value={yearGroup} onValueChange={v => { setYearGroup(v); setSelectedStudent(''); setSelectedStudents([]); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{['Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Term</Label>
          <Select value={term} onValueChange={setTerm}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent></Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" /></div>
      </div>

      {/* Individual: single student + single fee */}
      {mode === 'individual' && (
        <Card className="rounded-md border-[#2E6CC4]/20">
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Search & Select Student from {yearGroup}</Label>
              <Input placeholder="Type to search..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="h-9" data-testid="student-search" />
              <div className="max-h-[180px] overflow-y-auto border rounded-md bg-white">
                {ygStudents.map(s => (
                  <button key={s.user_id} onClick={() => { setSelectedStudent(s.user_id); setStudentSearch(''); }}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 hover:bg-blue-50 flex items-center justify-between ${selectedStudent === s.user_id ? 'bg-blue-50 font-semibold text-[#2E6CC4]' : ''}`} data-testid={`sel-student-${s.user_id}`}>
                    <span>{s.name}</span><span className="text-slate-400">{s.admission_number} | {s.boarding_status}</span>
                  </button>
                ))}
                {ygStudents.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No students in {yearGroup}</p>}
              </div>
              {selectedStudent && <Badge className="bg-[#2E6CC4] text-white mt-1">{students.find(s => s.user_id === selectedStudent)?.name}</Badge>}
            </div>
            <div className="space-y-1"><Label className="text-xs">Fee Description</Label><Input value={feeDesc} onChange={e => setFeeDesc(e.target.value)} className="h-9" data-testid="fee-desc-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Total Fee (GHS)</Label><Input type="number" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} placeholder="e.g. 15800" className="h-9 text-lg font-bold" data-testid="fee-amount-input" /></div>
              <div className="space-y-1"><Label className="text-xs">Amount Paid (GHS)</Label><Input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0" className="h-9 text-lg font-bold" data-testid="paid-amount-input" /></div>
            </div>
            {feeAmount && <div className="bg-slate-50 rounded-md p-3 flex justify-between text-sm"><span>Balance:</span><span className="font-bold text-red-600">TT$ {((parseFloat(feeAmount) || 0) - (parseFloat(paidAmount) || 0)).toLocaleString()}</span></div>}
            <Button className="w-full rounded-md bg-[#2E6CC4] h-11" onClick={handleIndividualAssign} disabled={assigning || !selectedStudent || !feeAmount} data-testid="assign-individual-btn">
              {assigning ? 'Assigning...' : 'Assign Fee & Record Payment'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Selected Students: checkboxes + fee items */}
      {mode === 'selected' && (
        <>
          <Card className="rounded-md border-amber-200">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Select Students from {yearGroup} ({selectedStudents.length} selected)</Label>
                <Button variant="ghost" size="sm" className="text-xs text-[#2E6CC4]" onClick={selectAll} data-testid="select-all-btn">
                  {ygStudents.every(s => selectedStudents.includes(s.user_id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="h-8 text-xs" />
              <div className="max-h-[200px] overflow-y-auto border rounded-md bg-white divide-y">
                {ygStudents.map(s => (
                  <label key={s.user_id} className={`flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-blue-50/50 ${selectedStudents.includes(s.user_id) ? 'bg-blue-50' : ''}`}>
                    <input type="checkbox" checked={selectedStudents.includes(s.user_id)} onChange={() => toggleStudent(s.user_id)} className="rounded text-[#2E6CC4]" data-testid={`chk-student-${s.user_id}`} />
                    <span className="flex-1 font-medium">{s.name}</span>
                    <span className="text-slate-400">{s.boarding_status}</span>
                  </label>
                ))}
                {ygStudents.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No students in {yearGroup}</p>}
              </div>
              {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedStudents.slice(0, 5).map(id => <Badge key={id} className="bg-[#2E6CC4]/10 text-[#2E6CC4] text-[9px]">{students.find(s => s.user_id === id)?.name}</Badge>)}
                  {selectedStudents.length > 5 && <Badge className="bg-slate-100 text-[9px]">+{selectedStudents.length - 5} more</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          <FeeItemsEditor feeItems={feeItems} setFeeItems={setFeeItems} addItem={addItem} updateItem={updateItem} removeItem={removeItem} totalAll={totalAll} />

          <Button className="w-full rounded-md bg-amber-600 hover:bg-amber-700 h-11" onClick={handleMultiOrBulkBill} disabled={assigning || !selectedStudents.length} data-testid="bill-selected-btn">
            {assigning ? 'Billing...' : `Bill ${selectedStudents.length} Selected Student${selectedStudents.length > 1 ? 's' : ''}`}
          </Button>
        </>
      )}

      {/* Bulk: entire year group + fee items */}
      {mode === 'bulk' && (
        <>
          <FeeItemsEditor feeItems={feeItems} setFeeItems={setFeeItems} addItem={addItem} updateItem={updateItem} removeItem={removeItem} totalAll={totalAll} />

          <Button className="w-full rounded-md bg-[#2E6CC4] h-11" onClick={handleMultiOrBulkBill} disabled={assigning} data-testid="assign-fees-btn">
            {assigning ? 'Assigning...' : `Bill All ${yearGroup} Students`}
          </Button>
        </>
      )}
    </div>
  );
}

function FeeItemsEditor({ feeItems, addItem, updateItem, removeItem, totalAll }) {
  return (
    <Card className="rounded-md border-slate-100">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs font-semibold">Fee Items (enter your own amounts)</Label>
          <Button variant="ghost" size="sm" className="text-xs text-[#2E6CC4]" onClick={addItem} data-testid="add-fee-item-btn"><Plus className="w-3 h-3 mr-1" /> Add Item</Button>
        </div>
        {feeItems.map((fi, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`fee-item-${i}`}>
            <div className="col-span-4"><Input value={fi.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Fee name (e.g. Tuition)" className="text-xs h-9" data-testid={`fee-item-name-${i}`} /></div>
            <div className="col-span-2">
              <Select value={fi.category} onValueChange={v => updateItem(i, 'category', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{['tuition','boarding','feeding','uniform','technology','activity','exam','books','transport','capital_levy','admission','other'].map(c => <SelectItem key={c} value={c}>{c.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Input type="number" value={fi.amount} onChange={e => updateItem(i, 'amount', e.target.value)} placeholder="Amount" className="text-xs h-9" data-testid={`fee-item-amount-${i}`} /></div>
            <div className="col-span-3">
              <Select value={fi.applies_to} onValueChange={v => updateItem(i, 'applies_to', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Students</SelectItem><SelectItem value="boarding">Boarding Only</SelectItem><SelectItem value="day">Day Only</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-1">{feeItems.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
          </div>
        ))}
        <div className="bg-slate-50 rounded-md p-3 flex justify-between mt-2">
          <span className="text-sm text-slate-600">Total per student:</span>
          <span className="text-lg font-bold text-[#2E6CC4]">TT$ {totalAll.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}


function FeeTemplatesTab() {
  const [templates, setTemplates] = React.useState([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [name, setName] = React.useState('');
  const [yearGroup, setYearGroup] = React.useState('');
  const [term, setTerm] = React.useState('Term 1');
  const [feeItems, setFeeItems] = React.useState([{ name: 'Tuition', category: 'tuition', amount: 0, applies_to: 'all' }]);
  const [saving, setSaving] = React.useState(false);
  const [applyingId, setApplyingId] = React.useState(null);
  const [dueDate, setDueDate] = React.useState('');

  const yearGroups = ['Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'];
  const terms = ['Term 1','Term 2','Term 3'];

  const load = async () => { try { const r = await api.get('/finance/fee-templates'); setTemplates(r.data); } catch (err) { console.error("Error:", err); } };
  React.useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !yearGroup) { toast.error('Name and year group required'); return; }
    setSaving(true);
    try {
      await api.post('/finance/fee-templates', { name, year_group: yearGroup, term, fee_items: feeItems.map(fi => ({ ...fi, amount: parseFloat(fi.amount) || 0 })) });
      successToast('Template saved'); setShowCreate(false); setName(''); setFeeItems([{ name: 'Tuition', category: 'tuition', amount: 0, applies_to: 'all' }]); load();
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  const handleApply = async (tmpl) => {
    if (!window.confirm(`Apply "${tmpl.name}" to all ${tmpl.year_group} students for ${tmpl.term}? This will generate invoices.`)) return;
    setApplyingId(tmpl.template_id);
    try {
      const r = await api.post(`/finance/fee-templates/${tmpl.template_id}/apply`, { due_date: dueDate });
      successToast(r.data.message);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setApplyingId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try { await api.delete(`/finance/fee-templates/${id}`); successToast('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const addItem = () => setFeeItems(prev => [...prev, { name: '', category: 'tuition', amount: 0, applies_to: 'all' }]);
  const updateItem = (i, key, val) => setFeeItems(prev => prev.map((fi, idx) => idx === i ? { ...fi, [key]: val } : fi));
  const removeItem = (i) => setFeeItems(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4" data-testid="fee-templates-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Fee Templates</h2><p className="text-xs text-slate-500">Save and reuse fee structures for bulk billing</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(!showCreate)} data-testid="create-template-btn"><Plus className="w-3 h-3 mr-1" /> Create Template</Button>
      </div>
      {showCreate && (
        <Card className="rounded-md border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Template Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Year 10 Term 1 Fees" className="text-xs h-9" /></div>
              <div><Label className="text-xs">Year Group</Label><Select value={yearGroup} onValueChange={setYearGroup}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{yearGroups.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Term</Label><Select value={term} onValueChange={setTerm}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Fee Items</Label><button onClick={addItem} className="text-xs text-[#2E6CC4]">+ Add Item</button></div>
              {feeItems.map((fi, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4"><Input value={fi.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Fee name" className="text-xs h-8" /></div>
                  <div className="col-span-3"><Select value={fi.category} onValueChange={v => updateItem(i, 'category', v)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['tuition','boarding','feeding','uniform','technology','activity','exam','books','transport','other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div className="col-span-2"><Input type="number" value={fi.amount} onChange={e => updateItem(i, 'amount', e.target.value)} placeholder="Amount" className="text-xs h-8" /></div>
                  <div className="col-span-2"><Select value={fi.applies_to} onValueChange={v => updateItem(i, 'applies_to', v)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="day">Day</SelectItem></SelectContent></Select></div>
                  <div className="col-span-1">{feeItems.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400">x</button>}</div>
                </div>
              ))}
            </div>
            <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</Button>
          </CardContent>
        </Card>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <Card key={t.template_id} className="rounded-md hover:border-[#2E6CC4]/30 transition-colors" data-testid={`template-${t.template_id}`}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1B2A4A]">{t.name}</h3>
                <button onClick={() => handleDelete(t.template_id)} className="text-red-400 text-xs hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-[9px]">{t.year_group}</Badge>
                <Badge variant="secondary" className="text-[9px]">{t.term}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-blue-50 rounded p-2 text-center"><p className="text-[9px] text-slate-500">Day Student</p><p className="text-sm font-bold text-[#2E6CC4]">TT$ {(t.total_day || 0).toLocaleString()}</p></div>
                <div className="bg-blue-50 rounded p-2 text-center"><p className="text-[9px] text-slate-500">Boarding</p><p className="text-sm font-bold text-[#1B2A4A]">TT$ {(t.total_boarding || 0).toLocaleString()}</p></div>
              </div>
              <p className="text-[9px] text-slate-400">{t.fee_items?.length || 0} fee items | By {t.created_by_name}</p>
              <Button size="sm" className="w-full bg-[#2E6CC4] rounded-md text-xs h-8" onClick={() => handleApply(t)} disabled={applyingId === t.template_id} data-testid={`apply-template-${t.template_id}`}>
                {applyingId === t.template_id ? 'Applying...' : 'Apply to All Students'}
              </Button>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400"><p className="text-sm">No fee templates yet. Create one to automate billing.</p></div>}
      </div>
    </div>
  );
}


function TermBillingTab() {
  const [term, setTerm] = React.useState('Term 1');
  const [academicYear, setAcademicYear] = React.useState('2025-2026');
  const [summary, setSummary] = React.useState(null);
  const [report, setReport] = React.useState(null);
  const [reportTerm, setReportTerm] = React.useState('all');
  const [reportYG, setReportYG] = React.useState('all');
  const [loading, setLoading] = React.useState(false);

  const terms = ['Term 1','Term 2','Term 3'];
  const yearGroups = ['Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'];

  const loadSummary = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/finance/term-summary?term=${term}&academic_year=${academicYear}`);
      setSummary(r.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const loadReport = async () => {
    try {
      const params = new URLSearchParams();
      if (reportTerm && reportTerm !== 'all') params.append('term', reportTerm);
      if (reportYG && reportYG !== 'all') params.append('year_group', reportYG);
      const r = await api.get(`/finance/outstanding-report?${params}`);
      setReport(r.data);
    } catch (err) { console.error("Error:", err); }
  };

  React.useEffect(() => { loadSummary(); }, [term, academicYear]);

  return (
    <div className="space-y-6" data-testid="term-billing-tab">
      {/* Term Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div><h2 className="text-lg font-bold text-[#1B2A4A]">Term Billing Summary</h2><p className="text-xs text-slate-500">Overview of invoicing and collections per year group</p></div>
          <div className="flex gap-2">
            <Select value={term} onValueChange={setTerm}><SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Select value={academicYear} onValueChange={setAcademicYear}><SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025-2026">2025-2026</SelectItem><SelectItem value="2024-2025">2024-2025</SelectItem></SelectContent></Select>
          </div>
        </div>
        {loading && <AppLoader size="sm" />}
        {summary && !loading && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]" data-testid="term-invoiced">TT$ {(summary.totals?.invoiced || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Invoiced</p></div>
              <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]" data-testid="term-paid">TT$ {(summary.totals?.paid || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Collected</p></div>
              <div className="stat-card"><p className="text-2xl font-bold text-red-600" data-testid="term-outstanding">TT$ {(summary.totals?.outstanding || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Outstanding</p></div>
            </div>
            <Card className="rounded-md"><CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-slate-500"><th className="pb-2">Year Group</th><th className="pb-2">Students</th><th className="pb-2">Boarding</th><th className="pb-2">Day</th><th className="pb-2 text-right">Invoiced</th><th className="pb-2 text-right">Paid</th><th className="pb-2 text-right">Outstanding</th><th className="pb-2 text-right">Rate</th></tr></thead>
                <tbody>{(summary.year_groups || []).map(yg => (
                  <tr key={yg.year_group} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 font-medium text-[#1B2A4A]">{yg.year_group}</td>
                    <td className="py-2">{yg.student_count}</td>
                    <td className="py-2 text-[#2E6CC4]">{yg.boarding_count}</td>
                    <td className="py-2 text-blue-600">{yg.day_count}</td>
                    <td className="py-2 text-right">TT$ {(yg.invoiced || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-[#C5A55A]">TT$ {(yg.paid || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600 font-semibold">TT$ {(yg.outstanding || 0).toLocaleString()}</td>
                    <td className="py-2 text-right"><Badge className={`text-[9px] ${yg.collection_rate >= 80 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : yg.collection_rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{yg.collection_rate}%</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
              {(summary.year_groups || []).length === 0 && <p className="text-center text-sm text-slate-400 py-6">No billing data for this term</p>}
            </CardContent></Card>
          </>
        )}
      </div>

      {/* Outstanding Balances Report */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div><h2 className="text-lg font-bold text-[#1B2A4A]">Outstanding Balances</h2><p className="text-xs text-slate-500">Students with unpaid fees</p></div>
          <div className="flex gap-2">
            <Select value={reportTerm} onValueChange={setReportTerm}><SelectTrigger className="h-9 w-28 text-xs"><SelectValue placeholder="All Terms" /></SelectTrigger><SelectContent><SelectItem value="all">All Terms</SelectItem>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Select value={reportYG} onValueChange={setReportYG}><SelectTrigger className="h-9 w-28 text-xs"><SelectValue placeholder="All Years" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{yearGroups.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
            <Button className="bg-[#2E6CC4] rounded-md text-xs h-9" onClick={loadReport} data-testid="load-report-btn">Load Report</Button>
          </div>
        </div>
        {report && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="stat-card"><p className="text-xl font-bold">{report.count}</p><p className="text-xs text-slate-500">Students Owing</p></div>
              <div className="stat-card"><p className="text-xl font-bold text-[#2E6CC4]">TT$ {(report.total_invoiced || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Invoiced</p></div>
              <div className="stat-card"><p className="text-xl font-bold text-red-600">TT$ {(report.total_outstanding || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Outstanding</p></div>
            </div>
            <Card className="rounded-md"><CardContent className="pt-4 max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b text-left text-xs text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Year Group</th><th className="pb-2">Type</th><th className="pb-2 text-right">Invoiced</th><th className="pb-2 text-right">Paid</th><th className="pb-2 text-right">Outstanding</th></tr></thead>
                <tbody>{(report.students || []).map(s => (
                  <tr key={s.student_id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 font-medium text-[#1B2A4A]">{s.name}</td>
                    <td className="py-2">{s.year_group}</td>
                    <td className="py-2"><Badge variant="secondary" className="text-[9px]">{s.boarding_status}</Badge></td>
                    <td className="py-2 text-right">TT$ {(s.total_invoiced || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-[#C5A55A]">TT$ {(s.total_paid || 0).toLocaleString()}</td>
                    <td className="py-2 text-right text-red-600 font-bold">TT$ {(s.outstanding || 0).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
              {(report.students || []).length === 0 && <p className="text-center text-sm text-slate-400 py-6">No outstanding balances found</p>}
            </CardContent></Card>
          </>
        )}
      </div>
    </div>
  );
}


function ReconciliationTab({ user }) {
  const { activeTerm } = useTerm();
  const YEAR_GROUPS = ['Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'];
  const [yearGroup, setYearGroup] = React.useState('Year 7');
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [edited, setEdited] = React.useState({});
  const [evidenceView, setEvidenceView] = React.useState(null);
  const isManagement = ['SuperAdmin','Founder','CEO'].includes(user?.role);
  const isFinance = ['SuperAdmin','FinanceOfficer','CEO','Founder','Admin','Accounts'].includes(user?.role);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/reconciliation', { params: { year_group: yearGroup } });
      setRows(res.data.students || []);
      setEdited({});
    } catch { toast.error('Failed to load reconciliation data'); }
    setLoading(false);
  }, [yearGroup]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleCellChange = (idx, field, value) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: parseFloat(value) || 0 };
    updated[idx].balance = (updated[idx].total_due || 0) - (updated[idx].total_paid || 0);
    setRows(updated);
    setEdited(prev => ({ ...prev, [updated[idx].student_id]: true }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = rows.filter(r => edited[r.student_id]).map(r => ({
        student_id: r.student_id, total_due: r.total_due, total_paid: r.total_paid, notes: r.notes || ''
      }));
      if (!entries.length) { toast.error('No changes to save'); setSaving(false); return; }
      const res = await api.post('/finance/reconciliation/save', { year_group: yearGroup, entries });
      successToast(res.data.message);
      setEdited({});
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    setSaving(false);
  };

  const handleApprove = async () => {
    if (!window.confirm(`Mark all pending reconciliation records for ${yearGroup} as seen?`)) return;
    try {
      const res = await api.post('/finance/reconciliation/approve', { year_group: yearGroup });
      successToast(res.data.message);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleApproveOne = async (student) => {
    try {
      await api.post('/finance/reconciliation/approve-one', {
        student_id: student.student_id, year_group: yearGroup,
        total_due: student.total_due || 0, total_paid: student.total_paid || 0
      });
      setRows(prev => prev.map(r => r.student_id === student.student_id ? { ...r, status: 'approved' } : r));
      successToast('Marked as seen');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const viewStudentEvidence = async (studentId, studentName) => {
    try {
      const res = await api.get('/finance/payments', { params: { student_id: studentId } });
      const payments = res.data || [];
      const allEvidence = [];
      for (const p of payments) {
        if (p.proof_file_id || (p.evidence_files && p.evidence_files.length > 0)) {
          const files = p.evidence_files || [];
          if (p.proof_file_id && !files.find(f => f.file_id === p.proof_file_id)) {
            files.unshift({ file_id: p.proof_file_id, filename: 'Payment proof', content_type: 'image/jpeg', attached_at: p.created_at });
          }
          allEvidence.push(...files.map(f => ({
            ...f,
            payment_ref: p.reference || p.payment_id,
            amount: p.amount,
            method: p.method,
            content_type: f.content_type || f.filename || 'image/jpeg',
          })));
        }
      }
      setEvidenceView({ student_name: studentName, files: allEvidence, payment_count: payments.length });
    } catch { toast.error('Failed to load evidence'); }
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    autoTable(doc, {
      startY: 46,
      head: [['#', 'Student Name', 'Total Due (GHS)', 'Total Paid (GHS)', 'Balance (GHS)']],
      body: rows.map((r, i) => [
        i + 1,
        r.name || '',
        (r.total_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        (r.total_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        (r.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [27, 42, 74], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 60 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 32 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = parseFloat(String(data.cell.raw).replace(/,/g, ''));
          if (val > 0) data.cell.styles.textColor = [220, 38, 38];
          else data.cell.styles.textColor = [22, 163, 74];
        }
      },
      didDrawPage: () => {
        doc.setFontSize(16);
        doc.setTextColor(27, 42, 74);
        doc.text('The RightWay Centre of Learning', 105, 18, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Informing Minds, Transforming Hearts', 105, 24, { align: 'center' });
        doc.setFontSize(13);
        doc.setTextColor(46, 108, 196);
        doc.text(`Fee Reconciliation - ${yearGroup}`, 105, 33, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${activeTerm} | Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 105, 39, { align: 'center' });
        doc.setDrawColor(46, 108, 196);
        doc.setLineWidth(0.5);
        doc.line(10, 42, 200, 42);
      },
    });

    const finalY = doc.lastAutoTable.finalY + 5;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Students: ${rows.length}   |   Total Due: TT$ ${grandDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}   |   Total Paid: TT$ ${grandPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}   |   Outstanding: TT$ ${grandBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY);
    doc.setFont(undefined, 'normal');
    doc.text('Prepared by (Finance): ___________________', 14, finalY + 15);
    doc.text('Approved by (Management): ___________________', 110, finalY + 15);

    doc.save(`RightWay_Reconciliation_${yearGroup.replace(/ /g, '_')}.pdf`);
  };

  const handleDeleteRecon = async (r) => {
    const label = r.recon_id ? 'Delete manual override and revert to auto-calculated values' : 'No manual override to delete for this student';
    if (!r.recon_id) { toast.error('No manual override exists — already auto-calculated'); return; }
    if (!window.confirm(`${label} for ${r.name}?`)) return;
    try {
      await api.delete(`/finance/reconciliation/${r.student_id}?year_group=${encodeURIComponent(yearGroup)}`);
      successToast('Reconciliation record deleted');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
  };

  const grandDue = rows.reduce((s, r) => s + (r.total_due || 0), 0);
  const grandPaid = rows.reduce((s, r) => s + (r.total_paid || 0), 0);
  const grandBalance = grandDue - grandPaid;
  const unseenCount = rows.filter(r => r.status !== 'approved').length;
  const seenCount = rows.filter(r => r.status === 'approved').length;
  const hasEdits = Object.keys(edited).length > 0;

  return (
    <div className="space-y-4" data-testid="reconciliation-tab">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={yearGroup} onValueChange={v => setYearGroup(v)}>
            <SelectTrigger className="h-9 w-36 text-sm font-semibold" data-testid="recon-year-select"><SelectValue /></SelectTrigger>
            <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-sm text-slate-500">{rows.length} students | {activeTerm}</span>
          {unseenCount > 0 && <Badge className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5">{unseenCount} unseen</Badge>}
          {seenCount > 0 && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-xs px-2 py-0.5">{seenCount} seen</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {isFinance && hasEdits && (
            <Button className="rounded-md bg-[#2E6CC4] text-sm h-9 px-4" onClick={handleSave} disabled={saving} data-testid="recon-save-btn">
              {saving ? 'Saving...' : `Save Changes (${Object.keys(edited).length})`}
            </Button>
          )}
          {isManagement && unseenCount > 0 && (
            <Button className="rounded-md bg-[#C5A55A] hover:bg-[#b8963e] text-sm h-9 px-4" onClick={handleApprove} data-testid="recon-approve-btn">
              <CheckCircle className="w-4 h-4 mr-1" /> Mark All Seen
            </Button>
          )}
          <Button variant="outline" className="rounded-md text-sm h-9 px-4" onClick={handleDownloadPDF} data-testid="recon-download-btn">
            <Download className="w-4 h-4 mr-1" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-md border-slate-100"><CardContent className="p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Due</p>
          <p className="text-xl font-bold text-[#1B2A4A]">TT$ {grandDue.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
        </CardContent></Card>
        <Card className="rounded-md border-slate-100"><CardContent className="p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Paid</p>
          <p className="text-xl font-bold text-[#C5A55A]">TT$ {grandPaid.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
        </CardContent></Card>
        <Card className="rounded-md border-slate-100"><CardContent className="p-4">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Outstanding</p>
          <p className={`text-xl font-bold ${grandBalance > 0 ? 'text-red-600' : 'text-[#C5A55A]'}`}>TT$ {grandBalance.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
        </CardContent></Card>
      </div>

      {loading ? <AppLoader /> : (
        <div className="bg-white rounded-lg border border-slate-100 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1B2A4A] h-10">
                <TableHead className="text-white text-xs w-10">#</TableHead>
                <TableHead className="text-white text-xs">Student Name</TableHead>
                <TableHead className="text-white text-xs">ADM No.</TableHead>
                <TableHead className="text-white text-xs">Type</TableHead>
                <TableHead className="text-white text-xs text-right">Total Due (GHS)</TableHead>
                <TableHead className="text-white text-xs text-right">Total Paid (GHS)</TableHead>
                <TableHead className="text-white text-xs text-right">Balance (GHS)</TableHead>
                <TableHead className="text-white text-xs text-center">Evidence</TableHead>
                <TableHead className="text-white text-xs">Status</TableHead>
                {isFinance && <TableHead className="text-white text-xs text-center">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.student_id} className={`h-10 ${edited[r.student_id] ? 'bg-amber-50' : idx % 2 === 1 ? 'bg-slate-50/50' : ''}`} data-testid={`recon-row-${r.student_id}`}>
                  <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-semibold whitespace-nowrap">{r.name}</TableCell>
                  <TableCell className="text-xs text-slate-600">{r.admission_number || '-'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[9px] capitalize px-2 py-0.5">{r.boarding_status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {isFinance ? (
                      <Input type="number" step="0.01" className="h-8 text-sm text-right w-28 ml-auto font-medium"
                        value={r.total_due || ''} onChange={e => handleCellChange(idx, 'total_due', e.target.value)}
                        data-testid={`recon-due-${r.student_id}`} />
                    ) : <span className="text-sm font-semibold">{(r.total_due || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {isFinance ? (
                      <Input type="number" step="0.01" className="h-8 text-sm text-right w-28 ml-auto font-medium"
                        value={r.total_paid || ''} onChange={e => handleCellChange(idx, 'total_paid', e.target.value)}
                        data-testid={`recon-paid-${r.student_id}`} />
                    ) : <span className="text-sm font-semibold text-[#C5A55A]">{(r.total_paid || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-bold ${r.balance > 0 ? 'text-red-600' : 'text-[#C5A55A]'}`}>
                      {(r.balance || 0).toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" className="h-8 text-xs text-[#2E6CC4] hover:text-[#1B2A4A]" onClick={() => viewStudentEvidence(r.student_id, r.name)} data-testid={`recon-evidence-${r.student_id}`}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  </TableCell>
                  <TableCell>
                    {isManagement && (r.status === 'pending' || r.status === 'auto') ? (
                      <Badge className="text-xs bg-slate-100 text-slate-500 cursor-pointer hover:bg-[#C5A55A]/15 hover:text-[#C5A55A] transition-colors px-2 py-1"
                        onClick={() => handleApproveOne(r)} data-testid={`recon-seen-${r.student_id}`}>
                        unseen
                      </Badge>
                    ) : (
                      <Badge className={`text-[9px] px-2 py-0.5 ${r.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-slate-100 text-slate-500'}`}>
                        {r.status === 'approved' ? 'seen' : 'unseen'}
                      </Badge>
                    )}
                  </TableCell>
                  {isFinance && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteRecon(r)} title={r.recon_id ? 'Delete manual override' : 'No manual override'} data-testid={`delete-recon-${r.student_id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={isFinance ? 10 : 9} className="text-center py-12 text-slate-400 text-sm">No students in {yearGroup}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Evidence Viewer for Reconciliation */}
      <Dialog open={!!evidenceView} onOpenChange={v => { if (!v) setEvidenceView(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Payment Evidence — {evidenceView?.student_name}</DialogTitle>
            <p className="text-xs text-slate-500">{evidenceView?.payment_count || 0} payment(s) found</p>
          </DialogHeader>
          <div className="space-y-4">
            {(evidenceView?.files || []).length > 0 ? (
              evidenceView.files.map((ef, i) => {
                const token = localStorage.getItem('rw_token');
                const previewUrl = `${BACKEND}/api/files/${ef.file_id}/preview?token=${token}`;
                const downloadUrl = `${BACKEND}/api/files/${ef.file_id}/download?token=${token}`;
                const fileInfo = (ef.content_type || ef.filename || '').toLowerCase();
                const isImage = /image|png|jpg|jpeg|gif|webp/.test(fileInfo);
                const isPdf = /pdf/.test(fileInfo);
                return (
                  <div key={i} className="border rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-[#2E6CC4]" /></div>
                        <div>
                          <p className="text-sm font-semibold">{ef.filename || 'Evidence file'}</p>
                          <p className="text-xs text-slate-400">Ref: {ef.payment_ref} | TT$ {ef.amount?.toLocaleString()} ({ef.method})</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={downloadUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="h-8 text-xs text-[#C5A55A]"><Download className="w-3 h-3 mr-1" />Download</Button></a>
                      </div>
                    </div>
                    {/* Inline preview — same as Payments tab */}
                    <div className="p-2 bg-white">
                      {isImage ? (
                        <img src={previewUrl} alt="Evidence" className="w-full max-h-[500px] object-contain rounded-lg" />
                      ) : isPdf ? (
                        <object data={previewUrl} type="application/pdf" className="w-full h-[500px] rounded-lg border">
                          <iframe src={previewUrl} className="w-full h-[500px] rounded-lg border" title="Evidence PDF" />
                        </object>
                      ) : (
                        <div className="text-center py-8 text-slate-400">
                          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">Preview not available — click Download</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8"><FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-400">No evidence files found for this student's payments</p></div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
