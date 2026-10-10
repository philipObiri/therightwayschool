import React, { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, Trash2, Upload, FileText, Download, X, Image as ImageIcon } from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL;
const SPEND_CATEGORIES = [
  'Transport', 'Stationery', 'Cleaning', 'Refreshments',
  'Repairs', 'Printing', 'Fuel', 'Communication', 'Miscellaneous'
];

export function PettyCashTab() {
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showSpend, setShowSpend] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [createForm, setCreateForm] = useState({ name: 'Main Petty Cash', initial_balance: '' });
  const [topUpForm, setTopUpForm] = useState({ amount: '', description: '', receipt_file_id: '' });
  const [spendForm, setSpendForm] = useState({ amount: '', description: '', category: 'Miscellaneous', receipt_file_id: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState('');
  const spendFileRef = useRef(null);
  const topUpFileRef = useRef(null);

  const loadAccounts = async () => {
    try { const r = await api.get('/finance/petty-cash/accounts'); setAccounts(r.data); } catch (err) { console.error("Error:", err); }
  };
  useEffect(() => { loadAccounts(); }, []);

  const loadTransactions = async (accountId) => {
    try { const r = await api.get(`/finance/petty-cash/${accountId}/transactions`); setTransactions(r.data); } catch (err) { console.error("Error:", err); }
  };

  const selectAccount = (acc) => {
    setActiveAccount(acc);
    loadTransactions(acc.account_id);
  };

  const uploadReceipt = async (file, target) => {
    if (!file) return;
    setUploading(true);
    setUploadTarget(target);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const fileId = r.data.file_id;
      if (target === 'spend') {
        setSpendForm(p => ({ ...p, receipt_file_id: fileId }));
      } else {
        setTopUpForm(p => ({ ...p, receipt_file_id: fileId }));
      }
      successToast('Receipt uploaded');
    } catch (e) {
      toast.error('Upload failed');
    }
    setUploading(false);
    setUploadTarget('');
  };

  const handleCreateAccount = async () => {
    if (!createForm.name) { toast.error('Account name required'); return; }
    setSaving(true);
    try {
      const r = await api.post('/finance/petty-cash/accounts', { name: createForm.name, initial_balance: parseFloat(createForm.initial_balance) || 0 });
      successToast('Petty cash account created');
      setShowCreate(false); setCreateForm({ name: 'Main Petty Cash', initial_balance: '' });
      loadAccounts();
      selectAccount(r.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleDeleteAccount = async (accountId) => {
    setSaving(true);
    try {
      await api.delete(`/finance/petty-cash/${accountId}`);
      successToast('Account deleted');
      setShowDeleteConfirm(null);
      if (activeAccount?.account_id === accountId) { setActiveAccount(null); setTransactions([]); }
      loadAccounts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete'); }
    setSaving(false);
  };

  const handleTopUp = async () => {
    if (!topUpForm.amount || parseFloat(topUpForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    try {
      await api.post(`/finance/petty-cash/${activeAccount.account_id}/top-up`, {
        amount: parseFloat(topUpForm.amount), description: topUpForm.description,
        receipt_file_id: topUpForm.receipt_file_id,
      });
      successToast('Top-up recorded');
      setShowTopUp(false); setTopUpForm({ amount: '', description: '', receipt_file_id: '' });
      loadAccounts(); loadTransactions(activeAccount.account_id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const handleSpend = async () => {
    if (!spendForm.amount || parseFloat(spendForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    try {
      await api.post(`/finance/petty-cash/${activeAccount.account_id}/spend`, {
        amount: parseFloat(spendForm.amount), description: spendForm.description,
        category: spendForm.category, receipt_file_id: spendForm.receipt_file_id,
      });
      successToast('Spending recorded');
      setShowSpend(false); setSpendForm({ amount: '', description: '', category: 'Miscellaneous', receipt_file_id: '' });
      loadAccounts(); loadTransactions(activeAccount.account_id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };

  const token = localStorage.getItem('rw_token');
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalTopUps = transactions.filter(t => t.type === 'top_up').reduce((s, t) => s + t.amount, 0);
  const totalSpent = transactions.filter(t => t.type === 'spend').reduce((s, t) => s + t.amount, 0);

  const ReceiptUploadWidget = ({ target, fileId, onClear }) => (
    <div>
      <Label className="text-xs">Receipt (optional)</Label>
      {fileId ? (
        <div className="flex items-center gap-2 mt-1 p-2 bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-lg">
          <FileText className="w-4 h-4 text-[#C5A55A] shrink-0" />
          <span className="text-xs text-[#C5A55A] flex-1 truncate">Receipt attached</span>
          <a href={`${BACKEND}/api/files/${fileId}/preview?token=${token}`} target="_blank" rel="noreferrer" className="text-[10px] text-[#2E6CC4] hover:underline">View</a>
          <button onClick={onClear} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <div
          onClick={() => target === 'spend' ? spendFileRef.current?.click() : topUpFileRef.current?.click()}
          className="mt-1 flex items-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-[#2E6CC4]/40 hover:bg-slate-50 transition-colors"
          data-testid={`pc-${target}-receipt-upload`}
        >
          {uploading && uploadTarget === target ? (
            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-[#2E6CC4] border-t-transparent rounded-full animate-spin" /><span className="text-xs text-slate-500">Uploading...</span></div>
          ) : (
            <><Upload className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-500">Click to upload receipt (image or PDF)</span></>
          )}
        </div>
      )}
      <input ref={target === 'spend' ? spendFileRef : topUpFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files[0]) uploadReceipt(e.target.files[0], target); e.target.value = ''; }} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="petty-cash-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Petty Cash Management</h2><p className="text-xs text-slate-500">Manage petty cash accounts, top-ups, and spending</p></div>
        <Button className="bg-[#2E6CC4] rounded-md text-xs" onClick={() => setShowCreate(true)} data-testid="create-pc-account-btn"><Plus className="w-3 h-3 mr-1" /> New Account</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">TT$ {totalBalance.toLocaleString()}</p><p className="text-xs text-slate-500">Total Balance</p></div>
        <div className="stat-card"><p className="text-2xl font-bold">{accounts.length}</p><p className="text-xs text-slate-500">Accounts</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-amber-600">{transactions.length}</p><p className="text-xs text-slate-500">Transactions</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Account list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accounts</p>
          {accounts.map(acc => (
            <Card key={acc.account_id} className={`rounded-md cursor-pointer transition-colors ${activeAccount?.account_id === acc.account_id ? 'border-[#2E6CC4] bg-blue-50/50' : 'hover:bg-slate-50'}`} data-testid={`pc-account-${acc.account_id}`}>
              <CardContent className="py-3 px-4" onClick={() => selectAccount(acc)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#2E6CC4]" />
                    <span className="text-sm font-medium">{acc.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]">active</Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(acc); }}
                      className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"
                      data-testid={`pc-delete-${acc.account_id}`}
                      title="Delete account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-lg font-bold text-[#1B2A4A] mt-1">TT$ {(acc.balance || 0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">Custodian: {acc.custodian_name}</p>
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && <p className="text-center text-sm text-slate-400 py-6">No petty cash accounts</p>}
        </div>

        {/* Transactions panel */}
        <div className="lg:col-span-2">
          {activeAccount ? (
            <Card className="rounded-md">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#1B2A4A]">{activeAccount.name}</h3>
                    <p className="text-xs text-slate-500">Balance: <span className="font-bold text-[#2E6CC4]">TT$ {(activeAccount.balance || 0).toLocaleString()}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#C5A55A] rounded-md text-xs" onClick={() => setShowTopUp(true)} data-testid="pc-topup-btn"><ArrowUpCircle className="w-3 h-3 mr-1" /> Top Up</Button>
                    <Button size="sm" className="bg-amber-600 rounded-md text-xs" onClick={() => setShowSpend(true)} data-testid="pc-spend-btn"><ArrowDownCircle className="w-3 h-3 mr-1" /> Record Spend</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#C5A55A]/10 p-3 rounded-lg text-center"><p className="text-[10px] text-slate-500">Total Top-ups</p><p className="font-bold text-[#C5A55A]">TT$ {totalTopUps.toLocaleString()}</p></div>
                  <div className="bg-red-50 p-3 rounded-lg text-center"><p className="text-[10px] text-slate-500">Total Spent</p><p className="font-bold text-red-600">TT$ {totalSpent.toLocaleString()}</p></div>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transactions.map(txn => (
                    <div key={txn.txn_id} className="flex items-center gap-3 p-2.5 border border-slate-100 rounded-md hover:bg-slate-50/50 transition-colors" data-testid={`pc-txn-${txn.txn_id}`}>
                      {txn.type === 'top_up' ? <ArrowUpCircle className="w-4 h-4 text-[#C5A55A] shrink-0" /> : <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{txn.description || txn.type.replace('_', ' ')}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {txn.category && <Badge variant="outline" className="text-[8px] py-0 px-1">{txn.category}</Badge>}
                          <p className="text-[10px] text-slate-400">{txn.created_by_name} | {new Date(txn.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {txn.receipt_file_id && (
                        <a
                          href={`${BACKEND}/api/files/${txn.receipt_file_id}/download?token=${token}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] text-[#2E6CC4] hover:underline bg-blue-50 px-2 py-1 rounded-md shrink-0"
                          data-testid={`pc-receipt-${txn.txn_id}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <Download className="w-3 h-3" /> Receipt
                        </a>
                      )}
                      <span className={`text-sm font-bold shrink-0 ${txn.type === 'top_up' ? 'text-[#C5A55A]' : 'text-red-600'}`}>
                        {txn.type === 'top_up' ? '+' : '-'}TT$ {txn.amount?.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="text-center py-6 text-sm text-slate-400">No transactions yet</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center"><Wallet className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="text-sm">Select an account to view transactions</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Create Account Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create Petty Cash Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Account Name</Label><Input value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} className="h-9 text-xs" data-testid="pc-name-input" /></div>
            <div><Label className="text-xs">Initial Balance (GHS)</Label><Input type="number" value={createForm.initial_balance} onChange={e => setCreateForm(p => ({ ...p, initial_balance: e.target.value }))} className="h-9 text-xs" placeholder="0" data-testid="pc-initial-balance" /></div>
            <Button className="w-full bg-[#2E6CC4] rounded-md text-xs" onClick={handleCreateAccount} disabled={saving} data-testid="pc-create-submit">{saving ? 'Creating...' : 'Create Account'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Delete Petty Cash Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold">"{showDeleteConfirm?.name}"</span>? This will permanently remove the account and all its transactions.</p>
            {showDeleteConfirm?.balance > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 font-medium">This account still has TT$ {showDeleteConfirm.balance.toLocaleString()} remaining balance.</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs rounded-md" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-xs rounded-md" onClick={() => handleDeleteAccount(showDeleteConfirm.account_id)} disabled={saving} data-testid="pc-delete-confirm">{saving ? 'Deleting...' : 'Delete Account'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog open={showTopUp} onOpenChange={v => { setShowTopUp(v); if (!v) setTopUpForm({ amount: '', description: '', receipt_file_id: '' }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Top Up Petty Cash</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Amount (GHS)</Label><Input type="number" value={topUpForm.amount} onChange={e => setTopUpForm(p => ({ ...p, amount: e.target.value }))} className="h-9 text-xs" data-testid="pc-topup-amount" /></div>
            <div><Label className="text-xs">Description</Label><Input value={topUpForm.description} onChange={e => setTopUpForm(p => ({ ...p, description: e.target.value }))} className="h-9 text-xs" placeholder="e.g. Monthly replenishment" /></div>
            <ReceiptUploadWidget target="topup" fileId={topUpForm.receipt_file_id} onClear={() => setTopUpForm(p => ({ ...p, receipt_file_id: '' }))} />
            <Button className="w-full bg-[#C5A55A] rounded-md text-xs" onClick={handleTopUp} disabled={saving || uploading} data-testid="pc-topup-submit">{saving ? 'Processing...' : 'Confirm Top Up'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Spend Dialog */}
      <Dialog open={showSpend} onOpenChange={v => { setShowSpend(v); if (!v) setSpendForm({ amount: '', description: '', category: 'Miscellaneous', receipt_file_id: '' }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Petty Cash Spending</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Amount (GHS)</Label><Input type="number" value={spendForm.amount} onChange={e => setSpendForm(p => ({ ...p, amount: e.target.value }))} className="h-9 text-xs" data-testid="pc-spend-amount" /></div>
            <div><Label className="text-xs">Category</Label>
              <Select value={spendForm.category} onValueChange={v => setSpendForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="h-9 text-xs" data-testid="pc-spend-category"><SelectValue /></SelectTrigger>
                <SelectContent>{SPEND_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Description</Label><Input value={spendForm.description} onChange={e => setSpendForm(p => ({ ...p, description: e.target.value }))} className="h-9 text-xs" placeholder="What was purchased?" data-testid="pc-spend-desc" /></div>
            <ReceiptUploadWidget target="spend" fileId={spendForm.receipt_file_id} onClear={() => setSpendForm(p => ({ ...p, receipt_file_id: '' }))} />
            <Button className="w-full bg-amber-600 rounded-md text-xs" onClick={handleSpend} disabled={saving || uploading} data-testid="pc-spend-submit">{saving ? 'Processing...' : 'Record Spending'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
