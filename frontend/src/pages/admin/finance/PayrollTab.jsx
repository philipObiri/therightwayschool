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
import { SearchableSelect } from '../../../components/ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Plus, DollarSign, Users, Calculator, CheckCircle, FileText } from 'lucide-react';

export function PayrollTab() {
  const [records, setRecords] = useState([]);
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [staff, setStaff] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [view, setView] = useState('records');
  const [form, setForm] = useState({ staff_id: '', staff_name: '', department: '', role: '', basic_salary: '', housing_allowance: '', transport_allowance: '', other_allowance: '', tax_deduction: '', pension_deduction: '', other_deduction: '', bank_name: '', account_number: '' });
  const [genForm, setGenForm] = useState({ month: '', year: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => { try { const r = await api.get('/finance/payroll/staff-records'); setRecords(r.data); } catch (err) { console.error("Error:", err); } };
  const loadRuns = async () => { try { const r = await api.get('/finance/payroll/runs'); setRuns(r.data); } catch (err) { console.error("Error:", err); } };
  const loadStaff = async () => { try { const r = await api.get('/admin/staff'); setStaff(r.data); } catch (err) { console.error("Error:", err); } };
  useEffect(() => { load(); loadRuns(); loadStaff(); }, []);

  const handleCreate = async () => {
    if (!form.staff_id || !form.basic_salary) { toast.error('Staff and basic salary required'); return; }
    setSaving(true);
    try { await api.post('/finance/payroll/staff-records', { ...form, basic_salary: parseFloat(form.basic_salary) || 0, housing_allowance: parseFloat(form.housing_allowance) || 0, transport_allowance: parseFloat(form.transport_allowance) || 0, other_allowance: parseFloat(form.other_allowance) || 0, tax_deduction: parseFloat(form.tax_deduction) || 0, pension_deduction: parseFloat(form.pension_deduction) || 0, other_deduction: parseFloat(form.other_deduction) || 0 }); successToast('Salary record created'); setShowCreate(false); load(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleGenerate = async () => {
    if (!genForm.month || !genForm.year) { toast.error('Month and year required'); return; }
    setSaving(true);
    try { await api.post('/finance/payroll/generate', genForm); successToast('Payroll generated'); setShowGenerate(false); loadRuns(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const viewRun = async (runId) => { try { const r = await api.get(`/finance/payroll/runs/${runId}`); setActiveRun(r.data); } catch (err) { console.error("Error:", err); } };

  const approveRun = async (runId) => {
    try { await api.put(`/finance/payroll/runs/${runId}/approve`); successToast('Payroll approved'); loadRuns(); if (activeRun) viewRun(runId); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const totalMonthly = records.reduce((s, r) => s + (r.net_salary || 0), 0);

  const printPayStub = (stub, month, year) => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Pay Stub - ${stub.staff_name}</title><style>body{font-family:Arial;padding:40px;max-width:600px;margin:auto}.header{text-align:center;border-bottom:2px solid #1B2A4A;padding-bottom:12px;margin-bottom:20px}.header h1{color:#1B2A4A;margin:0;font-size:18px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}.section{margin:16px 0;padding:8px;background:#f0f4ff;border-radius:8px}.total{font-size:18px;text-align:center;padding:16px;background:#f0f9ff;border-radius:8px;margin:16px 0}@media print{body{padding:20px}}</style></head><body>
    <div class="header"><h1>RightWay Centre - Pay Stub</h1><p style="color:#666;font-size:11px">${month} ${year}</p></div>
    <div class="row"><span>Employee:</span><strong>${stub.staff_name}</strong></div>
    <div class="row"><span>Department:</span><span>${stub.department}</span></div>
    <div class="row"><span>Role:</span><span>${stub.role}</span></div>
    <div class="section"><strong>Earnings</strong></div>
    <div class="row"><span>Basic Salary:</span><span>TT$ ${stub.basic_salary?.toLocaleString()}</span></div>
    <div class="row"><span>Housing Allowance:</span><span>TT$ ${stub.housing_allowance?.toLocaleString()}</span></div>
    <div class="row"><span>Transport Allowance:</span><span>TT$ ${stub.transport_allowance?.toLocaleString()}</span></div>
    <div class="row"><span>Other Allowance:</span><span>TT$ ${stub.other_allowance?.toLocaleString()}</span></div>
    <div class="row" style="font-weight:600;border-top:2px solid #1B2A4A"><span>Gross Salary:</span><span>TT$ ${stub.gross_salary?.toLocaleString()}</span></div>
    <div class="section"><strong>Deductions</strong></div>
    <div class="row"><span>Tax:</span><span>TT$ ${stub.tax_deduction?.toLocaleString()}</span></div>
    <div class="row"><span>Pension:</span><span>TT$ ${stub.pension_deduction?.toLocaleString()}</span></div>
    <div class="row"><span>Other:</span><span>TT$ ${stub.other_deduction?.toLocaleString()}</span></div>
    <div class="row" style="font-weight:600;border-top:2px solid #dc2626;color:#dc2626"><span>Total Deductions:</span><span>TT$ ${stub.total_deductions?.toLocaleString()}</span></div>
    <div class="total"><p style="margin:0;color:#666;font-size:12px">Net Pay</p><p style="margin:4px 0 0;color:#16a34a;font-weight:700;font-size:22px">TT$ ${stub.net_salary?.toLocaleString()}</p></div>
    ${stub.bank_name ? `<div class="row"><span>Bank:</span><span>${stub.bank_name} - ${stub.account_number}</span></div>` : ''}
    <div style="text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px dashed #ccc;padding-top:12px">Computer-generated pay stub. RightWay Centre of Learning Workstation.</div></body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-4" data-testid="payroll-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Payroll Management</h2><p className="text-xs text-slate-500">Staff salary records and monthly payroll</p></div>
        <div className="flex gap-2">
          <Button variant={view === 'records' ? 'default' : 'outline'} size="sm" className="rounded-md text-xs" onClick={() => setView('records')}>Salary Records</Button>
          <Button variant={view === 'runs' ? 'default' : 'outline'} size="sm" className="rounded-md text-xs" onClick={() => setView('runs')}>Payroll Runs</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{records.length}</p><p className="text-xs text-slate-500">Staff on Payroll</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">TT$ {totalMonthly.toLocaleString()}</p><p className="text-xs text-slate-500">Monthly Net Payroll</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]">{runs.length}</p><p className="text-xs text-slate-500">Payroll Runs</p></div>
      </div>

      {view === 'records' && (
        <>
          <div className="flex justify-end"><Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(true)} data-testid="add-salary-btn"><Plus className="w-3 h-3 mr-1" /> Add Salary Record</Button></div>
          <Card className="rounded-md"><CardContent className="p-0">
            <Table><TableHeader><TableRow>
              <TableHead className="bg-slate-50">Staff</TableHead><TableHead className="bg-slate-50">Dept</TableHead><TableHead className="bg-slate-50 text-right">Basic</TableHead><TableHead className="bg-slate-50 text-right">Gross</TableHead><TableHead className="bg-slate-50 text-right">Deductions</TableHead><TableHead className="bg-slate-50 text-right">Net Pay</TableHead>
            </TableRow></TableHeader>
            <TableBody>{records.map(r => (
              <TableRow key={r.record_id}><TableCell className="text-sm font-medium">{r.staff_name}</TableCell><TableCell className="text-xs">{r.department}</TableCell><TableCell className="text-right text-xs">TT$ {r.basic_salary?.toLocaleString()}</TableCell><TableCell className="text-right text-xs">TT$ {r.gross_salary?.toLocaleString()}</TableCell><TableCell className="text-right text-xs text-red-600">TT$ {r.total_deductions?.toLocaleString()}</TableCell><TableCell className="text-right font-semibold text-[#C5A55A]">TT$ {r.net_salary?.toLocaleString()}</TableCell></TableRow>
            ))}{records.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400 text-sm">No salary records</TableCell></TableRow>}</TableBody></Table>
          </CardContent></Card>
        </>
      )}

      {view === 'runs' && !activeRun && (
        <>
          <div className="flex justify-end"><Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowGenerate(true)} data-testid="generate-payroll-btn"><Calculator className="w-3 h-3 mr-1" /> Generate Payroll</Button></div>
          <div className="space-y-2">{runs.map(r => (
            <Card key={r.run_id} className="rounded-md cursor-pointer hover:border-[#2E6CC4]/30" onClick={() => viewRun(r.run_id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div><p className="text-sm font-bold">{r.month} {r.year}</p><p className="text-xs text-slate-500">{r.staff_count} staff | Generated by {r.generated_by_name}</p></div>
                <div className="flex items-center gap-3"><div className="text-right"><p className="text-sm font-bold text-[#C5A55A]">TT$ {r.total_net?.toLocaleString()}</p><p className="text-[10px] text-slate-400">Net payroll</p></div>
                  <Badge className={`text-[9px] ${r.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-amber-100 text-amber-700'}`}>{r.status}</Badge></div>
              </CardContent>
            </Card>
          ))}{runs.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No payroll runs yet</p>}</div>
        </>
      )}

      {view === 'runs' && activeRun && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Button variant="ghost" size="sm" onClick={() => setActiveRun(null)} className="text-xs">Back</Button><h3 className="text-sm font-bold inline ml-2">Payroll: {activeRun.month} {activeRun.year}</h3><Badge className={`ml-2 text-[9px] ${activeRun.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-amber-100 text-amber-700'}`}>{activeRun.status}</Badge></div>
            {activeRun.status === 'draft' && <Button size="sm" className="bg-[#C5A55A] rounded-md text-xs" onClick={() => approveRun(activeRun.run_id)} data-testid="approve-payroll-btn"><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border rounded-md p-3 text-center"><p className="text-xs text-slate-500">Gross</p><p className="font-bold">TT$ {activeRun.total_gross?.toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3 text-center"><p className="text-xs text-slate-500">Deductions</p><p className="font-bold text-red-600">TT$ {activeRun.total_deductions?.toLocaleString()}</p></div>
            <div className="bg-white border rounded-md p-3 text-center"><p className="text-xs text-slate-500">Net</p><p className="font-bold text-[#C5A55A]">TT$ {activeRun.total_net?.toLocaleString()}</p></div>
          </div>
          <Card className="rounded-md"><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Staff</TableHead><TableHead className="bg-slate-50">Dept</TableHead><TableHead className="bg-slate-50 text-right">Gross</TableHead><TableHead className="bg-slate-50 text-right">Deductions</TableHead><TableHead className="bg-slate-50 text-right">Net Pay</TableHead><TableHead className="bg-slate-50">Action</TableHead></TableRow></TableHeader>
              <TableBody>{(activeRun.stubs || []).map(s => (
                <TableRow key={s.stub_id}><TableCell className="text-sm font-medium">{s.staff_name}</TableCell><TableCell className="text-xs">{s.department}</TableCell><TableCell className="text-right text-xs">TT$ {s.gross_salary?.toLocaleString()}</TableCell><TableCell className="text-right text-xs text-red-600">TT$ {s.total_deductions?.toLocaleString()}</TableCell><TableCell className="text-right font-semibold text-[#C5A55A]">TT$ {s.net_salary?.toLocaleString()}</TableCell><TableCell><Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => printPayStub(s, activeRun.month, activeRun.year)}><FileText className="w-3 h-3 mr-1" />Stub</Button></TableCell></TableRow>
              ))}</TableBody></Table>
          </CardContent></Card>
        </div>
      )}

      {/* Create Salary Record */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Add Salary Record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Staff Member</Label><SearchableSelect options={staff.map(s => ({ value: s.user_id, label: `${s.name} (${s.role})` }))} value={form.staff_id} onValueChange={v => { const s = staff.find(st => st.user_id === v); setForm(p => ({ ...p, staff_id: v, staff_name: s?.name || '', department: s?.department || '', role: s?.role || '' })); }} placeholder="Search staff..." className="h-9 text-xs w-full" /></div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Earnings</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">Basic Salary *</Label><Input type="number" value={form.basic_salary} onChange={e => setForm(p => ({ ...p, basic_salary: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Housing</Label><Input type="number" value={form.housing_allowance} onChange={e => setForm(p => ({ ...p, housing_allowance: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Transport</Label><Input type="number" value={form.transport_allowance} onChange={e => setForm(p => ({ ...p, transport_allowance: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Other Allowance</Label><Input type="number" value={form.other_allowance} onChange={e => setForm(p => ({ ...p, other_allowance: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Deductions</p>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-[10px]">Tax</Label><Input type="number" value={form.tax_deduction} onChange={e => setForm(p => ({ ...p, tax_deduction: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Pension</Label><Input type="number" value={form.pension_deduction} onChange={e => setForm(p => ({ ...p, pension_deduction: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Other</Label><Input type="number" value={form.other_deduction} onChange={e => setForm(p => ({ ...p, other_deduction: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Bank Details</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px]">Bank</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-[10px]">Account #</Label><Input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleCreate} disabled={saving}>{saving ? 'Saving...' : 'Create Salary Record'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Payroll */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Generate Monthly Payroll</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Month</Label><Select value={genForm.month} onValueChange={v => setGenForm(p => ({ ...p, month: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select month" /></SelectTrigger><SelectContent>{['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Year</Label><Select value={genForm.year} onValueChange={v => setGenForm(p => ({ ...p, year: v }))}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select year" /></SelectTrigger><SelectContent>{['2025','2026','2027'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            <p className="text-xs text-slate-500">This will generate pay stubs for all {records.length} active salary records.</p>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleGenerate} disabled={saving}>{saving ? 'Generating...' : 'Generate Payroll'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
