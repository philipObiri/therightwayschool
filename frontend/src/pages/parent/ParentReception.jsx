import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AppLoader } from '../../components/AppLoader';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import {
  MessageSquare, Receipt, DollarSign, Radio, Clock, Shirt,
  Bell, ChevronDown, ChevronUp, Package, Paperclip, Download,
  CreditCard, FileText, Phone, Building, Utensils, Printer, Upload
} from 'lucide-react';
import FileViewerModal from '../../components/FileViewerModal';

const BACKEND = import.meta.env.VITE_API_URL;
const getToken = () => localStorage.getItem('rw_token') || '';
const fileUrl = (fileId) => `${BACKEND}/api/files/${fileId}/download?token=${getToken()}`;

export default function ParentReception() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [expandedBill, setExpandedBill] = useState(null);
  const [viewFileUrl, setViewFileUrl] = useState(null);
  const [viewFileTitle, setViewFileTitle] = useState('Document');

  // Payment
  const [showPay, setShowPay] = useState(false);
  const [payBill, setPayBill] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'momo', reference_id: '', sender_name: '', date: new Date().toISOString().split('T')[0], proof_file_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchData = () => {
    api.get('/receptionist/parent/updates')
      .then(r => setData(r.data))
      .catch(() => setData({ message_count: 0, bill_count: 0, total_billed: 0, total_paid: 0, outstanding: 0, messages: [], bills: [] }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handlePay = async () => {
    if (!payForm.amount || payForm.amount <= 0) return toast.error('Enter valid amount');
    if (!payForm.reference_id) return toast.error('Enter transaction/reference ID');
    setSubmitting(true);
    try {
      await api.post('/receptionist/parent/pay', { invoice_id: payBill.invoice_id, ...payForm });
      successToast('Payment submitted successfully! The school will verify shortly.');
      setShowPay(false); setPayBill(null);
      setPayForm({ amount: 0, method: 'momo', reference_id: '', sender_name: '', date: new Date().toISOString().split('T')[0], proof_file_id: '' });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPayForm(f => ({ ...f, proof_file_id: res.data.file_id }));
      successToast('Proof uploaded');
    } catch (err) { toast.error('Upload failed'); }
    setUploading(false); e.target.value = '';
  };

  if (loading) return <AppLoader />;

  const messages = data?.messages || [];
  const bills = data?.bills || [];

  const feed = [
    ...messages.map(m => ({ ...m, _type: 'message', _date: m.sent_at })),
    ...bills.map(b => ({ ...b, _type: 'bill', _date: b.issued_at })),
  ].sort((a, b) => (b._date || '').localeCompare(a._date || ''));

  const filteredFeed = tab === 'all' ? feed : tab === 'messages' ? feed.filter(f => f._type === 'message') : feed.filter(f => f._type === 'bill');

  return (
    <div className="space-y-6" data-testid="parent-reception">
      {/* Header */}
      <div className="relative w-full rounded-2xl bg-[#2A7A5A] overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] via-[#1B2A4A]/90 to-[#C5A55A]/10" />
        <div className="relative z-10 px-6 md:px-10 py-7 md:py-9">
          <p className="text-[#F4A261] text-sm font-semibold tracking-wide mb-1">School Reception</p>
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Updates &amp; Bills
          </h1>
          <p className="text-slate-300 mt-1 text-xs md:text-sm">Messages, billing and payments from the school reception</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={MessageSquare} label="Messages" value={data?.message_count || 0} color="bg-blue-50 text-[#2E6CC4]" />
        <SummaryCard icon={Receipt} label="Bills" value={data?.bill_count || 0} color="bg-amber-50 text-amber-600" />
        <SummaryCard icon={DollarSign} label="Total Billed" value={`TT$ ${(data?.total_billed || 0).toLocaleString()}`} color="bg-[#C5A55A]/10 text-[#C5A55A]" />
        <SummaryCard icon={DollarSign} label="Outstanding" value={`TT$ ${(data?.outstanding || 0).toLocaleString()}`} color={(data?.outstanding || 0) > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} />
      </div>

      {/* Payment Details Card */}
      <Card className="rounded-xl border-[#C5A55A]/30 bg-gradient-to-r from-amber-50/50 to-white">
        <CardContent className="pt-4 pb-4">
          <h3 className="text-sm font-bold text-[#1B2A4A] mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#C5A55A]" /> Payment Details</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-[#1B2A4A] flex items-center gap-1 mb-1"><Phone className="w-3.5 h-3.5" /> MoMo Details</p>
              <p className="text-slate-600">MTN Merchant: <strong>727799</strong></p>
              <p className="text-slate-600">Name: <strong>The RightWay Centre of Learning</strong></p>
              <p className="text-slate-600">Other Networks: <strong>0593227076</strong> — Olivia Titi-Ofei</p>
            </div>
            <div>
              <p className="font-semibold text-[#1B2A4A] flex items-center gap-1 mb-1"><Building className="w-3.5 h-3.5" /> Bank Details</p>
              <p className="text-slate-600">Account: <strong>3220001035433</strong></p>
              <p className="text-slate-600">Bank: <strong>GT BANK</strong></p>
              <p className="text-slate-600">Depositor Name: <strong>Ward's Name</strong></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All Updates', count: feed.length },
          { key: 'messages', label: 'Messages', count: messages.length },
          { key: 'bills', label: 'Bills & Pay', count: bills.length },
        ].map(t => (
          <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm"
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'bg-[#2A7A5A] text-white' : ''}
            data-testid={`tab-${t.key}`}>
            {t.label} ({t.count})
          </Button>
        ))}
      </div>

      {/* Feed */}
      {filteredFeed.length === 0 ? (
        <Card className="rounded-xl"><CardContent className="pt-8 pb-8 text-center">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-400">No updates from reception yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredFeed.map((item) => (
            item._type === 'message' ? (
              <MessageCard key={`msg-${item.message_id}`} msg={item} expanded={expandedMsg === item.message_id} onToggle={() => setExpandedMsg(expandedMsg === item.message_id ? null : item.message_id)} onViewFile={(url, title) => { setViewFileUrl(url); setViewFileTitle(title || 'Attachment'); }} />
            ) : (
              <BillCard key={`bill-${item.invoice_id}`} bill={item} expanded={expandedBill === item.invoice_id} onToggle={() => setExpandedBill(expandedBill === item.invoice_id ? null : item.invoice_id)} onPay={() => { setPayBill(item); setPayForm({ amount: item.balance || (item.total_due - (item.amount_paid || 0)), method: 'momo', reference_id: '', sender_name: user?.name || '', date: new Date().toISOString().split('T')[0], proof_file_id: '' }); setShowPay(true); }} onViewFile={(url, title) => { setViewFileUrl(url); setViewFileTitle(title || 'Invoice'); }} />
            )
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-500">Invoice for: <strong className="text-[#1B2A4A]">{payBill?.student_name}</strong></p>
              <p className="text-sm text-slate-500">Type: <strong>{payBill?.type}</strong> &middot; Total: <strong>TT$ {(payBill?.total_due || 0).toLocaleString()}</strong></p>
              <p className="text-sm">Balance: <strong className="text-red-600">TT$ {(payBill?.balance || 0).toLocaleString()}</strong></p>
            </div>

            <div className="space-y-1"><Label>Amount Paid (GHS) *</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} data-testid="pay-amount" /></div>

            <div className="space-y-1">
              <Label>Payment Method *</Label>
              <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="pay-method">
                <option value="momo">Mobile Money (MoMo)</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Transaction ID / Reference *</Label><Input value={payForm.reference_id} onChange={e => setPayForm({ ...payForm, reference_id: e.target.value })} placeholder="e.g. 76544065894" data-testid="pay-ref" /></div>
              <div className="space-y-1"><Label>Sender's Name</Label><Input value={payForm.sender_name} onChange={e => setPayForm({ ...payForm, sender_name: e.target.value })} data-testid="pay-sender" /></div>
            </div>

            <div className="space-y-1"><Label>Payment Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} data-testid="pay-date" /></div>

            {/* Proof upload */}
            <div className="space-y-1">
              <Label>Upload Proof (screenshot/receipt)</Label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
                <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : payForm.proof_file_id ? 'Proof uploaded' : 'Choose file'}
                <input type="file" className="hidden" onChange={handleProofUpload} disabled={uploading} accept="image/*,.pdf" />
              </label>
              {payForm.proof_file_id && <Badge className="bg-green-100 text-green-700 text-[10px]">Proof attached</Badge>}
            </div>

            {/* MoMo reminder */}
            {payForm.method === 'momo' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-semibold mb-1">MoMo Payment Instructions:</p>
                <p>MTN Merchant: <strong>727799</strong> (The RightWay Centre of Learning)</p>
                <p>Other Networks: <strong>0593227076</strong> (Olivia Titi-Ofei)</p>
              </div>
            )}
            {payForm.method === 'bank_transfer' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">Bank Transfer Instructions:</p>
                <p>Account: <strong>3220001035433</strong> — GT BANK</p>
                <p>Depositor Name: <strong>Your Ward's Name</strong></p>
              </div>
            )}

            <Button onClick={handlePay} disabled={submitting} className="w-full bg-[#C5A55A] hover:bg-[#B09444] h-11" data-testid="confirm-pay-btn">
              <CreditCard className="w-4 h-4 mr-2" /> {submitting ? 'Submitting...' : `Submit TT$ ${(payForm.amount || 0).toLocaleString()} Payment`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* File/Proof Viewer Modal */}
      <FileViewerModal
        url={viewFileUrl}
        open={!!viewFileUrl}
        onClose={() => setViewFileUrl(null)}
        title={viewFileTitle}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm" data-testid={`summary-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}><Icon className="w-4 h-4" /></div>
      <p className="text-xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function MessageCard({ msg, expanded, onToggle, onViewFile }) {
  const isBroadcast = msg.type === 'broadcast';
  return (
    <Card className="rounded-xl border-slate-200/60 hover:shadow-sm transition-shadow" data-testid={`msg-card-${msg.message_id}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isBroadcast ? 'bg-amber-100' : 'bg-blue-100'}`}>
            {isBroadcast ? <Radio className="w-4 h-4 text-amber-600" /> : <MessageSquare className="w-4 h-4 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-[#1B2A4A] truncate">{msg.subject || 'Message from Reception'}</p>
              <Badge className={`text-[9px] flex-shrink-0 ${isBroadcast ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {isBroadcast ? 'Announcement' : 'Direct'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {msg.sent_at ? new Date(msg.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              <span className="mx-1">&middot;</span> From: {msg.sent_by_name || 'Reception'}
            </p>
            {!expanded && msg.body && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{msg.body}</p>}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </div>
        {expanded && (
          <div className="mt-3 pl-12 border-t pt-3">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
            {(msg.attachments || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {msg.attachments.map((att, j) => (
                  <button key={j} onClick={() => onViewFile(`${BACKEND}/api/files/${att.file_id}/download`, att.filename || 'Attachment')}
                    className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer" data-testid={`att-${att.file_id}`}>
                    <Download className="w-3.5 h-3.5" /> {att.filename || 'View File'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BillCard({ bill, expanded, onToggle, onPay, onViewFile }) {
  const items = bill.items || [];
  const isPaid = bill.status === 'paid';
  const balance = bill.balance ?? (bill.total_due - (bill.amount_paid || 0));
  const isFeeding = bill.type === 'feeding';

  return (
    <Card className="rounded-xl border-slate-200/60 hover:shadow-sm transition-shadow" data-testid={`bill-card-${bill.invoice_id}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isPaid ? 'bg-green-100' : 'bg-[#C5A55A]/10'}`}>
            {isFeeding ? <Utensils className="w-4 h-4 text-amber-600" /> : <Shirt className="w-4 h-4 text-[#C5A55A]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-[#1B2A4A]">{isFeeding ? 'Feeding Fee' : 'Items Bill'} — {bill.student_name}</p>
              <Badge className={`text-[9px] ${isPaid ? 'bg-green-100 text-green-700' : bill.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {bill.status || 'issued'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {bill.issued_at ? new Date(bill.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              {bill.term && <><span className="mx-1">&middot;</span>{bill.term} {bill.academic_year}</>}
            </p>
          </div>
          <div className="text-right flex-shrink-0 mr-2">
            <p className="text-base font-bold text-[#1B2A4A]">TT$ {(bill.total_due || 0).toLocaleString()}</p>
            {balance > 0 && <p className="text-[10px] text-red-600 font-medium">Bal: TT$ {balance.toLocaleString()}</p>}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </div>

        {expanded && (
          <div className="mt-3 pl-12 border-t pt-3 space-y-3">
            {/* Items */}
            <div className="space-y-1">
              {items.map((item, j) => (
                <div key={j} className="flex justify-between text-xs bg-slate-50 rounded-md px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Package className="w-3 h-3 text-slate-400" />
                    {j + 1}. {item.name || item.description} {(item.quantity || 1) > 1 ? `x${item.quantity}` : ''}
                  </span>
                  <span className="font-medium text-[#1B2A4A]">TT$ {((item.unit_price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Payment history */}
            {(bill.payments || []).length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-medium mb-1">Payments Made</p>
                {bill.payments.map(p => (
                  <div key={p.payment_id} className="flex items-center gap-2 text-xs bg-green-50 rounded-md px-3 py-1.5 mb-1">
                    <span className="text-green-700 font-medium">TT$ {(p.amount || 0).toLocaleString()}</span>
                    <Badge variant="outline" className="text-[8px]">{p.method === 'momo' ? 'MoMo' : p.method === 'bank_transfer' ? 'Bank' : p.method}</Badge>
                    <span className="text-slate-400">{p.date}</span>
                    {p.reference_id && <span className="font-mono text-slate-400">{p.reference_id}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {!isPaid && (
                <Button size="sm" onClick={(e) => { e.stopPropagation(); onPay(); }} className="bg-[#C5A55A] hover:bg-[#B09444] text-xs" data-testid={`pay-bill-${bill.invoice_id}`}>
                  <CreditCard className="w-3 h-3 mr-1" /> Pay Now
                </Button>
              )}
              <a href={`${BACKEND}/api/receptionist/parent/invoice/${bill.invoice_id}/pdf?token=${getToken()}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="text-xs" data-testid={`pdf-${bill.invoice_id}`}>
                  <FileText className="w-3 h-3 mr-1" /> Download PDF
                </Button>
              </a>
              <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); onViewFile(`${BACKEND}/api/receptionist/parent/invoice/${bill.invoice_id}/pdf`, 'Invoice'); }} data-testid={`view-pdf-${bill.invoice_id}`}>
                <Printer className="w-3 h-3 mr-1" /> View Invoice
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
