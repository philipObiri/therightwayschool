import React, { useEffect, useState, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AppLoader } from '../../components/AppLoader';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import {
  Search, User, X, Shirt, Plus, Minus, ShoppingCart, Receipt,
  Package, Edit, Trash2, Printer, DollarSign, CreditCard,
  Utensils, Scissors, FileText, ChevronDown, ChevronUp, Upload
} from 'lucide-react';
import FileViewerModal from '../../components/FileViewerModal';

const BACKEND = import.meta.env.VITE_API_URL;
const CATEGORIES = ['uniforms', 'books', 'stationery', 'equipment', 'pe_kit', 'accessories', 'other'];
const CAT_LABELS = { uniforms: 'Uniforms', books: 'Books', stationery: 'Stationery', equipment: 'Equipment', pe_kit: 'PE Kit', accessories: 'Accessories', other: 'Other' };

const fileUrl = (fileId) => `${BACKEND}/api/files/${fileId}/download`;

const NativeSelect = ({ value, onChange, children, className = '', ...props }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring ${className}`} {...props}>{children}</select>
);

export default function UniformBilling() {
  const [allItems, setAllItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tailorPayments, setTailorPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('uniforms');

  // Uniform invoice
  const [showUniformInvoice, setShowUniformInvoice] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [uniformItems, setUniformItems] = useState([{ description: '', qty: 1, unit_price: 0 }]);
  const [studentStatus, setStudentStatus] = useState('Full Boarding');

  // Feeding invoice
  const [showFeedingInvoice, setShowFeedingInvoice] = useState(false);
  const [editingFeedingInv, setEditingFeedingInv] = useState(null);
  const [excludedWeeks, setExcludedWeeks] = useState(new Set());
  const [feedStudent, setFeedStudent] = useState(null);
  const [feedSearch, setFeedSearch] = useState('');
  const [feedSearchResults, setFeedSearchResults] = useState([]);
  const [feedDailyRate, setFeedDailyRate] = useState(35);
  const [feedWeeks, setFeedWeeks] = useState([]);
  const [feedStatus, setFeedStatus] = useState('Day Student');

  // Payment recording
  const [showPayment, setShowPayment] = useState(false);
  const [payInvoice, setPayInvoice] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, date: '', reference_id: '', sender_name: '', method: 'cash', proof_file_id: '', breakdown_items: [{ description: '', amount: 0 }], notes: '' });
  const [editingPayment, setEditingPayment] = useState(null);

  // Proof viewer
  const [proofUrl, setProofUrl] = useState(null);

  // Tailor payment
  const [showTailor, setShowTailor] = useState(false);
  const [tailorForm, setTailorForm] = useState({ student_name: '', tailor_type: 'tailor', breakdown: '', amount: 0, payment_date: '' });
  const [tailorStudentSearch, setTailorStudentSearch] = useState('');
  const [tailorSearchResults, setTailorSearchResults] = useState([]);

  // Item management
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', category: 'uniforms', quantity: 0, unit_price: 0, min_threshold: 5, supplier: '' });

  // Expanded invoice detail
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  const printRef = useRef(null);

  const refreshData = useCallback(async () => {
    try {
      const [items, inv, tp] = await Promise.all([
        api.get('/receptionist/uniform-items'),
        api.get('/receptionist/uniform-invoices'),
        api.get('/receptionist/tailor-payments'),
      ]);
      setAllItems(items.data);
      setInvoices(inv.data);
      setTailorPayments(tp.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Search
  const searchStudents = async (q, setter, resultSetter) => {
    setter(q);
    if (q.length < 2) { resultSetter([]); return; }
    const r = await api.get(`/receptionist/students/search?q=${encodeURIComponent(q)}`);
    resultSetter(r.data);
  };

  // ─── UNIFORM INVOICE ───
  const addUniformRow = () => setUniformItems([...uniformItems, { description: '', qty: 1, unit_price: 0 }]);
  const removeUniformRow = (i) => setUniformItems(uniformItems.filter((_, idx) => idx !== i));
  const updateUniformRow = (i, field, val) => { const arr = [...uniformItems]; arr[i] = { ...arr[i], [field]: val }; setUniformItems(arr); };
  const uniformTotal = uniformItems.reduce((s, i) => s + (i.qty * i.unit_price), 0);

  const handleCreateUniformInvoice = async () => {
    if (!selectedStudent) return toast.error('Select a student');
    if (uniformItems.filter(i => i.description && i.unit_price > 0).length === 0) return toast.error('Add at least one item');
    try {
      const items = uniformItems.filter(i => i.description).map(i => ({ name: i.description, unit_price: i.unit_price, quantity: i.qty }));
      await api.post('/receptionist/uniform-invoice', { student_id: selectedStudent.user_id, student_status: studentStatus, invoice_type: 'uniform', items });
      successToast('Uniform invoice created');
      setShowUniformInvoice(false); setSelectedStudent(null); setStudentSearch('');
      setUniformItems([{ description: '', qty: 1, unit_price: 0 }]);
      refreshData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  // ─── FEEDING INVOICE ───
  const generateWeeks = (startDate, count) => {
    const weeks = [];
    let d = new Date(startDate);
    for (let i = 0; i < count; i++) {
      const start = new Date(d);
      const end = new Date(d);
      end.setDate(end.getDate() + 4);
      weeks.push({ week: i + 1, label: `Week ${i + 1}`, start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
      d.setDate(d.getDate() + 7);
    }
    return weeks;
  };

  const handleCreateFeedingInvoice = async () => {
    if (!feedStudent && !editingFeedingInv) return toast.error('Select a student');
    if (feedWeeks.length === 0) return toast.error('Generate weeks first');
    const activeWeeks = feedWeeks.filter(w => !excludedWeeks.has(w.week));
    const excludedLabels = feedWeeks.filter(w => excludedWeeks.has(w.week)).map(w => w.label);
    try {
      if (editingFeedingInv) {
        await api.put(`/receptionist/feeding-invoice/${editingFeedingInv.invoice_id}`, {
          daily_rate: feedDailyRate, days_per_week: 5, weeks: activeWeeks, excluded_weeks: excludedLabels,
        });
        successToast('Feeding invoice updated');
      } else {
        await api.post('/receptionist/feeding-invoice', { student_id: feedStudent.user_id, student_status: feedStatus, daily_rate: feedDailyRate, days_per_week: 5, weeks: activeWeeks });
        successToast('Feeding fee invoice created');
      }
      setShowFeedingInvoice(false); setFeedStudent(null); setFeedSearch(''); setFeedWeeks([]); setExcludedWeeks(new Set()); setEditingFeedingInv(null);
      refreshData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const openEditFeedingInvoice = (inv) => {
    setEditingFeedingInv(inv);
    setFeedStudent({ user_id: inv.student_id, name: inv.student_name });
    setFeedSearch(inv.student_name);
    setFeedDailyRate(inv.daily_rate || 35);
    setFeedStatus(inv.student_status || 'Day Student');
    setFeedWeeks(inv.weeks || []);
    const ex = new Set(inv.excluded_weeks || []);
    setExcludedWeeks(ex);
    setShowFeedingInvoice(true);
  };

  // ─── RECORD PAYMENT ───
  const emptyPayForm = { amount: 0, date: '', reference_id: '', sender_name: '', method: 'cash', proof_file_id: '', breakdown_items: [{ description: '', amount: 0 }], notes: '' };

  const handleRecordPayment = async () => {
    if (!payForm.amount || payForm.amount <= 0) return toast.error('Enter valid amount');
    // Filter out empty breakdown items
    const cleanForm = { ...payForm, breakdown_items: (payForm.breakdown_items || []).filter(b => b.description.trim()) };
    try {
      if (editingPayment) {
        await api.put(`/receptionist/invoice-payment/${payInvoice.invoice_id}/${editingPayment.payment_id}`, cleanForm);
        successToast('Payment updated');
      } else {
        await api.post('/receptionist/invoice-payment', { invoice_id: payInvoice.invoice_id, ...cleanForm });
        successToast('Payment recorded');
      }
      setShowPayment(false); setPayInvoice(null); setEditingPayment(null);
      setPayForm(emptyPayForm);
      refreshData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleEditPayment = (p) => {
    setEditingPayment(p);
    setPayInvoice(p.inv);
    setPayForm({
      amount: p.amount || 0,
      date: p.date || '',
      reference_id: p.reference_id || '',
      sender_name: p.sender_name || '',
      method: p.method || 'cash',
      proof_file_id: p.proof_file_id || '',
      breakdown_items: (p.breakdown_items && p.breakdown_items.length > 0) ? p.breakdown_items : [{ description: '', amount: 0 }],
      notes: p.notes || '',
    });
    setShowPayment(true);
  };

  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete payment of TT$ ${(p.amount || 0).toLocaleString()} for ${p.inv.student_name}?`)) return;
    try {
      await api.delete(`/receptionist/invoice-payment/${p.inv.invoice_id}/${p.payment_id}`);
      successToast('Payment deleted');
      refreshData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
  };

  const addBreakdownItem = () => setPayForm(f => ({ ...f, breakdown_items: [...(f.breakdown_items || []), { description: '', amount: 0 }] }));

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Delete ${inv.type} invoice for ${inv.student_name}? This will also remove all associated payments.`)) return;
    try {
      await api.delete(`/receptionist/uniform-invoices/${inv.invoice_id}`);
      successToast('Invoice deleted');
      refreshData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
  };
  const updateBreakdownItem = (idx, field, val) => {
    const items = [...(payForm.breakdown_items || [])];
    items[idx] = { ...items[idx], [field]: field === 'amount' ? parseFloat(val) || 0 : val };
    setPayForm(f => ({ ...f, breakdown_items: items }));
  };
  const removeBreakdownItem = (idx) => setPayForm(f => ({ ...f, breakdown_items: (f.breakdown_items || []).filter((_, i) => i !== idx) }));

  // ─── TAILOR PAYMENT ───
  const handleRecordTailor = async () => {
    if (!tailorForm.student_name || !tailorForm.amount) return toast.error('Fill required fields');
    try {
      await api.post('/receptionist/tailor-payments', tailorForm);
      successToast('Tailor payment recorded');
      setShowTailor(false); setTailorForm({ student_name: '', tailor_type: 'tailor', breakdown: '', amount: 0, payment_date: '' });
      refreshData();
    } catch (e) { toast.error('Failed'); }
  };

  // ─── ITEM MANAGEMENT ───
  const handleSaveItem = async () => {
    if (!itemForm.name || itemForm.unit_price <= 0) return toast.error('Name and price required');
    try {
      if (editItem) { await api.put(`/receptionist/inventory/${editItem.item_id}`, itemForm); }
      else { await api.post('/receptionist/inventory', itemForm); }
      successToast(editItem ? 'Updated' : 'Created');
      setShowItemForm(false); setEditItem(null); setItemForm({ name: '', category: 'uniforms', quantity: 0, unit_price: 0, min_threshold: 5, supplier: '' });
      refreshData();
    } catch (e) { toast.error('Failed'); }
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.body.innerHTML = DOMPurify.sanitize(`<html><head><title>RightWay Payment Records</title><style>body{font-family:'DM Sans',sans-serif;padding:20px;color:#1B2A4A}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}th{background:#1B2A4A;color:white}.paid{color:#16a34a;font-weight:700}.owed{color:#dc2626;font-weight:700}h1{font-size:16px}h2{font-size:12px;color:#64748b}</style></head><body>${el.innerHTML}</body></html>`);
    win.document.close(); win.print();
  };

  if (loading) return <AppLoader />;

  const uniformInvoices = invoices.filter(i => i.type === 'uniform');
  const feedingInvoices = invoices.filter(i => i.type === 'feeding');

  return (
    <div className="space-y-6" data-testid="uniform-billing">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Billing &amp; Items</h1>
          <p className="text-sm text-slate-500 mt-1">{invoices.length} invoices &middot; {allItems.length} items</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'uniforms', label: 'Uniforms', icon: Shirt, count: uniformInvoices.length },
          { key: 'feeding', label: 'Feeding Fees', icon: Utensils, count: feedingInvoices.length },
          { key: 'payments', label: 'Payment Records', icon: DollarSign, count: invoices.reduce((s, i) => s + (i.payments?.length || 0), 0) },
          { key: 'tailors', label: "Tailors' Payments", icon: Scissors, count: tailorPayments.length },
          { key: 'items', label: 'Manage Items', icon: Package, count: allItems.length },
        ].map(t => (
          <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm"
            onClick={() => setTab(t.key)} className={tab === t.key ? 'bg-[#1B2A4A] text-white' : ''} data-testid={`tab-${t.key}`}>
            <t.icon className="w-3 h-3 mr-1" /> {t.label} ({t.count})
          </Button>
        ))}
      </div>

      {/* ─── UNIFORMS TAB ─── */}
      {tab === 'uniforms' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowUniformInvoice(true)} className="bg-[#2E6CC4]" data-testid="new-uniform-invoice-btn">
              <Plus className="w-4 h-4 mr-2" /> New Uniform Invoice
            </Button>
          </div>
          <InvoiceList invoices={uniformInvoices} type="uniform" onRecordPayment={(inv) => { setEditingPayment(null); setPayInvoice(inv); setPayForm({ ...emptyPayForm, amount: inv.balance || 0, date: new Date().toISOString().split('T')[0] }); setShowPayment(true); }} onDeleteInvoice={handleDeleteInvoice} expandedInvoice={expandedInvoice} setExpandedInvoice={setExpandedInvoice} onViewProof={setProofUrl} />
        </div>
      )}

      {/* ─── FEEDING TAB ─── */}
      {tab === 'feeding' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowFeedingInvoice(true)} className="bg-[#2E6CC4]" data-testid="new-feeding-invoice-btn">
              <Plus className="w-4 h-4 mr-2" /> New Feeding Invoice
            </Button>
          </div>
          <InvoiceList invoices={feedingInvoices} type="feeding" onRecordPayment={(inv) => { setEditingPayment(null); setPayInvoice(inv); setPayForm({ ...emptyPayForm, amount: inv.balance || 0, date: new Date().toISOString().split('T')[0] }); setShowPayment(true); }} onDeleteInvoice={handleDeleteInvoice} onEditInvoice={(inv) => { if (inv.type === 'feeding') openEditFeedingInvoice(inv); }} expandedInvoice={expandedInvoice} setExpandedInvoice={setExpandedInvoice} onViewProof={setProofUrl} />
        </div>
      )}

      {/* ─── PAYMENT RECORDS TAB — Excel-style editable table ─── */}
      {tab === 'payments' && (
        <PaymentSpreadsheet
          invoices={invoices}
          onRefresh={refreshData}
          onViewProof={setProofUrl}
          printRef={printRef}
          handlePrint={handlePrint}
        />
      )}

      {/* ─── TAILORS TAB ─── */}
      {tab === 'tailors' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-3 h-3 mr-1" /> Print</Button>
            <Button onClick={() => setShowTailor(true)} className="bg-[#2E6CC4]" data-testid="new-tailor-btn"><Plus className="w-4 h-4 mr-2" /> Record Payment</Button>
          </div>
          <div ref={tab === 'tailors' ? printRef : undefined}>
            <Card className="rounded-xl">
              <CardContent className="pt-3 px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-[10px] text-slate-500 uppercase text-left bg-slate-50">
                      <th className="py-2 px-2">Student</th><th className="py-2 px-2">Type</th><th className="py-2 px-2">Breakdown</th><th className="py-2 px-2">Charge (GHS)</th><th className="py-2 px-2">Payment Date</th><th className="py-2 px-2">Recorded By</th>
                    </tr></thead>
                    <tbody>
                      {tailorPayments.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">No tailor payments recorded</td></tr>
                      ) : tailorPayments.map(tp => (
                        <tr key={tp.payment_id} className="border-b hover:bg-slate-50" data-testid={`tailor-row-${tp.payment_id}`}>
                          <td className="py-2 px-2 font-medium">{tp.student_name}</td>
                          <td className="py-2 px-2"><Badge variant="outline" className="text-[9px]">{tp.tailor_type === 'seamstress' ? 'Seamstress' : 'Tailor'}</Badge></td>
                          <td className="py-2 px-2 text-slate-600">{tp.breakdown}</td>
                          <td className="py-2 px-2 font-bold">{(tp.amount || 0).toLocaleString()}</td>
                          <td className="py-2 px-2 text-slate-500">{tp.payment_date || '-'}</td>
                          <td className="py-2 px-2 text-slate-500">{tp.recorded_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── MANAGE ITEMS TAB ─── */}
      {tab === 'items' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => { setEditItem(null); setItemForm({ name: '', category: 'uniforms', quantity: 0, unit_price: 0, min_threshold: 5, supplier: '' }); setShowItemForm(true); }} className="bg-[#2E6CC4]" data-testid="add-item-btn"><Plus className="w-4 h-4 mr-2" /> Add Item</Button></div>
          <Card className="rounded-xl"><CardContent className="pt-3 px-0"><div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b text-[10px] text-slate-500 uppercase text-left bg-slate-50">
              <th className="py-2 px-3">Name</th><th className="py-2 px-3">Category</th><th className="py-2 px-3">Price</th><th className="py-2 px-3">Stock</th><th className="py-2 px-3">Actions</th>
            </tr></thead><tbody>
              {allItems.map(item => (
                <tr key={item.item_id} className="border-b hover:bg-slate-50"><td className="py-2 px-3 font-medium">{item.name}</td><td className="py-2 px-3"><Badge variant="outline" className="text-[9px]">{CAT_LABELS[item.category] || item.category}</Badge></td><td className="py-2 px-3">TT$ {(item.unit_price || 0).toLocaleString()}</td><td className="py-2 px-3"><span className={item.quantity <= item.min_threshold ? 'text-red-600 font-bold' : ''}>{item.quantity}</span></td>
                  <td className="py-2 px-3"><Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditItem(item); setItemForm({ name: item.name, category: item.category, quantity: item.quantity, unit_price: item.unit_price || 0, min_threshold: item.min_threshold, supplier: item.supplier || '' }); setShowItemForm(true); }}><Edit className="w-3 h-3" /></Button></td>
                </tr>
              ))}
              {allItems.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No items</td></tr>}
            </tbody></table>
          </div></CardContent></Card>
        </div>
      )}

      {/* ─── UNIFORM INVOICE DIALOG ─── */}
      <Dialog open={showUniformInvoice} onOpenChange={setShowUniformInvoice}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Shirt className="w-5 h-5 inline mr-2 text-[#2E6CC4]" />Uniforms Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <StudentSearch label="Student" value={studentSearch} results={searchResults} selected={selectedStudent}
              onSearch={q => searchStudents(q, setStudentSearch, setSearchResults)}
              onSelect={s => { setSelectedStudent(s); setSearchResults([]); setStudentSearch(s.name); }}
              onClear={() => { setSelectedStudent(null); setStudentSearch(''); }} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Year</Label><Input value={selectedStudent?.year_group || ''} disabled className="bg-slate-50" /></div>
              <div className="space-y-1"><Label>Status</Label>
                <NativeSelect value={studentStatus} onChange={setStudentStatus}>
                  <option value="Full Boarding">Full Boarding</option><option value="Day Student">Day Student</option><option value="Weekly Boarding">Weekly Boarding</option>
                </NativeSelect>
              </div>
            </div>
            <div><Label className="mb-2 block text-sm font-semibold">Items Breakdown</Label>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] text-slate-500 uppercase font-medium px-1">
                  <span className="col-span-1">No.</span><span className="col-span-6">Item Description</span><span className="col-span-2">Qty</span><span className="col-span-2">Price (GHS)</span><span className="col-span-1">Total</span>
                </div>
                {uniformItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-1 text-xs text-slate-400 text-center">{i + 1}</span>
                    <Input className="col-span-6 h-8 text-sm" placeholder="e.g. School Shirt fabric (6yds for 4 shirts)" value={item.description} onChange={e => updateUniformRow(i, 'description', e.target.value)} data-testid={`uitem-desc-${i}`} />
                    <Input className="col-span-2 h-8 text-sm" type="number" value={item.qty} onChange={e => updateUniformRow(i, 'qty', parseInt(e.target.value) || 0)} data-testid={`uitem-qty-${i}`} />
                    <Input className="col-span-2 h-8 text-sm" type="number" value={item.unit_price} onChange={e => updateUniformRow(i, 'unit_price', parseFloat(e.target.value) || 0)} data-testid={`uitem-price-${i}`} />
                    <div className="col-span-1 flex items-center gap-1">
                      <span className="text-xs font-bold">{(item.qty * item.unit_price).toLocaleString()}</span>
                      {uniformItems.length > 1 && <button onClick={() => removeUniformRow(i)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addUniformRow} className="text-xs"><Plus className="w-3 h-3 mr-1" /> Add Row</Button>
              </div>
            </div>
            <div className="bg-[#1B2A4A] text-white rounded-lg p-4 text-center">
              <p className="text-xs text-slate-300">Total</p>
              <p className="text-2xl font-bold">TT$ {uniformTotal.toLocaleString()}</p>
            </div>
            <Button onClick={handleCreateUniformInvoice} className="w-full bg-[#2E6CC4]" data-testid="create-uniform-inv-btn"><Receipt className="w-4 h-4 mr-2" /> Create Invoice</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── FEEDING INVOICE DIALOG ─── */}
      <Dialog open={showFeedingInvoice} onOpenChange={(v) => { if (!v) setEditingFeedingInv(null); setShowFeedingInvoice(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Utensils className="w-5 h-5 inline mr-2 text-[#C5A55A]" />{editingFeedingInv ? 'Edit Feeding Invoice' : 'Feeding Fee Invoice'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <StudentSearch label="Student" value={feedSearch} results={feedSearchResults} selected={feedStudent}
              onSearch={q => searchStudents(q, setFeedSearch, setFeedSearchResults)}
              onSelect={s => { setFeedStudent(s); setFeedSearchResults([]); setFeedSearch(s.name); }}
              onClear={() => { setFeedStudent(null); setFeedSearch(''); }} />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Status</Label>
                <NativeSelect value={feedStatus} onChange={setFeedStatus}>
                  <option value="Day Student">Day Student</option><option value="Full Boarding">Full Boarding</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><Label>Daily Rate (GHS)</Label><Input type="number" value={feedDailyRate} onChange={e => setFeedDailyRate(parseFloat(e.target.value) || 0)} data-testid="daily-rate" /></div>
              <div className="space-y-1"><Label>Term Start Date</Label><Input type="date" onChange={e => { if (e.target.value) setFeedWeeks(generateWeeks(e.target.value, 12)); }} data-testid="term-start" /></div>
            </div>
            {feedWeeks.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-[10px] text-slate-500 uppercase"><th className="py-1 px-2 w-6"></th><th className="py-1 px-2">Week</th><th className="py-1 px-2">Period</th><th className="py-1 px-2">Mon</th><th className="py-1 px-2">Tue</th><th className="py-1 px-2">Wed</th><th className="py-1 px-2">Thu</th><th className="py-1 px-2">Fri</th><th className="py-1 px-2">Total</th></tr></thead>
                  <tbody>
                    {feedWeeks.map(w => {
                      const isExcluded = excludedWeeks.has(w.week);
                      return (
                        <tr key={w.week} className={`border-t text-xs ${isExcluded ? 'bg-red-50 line-through opacity-50' : ''}`}>
                          <td className="py-1 px-2 text-center">
                            <input type="checkbox" checked={!isExcluded} onChange={() => setExcludedWeeks(prev => { const n = new Set(prev); if (n.has(w.week)) n.delete(w.week); else n.add(w.week); return n; })} className="w-3 h-3" data-testid={`week-toggle-${w.week}`} />
                          </td>
                          <td className="py-1 px-2 font-medium">{w.label} {isExcluded && <span className="text-red-500 text-[9px] font-normal">(Excluded)</span>}</td>
                          <td className="py-1 px-2 text-slate-400">{w.start} to {w.end}</td>
                          {[1,2,3,4,5].map(d => <td key={d} className="py-1 px-2 text-center">{isExcluded ? '-' : `TT$ ${feedDailyRate}`}</td>)}
                          <td className="py-1 px-2 font-bold text-center">{isExcluded ? <span className="text-red-400">Excluded</span> : `TT$ ${(feedDailyRate * 5).toLocaleString()}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {excludedWeeks.size > 0 && (
                  <div className="bg-amber-50 px-3 py-2 border-t text-xs text-amber-700">
                    {excludedWeeks.size} week(s) excluded (midterm/holiday) &middot; Uncheck to include
                  </div>
                )}
              </div>
            )}
            {feedWeeks.length > 0 && (() => {
              const activeWeeks = feedWeeks.length - excludedWeeks.size;
              const total = feedDailyRate * 5 * activeWeeks;
              return (
                <div className="bg-[#1B2A4A] text-white rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-300">{activeWeeks} active week{activeWeeks !== 1 ? 's' : ''} x TT$ {(feedDailyRate * 5).toLocaleString()}/week {excludedWeeks.size > 0 ? `(${excludedWeeks.size} excluded)` : ''}</p>
                  <p className="text-2xl font-bold">TT$ {total.toLocaleString()}</p>
                </div>
              );
            })()}
            <Button onClick={handleCreateFeedingInvoice} className="w-full bg-[#C5A55A] hover:bg-[#B09444]" data-testid="create-feeding-inv-btn"><Receipt className="w-4 h-4 mr-2" /> {editingFeedingInv ? 'Update Feeding Invoice' : 'Create Feeding Invoice'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── RECORD PAYMENT DIALOG ─── */}
      <Dialog open={showPayment} onOpenChange={(v) => { if (!v) { setEditingPayment(null); } setShowPayment(v); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPayment ? 'Edit Payment' : 'Record Payment'} — {payInvoice?.student_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Invoice: <strong>{payInvoice?.invoice_id}</strong> &middot; Balance: <strong className="text-red-600">TT$ {(payInvoice?.balance || 0).toLocaleString()}</strong></p>
            <div className="space-y-1"><Label>Amount Paid (GHS)</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} data-testid="pay-amount" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Payment Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} data-testid="pay-date" /></div>
              <div className="space-y-1"><Label>Method</Label>
                <NativeSelect value={payForm.method} onChange={v => setPayForm({ ...payForm, method: v })} data-testid="pay-method">
                  <option value="cash">Cash</option><option value="momo">Mobile Money (MoMo)</option><option value="bank_transfer">Bank Transfer</option>
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Transaction / Reference ID</Label><Input value={payForm.reference_id} onChange={e => setPayForm({ ...payForm, reference_id: e.target.value })} data-testid="pay-ref" /></div>
              <div className="space-y-1"><Label>Sender's Name</Label><Input value={payForm.sender_name} onChange={e => setPayForm({ ...payForm, sender_name: e.target.value })} data-testid="pay-sender" /></div>
            </div>

            {/* Itemized Breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-[#1B2A4A]">Payment Breakdown (Itemized)</Label>
                <button type="button" onClick={addBreakdownItem} className="text-xs text-[#2E6CC4] font-medium hover:underline flex items-center gap-1" data-testid="add-breakdown-item">
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>
              {(payForm.breakdown_items || []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="e.g. Tuition, Uniform Shirt, Books..."
                    value={item.description}
                    onChange={e => updateBreakdownItem(idx, 'description', e.target.value)}
                    className="flex-1 h-9 text-sm"
                    data-testid={`breakdown-desc-${idx}`}
                  />
                  <Input
                    type="number"
                    placeholder="GHS"
                    value={item.amount || ''}
                    onChange={e => updateBreakdownItem(idx, 'amount', e.target.value)}
                    className="w-24 h-9 text-sm"
                    data-testid={`breakdown-amt-${idx}`}
                  />
                  {(payForm.breakdown_items || []).length > 1 && (
                    <button type="button" onClick={() => removeBreakdownItem(idx)} className="p-1 text-red-400 hover:text-red-600" data-testid={`breakdown-remove-${idx}`}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {(payForm.breakdown_items || []).filter(b => b.amount > 0).length > 0 && (
                <p className="text-xs text-slate-400 text-right">
                  Breakdown total: TT$ {(payForm.breakdown_items || []).reduce((s, b) => s + (b.amount || 0), 0).toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} rows={2} placeholder="Additional payment notes..." data-testid="pay-notes" />
            </div>

            <Button onClick={handleRecordPayment} className="w-full bg-[#C5A55A] hover:bg-[#B09444]" data-testid="confirm-payment-btn">
              <CreditCard className="w-4 h-4 mr-2" /> {editingPayment ? 'Update Payment' : 'Record Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── TAILOR PAYMENT DIALOG ─── */}
      <Dialog open={showTailor} onOpenChange={setShowTailor}>
        <DialogContent>
          <DialogHeader><DialogTitle><Scissors className="w-5 h-5 inline mr-2" />Record Tailor Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Student Name</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                <Input className="pl-8" value={tailorStudentSearch || tailorForm.student_name} onChange={e => { setTailorStudentSearch(e.target.value); setTailorForm({ ...tailorForm, student_name: e.target.value }); searchStudents(e.target.value, v => setTailorStudentSearch(v), setTailorSearchResults); }} placeholder="Search student..." data-testid="tailor-name" />
              </div>
              {tailorSearchResults.length > 0 && (
                <div className="border rounded-lg max-h-32 overflow-y-auto">
                  {tailorSearchResults.map(s => (
                    <div key={s.user_id} onClick={() => { setTailorForm({ ...tailorForm, student_name: s.name }); setTailorStudentSearch(s.name); setTailorSearchResults([]); }}
                      className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-xs">{s.name} ({s.year_group})</div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Type</Label>
                <NativeSelect value={tailorForm.tailor_type} onChange={v => setTailorForm({ ...tailorForm, tailor_type: v })} data-testid="tailor-type">
                  <option value="tailor">Tailor</option><option value="seamstress">Seamstress</option>
                </NativeSelect>
              </div>
              <div className="space-y-1"><Label>Charge (GHS)</Label><Input type="number" value={tailorForm.amount} onChange={e => setTailorForm({ ...tailorForm, amount: parseFloat(e.target.value) || 0 })} data-testid="tailor-amount" /></div>
            </div>
            <div className="space-y-1"><Label>Breakdown</Label><Textarea value={tailorForm.breakdown} onChange={e => setTailorForm({ ...tailorForm, breakdown: e.target.value })} placeholder="e.g. 2 SHIRTS + 2 CRESTS + 1 TROUSER" rows={2} data-testid="tailor-breakdown" /></div>
            <div className="space-y-1"><Label>Payment Date</Label><Input type="date" value={tailorForm.payment_date} onChange={e => setTailorForm({ ...tailorForm, payment_date: e.target.value })} data-testid="tailor-date" /></div>
            <Button onClick={handleRecordTailor} className="w-full bg-[#2E6CC4]" data-testid="confirm-tailor-btn"><Scissors className="w-4 h-4 mr-2" /> Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── PROOF VIEWER MODAL ─── */}
      <FileViewerModal
        url={proofUrl ? `${BACKEND}/api/files/${proofUrl}/download` : null}
        open={!!proofUrl}
        onClose={() => setProofUrl(null)}
        title="Payment Proof"
      />

      {/* ─── ITEM FORM DIALOG ─── */}
      <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit Item' : 'Add Billable Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} data-testid="item-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Category</Label>
                <NativeSelect value={itemForm.category} onChange={v => setItemForm({ ...itemForm, category: v })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1"><Label>Unit Price (GHS)</Label><Input type="number" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: parseFloat(e.target.value) || 0 })} data-testid="item-price-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Stock</Label><Input type="number" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-1"><Label>Supplier</Label><Input value={itemForm.supplier} onChange={e => setItemForm({ ...itemForm, supplier: e.target.value })} /></div>
            </div>
            <Button onClick={handleSaveItem} className="w-full bg-[#2E6CC4]" data-testid="save-item-btn">{editItem ? 'Update' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Reusable Components ───
function StudentSearch({ label, value, results, selected, onSearch, onSelect, onClear }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm">
          <User className="w-4 h-4 text-blue-600" /><span className="font-medium flex-1">{selected.name}</span><span className="text-xs text-slate-400">{selected.year_group}</span>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
        </div>
      ) : (
        <>
          <div className="relative"><Search className="absolute left-2 top-2 w-4 h-4 text-slate-400" /><Input placeholder="Search student..." value={value} onChange={e => onSearch(e.target.value)} className="pl-8 h-8 text-sm" /></div>
          {results.length > 0 && <div className="border rounded-lg max-h-32 overflow-y-auto">{results.map(s => (
            <div key={s.user_id} onClick={() => onSelect(s)} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-xs">{s.name} ({s.year_group})</div>
          ))}</div>}
        </>
      )}
    </div>
  );
}


// ─── EXCEL-STYLE EDITABLE SPREADSHEET ───
function PaymentSpreadsheet({ invoices, onRefresh, onViewProof, printRef, handlePrint }) {
  const allPayments = invoices.flatMap(inv => (inv.payments || []).map(p => ({ ...p, inv }))).sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''));
  const [editingCell, setEditingCell] = useState(null); // { rowId, field }
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  const cellClass = "py-2 px-2 border border-slate-200 text-sm cursor-pointer select-none transition-colors hover:bg-blue-50/40";
  const editCellClass = "py-0 px-0 border-2 border-[#2E6CC4] bg-white";
  const headerClass = "py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider text-white border border-[#1B2A4A]/80";

  const startEdit = (rowId, field, currentValue) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue ?? '');
  };

  const saveCell = async (p) => {
    if (!editingCell) return;
    const { field } = editingCell;
    const updates = {};
    if (field === 'amount') updates.amount = parseFloat(editValue) || 0;
    else if (field === 'date') updates.date = editValue;
    else if (field === 'reference_id') updates.reference_id = editValue;
    else if (field === 'sender_name') updates.sender_name = editValue;
    else if (field === 'method') updates.method = editValue;
    else if (field === 'notes') updates.notes = editValue;

    setSaving(p.payment_id);
    try {
      await api.put(`/receptionist/invoice-payment/${p.inv.invoice_id}/${p.payment_id}`, updates);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    setSaving(null);
    setEditingCell(null);
  };

  const handleKeyDown = (e, p) => {
    if (e.key === 'Enter') { saveCell(p); }
    if (e.key === 'Escape') { setEditingCell(null); }
    if (e.key === 'Tab') { e.preventDefault(); saveCell(p); }
  };

  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete payment of TT$ ${(p.amount || 0).toLocaleString()} for ${p.inv.student_name}?`)) return;
    try {
      await api.delete(`/receptionist/invoice-payment/${p.inv.invoice_id}/${p.payment_id}`);
      successToast('Payment deleted');
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
  };

  const saveBreakdown = async (p, items) => {
    setSaving(p.payment_id);
    try {
      await api.put(`/receptionist/invoice-payment/${p.inv.invoice_id}/${p.payment_id}`, { breakdown_items: items });
      successToast('Breakdown saved');
      onRefresh();
    } catch (e) { toast.error('Failed to save breakdown'); }
    setSaving(null);
  };

  const renderCell = (p, field, displayVal, rawVal) => {
    const isEditing = editingCell?.rowId === p.payment_id && editingCell?.field === field;
    if (isEditing) {
      if (field === 'method') {
        return (
          <td className={editCellClass}>
            <select
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => saveCell(p)}
              className="w-full h-full px-2 py-2 text-sm outline-none bg-white"
              data-testid={`edit-cell-${field}`}
            >
              <option value="cash">Cash</option>
              <option value="momo">MoMo</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </td>
        );
      }
      return (
        <td className={editCellClass}>
          <input
            autoFocus
            type={field === 'amount' ? 'number' : field === 'date' ? 'date' : 'text'}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => saveCell(p)}
            onKeyDown={e => handleKeyDown(e, p)}
            className="w-full h-full px-2 py-2 text-sm outline-none"
            data-testid={`edit-cell-${field}`}
          />
        </td>
      );
    }
    return (
      <td className={cellClass} onClick={() => startEdit(p.payment_id, field, rawVal)} data-testid={`cell-${field}-${p.payment_id}`}>
        {saving === p.payment_id ? <span className="text-xs text-blue-400 animate-pulse">Saving...</span> : displayVal}
      </td>
    );
  };

  const totalPaid = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalBilled = allPayments.reduce((s, p) => s + (p.inv.total_due || 0), 0);

  return (
    <div className="space-y-4" data-testid="payment-spreadsheet">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-xs text-slate-400">Click any cell to edit &middot; Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> or <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Tab</kbd> to save</p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} data-testid="print-payments-btn"><Printer className="w-3 h-3 mr-1" /> Print</Button>
      </div>

      <div ref={printRef}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>RightWay Payment Records</h1>
            <h2 style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Generated {new Date().toLocaleDateString('en-GB')}</h2>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-slate-500">Total Billed: <strong className="text-[#1B2A4A]">TT$ {totalBilled.toLocaleString()}</strong></span>
            <span className="text-slate-500">Total Paid: <strong className="text-green-700">TT$ {totalPaid.toLocaleString()}</strong></span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="payment-table">
              <thead>
                <tr className="bg-[#1B2A4A]">
                  <th className={headerClass} style={{width: 30}}>#</th>
                  <th className={headerClass}>Student</th>
                  <th className={headerClass}>Type</th>
                  <th className={headerClass}>Paid (GHS)</th>
                  <th className={headerClass}>Date</th>
                  <th className={headerClass}>Method</th>
                  <th className={headerClass}>Reference ID</th>
                  <th className={headerClass}>Sender</th>
                  <th className={headerClass}>Total Billed</th>
                  <th className={headerClass}>Balance</th>
                  <th className={headerClass}>Breakdown</th>
                  <th className={headerClass}>Proof</th>
                  <th className={headerClass} style={{width: 60}}>Del</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-12 text-slate-400 border border-slate-200">No payments recorded yet</td></tr>
                ) : allPayments.map((p, idx) => (
                  <React.Fragment key={p.payment_id}>
                    <tr className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${saving === p.payment_id ? 'opacity-60' : ''}`} data-testid={`pay-row-${p.payment_id}`}>
                      <td className="py-2 px-2 border border-slate-200 text-center text-xs text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-2 border border-slate-200 font-medium text-sm text-[#1B2A4A]">{p.inv.student_name}</td>
                      <td className="py-2 px-2 border border-slate-200"><Badge variant="outline" className="text-[9px]">{p.inv.type}</Badge></td>
                      {renderCell(p, 'amount', <span className="text-green-700 font-bold">{(p.amount || 0).toLocaleString()}</span>, p.amount)}
                      {renderCell(p, 'date', <span className="text-slate-600">{p.date || '-'}</span>, p.date || '')}
                      {renderCell(p, 'method', <Badge variant="secondary" className="text-[9px] capitalize">{p.method || 'cash'}</Badge>, p.method || 'cash')}
                      {renderCell(p, 'reference_id', <span className="font-mono text-xs">{p.reference_id || '-'}</span>, p.reference_id || '')}
                      {renderCell(p, 'sender_name', p.sender_name || '-', p.sender_name || '')}
                      <td className="py-2 px-2 border border-slate-200 font-bold text-sm">{(p.inv.total_due || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 border border-slate-200">
                        <span className={`font-bold ${(p.inv.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(p.inv.balance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-2 border border-slate-200 text-center">
                        <button
                          onClick={() => setExpandedRow(expandedRow === p.payment_id ? null : p.payment_id)}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${expandedRow === p.payment_id ? 'bg-[#2E6CC4] text-white' : 'text-[#2E6CC4] hover:bg-blue-50'}`}
                          data-testid={`breakdown-toggle-${p.payment_id}`}
                        >
                          {(p.breakdown_items || []).length > 0 ? `${p.breakdown_items.length} items` : '+ Add'}
                        </button>
                      </td>
                      <td className="py-2 px-2 border border-slate-200 text-center">
                        {p.proof_file_id ? (
                          <button onClick={() => onViewProof(p.proof_file_id)} className="text-blue-600 text-xs font-medium hover:text-blue-800 underline" data-testid={`proof-link-${p.payment_id}`}>
                            <FileText className="w-3.5 h-3.5 inline" />
                          </button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2 px-2 border border-slate-200 text-center">
                        <button onClick={() => handleDeletePayment(p)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" data-testid={`del-pay-${p.payment_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {/* Expanded Breakdown Sub-table */}
                    {expandedRow === p.payment_id && (
                      <tr>
                        <td colSpan={13} className="bg-blue-50/30 border border-slate-200 p-0">
                          <BreakdownEditor payment={p} onSave={(items) => saveBreakdown(p, items)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {allPayments.length > 0 && (
                <tfoot>
                  <tr className="bg-[#1B2A4A]/5 font-bold">
                    <td colSpan={3} className="py-2 px-2 border border-slate-200 text-right text-xs uppercase text-slate-500">Totals</td>
                    <td className="py-2 px-2 border border-slate-200 text-green-700">{totalPaid.toLocaleString()}</td>
                    <td colSpan={4} className="border border-slate-200"></td>
                    <td className="py-2 px-2 border border-slate-200 font-bold">{totalBilled.toLocaleString()}</td>
                    <td className="py-2 px-2 border border-slate-200">
                      <span className={(totalBilled - totalPaid) > 0 ? 'text-red-600' : 'text-green-600'}>{(totalBilled - totalPaid).toLocaleString()}</span>
                    </td>
                    <td colSpan={2} className="border border-slate-200"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INLINE BREAKDOWN EDITOR (Excel sub-rows) ───
function BreakdownEditor({ payment, onSave }) {
  const [items, setItems] = useState(
    (payment.breakdown_items && payment.breakdown_items.length > 0)
      ? payment.breakdown_items.map(b => ({ ...b }))
      : [{ description: '', amount: 0 }]
  );

  const addRow = () => setItems([...items, { description: '', amount: 0 }]);
  const updateRow = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: field === 'amount' ? parseFloat(val) || 0 : val };
    setItems(next);
  };
  const removeRow = (idx) => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="px-6 py-3" data-testid="breakdown-editor">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[#1B2A4A] uppercase tracking-wider">Itemized Payment Breakdown — {payment.inv.student_name}</p>
        <div className="flex gap-2">
          <button onClick={addRow} className="text-xs text-[#2E6CC4] font-medium hover:underline flex items-center gap-1" data-testid="add-breakdown-row">
            <Plus className="w-3 h-3" /> Add Row
          </button>
          <button onClick={() => onSave(items.filter(b => b.description.trim()))} className="text-xs bg-[#2E6CC4] text-white px-3 py-1 rounded font-medium hover:bg-[#2E6CC4]/90" data-testid="save-breakdown">
            Save
          </button>
        </div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="py-1.5 px-2 text-left text-[10px] font-bold text-slate-500 uppercase border border-slate-200" style={{width: 30}}>#</th>
            <th className="py-1.5 px-2 text-left text-[10px] font-bold text-slate-500 uppercase border border-slate-200">Description</th>
            <th className="py-1.5 px-2 text-left text-[10px] font-bold text-slate-500 uppercase border border-slate-200" style={{width: 120}}>Amount (GHS)</th>
            <th className="py-1.5 px-2 text-center text-[10px] font-bold text-slate-500 uppercase border border-slate-200" style={{width: 40}}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="py-1 px-2 border border-slate-200 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
              <td className="py-0 px-0 border border-slate-200">
                <input
                  value={item.description}
                  onChange={e => updateRow(idx, 'description', e.target.value)}
                  placeholder="e.g. Tuition Fee, Uniform Shirt, Books..."
                  className="w-full px-2 py-1.5 text-sm outline-none bg-transparent focus:bg-blue-50/30"
                  data-testid={`bd-desc-${idx}`}
                />
              </td>
              <td className="py-0 px-0 border border-slate-200">
                <input
                  type="number"
                  value={item.amount || ''}
                  onChange={e => updateRow(idx, 'amount', e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-sm outline-none bg-transparent focus:bg-blue-50/30 text-right"
                  data-testid={`bd-amt-${idx}`}
                />
              </td>
              <td className="py-1 px-2 border border-slate-200 text-center">
                {items.length > 1 && (
                  <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600" data-testid={`bd-remove-${idx}`}>
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td colSpan={2} className="py-1.5 px-2 border border-slate-200 text-right text-xs uppercase text-slate-500">Total</td>
            <td className="py-1.5 px-2 border border-slate-200 text-right text-sm text-[#1B2A4A]">{total.toLocaleString()}</td>
            <td className="border border-slate-200"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


function InvoiceList({ invoices, type, onRecordPayment, onDeleteInvoice, onEditInvoice, expandedInvoice, setExpandedInvoice, onViewProof }) {
  if (invoices.length === 0) return (
    <Card className="rounded-xl"><CardContent className="pt-8 pb-8 text-center">
      <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No {type} invoices yet</p>
    </CardContent></Card>
  );
  return (
    <div className="space-y-2">
      {invoices.map(inv => {
        const isExpanded = expandedInvoice === inv.invoice_id;
        return (
          <Card key={inv.invoice_id} className="rounded-xl border-slate-200/60">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedInvoice(isExpanded ? null : inv.invoice_id)}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${type === 'feeding' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {type === 'feeding' ? <Utensils className="w-4 h-4 text-amber-600" /> : <Shirt className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2A4A]">{inv.student_name} <span className="text-xs text-slate-400">({inv.student_year || ''})</span></p>
                  <p className="text-[10px] text-slate-400">{inv.student_status} &middot; {inv.term} {inv.academic_year} &middot; {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB') : ''}</p>
                </div>
                <div className="text-right mr-2">
                  <p className="text-sm font-bold text-[#1B2A4A]">TT$ {(inv.total_due || 0).toLocaleString()}</p>
                  <p className={`text-[10px] font-medium ${(inv.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Bal: TT$ {(inv.balance || 0).toLocaleString()}
                  </p>
                </div>
                <Badge className={`text-[9px] ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{inv.status}</Badge>
                {onEditInvoice && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditInvoice(inv); }}
                    className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Edit invoice"
                    data-testid={`edit-inv-${inv.invoice_id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteInvoice(inv); }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete invoice"
                  data-testid={`delete-inv-${inv.invoice_id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {/* Items breakdown */}
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Items Breakdown</p>
                    <div className="space-y-1">
                      {(inv.items || []).map((item, j) => (
                        <div key={j} className="flex justify-between text-xs bg-slate-50 rounded px-2 py-1">
                          <span>{j + 1}. {item.name || item.description} {item.quantity > 1 ? `x${item.quantity}` : ''}</span>
                          <span className="font-medium">TT$ {((item.unit_price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Payments */}
                  {(inv.payments || []).length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Payments</p>
                      {inv.payments.map(p => (
                        <div key={p.payment_id} className="flex items-center gap-2 text-xs bg-green-50 rounded px-2 py-1 mb-1 flex-wrap">
                          <span className="text-green-700 font-medium">TT$ {(p.amount || 0).toLocaleString()}</span>
                          <span className="text-slate-400">{p.date}</span>
                          <Badge variant="outline" className="text-[8px]">{p.method === 'momo' ? 'MoMo' : p.method === 'bank_transfer' ? 'Bank' : p.method || 'cash'}</Badge>
                          {p.sender_name && <span className="text-slate-500">by {p.sender_name}</span>}
                          {p.reference_id && <span className="font-mono text-slate-400">{p.reference_id}</span>}
                          {p.source === 'parent_portal' && <Badge className="bg-blue-100 text-blue-700 text-[7px]">Parent Portal</Badge>}
                          {p.proof_file_id && (
                            <button onClick={() => onViewProof(p.proof_file_id)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium cursor-pointer" data-testid={`proof-${p.payment_id}`}>
                              <FileText className="w-3 h-3" /> View Proof
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {inv.status !== 'paid' && (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onRecordPayment(inv); }} className="bg-[#C5A55A] hover:bg-[#B09444] text-xs" data-testid={`pay-inv-${inv.invoice_id}`}>
                      <CreditCard className="w-3 h-3 mr-1" /> Record Payment
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
