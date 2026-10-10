import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { AppLoader } from '../../../components/AppLoader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, Download, Printer, FileText } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND = import.meta.env.VITE_API_URL;
const COLORS = ['#2E6CC4', '#C5A55A', '#F59E0B', '#DC2626', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export function ReportsTab() {
  const [period, setPeriod] = useState('month');
  const [incomeExpense, setIncomeExpense] = useState(null);
  const [deptSummary, setDeptSummary] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('overview');
  const [downloading, setDownloading] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ie, dept, fin] = await Promise.all([
        api.get('/finance/reports/income-expense', { params: { period } }),
        api.get('/finance/reports/department-summary'),
        api.get('/finance/reports/financial-summary'),
      ]);
      setIncomeExpense(ie.data);
      setDeptSummary(dept.data);
      setFinancialSummary(fin.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  useEffect(() => {
    api.get('/finance/reports/income-expense', { params: { period } }).then(r => setIncomeExpense(r.data)).catch(() => {});
  }, [period]);

  const downloadPdf = async (type, params = {}) => {
    setDownloading(type);
    try {
      const queryStr = new URLSearchParams(params).toString();
      const url = `${BACKEND}/api/finance/reports/pdf/${type}${queryStr ? '?' + queryStr : ''}`;
      const token = localStorage.getItem('rw_token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const disposition = res.headers.get('content-disposition');
      const filename = disposition?.match(/filename="?(.+?)"?$/)?.[1] || `RightWay_Report_${type}.pdf`;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error('Download failed');
    }
    setDownloading('');
  };

  const printPdf = async (type, params = {}) => {
    setDownloading(type);
    try {
      const queryStr = new URLSearchParams(params).toString();
      const url = `${BACKEND}/api/finance/reports/pdf/${type}${queryStr ? '?' + queryStr : ''}`;
      const token = localStorage.getItem('rw_token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Print failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const printWin = window.open(blobUrl, '_blank');
      if (printWin) {
        printWin.onload = () => { printWin.print(); };
      }
    } catch (e) {
      toast.error('Print failed');
    }
    setDownloading('');
  };

  if (loading) return <AppLoader />;

  const fin = financialSummary || {};

  const PdfActions = ({ type, params = {} }) => (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline" size="sm"
        className="text-xs rounded-md border-[#2E6CC4]/30 text-[#2E6CC4] hover:bg-[#2E6CC4]/5"
        onClick={() => downloadPdf(type, params)}
        disabled={!!downloading}
        data-testid={`pdf-download-${type}`}
      >
        {downloading === type ? <div className="w-3 h-3 border-2 border-[#2E6CC4] border-t-transparent rounded-full animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
        Download PDF
      </Button>
      <Button
        variant="outline" size="sm"
        className="text-xs rounded-md border-slate-200 text-slate-600 hover:bg-slate-50"
        onClick={() => printPdf(type, params)}
        disabled={!!downloading}
        data-testid={`pdf-print-${type}`}
      >
        <Printer className="w-3 h-3 mr-1" /> Print
      </Button>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="reports-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Financial Reports</h2><p className="text-xs text-slate-500">Comprehensive financial analysis and summaries</p></div>
        <div className="flex gap-2">
          <Button variant={view === 'overview' ? 'default' : 'outline'} size="sm" className="text-xs rounded-md" onClick={() => setView('overview')}>Overview</Button>
          <Button variant={view === 'income' ? 'default' : 'outline'} size="sm" className="text-xs rounded-md" onClick={() => setView('income')}>Income/Expense</Button>
          <Button variant={view === 'department' ? 'default' : 'outline'} size="sm" className="text-xs rounded-md" onClick={() => setView('department')}>Department</Button>
        </div>
      </div>

      {view === 'overview' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Financial Overview</p>
            <div className="flex gap-1.5">
              <PdfActions type="overview" />
              <Button variant="outline" size="sm" className="text-xs rounded-md border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => downloadPdf('outstanding')} disabled={!!downloading} data-testid="pdf-download-outstanding">
                <FileText className="w-3 h-3 mr-1" /> Outstanding Fees PDF
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card"><div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><DollarSign className="w-5 h-5 text-[#2E6CC4]" /></div><p className="text-2xl font-bold" data-testid="total-invoiced">TT$ {(fin.all_time_invoiced || 0).toLocaleString()}</p><p className="text-sm text-slate-500">Total Invoiced</p></div>
            <div className="stat-card"><div className="w-10 h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center mb-2"><TrendingUp className="w-5 h-5 text-[#C5A55A]" /></div><p className="text-2xl font-bold text-[#C5A55A]" data-testid="total-collected">TT$ {(fin.all_time_collected || 0).toLocaleString()}</p><p className="text-sm text-slate-500">Collected</p></div>
            <div className="stat-card"><div className="w-10 h-10 rounded-md bg-red-50 flex items-center justify-center mb-2"><TrendingDown className="w-5 h-5 text-[#DC2626]" /></div><p className="text-2xl font-bold text-[#DC2626]" data-testid="total-expenses-all">TT$ {(fin.all_time_expenses || 0).toLocaleString()}</p><p className="text-sm text-slate-500">Total Expenses</p></div>
            <div className="stat-card"><div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><Users className="w-5 h-5 text-[#2E6CC4]" /></div><p className="text-2xl font-bold">{fin.total_staff_on_payroll || 0}</p><p className="text-sm text-slate-500">Staff on Payroll</p></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded-md p-3"><p className="text-[10px] text-slate-500">This Month Income</p><p className="text-lg font-bold text-[#C5A55A]">TT$ {(fin.month_income || 0).toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3"><p className="text-[10px] text-slate-500">This Month Expenses</p><p className="text-lg font-bold text-red-600">TT$ {(fin.month_expenses || 0).toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3"><p className="text-[10px] text-slate-500">Monthly Payroll</p><p className="text-lg font-bold text-[#2E6CC4]">TT$ {(fin.monthly_payroll || 0).toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3"><p className="text-[10px] text-slate-500">Petty Cash Balance</p><p className="text-lg font-bold">TT$ {(fin.petty_cash_balance || 0).toLocaleString()}</p></div>
          </div>
        </>
      )}

      {view === 'income' && incomeExpense && (
        <>
          <div className="flex items-center justify-between">
            <Select value={period} onValueChange={v => setPeriod(v)}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">This Month</SelectItem><SelectItem value="term">This Term</SelectItem><SelectItem value="year">This Year</SelectItem></SelectContent></Select>
            <PdfActions type="income-expense" params={{ period }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border rounded-md p-3 text-center"><p className="text-[10px] text-slate-500">Income</p><p className="text-xl font-bold text-[#C5A55A]">TT$ {(incomeExpense.total_income || 0).toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3 text-center"><p className="text-[10px] text-slate-500">Expenses</p><p className="text-xl font-bold text-red-600">TT$ {(incomeExpense.total_expenses || 0).toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3 text-center"><p className="text-[10px] text-slate-500">Net Position</p><p className={`text-xl font-bold ${(incomeExpense.net_position || 0) >= 0 ? 'text-[#C5A55A]' : 'text-red-600'}`}>TT$ {(incomeExpense.net_position || 0).toLocaleString()}</p></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="rounded-md"><CardContent className="p-4"><h3 className="text-sm font-semibold mb-2">Income by Payment Method</h3>
              {incomeExpense.income_by_method?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={incomeExpense.income_by_method.map(i => ({ name: i.method, value: i.total }))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>{incomeExpense.income_by_method.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={v => `TT$ ${v.toLocaleString()}`} /></PieChart></ResponsiveContainer>
              ) : <p className="text-center text-slate-400 text-xs py-8">No income data</p>}
            </CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-4"><h3 className="text-sm font-semibold mb-2">Expenses by Category</h3>
              {incomeExpense.expenses_by_category?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}><BarChart data={incomeExpense.expenses_by_category}><XAxis dataKey="category" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={v => `TT$ ${v.toLocaleString()}`} /><Bar dataKey="total" fill="#DC2626" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
              ) : <p className="text-center text-slate-400 text-xs py-8">No expense data</p>}
            </CardContent></Card>
          </div>
        </>
      )}

      {view === 'department' && deptSummary && (
        <>
          <div className="flex items-center justify-end">
            <PdfActions type="department" />
          </div>
          <div className="space-y-3">
            {deptSummary.map((d, i) => (
              <Card key={i} className="rounded-md"><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-bold text-[#1B2A4A]">{d.department}</h3><Badge variant="secondary" className="text-[9px]">{d.staff_count} staff</Badge></div>
                <div className="grid grid-cols-4 gap-3">
                  <div><p className="text-[10px] text-slate-500">Expenses</p><p className="text-sm font-bold text-red-600">TT$ {(d.expenses || 0).toLocaleString()}</p></div>
                  <div><p className="text-[10px] text-slate-500">Budget Allocated</p><p className="text-sm font-bold text-[#2E6CC4]">TT$ {(d.budget_allocated || 0).toLocaleString()}</p></div>
                  <div><p className="text-[10px] text-slate-500">Budget Spent</p><p className="text-sm font-bold text-amber-600">TT$ {(d.budget_spent || 0).toLocaleString()}</p></div>
                  <div><p className="text-[10px] text-slate-500">Monthly Payroll</p><p className="text-sm font-bold text-[#C5A55A]">TT$ {(d.payroll_monthly || 0).toLocaleString()}</p></div>
                </div>
              </CardContent></Card>
            ))}
            {deptSummary.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No department data</p>}
          </div>
        </>
      )}
    </div>
  );
}
