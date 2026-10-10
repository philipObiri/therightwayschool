import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import {
  BookOpen, Plus, ArrowUpDown, Scale, FileText, CheckCircle,
  AlertCircle, DollarSign, TrendingUp, TrendingDown, Trash2,
  Landmark, Loader2, Printer, ChevronDown, ChevronRight, Search,
  Calendar, Building2, BarChart3, CreditCard, Wallet
} from 'lucide-react';

const fmt = (n) => `TT$ ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getPeriodDates(period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  switch (period) {
    case 'month': return { start: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, end: today };
    case 'quarter': {
      const qm = Math.floor(now.getMonth()/3)*3;
      return { start: `${now.getFullYear()}-${String(qm+1).padStart(2,'0')}-01`, end: today };
    }
    case 'year': return { start: `${now.getFullYear()}-01-01`, end: today };
    default: return { start: null, end: null };
  }
}

function PeriodSelector({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) {
  return (
    <div className="flex items-center gap-3 print:hidden" data-testid="period-selector">
      <Calendar className="w-4 h-4 text-slate-400" />
      <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
        {[{l:'Month',v:'month'},{l:'Quarter',v:'quarter'},{l:'Year',v:'year'},{l:'All Time',v:'all'},{l:'Custom',v:'custom'}].map(p => (
          <button key={p.v} onClick={() => setPeriod(p.v)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.v ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            data-testid={`period-${p.v}`}>{p.l}</button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex gap-2 items-center">
          <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-sm" data-testid="period-custom-start" />
          <span className="text-slate-400 text-sm">to</span>
          <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-sm" data-testid="period-custom-end" />
        </div>
      )}
    </div>
  );
}

export default function AccountingModule() {
  const { user } = useAuth();
  const [tab, setTab] = useState('coa');
  const [accounts, setAccounts] = useState([]);
  const [totals, setTotals] = useState({});
  const [journalEntries, setJournalEntries] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [bankTxns, setBankTxns] = useState([]);
  const [reconSummary, setReconSummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateParams = useMemo(() => {
    if (period === 'custom') return { start: customStart || null, end: customEnd || null };
    return getPeriodDates(period);
  }, [period, customStart, customEnd]);

  const dateQuery = useMemo(() => {
    const p = [];
    if (dateParams.start) p.push(`start_date=${dateParams.start}`);
    if (dateParams.end) p.push(`end_date=${dateParams.end}`);
    return p.length ? `?${p.join('&')}` : '';
  }, [dateParams]);

  const loadCoa = useCallback(async () => {
    try { const r = await api.get('/accounting/chart-of-accounts'); setAccounts(r.data.accounts || []); setTotals(r.data.totals || {}); } catch (err) { console.error("Accounting error:", err); }
  }, []);
  const loadDashboard = useCallback(async () => {
    try { const r = await api.get('/accounting/dashboard'); setDashboard(r.data); } catch (err) { console.error("Accounting error:", err); }
  }, []);
  const loadJournalEntries = useCallback(async () => {
    try { const r = await api.get('/accounting/journal-entries'); setJournalEntries(r.data || []); } catch (err) { console.error("Accounting error:", err); }
  }, []);
  const loadTrialBalance = useCallback(async () => {
    try { const r = await api.get(`/accounting/trial-balance${dateQuery}`); setTrialBalance(r.data); } catch (err) { console.error("Accounting error:", err); }
  }, [dateQuery]);
  const loadIncomeStatement = useCallback(async () => {
    try { const r = await api.get(`/accounting/income-statement${dateQuery}`); setIncomeStatement(r.data); } catch (err) { console.error("Accounting error:", err); }
  }, [dateQuery]);
  const loadBalanceSheet = useCallback(async () => {
    try { const r = await api.get(`/accounting/balance-sheet${dateQuery}`); setBalanceSheet(r.data); } catch (err) { console.error("Accounting error:", err); }
  }, [dateQuery]);
  const loadBank = useCallback(async () => {
    try {
      const [txns, summary] = await Promise.all([api.get('/accounting/bank-transactions'), api.get('/accounting/reconciliation-summary')]);
      setBankTxns(txns.data || []); setReconSummary(summary.data);
    } catch (err) { console.error("Accounting error:", err); }
  }, []);

  useEffect(() => { loadCoa(); loadDashboard(); }, [loadCoa, loadDashboard]);
  useEffect(() => {
    if (tab === 'journal') loadJournalEntries();
    if (tab === 'trial') loadTrialBalance();
    if (tab === 'income') loadIncomeStatement();
    if (tab === 'balance') loadBalanceSheet();
    if (tab === 'bank') { loadBank(); loadJournalEntries(); }
  }, [tab, loadJournalEntries, loadTrialBalance, loadIncomeStatement, loadBalanceSheet, loadBank]);

  useEffect(() => {
    if (tab === 'trial') loadTrialBalance();
    if (tab === 'income') loadIncomeStatement();
    if (tab === 'balance') loadBalanceSheet();
  }, [dateQuery]);

  const seedCoa = async () => {
    setLoading(true);
    try { const r = await api.post('/accounting/seed-coa'); successToast(r.data.message); loadCoa(); loadDashboard(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setLoading(false);
  };

  const syncFinance = async () => {
    setLoading(true);
    try {
      const r = await api.post('/accounting/sync-finance');
      successToast(r.data.message);
      loadCoa(); loadDashboard();
      if (tab === 'journal') loadJournalEntries();
      if (tab === 'trial') loadTrialBalance();
      if (tab === 'income') loadIncomeStatement();
      if (tab === 'balance') loadBalanceSheet();
    } catch (e) { toast.error(e.response?.data?.detail || 'Sync failed'); }
    setLoading(false);
  };

  const periodLabel = useMemo(() => {
    if (period === 'all') return 'All Time';
    if (period === 'custom' && customStart && customEnd) return `${customStart} to ${customEnd}`;
    const d = getPeriodDates(period);
    if (d.start && d.end) return `${d.start} to ${d.end}`;
    return 'All Time';
  }, [period, customStart, customEnd]);

  const TC = { asset: 'bg-blue-50 text-blue-700 border-blue-200', liability: 'bg-red-50 text-red-700 border-red-200', equity: 'bg-blue-50 text-[#1B2A4A] border-blue-200', revenue: 'bg-[#C5A55A]/10 text-[#C5A55A] border-[#C5A55A]/30', expense: 'bg-amber-50 text-amber-700 border-amber-200' };

  return (
    <div className="space-y-5" data-testid="accounting-module">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-[#1B2A4A]" data-testid="accounting-title">Accounting</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">Double-entry bookkeeping & financial reports</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Button onClick={syncFinance} disabled={loading} variant="outline" className="h-10 px-5 border-[#C5A55A]/40 text-[#C5A55A] hover:bg-[#C5A55A]/10" data-testid="sync-finance-btn">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />} Sync Finance Data
          </Button>
          {accounts.length === 0 && (
            <Button onClick={seedCoa} disabled={loading} className="bg-[#1B2A4A] h-10 px-5" data-testid="seed-coa-btn">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />} Initialize Accounts
            </Button>
          )}
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 print:hidden" data-testid="dashboard-cards">
          {[
            { label: 'Total Assets', value: dashboard.total_assets, icon: Building2, color: 'text-blue-600' },
            { label: 'Revenue', value: dashboard.total_revenue, icon: TrendingUp, color: 'text-[#C5A55A]' },
            { label: 'Expenses', value: dashboard.total_expenses, icon: TrendingDown, color: 'text-red-500' },
            { label: 'Net Income', value: dashboard.net_income, icon: DollarSign, color: dashboard.net_income >= 0 ? 'text-[#C5A55A]' : 'text-red-600' },
            { label: 'Liabilities', value: dashboard.total_liabilities, icon: Scale, color: 'text-orange-500' },
            { label: 'Journal Entries', value: null, count: dashboard.journal_count, icon: FileText, color: 'text-slate-600' },
          ].map((c, i) => (
            <Card key={i} className="border border-slate-200 shadow-none"><CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between mb-1"><span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">{c.label}</span><c.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${c.color}`} /></div>
              <p className={`text-base md:text-xl font-bold ${c.color} tabular-nums`}>{c.count !== undefined ? c.count : fmt(c.value)}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
          <TabsList className="bg-slate-100 h-auto flex-wrap gap-0.5 p-1">
            {[
              {v:'coa',l:'Accounts'},{v:'journal',l:'Journals'},{v:'ledger',l:'Ledger'},
              {v:'trial',l:'Trial Balance'},{v:'income',l:'Income'},{v:'balance',l:'Balance Sheet'},{v:'bank',l:'Bank Recon'}
            ].map(t => <TabsTrigger key={t.v} value={t.v} className="text-xs md:text-sm h-7 md:h-8 px-2 md:px-4" data-testid={`tab-${t.v}`}>{t.l}</TabsTrigger>)}
          </TabsList>
          {['trial','income','balance','ledger'].includes(tab) && (
            <PeriodSelector period={period} setPeriod={setPeriod} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd} />
          )}
        </div>

        <TabsContent value="coa" className="mt-4"><CoaTab accounts={accounts} totals={totals} typeColors={TC} onRefresh={() => { loadCoa(); loadDashboard(); }} /></TabsContent>
        <TabsContent value="journal" className="mt-4"><JournalTab entries={journalEntries} accounts={accounts} onRefresh={() => { loadJournalEntries(); loadCoa(); loadDashboard(); }} /></TabsContent>
        <TabsContent value="ledger" className="mt-4"><LedgerTab accounts={accounts} dateQuery={dateQuery} /></TabsContent>
        <TabsContent value="trial" className="mt-4">{trialBalance ? <TrialBalanceReport data={trialBalance} periodLabel={periodLabel} /> : <LoadingState />}</TabsContent>
        <TabsContent value="income" className="mt-4">{incomeStatement ? <IncomeStatementReport data={incomeStatement} periodLabel={periodLabel} /> : <LoadingState />}</TabsContent>
        <TabsContent value="balance" className="mt-4">{balanceSheet ? <BalanceSheetReport data={balanceSheet} periodLabel={periodLabel} /> : <LoadingState />}</TabsContent>
        <TabsContent value="bank" className="mt-4"><BankReconciliationTab txns={bankTxns} summary={reconSummary} entries={journalEntries} onRefresh={loadBank} /></TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingState() { return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>; }
function PrintBtn() { return <Button variant="outline" size="sm" className="print:hidden gap-2" onClick={() => window.print()} data-testid="print-btn"><Printer className="w-4 h-4" />Print</Button>; }

function ReportHeader({ title, subtitle, periodLabel }) {
  return (
    <div className="text-center mb-6 print:mb-4">
      <p className="text-xs font-semibold text-[#2A7A5A] uppercase tracking-widest">RightWay Centre</p>
      <h2 className="text-2xl font-bold text-[#1A1A2E] mt-1">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      <p className="text-sm text-slate-400 mt-1">Period: {periodLabel}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CHART OF ACCOUNTS
   ═══════════════════════════════════════════════ */
function CoaTab({ accounts, totals, typeColors, onRefresh }) {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'asset', category: '' });
  const [search, setSearch] = useState('');
  const filtered = accounts.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search));

  const create = async () => {
    try { await api.post('/accounting/chart-of-accounts', form); successToast('Account created'); setDialog(false); setForm({ code: '', name: '', type: 'asset', category: '' }); onRefresh(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this account?')) return;
    try { await api.delete(`/accounting/chart-of-accounts/${id}`); successToast('Account deactivated'); onRefresh(); } catch (e) { toast.error('Failed'); }
  };

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(a => { const cat = a.category || a.type; if (!g[cat]) g[cat] = []; g[cat].push(a); });
    return g;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{k:'asset',l:'Assets'},{k:'liability',l:'Liabilities'},{k:'equity',l:'Equity'},{k:'revenue',l:'Revenue'},{k:'expense',l:'Expenses'}].map(({k:t,l}) => (
          <Card key={t} className="border border-slate-200 shadow-none"><CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">{l}</p>
            <p className="text-2xl font-bold text-[#1B2A4A] mt-1 tabular-nums">{fmt(totals[t])}</p>
          </CardContent></Card>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-9 h-9" data-testid="coa-search" /></div>
        <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild>
          <Button className="bg-[#1B2A4A] h-9 px-4 text-sm" data-testid="add-account-btn"><Plus className="w-4 h-4 mr-1.5" />Add Account</Button>
        </DialogTrigger><DialogContent><DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader><div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Account Code</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. 1030" data-testid="acct-code" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Type</Label><Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger data-testid="acct-type"><SelectValue /></SelectTrigger><SelectContent>{['asset','liability','equity','revenue','expense'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Account Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Account name" data-testid="acct-name" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Category</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Current Assets" data-testid="acct-cat" /></div>
          <Button className="w-full bg-[#1B2A4A]" onClick={create} data-testid="submit-account">Create Account</Button>
        </div></DialogContent></Dialog>
      </div>
      {Object.entries(grouped).map(([cat, accts]) => (
        <div key={cat}>
          <div className="bg-slate-50 px-4 py-2 rounded-t-lg border border-slate-200 border-b-0">
            <span className="text-sm font-semibold text-[#1B2A4A]">{cat}</span>
            <span className="text-xs text-slate-400 ml-2">({accts.length})</span>
          </div>
          <div className="overflow-x-auto">
          <Table className="border border-slate-200 rounded-b-lg min-w-[550px]"><TableHeader><TableRow>
            <TableHead className="w-24 bg-white text-xs font-semibold text-slate-500">CODE</TableHead>
            <TableHead className="bg-white text-xs font-semibold text-slate-500">ACCOUNT</TableHead>
            <TableHead className="w-28 bg-white text-xs font-semibold text-slate-500">TYPE</TableHead>
            <TableHead className="w-36 bg-white text-xs font-semibold text-slate-500 text-right">BALANCE</TableHead>
            <TableHead className="w-12 bg-white"></TableHead>
          </TableRow></TableHeader><TableBody>{accts.map(a => (
            <TableRow key={a.account_id} className="hover:bg-slate-50/50">
              <TableCell className="font-mono text-sm font-medium text-slate-700">{a.code}</TableCell>
              <TableCell className="text-sm font-medium">{a.name}</TableCell>
              <TableCell><Badge variant="outline" className={`text-xs border ${typeColors[a.type]}`}>{a.type}</Badge></TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{fmt(a.balance)}</TableCell>
              <TableCell><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => deactivate(a.account_id)} data-testid={`delete-${a.code}`}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
            </TableRow>))}</TableBody></Table>
          </div>
        </div>
      ))}
      {filtered.length === 0 && <p className="text-center text-slate-400 py-8">No accounts found</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   JOURNAL ENTRIES
   ═══════════════════════════════════════════════ */
function JournalTab({ entries, accounts, onRefresh }) {
  const [dialog, setDialog] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ description: '', reference: '', entry_date: new Date().toISOString().split('T')[0] });
  const [lines, setLines] = useState([{ account_code: '', debit: 0, credit: 0, memo: '' }, { account_code: '', debit: 0, credit: 0, memo: '' }]);

  const addLine = () => setLines([...lines, { account_code: '', debit: 0, credit: 0, memo: '' }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i, f, v) => { const n = [...lines]; n[i] = { ...n[i], [f]: v }; setLines(n); };
  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const submit = async () => {
    if (!balanced) { toast.error('Debits must equal Credits'); return; }
    try {
      await api.post('/accounting/journal-entries', { ...form, lines: lines.filter(l => l.account_code) });
      successToast('Journal entry posted'); setDialog(false); onRefresh();
      setLines([{ account_code: '', debit: 0, credit: 0, memo: '' }, { account_code: '', debit: 0, credit: 0, memo: '' }]);
      setForm({ description: '', reference: '', entry_date: new Date().toISOString().split('T')[0] });
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{entries.length} entries</p>
        <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild>
          <Button className="bg-[#1B2A4A] h-9 px-4 text-sm" data-testid="new-journal-btn"><Plus className="w-4 h-4 mr-1.5" />New Journal Entry</Button>
        </DialogTrigger><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader><div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={form.entry_date} onChange={e => setForm({...form, entry_date: e.target.value})} data-testid="je-date" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description *" data-testid="je-desc" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Reference</Label><Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="Ref #" data-testid="je-ref" /></div>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table className="min-w-[550px]"><TableHeader><TableRow className="bg-slate-50">
              <TableHead className="text-xs font-semibold">ACCOUNT</TableHead>
              <TableHead className="text-xs font-semibold w-28">DEBIT</TableHead>
              <TableHead className="text-xs font-semibold w-28">CREDIT</TableHead>
              <TableHead className="text-xs font-semibold w-32">MEMO</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow></TableHeader><TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="py-1.5"><SearchableSelect
                    options={accounts.map(a => ({ value: a.code, label: `${a.code} - ${a.name}` }))}
                    value={l.account_code}
                    onValueChange={v => updateLine(i, 'account_code', v)}
                    placeholder="Search account..."
                    className="h-8 text-sm w-full"
                  /></TableCell>
                  <TableCell className="py-1.5"><Input type="number" value={l.debit || ''} onChange={e => { updateLine(i, 'debit', parseFloat(e.target.value) || 0); if (parseFloat(e.target.value) > 0) updateLine(i, 'credit', 0); }} className="h-8 text-sm font-mono text-right" /></TableCell>
                  <TableCell className="py-1.5"><Input type="number" value={l.credit || ''} onChange={e => { updateLine(i, 'credit', parseFloat(e.target.value) || 0); if (parseFloat(e.target.value) > 0) updateLine(i, 'debit', 0); }} className="h-8 text-sm font-mono text-right" /></TableCell>
                  <TableCell className="py-1.5"><Input value={l.memo} onChange={e => updateLine(i, 'memo', e.target.value)} className="h-8 text-sm" placeholder="memo" /></TableCell>
                  <TableCell className="py-1.5">{lines.length > 2 && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => removeLine(i)}><Trash2 className="w-3.5 h-3.5" /></Button>}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50 font-semibold">
                <TableCell className="text-sm">Totals</TableCell>
                <TableCell className={`text-right font-mono text-sm ${!balanced ? 'text-red-600' : ''}`}>{fmtNum(totalDebit)}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${!balanced ? 'text-red-600' : ''}`}>{fmtNum(totalCredit)}</TableCell>
                <TableCell colSpan={2}>{balanced ? <Badge className="bg-[#C5A55A]/10 text-[#C5A55A] border-[#C5A55A]/30 text-xs">Balanced</Badge> : <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">Off by {fmtNum(Math.abs(totalDebit - totalCredit))}</Badge>}</TableCell>
              </TableRow>
            </TableBody></Table>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={addLine} className="text-sm">+ Add Line</Button>
            <Button className="bg-[#C5A55A] hover:bg-[#b8963e]" onClick={submit} disabled={!balanced} data-testid="post-journal">Post Entry</Button>
          </div>
        </div></DialogContent></Dialog>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table><TableHeader><TableRow className="bg-slate-50">
          <TableHead className="w-8"></TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">DATE</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">DESCRIPTION</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">REF</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500 text-right">DEBIT</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500 text-right">CREDIT</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">STATUS</TableHead>
        </TableRow></TableHeader><TableBody>
          {entries.map(e => (
            <React.Fragment key={e.entry_id}>
              <TableRow className="cursor-pointer hover:bg-slate-50/80" onClick={() => setExpandedId(expandedId === e.entry_id ? null : e.entry_id)}>
                <TableCell className="py-2">{expandedId === e.entry_id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</TableCell>
                <TableCell className="text-sm text-slate-600 font-mono">{e.entry_date}</TableCell>
                <TableCell className="text-sm font-medium">{e.description}</TableCell>
                <TableCell className="text-xs text-slate-400">{e.reference}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{fmtNum(e.total_debit)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{fmtNum(e.total_credit)}</TableCell>
                <TableCell className="flex gap-1.5 items-center"><Badge className="bg-[#C5A55A]/10 text-[#C5A55A] border-[#C5A55A]/30 text-xs">{e.status}</Badge>{e.source === 'finance_auto' && <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs">Finance</Badge>}</TableCell>
              </TableRow>
              {expandedId === e.entry_id && e.lines?.map((l, i) => (
                <TableRow key={i} className="bg-slate-50/50">
                  <TableCell></TableCell>
                  <TableCell className="text-xs text-slate-400 pl-6">{l.line_num}</TableCell>
                  <TableCell className="text-sm pl-6"><span className="font-mono text-slate-500 mr-2">{l.account_code}</span>{l.account_name}</TableCell>
                  <TableCell className="text-xs text-slate-400 italic">{l.memo}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{l.debit > 0 ? fmtNum(l.debit) : ''}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{l.credit > 0 ? fmtNum(l.credit) : ''}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody></Table>
      </div>
      {entries.length === 0 && <p className="text-center text-slate-400 py-10">No journal entries yet. Post your first entry above.</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   GENERAL LEDGER
   ═══════════════════════════════════════════════ */
function LedgerTab({ accounts, dateQuery }) {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [lines, setLines] = useState([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

  const load = async (code) => {
    setSelectedAccount(code);
    const acctQ = code ? `account_code=${code}` : '';
    const sep = dateQuery ? (acctQ ? `${dateQuery}&${acctQ}` : dateQuery) : (acctQ ? `?${acctQ}` : '');
    try { const r = await api.get(`/accounting/general-ledger${sep}`); setLines(r.data.lines || []); setTotals({ debit: r.data.total_debit || 0, credit: r.data.total_credit || 0 }); } catch (err) { console.error("Accounting error:", err); }
  };
  useEffect(() => { load(selectedAccount); }, [dateQuery]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 max-w-sm space-y-1.5">
          <Label className="text-xs font-medium text-slate-500">Filter by Account</Label>
          <SearchableSelect
            options={[{ value: 'all', label: 'All Accounts' }, ...accounts.map(a => ({ value: a.code, label: `${a.code} - ${a.name}` }))]}
            value={selectedAccount || 'all'}
            onValueChange={v => load(v === 'all' ? '' : v)}
            placeholder="Filter by account..."
            className="h-9 w-full"
            data-testid="ledger-account-filter"
          />
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table><TableHeader><TableRow className="bg-slate-50">
          <TableHead className="text-xs font-semibold text-slate-500">DATE</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">DESCRIPTION</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">REF</TableHead>
          {!selectedAccount && <TableHead className="text-xs font-semibold text-slate-500">ACCOUNT</TableHead>}
          <TableHead className="text-xs font-semibold text-slate-500 text-right">DEBIT</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500 text-right">CREDIT</TableHead>
          {selectedAccount && <TableHead className="text-xs font-semibold text-slate-500 text-right">BALANCE</TableHead>}
        </TableRow></TableHeader><TableBody>
          {lines.map((l, i) => (
            <TableRow key={i} className="hover:bg-slate-50/50">
              <TableCell className="text-sm font-mono text-slate-600">{l.entry_date}</TableCell>
              <TableCell className="text-sm">{l.description}</TableCell>
              <TableCell className="text-xs text-slate-400">{l.reference}</TableCell>
              {!selectedAccount && <TableCell className="text-sm"><span className="font-mono text-slate-500 mr-1">{l.account_code}</span>{l.account_name}</TableCell>}
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{l.debit > 0 ? fmtNum(l.debit) : ''}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{l.credit > 0 ? fmtNum(l.credit) : ''}</TableCell>
              {selectedAccount && <TableCell className="text-right font-mono text-sm font-bold tabular-nums text-[#1B2A4A]">{fmtNum(l.running_balance)}</TableCell>}
            </TableRow>
          ))}
          {lines.length > 0 && (
            <TableRow className="bg-slate-50 font-bold border-t-2 border-slate-300">
              <TableCell colSpan={selectedAccount ? 3 : 4} className="text-sm">Totals</TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{fmtNum(totals.debit)}</TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{fmtNum(totals.credit)}</TableCell>
              {selectedAccount && <TableCell></TableCell>}
            </TableRow>
          )}
        </TableBody></Table>
      </div>
      {lines.length === 0 && <p className="text-center text-slate-400 py-10">No ledger entries{selectedAccount ? ' for this account' : ''}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TRIAL BALANCE
   ═══════════════════════════════════════════════ */
function TrialBalanceReport({ data, periodLabel }) {
  const grouped = useMemo(() => {
    const g = {};
    data.trial_balance.forEach(a => { const cat = a.category || a.type; if (!g[cat]) g[cat] = []; g[cat].push(a); });
    return g;
  }, [data]);

  return (
    <Card className="border shadow-none print:shadow-none print:border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4 print:hidden"><div /><PrintBtn /></div>
        <ReportHeader title="Trial Balance" periodLabel={periodLabel} />
        <div className="border rounded-lg overflow-hidden">
          <Table><TableHeader><TableRow className="bg-[#1B2A4A]">
            <TableHead className="text-xs font-semibold text-white/80">CODE</TableHead>
            <TableHead className="text-xs font-semibold text-white/80">ACCOUNT</TableHead>
            <TableHead className="text-xs font-semibold text-white/80">TYPE</TableHead>
            <TableHead className="text-xs font-semibold text-white/80 text-right">DEBIT (GHS)</TableHead>
            <TableHead className="text-xs font-semibold text-white/80 text-right">CREDIT (GHS)</TableHead>
          </TableRow></TableHeader><TableBody>
            {Object.entries(grouped).map(([cat, accts]) => {
              const catDebit = accts.reduce((s, a) => s + a.debit, 0);
              const catCredit = accts.reduce((s, a) => s + a.credit, 0);
              return (
                <React.Fragment key={cat}>
                  <TableRow className="bg-slate-50"><TableCell colSpan={5} className="text-xs font-bold text-[#1B2A4A] uppercase tracking-wide py-1.5">{cat}</TableCell></TableRow>
                  {accts.map(a => (
                    <TableRow key={a.code} className="hover:bg-blue-50/30">
                      <TableCell className="font-mono text-sm text-slate-600 pl-6">{a.code}</TableCell>
                      <TableCell className="text-sm">{a.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{a.type}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{a.debit > 0 ? fmtNum(a.debit) : '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{a.credit > 0 ? fmtNum(a.credit) : '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t border-slate-200">
                    <TableCell colSpan={3} className="text-xs font-semibold text-slate-500 pl-6">Subtotal: {cat}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{catDebit > 0 ? fmtNum(catDebit) : '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">{catCredit > 0 ? fmtNum(catCredit) : '-'}</TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            <TableRow className="bg-[#1B2A4A]">
              <TableCell colSpan={3} className="font-bold text-white text-sm">TOTALS</TableCell>
              <TableCell className="text-right font-mono text-sm font-bold text-white tabular-nums">{fmtNum(data.total_debit)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-bold text-white tabular-nums">{fmtNum(data.total_credit)}</TableCell>
            </TableRow>
          </TableBody></Table>
        </div>
        <div className="mt-3 flex justify-center">
          {data.balanced ? <Badge className="bg-[#C5A55A]/10 text-[#C5A55A] border border-[#C5A55A]/30 text-sm px-4 py-1"><CheckCircle className="w-4 h-4 mr-1.5" />Balanced</Badge>
            : <Badge className="bg-red-50 text-red-700 border border-red-200 text-sm px-4 py-1"><AlertCircle className="w-4 h-4 mr-1.5" />Unbalanced (Diff: {fmt(Math.abs(data.total_debit - data.total_credit))})</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════
   INCOME STATEMENT (P&L)
   ═══════════════════════════════════════════════ */
function IncomeStatementReport({ data, periodLabel }) {
  const groupBy = (items) => {
    const g = {};
    items.forEach(i => { const cat = i.category || 'Other'; if (!g[cat]) g[cat] = []; g[cat].push(i); });
    return g;
  };
  const revenueGroups = groupBy(data.revenue);
  const expenseGroups = groupBy(data.expenses);

  return (
    <Card className="border shadow-none print:shadow-none print:border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4 print:hidden"><div /><PrintBtn /></div>
        <ReportHeader title="Income Statement" subtitle="Profit & Loss" periodLabel={periodLabel} />
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-[#C5A55A]/30">
              <TrendingUp className="w-5 h-5 text-[#C5A55A]" />
              <h3 className="text-lg font-bold text-[#C5A55A]">Revenue</h3>
            </div>
            {Object.entries(revenueGroups).map(([cat, items]) => (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 pl-4">{cat}</p>
                {items.map(r => (
                  <div key={r.code} className="flex justify-between py-1.5 pl-8 pr-2 hover:bg-[#C5A55A]/10/30 rounded">
                    <span className="text-sm"><span className="font-mono text-slate-400 mr-2">{r.code}</span>{r.name}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{fmtNum(r.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between py-2 px-2 border-t border-[#C5A55A]/30 font-bold text-[#C5A55A]">
              <span>Total Revenue</span><span className="font-mono tabular-nums">{fmt(data.total_revenue)}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-red-200">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-bold text-red-600">Expenses</h3>
            </div>
            {Object.entries(expenseGroups).map(([cat, items]) => (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 pl-4">{cat}</p>
                {items.map(ex => (
                  <div key={ex.code} className="flex justify-between py-1.5 pl-8 pr-2 hover:bg-red-50/30 rounded">
                    <span className="text-sm"><span className="font-mono text-slate-400 mr-2">{ex.code}</span>{ex.name}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{fmtNum(ex.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between py-2 px-2 border-t border-red-200 font-bold text-red-600">
              <span>Total Expenses</span><span className="font-mono tabular-nums">{fmt(data.total_expenses)}</span>
            </div>
          </div>
          <div className="border-t-4 border-[#1B2A4A] pt-4 mt-4">
            <div className="flex justify-between text-xl font-bold">
              <span className="text-[#1B2A4A]">Net Income</span>
              <span className={`font-mono tabular-nums ${data.net_income >= 0 ? 'text-[#C5A55A]' : 'text-red-600'}`}>{fmt(data.net_income)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════
   BALANCE SHEET
   ═══════════════════════════════════════════════ */
function BalanceSheetReport({ data, periodLabel }) {
  const groupBy = (items) => {
    const g = {};
    items.forEach(i => { const cat = i.category || 'Other'; if (!g[cat]) g[cat] = []; g[cat].push(i); });
    return g;
  };

  const Section = ({ title, items, total, color, borderColor }) => {
    const groups = groupBy(items);
    return (
      <div className="mb-6">
        <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${borderColor}`}>
          <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
        </div>
        {Object.entries(groups).map(([cat, catItems]) => {
          const catTotal = catItems.reduce((s, a) => s + (a.balance || 0), 0);
          return (
            <div key={cat} className="mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 pl-4">{cat}</p>
              {catItems.map(a => (
                <div key={a.code} className="flex justify-between py-1.5 pl-8 pr-2 hover:bg-slate-50 rounded">
                  <span className="text-sm"><span className="font-mono text-slate-400 mr-2">{a.code}</span>{a.name}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">{fmtNum(a.balance)}</span>
                </div>
              ))}
              {Object.keys(groups).length > 1 && (
                <div className="flex justify-between py-1 pl-8 pr-2 text-xs text-slate-500 border-t border-slate-100 mt-1">
                  <span className="font-semibold">Total {cat}</span><span className="font-mono font-semibold tabular-nums">{fmtNum(catTotal)}</span>
                </div>
              )}
            </div>
          );
        })}
        <div className={`flex justify-between py-2 px-2 border-t-2 ${borderColor} font-bold ${color}`}>
          <span>Total {title}</span><span className="font-mono tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="border shadow-none print:shadow-none print:border-0">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4 print:hidden"><div /><PrintBtn /></div>
        <ReportHeader title="Balance Sheet" subtitle="Statement of Financial Position" periodLabel={periodLabel} />
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div>
            <Section title="Assets" items={data.assets} total={data.total_assets} color="text-blue-700" borderColor="border-blue-200" />
          </div>
          <div>
            <Section title="Liabilities" items={data.liabilities} total={data.total_liabilities} color="text-red-600" borderColor="border-red-200" />
            <Section title="Equity" items={data.equity} total={data.total_equity} color="text-[#1B2A4A]" borderColor="border-blue-200" />
            {data.net_income !== 0 && (
              <div className="flex justify-between py-2 px-2 text-[#C5A55A] font-semibold border-t border-slate-200 mb-2">
                <span>Net Income</span><span className="font-mono tabular-nums">{fmt(data.net_income)}</span>
              </div>
            )}
            <div className="border-t-4 border-[#1B2A4A] pt-3">
              <div className="flex justify-between font-bold text-lg text-[#1B2A4A]">
                <span>Total L + Equity</span><span className="font-mono tabular-nums">{fmt(data.total_liabilities_equity)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          {data.balanced ? <Badge className="bg-[#C5A55A]/10 text-[#C5A55A] border border-[#C5A55A]/30 text-sm px-4 py-1"><CheckCircle className="w-4 h-4 mr-1.5" />Assets = Liabilities + Equity</Badge>
            : <Badge className="bg-red-50 text-red-700 border border-red-200 text-sm px-4 py-1"><AlertCircle className="w-4 h-4 mr-1.5" />Unbalanced</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════
   BANK RECONCILIATION
   ═══════════════════════════════════════════════ */
function BankReconciliationTab({ txns, summary, entries, onRefresh }) {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ date: '', description: '', amount: 0, type: 'credit', reference: '' });

  const addTxn = async () => {
    try { await api.post('/accounting/bank-transactions', form); successToast('Transaction added'); setDialog(false); setForm({ date: '', description: '', amount: 0, type: 'credit', reference: '' }); onRefresh(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const reconcile = async (txnId, entryId) => {
    try { await api.post(`/accounting/bank-reconcile/${txnId}`, { entry_id: entryId }); successToast('Reconciled'); onRefresh(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Bank Balance', value: summary.bank_balance, icon: Landmark, color: 'text-[#1B2A4A]' },
            { label: 'Book Balance', value: summary.book_balance, icon: BookOpen, color: 'text-blue-600' },
            { label: 'Difference', value: summary.difference, icon: ArrowUpDown, color: summary.difference === 0 ? 'text-[#C5A55A]' : 'text-red-600' },
            { label: 'Unmatched', value: null, count: summary.unmatched_count, icon: AlertCircle, color: 'text-amber-600' },
          ].map((c, i) => (
            <Card key={i} className="border border-slate-200 shadow-none"><CardContent className="p-4">
              <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-slate-500 uppercase">{c.label}</span><c.icon className={`w-4 h-4 ${c.color}`} /></div>
              <p className={`text-2xl font-bold ${c.color} tabular-nums`}>{c.count !== undefined ? c.count : fmt(c.value)}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Dialog open={dialog} onOpenChange={setDialog}><DialogTrigger asChild>
          <Button className="bg-[#1B2A4A] h-9 px-4 text-sm" data-testid="add-bank-txn-btn"><Plus className="w-4 h-4 mr-1.5" />Add Transaction</Button>
        </DialogTrigger><DialogContent><DialogHeader><DialogTitle>Bank Transaction</DialogTitle></DialogHeader><div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Type</Label><Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="credit">Deposit</SelectItem><SelectItem value="debit">Withdrawal</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Amount (GHS)</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Reference</Label><Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <Button className="w-full bg-[#1B2A4A]" onClick={addTxn} data-testid="submit-bank-txn">Add Transaction</Button>
        </div></DialogContent></Dialog>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table><TableHeader><TableRow className="bg-slate-50">
          <TableHead className="text-xs font-semibold text-slate-500">DATE</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">DESCRIPTION</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">REF</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500 text-right">AMOUNT</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">STATUS</TableHead>
          <TableHead className="text-xs font-semibold text-slate-500">ACTION</TableHead>
        </TableRow></TableHeader><TableBody>
          {txns.map(t => (
            <TableRow key={t.txn_id} className="hover:bg-slate-50/50">
              <TableCell className="text-sm font-mono text-slate-600">{t.date}</TableCell>
              <TableCell className="text-sm">{t.description}</TableCell>
              <TableCell className="text-xs text-slate-400">{t.reference}</TableCell>
              <TableCell className={`text-right font-mono text-sm font-semibold tabular-nums ${t.type === 'credit' ? 'text-[#C5A55A]' : 'text-red-600'}`}>{t.type === 'credit' ? '+' : '-'} {fmt(Math.abs(t.amount))}</TableCell>
              <TableCell>{t.matched ? <Badge className="bg-[#C5A55A]/10 text-[#C5A55A] border-[#C5A55A]/30 text-xs">Matched</Badge> : <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Unmatched</Badge>}</TableCell>
              <TableCell>{!t.matched && entries.length > 0 && (
                <SearchableSelect
                  options={entries.map(e => ({ value: e.entry_id, label: `${e.description} (${fmtNum(e.total_debit)})` }))}
                  value=""
                  onValueChange={v => reconcile(t.txn_id, v)}
                  placeholder="Match entry..."
                  className="w-44 h-7 text-xs"
                />
              )}</TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </div>
      {txns.length === 0 && <p className="text-center text-slate-400 py-10">No bank transactions. Import from bank statement or add manually.</p>}
    </div>
  );
}
