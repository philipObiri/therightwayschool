import React, { useEffect, useState, useCallback } from 'react';
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
import { Plus, ShoppingCart, CheckCircle, XCircle, Clock, Truck, Edit, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ProcurementRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editRequest, setEditRequest] = useState(null);
  const [form, setForm] = useState({ title: '', items: [{ name: '', qty: 1, unit_price: 0 }], category: 'general', urgency: 'normal', supplier: '', notes: '' });

  const fetch = useCallback(() => {
    const q = filter ? `?status=${filter}` : '';
    api.get(`/receptionist/procurement${q}`).then(r => setRequests(r.data)).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', qty: 1, unit_price: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    setForm({ ...form, items });
  };

  const totalCost = form.items.reduce((s, i) => s + (i.qty * i.unit_price), 0);

  const openEditProcurement = (r) => {
    setEditRequest(r);
    setForm({
      title: r.title || '', items: r.items?.length ? r.items.map(it => ({...it})) : [{ name: '', qty: 1, unit_price: 0 }],
      category: r.category || 'general', urgency: r.urgency || 'normal', supplier: r.supplier || '', notes: r.notes || '',
    });
    setShowCreate(true);
  };

  const handleSubmit = async () => {
    if (!form.title) return toast.error('Title required');
    try {
      if (editRequest) {
        await api.put(`/receptionist/procurement/${editRequest.request_id}`, { ...form, total_cost: totalCost });
        successToast('Request updated');
      } else {
        await api.post('/receptionist/procurement', { ...form, total_cost: totalCost });
        successToast('Procurement request submitted');
      }
      setShowCreate(false); setEditRequest(null);
      setForm({ title: '', items: [{ name: '', qty: 1, unit_price: 0 }], category: 'general', urgency: 'normal', supplier: '', notes: '' });
      fetch();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="procurement-requests">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Procurement Requests</h1>
          <p className="text-sm text-slate-500 mt-1">{requests.length} requests</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#2E6CC4] hover:bg-[#1B2A4A] rounded-lg" data-testid="create-procurement-btn">
          <Plus className="w-4 h-4 mr-2" /> New Request
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'rejected'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm"
            onClick={() => { setFilter(f); setLoading(true); }}
            className={filter === f ? 'bg-[#1B2A4A] text-white' : ''}
            data-testid={`filter-${f || 'all'}`}>
            {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <Card className="rounded-xl">
        <CardContent className="pt-4">
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No procurement requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r.request_id} className="flex items-center gap-3 p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`proc-${r.request_id}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${STATUS_COLORS[r.status]?.split(' ')[0] || 'bg-slate-100'}`}>
                    {r.status === 'approved' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                     r.status === 'rejected' ? <XCircle className="w-5 h-5 text-red-600" /> :
                     <Clock className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B2A4A]">{r.title}</p>
                    <p className="text-xs text-slate-400">
                      {r.category} &middot; {r.urgency} &middot; By {r.requested_by_name} &middot; {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                    </p>
                    {r.items && r.items.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">{r.items.map(i => i.name).join(', ')}</p>
                    )}
                  </div>
                  <span className="font-bold text-[#1B2A4A]">TT$ {(r.total_cost || 0).toLocaleString()}</span>
                  <Badge className={`text-[10px] ${STATUS_COLORS[r.status] || 'bg-slate-100'}`}>{r.status}</Badge>
                  {r.urgency === 'urgent' && <Badge className="bg-red-100 text-red-700 text-[10px]">Urgent</Badge>}
                  <button onClick={() => openEditProcurement(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit request" data-testid={`edit-proc-${r.request_id}`}>
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Procurement Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setEditRequest(null); } setShowCreate(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRequest ? 'Edit Procurement Request' : 'New Procurement Request'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Term 3 Uniform Restock" data-testid="proc-title-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="proc-category-select">
                  <option value="general">General</option><option value="uniforms">Uniforms</option><option value="stationery">Stationery</option><option value="equipment">Equipment</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Urgency</Label>
                <select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="proc-urgency-select">
                  <option value="normal">Normal</option><option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Items */}
            <div>
              <Label className="mb-2 block">Items</Label>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2 items-end">
                  <Input placeholder="Item name" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} className="flex-1" data-testid={`proc-item-name-${i}`} />
                  <Input type="number" placeholder="Qty" value={item.qty} onChange={e => updateItem(i, 'qty', parseInt(e.target.value) || 0)} className="w-20" data-testid={`proc-item-qty-${i}`} />
                  <Input type="number" placeholder="Price" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} className="w-24" data-testid={`proc-item-price-${i}`} />
                  {form.items.length > 1 && <Button variant="ghost" size="sm" className="text-red-500 h-9 px-2" onClick={() => removeItem(i)} data-testid={`remove-item-${i}`}>&times;</Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem} className="mt-1" data-testid="add-proc-item-btn">+ Add Item</Button>
            </div>

            <div className="space-y-1"><Label>Supplier</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} data-testid="proc-supplier-input" /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="proc-notes-input" /></div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
              <span className="text-sm font-medium">Total Cost:</span>
              <span className="text-lg font-bold text-[#1B2A4A]">TT$ {totalCost.toLocaleString()}</span>
            </div>

            <Button onClick={handleSubmit} className="w-full bg-[#2E6CC4]" data-testid="submit-procurement-btn">
              <Truck className="w-4 h-4 mr-2" /> Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
