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
import { Plus, Building2, Phone, Mail, Search, Edit2 } from 'lucide-react';

const SERVICE_CATEGORIES = [
  'IT Services', 'Catering', 'Construction', 'Maintenance',
  'Transport', 'Printing', 'Stationery', 'Cleaning',
  'Security', 'Consulting', 'Training', 'Other'
];

export function VendorsTab() {
  const [vendors, setVendors] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', service_category: '', tax_id: '', bank_details: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => { try { const r = await api.get('/finance/vendors'); setVendors(r.data); } catch (err) { console.error("Error:", err); } };
  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ name: '', contact_person: '', phone: '', email: '', address: '', service_category: '', tax_id: '', bank_details: '', notes: '' });

  const handleCreate = async () => {
    if (!form.name) { toast.error('Vendor name required'); return; }
    setSaving(true);
    try {
      await api.post('/finance/vendors', form);
      successToast('Vendor created');
      setShowCreate(false); resetForm(); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!form.name) { toast.error('Vendor name required'); return; }
    setSaving(true);
    try {
      await api.put(`/finance/vendors/${editing.vendor_id}`, form);
      successToast('Vendor updated');
      setEditing(null); resetForm(); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const openEdit = (v) => {
    setForm({ name: v.name, contact_person: v.contact_person || '', phone: v.phone || '', email: v.email || '', address: v.address || '', service_category: v.service_category || '', tax_id: v.tax_id || '', bank_details: v.bank_details || '', notes: v.notes || '' });
    setEditing(v);
  };

  const filtered = vendors.filter(v =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.service_category?.toLowerCase().includes(search.toLowerCase())
  );

  const byCategory = {};
  vendors.forEach(v => { const c = v.service_category || 'Other'; byCategory[c] = (byCategory[c] || 0) + 1; });

  return (
    <div className="space-y-4" data-testid="vendors-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Vendor Management</h2><p className="text-xs text-slate-500">Manage suppliers and service providers</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => { resetForm(); setShowCreate(true); }} data-testid="create-vendor-btn"><Plus className="w-3 h-3 mr-1" /> Add Vendor</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{vendors.length}</p><p className="text-xs text-slate-500">Total Vendors</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#C5A55A]">{vendors.filter(v => v.status === 'active').length}</p><p className="text-xs text-slate-500">Active</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">{Object.keys(byCategory).length}</p><p className="text-xs text-slate-500">Categories</p></div>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-md border px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="vendor-search" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(v => (
          <Card key={v.vendor_id} className="rounded-md hover:border-[#2E6CC4]/30 transition-colors" data-testid={`vendor-${v.vendor_id}`}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-md bg-[#1B2A4A] flex items-center justify-center text-white text-sm font-bold">{v.name?.charAt(0)}</div>
                  <div><h3 className="text-sm font-bold text-[#1B2A4A]">{v.name}</h3>
                  {v.service_category && <Badge variant="secondary" className="text-[9px]">{v.service_category}</Badge>}</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(v)}><Edit2 className="w-3 h-3" /></Button>
              </div>
              {v.contact_person && <p className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> {v.contact_person}</p>}
              {v.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {v.phone}</p>}
              {v.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {v.email}</p>}
              <Badge className={`mt-2 text-[9px] ${v.status === 'active' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-slate-100 text-slate-500'}`}>{v.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400"><Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="text-sm">No vendors found</p></div>}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || !!editing} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Vendor Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-9 text-xs" data-testid="vendor-name-input" /></div>
              <div><Label className="text-xs">Contact Person</Label><Input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Service Category</Label>
              <Select value={form.service_category} onValueChange={v => setForm(p => ({ ...p, service_category: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{SERVICE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="h-9 text-xs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Tax ID / TIN</Label><Input value={form.tax_id} onChange={e => setForm(p => ({ ...p, tax_id: e.target.value }))} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Bank Details</Label><Input value={form.bank_details} onChange={e => setForm(p => ({ ...p, bank_details: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="text-xs" /></div>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={editing ? handleUpdate : handleCreate} disabled={saving} data-testid="save-vendor-btn">
              {saving ? 'Saving...' : editing ? 'Update Vendor' : 'Create Vendor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
