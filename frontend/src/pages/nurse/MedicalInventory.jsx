import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AppLoader } from '../../components/AppLoader';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { Plus, Package, AlertTriangle, Search, Pill, Trash2, Edit } from 'lucide-react';

const CATEGORIES = ['medication', 'first_aid', 'equipment', 'consumable', 'other'];

export default function MedicalInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'medication', description: '', quantity: 0, unit: 'units', min_threshold: 5, expiry_date: '', supplier: '' });
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const fetch = useCallback(() => {
    api.get('/sick-bay/inventory').then(r => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    try {
      if (editItem) {
        await api.put(`/sick-bay/inventory/${editItem.item_id}`, form);
        successToast('Item updated');
      } else {
        await api.post('/sick-bay/inventory', form);
        successToast('Item added');
      }
      setShowAdd(false);
      setEditItem(null);
      setForm({ name: '', category: 'medication', description: '', quantity: 0, unit: 'units', min_threshold: 5, expiry_date: '', supplier: '' });
      fetch();
    } catch (e) { toast.error('Failed'); }
  };

  const handleAdjust = async () => {
    if (!adjustItem || adjustQty === 0) return;
    try {
      await api.put(`/sick-bay/inventory/${adjustItem.item_id}`, { quantity_change: adjustQty, reason: adjustReason });
      successToast('Stock adjusted');
      setAdjustItem(null);
      setAdjustQty(0);
      setAdjustReason('');
      fetch();
    } catch (e) { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await api.delete(`/sick-bay/inventory/${id}`);
      successToast('Item deleted');
      fetch();
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.category?.toLowerCase().includes(search.toLowerCase())
  );
  const lowStock = items.filter(i => i.quantity <= i.min_threshold);

  return (
    <div className="space-y-6" data-testid="medical-inventory">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Medical Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} items &middot; {lowStock.length} low stock</p>
        </div>
        <Button onClick={() => { setShowAdd(true); setEditItem(null); setForm({ name: '', category: 'medication', description: '', quantity: 0, unit: 'units', min_threshold: 5, expiry_date: '', supplier: '' }); }} className="bg-[#2E6CC4] hover:bg-[#1B2A4A] rounded-lg" data-testid="add-item-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3" data-testid="low-stock-alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">{lowStock.length} item{lowStock.length !== 1 ? 's' : ''} below minimum threshold:</span>
            <span className="text-sm text-amber-600">{lowStock.map(i => i.name).join(', ')}</span>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="inventory-search" />
      </div>

      <Card className="rounded-xl">
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500 uppercase">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Qty</th>
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3">Min</th>
                  <th className="py-2 px-3">Expiry</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No items found</td></tr>
                ) : filtered.map(item => (
                  <tr key={item.item_id} className="border-b last:border-0 hover:bg-slate-50" data-testid={`inv-row-${item.item_id}`}>
                    <td className="py-3 px-3 font-medium text-[#1B2A4A]">{item.name}</td>
                    <td className="py-3 px-3"><Badge variant="outline" className="text-[10px]">{item.category}</Badge></td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${item.quantity <= item.min_threshold ? 'text-red-600' : 'text-[#1B2A4A]'}`}>{item.quantity}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{item.unit}</td>
                    <td className="py-3 px-3 text-slate-500">{item.min_threshold}</td>
                    <td className="py-3 px-3 text-slate-500">{item.expiry_date || '-'}</td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAdjustItem(item)} data-testid={`adjust-${item.item_id}`}>
                          <Package className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditItem(item); setForm({ name: item.name, category: item.category, description: item.description || '', quantity: item.quantity, unit: item.unit || 'units', min_threshold: item.min_threshold, expiry_date: item.expiry_date || '', supplier: item.supplier || '' }); setShowAdd(true); }} data-testid={`edit-${item.item_id}`}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => handleDelete(item.item_id)} data-testid={`delete-${item.item_id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit Item' : 'Add Medical Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="item-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="item-category-select">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} data-testid="item-unit-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} data-testid="item-qty-input" /></div>
              <div className="space-y-1"><Label>Min Threshold</Label><Input type="number" value={form.min_threshold} onChange={e => setForm({ ...form, min_threshold: parseInt(e.target.value) || 0 })} data-testid="item-min-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} data-testid="item-expiry-input" /></div>
              <div className="space-y-1"><Label>Supplier</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} data-testid="item-supplier-input" /></div>
            </div>
            <Button onClick={handleSave} className="w-full bg-[#2E6CC4]" data-testid="save-item-btn">{editItem ? 'Update' : 'Add'} Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustItem} onOpenChange={() => setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock: {adjustItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Current: <strong>{adjustItem?.quantity} {adjustItem?.unit}</strong></p>
            <div className="space-y-1"><Label>Change (+/-)</Label><Input type="number" value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value) || 0)} placeholder="e.g. +10 or -3" data-testid="adjust-qty-input" /></div>
            <div className="space-y-1"><Label>Reason</Label><Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Restocked, Used for patient" data-testid="adjust-reason-input" /></div>
            <p className="text-sm">New quantity: <strong>{Math.max(0, (adjustItem?.quantity || 0) + adjustQty)}</strong></p>
            <Button onClick={handleAdjust} className="w-full bg-[#2E6CC4]" data-testid="confirm-adjust-btn">Adjust Stock</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
