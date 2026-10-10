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
import { Plus, Package, Search, AlertTriangle, Trash2, Edit } from 'lucide-react';

const CATEGORIES = ['uniforms', 'stationery', 'books', 'equipment', 'general'];

export default function InventoryManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'uniforms', description: '', quantity: 0, unit_price: 0, min_threshold: 5, supplier: '' });
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const fetch = useCallback(() => {
    const q = catFilter ? `?category=${catFilter}` : '';
    api.get(`/receptionist/inventory${q}`).then(r => setItems(r.data)).finally(() => setLoading(false));
  }, [catFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    try {
      if (editItem) {
        await api.put(`/receptionist/inventory/${editItem.item_id}`, form);
        successToast('Item updated');
      } else {
        await api.post('/receptionist/inventory', form);
        successToast('Item added');
      }
      setShowAdd(false);
      setEditItem(null);
      setForm({ name: '', category: 'uniforms', description: '', quantity: 0, unit_price: 0, min_threshold: 5, supplier: '' });
      fetch();
    } catch (e) { toast.error('Failed'); }
  };

  const handleAdjust = async () => {
    if (!adjustItem || adjustQty === 0) return;
    try {
      await api.put(`/receptionist/inventory/${adjustItem.item_id}`, { quantity_change: adjustQty, reason: adjustReason });
      successToast('Stock adjusted');
      setAdjustItem(null);
      setAdjustQty(0);
      setAdjustReason('');
      fetch();
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  const filtered = items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()));
  const lowStock = items.filter(i => i.quantity <= i.min_threshold);

  return (
    <div className="space-y-6" data-testid="receptionist-inventory">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Inventory Management</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} items &middot; {lowStock.length} low stock</p>
        </div>
        <Button onClick={() => { setShowAdd(true); setEditItem(null); setForm({ name: '', category: 'uniforms', description: '', quantity: 0, unit_price: 0, min_threshold: 5, supplier: '' }); }} className="bg-[#2E6CC4] hover:bg-[#1B2A4A] rounded-lg" data-testid="add-item-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3" data-testid="low-stock-alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">{lowStock.length} low stock item{lowStock.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="inventory-search" />
        </div>
        <select value={catFilter || "all"} onChange={e => setCatFilter(e.target.value === "all" ? "" : e.target.value)} className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="category-filter">
          <option value="all">All</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
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
                  <th className="py-2 px-3">Price (GHS)</th>
                  <th className="py-2 px-3">Min</th>
                  <th className="py-2 px-3">Supplier</th>
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
                    <td className="py-3 px-3"><span className={`font-bold ${item.quantity <= item.min_threshold ? 'text-red-600' : 'text-[#1B2A4A]'}`}>{item.quantity}</span></td>
                    <td className="py-3 px-3">{(item.unit_price || 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-500">{item.min_threshold}</td>
                    <td className="py-3 px-3 text-slate-500">{item.supplier || '-'}</td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAdjustItem(item)} data-testid={`adjust-${item.item_id}`}><Package className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditItem(item); setForm({ name: item.name, category: item.category, description: item.description || '', quantity: item.quantity, unit_price: item.unit_price || 0, min_threshold: item.min_threshold, supplier: item.supplier || '' }); setShowAdd(true); }} data-testid={`edit-${item.item_id}`}><Edit className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="item-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="item-category-select">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Unit Price (GHS)</Label><Input type="number" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} data-testid="item-price-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} data-testid="item-qty-input" /></div>
              <div className="space-y-1"><Label>Min Threshold</Label><Input type="number" value={form.min_threshold} onChange={e => setForm({ ...form, min_threshold: parseInt(e.target.value) || 0 })} data-testid="item-min-input" /></div>
            </div>
            <div className="space-y-1"><Label>Supplier</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} data-testid="item-supplier-input" /></div>
            <Button onClick={handleSave} className="w-full bg-[#2E6CC4]" data-testid="save-item-btn">{editItem ? 'Update' : 'Add'} Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock */}
      <Dialog open={!!adjustItem} onOpenChange={() => setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock: {adjustItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Current: <strong>{adjustItem?.quantity}</strong></p>
            <div className="space-y-1"><Label>Change (+/-)</Label><Input type="number" value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value) || 0)} data-testid="adjust-qty-input" /></div>
            <div className="space-y-1"><Label>Reason</Label><Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} data-testid="adjust-reason-input" /></div>
            <p className="text-sm">New: <strong>{Math.max(0, (adjustItem?.quantity || 0) + adjustQty)}</strong></p>
            <Button onClick={handleAdjust} className="w-full bg-[#2E6CC4]" data-testid="confirm-adjust-btn">Adjust</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
