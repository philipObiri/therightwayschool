import React, { useEffect, useState, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
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
import FileViewerModal from '../../components/FileViewerModal';
import {
  BedDouble, Users, DollarSign, Calendar, ArrowLeft,
  Plus, CreditCard, LogOut, Clock, Building, User,
  Receipt, BarChart3, CheckCircle, Printer, Download, FileText,
  Coffee, Moon, Edit, X, Trash2
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL;

const STATUS_COLORS = { available: 'bg-green-500', occupied: 'bg-red-500', reserved: 'bg-amber-400', maintenance: 'bg-slate-400' };
const STATUS_BG = { available: 'bg-green-50 border-green-200', occupied: 'bg-red-50 border-red-200', reserved: 'bg-amber-50 border-amber-200', maintenance: 'bg-slate-100 border-slate-200' };
const STAY_LABELS = { bed_only: 'Bed Only', bed_and_breakfast: 'Bed & Breakfast' };

export default function GuestHouseDashboard() {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('floor');
  const [selectedFloor, setSelectedFloor] = useState(2);

  // Booking form
  const [showBooking, setShowBooking] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookForm, setBookForm] = useState({ guest_name: '', guest_phone: '', guest_email: '', guest_id_type: '', guest_id_number: '', check_in_date: new Date().toISOString().split('T')[0], check_out_date: '', nightly_rate: 350, stay_type: 'bed_only', notes: '', comments: '' });

  // Payment
  const [showPayment, setShowPayment] = useState(false);
  const [payBooking, setPayBooking] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'cash', reference: '' });

  // Detail
  const [detailBooking, setDetailBooking] = useState(null);

  // Accounts
  const [accounts, setAccounts] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingNotes, setEditingNotes] = useState(null);
  const [editNotesVal, setEditNotesVal] = useState('');
  const [editBooking, setEditBooking] = useState(null);
  const [editBookForm, setEditBookForm] = useState({});
  const [showExpense, setShowExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', category: 'momo_charges', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
  const printRef = useRef(null);

  // Report viewer
  const [reportUrl, setReportUrl] = useState(null);
  const [reportTitle, setReportTitle] = useState('Report');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));

  const refresh = useCallback(async () => {
    try {
      const [d, r, b] = await Promise.all([
        api.get('/guesthouse/dashboard'),
        api.get('/guesthouse/rooms'),
        api.get('/guesthouse/bookings'),
      ]);
      setDash(d.data); setRooms(r.data); setBookings(b.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchAccounts = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const r = await api.get(`/guesthouse/accounts?${params.toString()}`);
    setAccounts(r.data);
  };

  useEffect(() => { if (tab === 'accounts') fetchAccounts(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Computed
  const floorRooms = rooms.filter(r => r.floor === selectedFloor);
  const nights = (() => {
    if (!bookForm.check_in_date || !bookForm.check_out_date) return 0;
    return Math.max(1, (new Date(bookForm.check_out_date) - new Date(bookForm.check_in_date)) / 86400000);
  })();
  const totalCost = nights * (bookForm.nightly_rate || 350);

  const handleCheckIn = async () => {
    if (!bookForm.guest_name) return toast.error('Guest name required');
    if (!bookForm.check_out_date) return toast.error('Check-out date required');
    try {
      await api.post('/guesthouse/bookings', { room_id: selectedRoom.room_id, ...bookForm });
      successToast(`${bookForm.guest_name} checked into Room ${selectedRoom.room_number}`);
      setShowBooking(false); setSelectedRoom(null);
      setBookForm({ guest_name: '', guest_phone: '', guest_email: '', guest_id_type: '', guest_id_number: '', check_in_date: new Date().toISOString().split('T')[0], check_out_date: '', nightly_rate: dash?.default_rate || 350, stay_type: 'bed_only', notes: '', comments: '' });
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handlePayment = async () => {
    if (!payForm.amount || payForm.amount <= 0) return toast.error('Enter valid amount');
    try {
      await api.post('/guesthouse/payments', { booking_id: payBooking.booking_id, ...payForm });
      successToast('Payment recorded');
      setShowPayment(false); setPayBooking(null); setPayForm({ amount: 0, method: 'cash', reference: '' });
      refresh();
      if (detailBooking) { const r = await api.get(`/guesthouse/bookings/${detailBooking.booking_id}`); setDetailBooking(r.data); }
    } catch (e) { toast.error('Failed'); }
  };

  const handleCheckout = async (booking) => {
    if (!window.confirm(`Check out ${booking.guest_name} from Room ${booking.room_number}?`)) return;
    try {
      await api.post(`/guesthouse/bookings/${booking.booking_id}/checkout`);
      successToast(`${booking.guest_name} checked out`);
      setDetailBooking(null); refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleRoomStatus = async (room, status) => {
    try {
      await api.put(`/guesthouse/rooms/${room.room_id}/status`, { status });
      successToast(`Room ${room.room_number} set to ${status}`); refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const openBookRoom = (room) => {
    setSelectedRoom(room);
    setBookForm(f => ({ ...f, nightly_rate: dash?.default_rate || 350 }));
    setShowBooking(true);
  };

  const viewBookingDetail = async (booking) => {
    const r = await api.get(`/guesthouse/bookings/${booking.booking_id}`);
    setDetailBooking(r.data);
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.body.innerHTML = DOMPurify.sanitize(`<html><head><title>Almond Guest House — Accounts Breakdown</title>
      <style>body{font-family:'DM Sans',sans-serif;padding:20px;color:#1B2A4A}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#1B2A4A;color:white;font-size:11px}tr:nth-child(even){background:#f8fafc}.summary{display:flex;gap:20px;margin-bottom:20px}.summary div{background:#f1f5f9;padding:12px 16px;border-radius:8px;flex:1;text-align:center}.summary .val{font-size:20px;font-weight:700}.summary .lbl{font-size:11px;color:#64748b}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;color:#64748b;margin:0 0 16px}.paid{color:#16a34a}.owed{color:#dc2626}.badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600}</style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleSaveNotes = async (bookingId, notes) => {
    try {
      await api.put(`/guesthouse/bookings/${bookingId}/notes`, { comments: notes });
      successToast('Notes saved');
      setEditingNotes(null);
      fetchAccounts();
    } catch (e) { toast.error('Failed'); }
  };

  const openEditBooking = (b) => {
    setEditBooking(b);
    setEditBookForm({
      guest_name: b.guest_name || '', guest_phone: b.guest_phone || '', guest_email: b.guest_email || '',
      guest_id_type: b.guest_id_type || '', guest_id_number: b.guest_id_number || '',
      check_in_date: b.check_in_date || '', check_out_date: b.check_out_date || '',
      nightly_rate: b.nightly_rate || 0, stay_type: b.stay_type || 'bed_only',
      notes: b.notes || '', comments: b.comments || '',
    });
  };

  const handleSaveEditBooking = async () => {
    try {
      await api.put(`/guesthouse/bookings/${editBooking.booking_id}`, editBookForm);
      successToast('Booking updated');
      setEditBooking(null);
      if (detailBooking) { const r = await api.get(`/guesthouse/bookings/${detailBooking.booking_id}`); setDetailBooking(r.data); }
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed'); }
  };

  const handleDeleteBooking = async (b) => {
    if (!window.confirm(`Delete booking for ${b.guest_name} (Room ${b.room_number})? This will also delete all payments and free the room.`)) return;
    try {
      await api.delete(`/guesthouse/bookings/${b.booking_id}`);
      successToast('Booking deleted');
      setDetailBooking(null);
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Delete failed'); }
  };


  const handleAddExpense = async () => {
    if (!expenseForm.description || expenseForm.amount <= 0) return toast.error('Description and amount required');
    try {
      await api.post('/guesthouse/expenses', expenseForm);
      successToast('Expense recorded');
      setShowExpense(false);
      setExpenseForm({ description: '', category: 'momo_charges', amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
      fetchAccounts();
    } catch (e) { toast.error('Failed'); }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await api.delete(`/guesthouse/expenses/${id}`); successToast('Deleted'); fetchAccounts(); } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="guesthouse-dashboard">
      {/* Hero */}
      <div className="relative w-full rounded-2xl bg-[#1B2A4A] overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] via-[#1B2A4A]/90 to-[#C5A55A]/20" />
        <div className="relative z-10 px-6 md:px-10 py-7 md:py-9">
          <p className="text-[#C5A55A] text-sm font-semibold tracking-wide mb-1">Almond Guest House</p>
          <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>Management Dashboard</h1>
          <p className="text-slate-300 mt-1 text-xs">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Rooms', value: dash?.total_rooms || 30, icon: BedDouble, color: 'bg-slate-50 text-slate-600' },
          { label: 'Occupied', value: dash?.occupied || 0, icon: Users, color: 'bg-red-50 text-red-600' },
          { label: 'Available', value: dash?.available || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          { label: 'Revenue', value: `TT$ ${(dash?.total_revenue || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-[#C5A55A]/10 text-[#C5A55A]' },
          { label: 'Occupancy', value: `${dash?.occupancy_rate || 0}%`, icon: BarChart3, color: 'bg-blue-50 text-[#2E6CC4]' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm" data-testid={`gh-stat-${i}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${s.color}`}><s.icon className="w-4 h-4" /></div>
            <p className="text-xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
            <p className="text-[11px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'floor', label: 'Floor View', icon: Building },
          { key: 'bookings', label: `Active (${bookings.filter(b => b.status === 'checked_in').length})`, icon: Users },
          { key: 'accounts', label: 'Accounts Breakdown', icon: FileText },
          { key: 'reports', label: 'PDF Reports', icon: Printer },
          { key: 'all', label: `All History (${bookings.length})`, icon: Clock },
        ].map(t => (
          <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm"
            onClick={() => { setTab(t.key); setDetailBooking(null); }}
            className={tab === t.key ? 'bg-[#1B2A4A] text-white' : ''} data-testid={`tab-${t.key}`}>
            <t.icon className="w-3 h-3 mr-1" /> {t.label}
          </Button>
        ))}
      </div>

      {/* ─── FLOOR VIEW ─── */}
      {tab === 'floor' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[2, 3, 4].map(f => (
              <Button key={f} variant={selectedFloor === f ? 'default' : 'outline'} onClick={() => setSelectedFloor(f)}
                className={selectedFloor === f ? 'bg-[#2E6CC4] text-white' : ''} data-testid={`floor-${f}-btn`}>
                <Building className="w-4 h-4 mr-1" /> {f === 2 ? '2nd' : f === 3 ? '3rd' : '4th'} Floor
              </Button>
            ))}
            <div className="flex gap-3 ml-auto text-xs items-center">
              {Object.entries(STATUS_COLORS).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${v}`} />{k}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 stagger-children">
            {floorRooms.map(room => (
              <div key={room.room_id}
                className={`rounded-xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${STATUS_BG[room.status]}`}
                onClick={() => {
                  if (room.status === 'available' || room.status === 'reserved') openBookRoom(room);
                  else if (room.status === 'occupied') {
                    const bk = bookings.find(b => b.booking_id === room.current_booking_id);
                    if (bk) viewBookingDetail(bk);
                  }
                }}
                data-testid={`room-${room.room_number}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-[#1B2A4A]">{room.room_number}</span>
                  <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[room.status]}`} />
                </div>
                <p className="text-[10px] text-slate-500">1 bed &middot; Floor {room.floor}</p>
                {room.status === 'occupied' && (
                  <div className="mt-1">
                    <p className="text-[10px] font-medium text-red-600 truncate">
                      {bookings.find(b => b.booking_id === room.current_booking_id)?.guest_name || 'Occupied'}
                    </p>
                    <div className="flex gap-1 mt-1.5">
                      <button
                        className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
                        onClick={(e) => { e.stopPropagation(); const bk = bookings.find(b => b.booking_id === room.current_booking_id); if (bk) openEditBooking(bk); }}
                        data-testid={`edit-room-${room.room_number}`}
                      >
                        Edit
                      </button>
                      <button
                        className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                        onClick={(e) => { e.stopPropagation(); const bk = bookings.find(b => b.booking_id === room.current_booking_id); if (bk) handleDeleteBooking(bk); }}
                        data-testid={`delete-room-${room.room_number}`}
                      >
                        Delete
                      </button>
                      <button
                        className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 hover:bg-green-100 font-medium"
                        onClick={(e) => { e.stopPropagation(); openBookRoom(room); }}
                        data-testid={`rebook-room-${room.room_number}`}
                      >
                        + Book
                      </button>
                    </div>
                  </div>
                )}
                {room.status === 'available' && (
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px] text-green-600 font-medium">Tap to book</p>
                    <button
                      className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium"
                      onClick={(e) => { e.stopPropagation(); handleRoomStatus(room, 'maintenance'); }}
                      data-testid={`maint-room-${room.room_number}`}
                    >
                      Maint.
                    </button>
                  </div>
                )}
                {room.status === 'maintenance' && (
                  <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1 mt-1" onClick={(e) => { e.stopPropagation(); handleRoomStatus(room, 'available'); }}>
                    Mark Available
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── ACTIVE BOOKINGS ─── */}
      {tab === 'bookings' && !detailBooking && (
        <Card className="rounded-xl">
          <CardContent className="pt-4">
            {bookings.filter(b => b.status === 'checked_in').length === 0 ? (
              <div className="text-center py-10"><BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No active guests</p></div>
            ) : (
              <div className="space-y-2">
                {bookings.filter(b => b.status === 'checked_in').map(b => (
                  <div key={b.booking_id} onClick={() => viewBookingDetail(b)} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer" data-testid={`booking-${b.booking_id}`}>
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center font-bold text-sm text-red-700">{b.room_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1B2A4A]">{b.guest_name}</p>
                      <p className="text-xs text-slate-400">{b.check_in_date} to {b.check_out_date} &middot; {b.nights} night{b.nights !== 1 ? 's' : ''} &middot; {STAY_LABELS[b.stay_type] || b.stay_type || 'Bed Only'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1B2A4A]">TT$ {(b.total_cost || 0).toLocaleString()}</p>
                      {b.outstanding > 0 && <p className="text-[10px] text-red-600">Owes: TT$ {b.outstanding.toLocaleString()}</p>}
                      {b.outstanding <= 0 && <Badge className="bg-green-100 text-green-700 text-[9px]">Paid</Badge>}
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <button className="text-[9px] px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium" onClick={(e) => { e.stopPropagation(); openEditBooking(b); }} data-testid={`edit-bk-${b.booking_id}`}>Edit</button>
                      <button className="text-[9px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium" onClick={(e) => { e.stopPropagation(); handleDeleteBooking(b); }} data-testid={`del-bk-${b.booking_id}`}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── ACCOUNTS BREAKDOWN ─── */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 h-9" data-testid="date-from" /></div>
            <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 h-9" data-testid="date-to" /></div>
            <Button size="sm" onClick={fetchAccounts} className="bg-[#2E6CC4] h-9" data-testid="filter-accounts-btn">Filter</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowExpense(true)} data-testid="add-expense-btn"><Plus className="w-3 h-3 mr-1" /> Add Expense</Button>
              <Button size="sm" variant="outline" onClick={handlePrint} data-testid="print-accounts-btn"><Printer className="w-3 h-3 mr-1" /> Print</Button>
            </div>
          </div>

          {/* Printable Area */}
          <div ref={printRef}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', margin: '0 0 4px' }}>Almond Guest House — Accounts Breakdown</h1>
            <h2 style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>
              {dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All Time'} &middot; Generated {new Date().toLocaleDateString('en-GB')}
            </h2>

            {/* Summary */}
            {accounts?.summary && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-500">Bookings</p><p className="text-lg font-bold text-[#1B2A4A]">{accounts.summary.total_bookings}</p></div>
                <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-500">Total Billed</p><p className="text-lg font-bold text-[#1B2A4A]">TT$ {accounts.summary.total_billed.toLocaleString()}</p></div>
                <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-500">Total Paid</p><p className="text-lg font-bold text-green-700">TT$ {accounts.summary.total_paid.toLocaleString()}</p></div>
                <div className={`${accounts.summary.total_outstanding > 0 ? 'bg-red-50' : 'bg-green-50'} rounded-lg p-3 text-center`}><p className="text-[10px] text-slate-500">Outstanding</p><p className={`text-lg font-bold ${accounts.summary.total_outstanding > 0 ? 'text-red-600' : 'text-green-700'}`}>TT$ {accounts.summary.total_outstanding.toLocaleString()}</p></div>
                <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-500">Expenses</p><p className="text-lg font-bold text-amber-700">TT$ {(accounts.summary.total_expenses || 0).toLocaleString()}</p></div>
                <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-[10px] text-slate-500">Net Revenue</p><p className="text-lg font-bold text-[#2E6CC4]">TT$ {(accounts.summary.net_revenue || 0).toLocaleString()}</p></div>
              </div>
            )}

            {/* Bookings Table */}
            <Card className="rounded-xl mb-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Bookings &amp; Payments</CardTitle></CardHeader>
              <CardContent className="pt-0 px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] text-slate-500 uppercase text-left bg-slate-50">
                        <th className="py-2 px-2">Guest</th>
                        <th className="py-2 px-2">Room</th>
                        <th className="py-2 px-2">In</th>
                        <th className="py-2 px-2">Out</th>
                        <th className="py-2 px-2">Nights</th>
                        <th className="py-2 px-2">Type</th>
                        <th className="py-2 px-2">Rate</th>
                        <th className="py-2 px-2">Total</th>
                        <th className="py-2 px-2">Paid</th>
                        <th className="py-2 px-2">Method</th>
                        <th className="py-2 px-2">Owing</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 min-w-[140px]">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(accounts?.bookings || []).length === 0 ? (
                        <tr><td colSpan={13} className="text-center py-8 text-slate-400">No bookings found</td></tr>
                      ) : (accounts?.bookings || []).map(b => {
                        const methods = [...new Set((b.payments || []).map(p => p.method).filter(Boolean))];
                        return (
                          <tr key={b.booking_id} className="border-b hover:bg-slate-50" data-testid={`acct-row-${b.booking_id}`}>
                            <td className="py-2 px-2 font-medium text-[#1B2A4A]">{b.guest_name}</td>
                            <td className="py-2 px-2 font-bold">{b.room_number}</td>
                            <td className="py-2 px-2 text-slate-600 text-xs">{b.check_in_date}</td>
                            <td className="py-2 px-2 text-slate-600 text-xs">{b.actual_checkout ? new Date(b.actual_checkout).toLocaleDateString('en-CA') : b.check_out_date}</td>
                            <td className="py-2 px-2">{b.nights}</td>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className="text-[9px]">
                                {b.stay_type === 'bed_and_breakfast' ? 'B&B' : 'Bed'}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-xs">TT$ {(b.nightly_rate || 0).toLocaleString()}</td>
                            <td className="py-2 px-2 font-bold">TT$ {(b.total_cost || 0).toLocaleString()}</td>
                            <td className="py-2 px-2 text-green-700 font-medium">TT$ {(b.amount_paid || 0).toLocaleString()}</td>
                            <td className="py-2 px-2 text-xs">
                              {methods.length > 0 ? methods.map(m => (
                                <Badge key={m} variant="outline" className="text-[8px] mr-0.5">{m === 'mobile_money' ? 'MoMo' : m === 'bank_transfer' ? 'Bank' : m === 'cash' ? 'Cash' : m}</Badge>
                              )) : '-'}
                            </td>
                            <td className="py-2 px-2"><span className={`font-bold ${(b.outstanding || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>TT$ {(b.outstanding || 0).toLocaleString()}</span></td>
                            <td className="py-2 px-2"><Badge className={`text-[9px] ${b.status === 'checked_in' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{(b.status || '').replace(/_/g, ' ')}</Badge></td>
                            <td className="py-2 px-2">
                              {editingNotes === b.booking_id ? (
                                <div className="flex gap-1">
                                  <Input className="h-7 text-xs flex-1" value={editNotesVal} onChange={e => setEditNotesVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveNotes(b.booking_id, editNotesVal); }} />
                                  <Button size="sm" className="h-7 px-2 bg-green-600 text-white text-[10px]" onClick={() => handleSaveNotes(b.booking_id, editNotesVal)}>Save</Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => setEditingNotes(null)}><X className="w-3 h-3" /></Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 cursor-pointer group" onClick={() => { setEditingNotes(b.booking_id); setEditNotesVal(b.comments || b.notes || ''); }}>
                                  <span className="text-xs text-slate-500 truncate max-w-[100px]">{b.comments || b.notes || 'Click to add'}</span>
                                  <Edit className="w-3 h-3 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Expenses Table */}
            {(accounts?.expenses || []).length > 0 && (
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Expenses &amp; Charges</CardTitle></CardHeader>
                <CardContent className="pt-0 px-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-[10px] text-slate-500 uppercase text-left bg-amber-50">
                        <th className="py-2 px-3">Description</th><th className="py-2 px-3">Category</th><th className="py-2 px-3">Amount</th><th className="py-2 px-3">Date</th><th className="py-2 px-3">Notes</th><th className="py-2 px-3">By</th><th className="py-2 px-3"></th>
                      </tr></thead>
                      <tbody>
                        {accounts.expenses.map(e => (
                          <tr key={e.expense_id} className="border-b hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">{e.description}</td>
                            <td className="py-2 px-3"><Badge variant="outline" className="text-[9px]">{(e.category || '').replace(/_/g, ' ')}</Badge></td>
                            <td className="py-2 px-3 font-bold text-amber-700">TT$ {(e.amount || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-500">{e.date}</td>
                            <td className="py-2 px-3 text-xs text-slate-500">{e.notes || '-'}</td>
                            <td className="py-2 px-3 text-xs text-slate-500">{e.recorded_by}</td>
                            <td className="py-2 px-3"><Button variant="ghost" size="sm" className="h-6 px-1 text-red-400 hover:text-red-600" onClick={() => handleDeleteExpense(e.expense_id)}><Trash2 className="w-3 h-3" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ─── PDF REPORTS ─── */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-sm">Generate Reports</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Daily Occupancy */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><BedDouble className="w-5 h-5 text-blue-600" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1B2A4A]">Daily Occupancy Report</p>
                  <p className="text-xs text-slate-500">Room status, guest names, floor-by-floor breakdown</p>
                </div>
                <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-40 h-9" />
                <Button size="sm" className="bg-[#2E6CC4]" onClick={() => { setReportUrl(`${BACKEND}/api/guesthouse/reports/daily-occupancy?date=${reportDate}`); setReportTitle('Daily Occupancy Report'); }} data-testid="gen-occupancy-btn">
                  <FileText className="w-3 h-3 mr-1" /> View
                </Button>
              </div>

              {/* Daily Revenue */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1B2A4A]">Daily Revenue Report</p>
                  <p className="text-xs text-slate-500">Payments received, expenses, net income for a day</p>
                </div>
                <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-40 h-9" />
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setReportUrl(`${BACKEND}/api/guesthouse/reports/daily-revenue?date=${reportDate}`); setReportTitle('Daily Revenue Report'); }} data-testid="gen-revenue-btn">
                  <FileText className="w-3 h-3 mr-1" /> View
                </Button>
              </div>

              {/* Monthly Summary */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-amber-600" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1B2A4A]">Monthly Performance Summary</p>
                  <p className="text-xs text-slate-500">KPIs, all bookings, revenue by room, revenue by method, expenses</p>
                </div>
                <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="w-40 h-9" />
                <Button size="sm" className="bg-[#C5A55A] hover:bg-[#B09444]" onClick={() => { setReportUrl(`${BACKEND}/api/guesthouse/reports/monthly-summary?month=${reportMonth}`); setReportTitle('Monthly Performance Summary'); }} data-testid="gen-monthly-btn">
                  <FileText className="w-3 h-3 mr-1" /> View
                </Button>
              </div>

              {/* Full Accounts PDF */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-[#1B2A4A] flex items-center justify-center"><Receipt className="w-5 h-5 text-white" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1B2A4A]">Full Accounts Breakdown (PDF)</p>
                  <p className="text-xs text-slate-500">Complete accounts with all columns, methods, notes — landscape format</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-9" placeholder="From" />
                  <span className="text-xs text-slate-400">to</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-9" placeholder="To" />
                </div>
                <Button size="sm" className="bg-[#1B2A4A]" onClick={() => { const params = new URLSearchParams(); if (dateFrom) params.set('date_from', dateFrom); if (dateTo) params.set('date_to', dateTo); setReportUrl(`${BACKEND}/api/guesthouse/reports/accounts-pdf?${params.toString()}`); setReportTitle('Accounts Breakdown'); }} data-testid="gen-accounts-pdf-btn">
                  <FileText className="w-3 h-3 mr-1" /> View
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── ALL HISTORY ─── */}
      {tab === 'all' && !detailBooking && (
        <Card className="rounded-xl">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-slate-500 uppercase text-left">
                  <th className="py-2 px-2">Room</th><th className="py-2 px-2">Guest</th><th className="py-2 px-2">Check-in</th><th className="py-2 px-2">Check-out</th><th className="py-2 px-2">Nights</th><th className="py-2 px-2">Type</th><th className="py-2 px-2">Total</th><th className="py-2 px-2">Paid</th><th className="py-2 px-2">Status</th>
                </tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.booking_id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => viewBookingDetail(b)}>
                      <td className="py-2 px-2 font-bold">{b.room_number}</td>
                      <td className="py-2 px-2">{b.guest_name}</td>
                      <td className="py-2 px-2 text-slate-500">{b.check_in_date}</td>
                      <td className="py-2 px-2 text-slate-500">{b.check_out_date}</td>
                      <td className="py-2 px-2">{b.nights}</td>
                      <td className="py-2 px-2"><Badge variant="outline" className="text-[9px]">{STAY_LABELS[b.stay_type] || 'Bed'}</Badge></td>
                      <td className="py-2 px-2 font-bold">TT$ {(b.total_cost || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-green-700">TT$ {(b.amount_paid || 0).toLocaleString()}</td>
                      <td className="py-2 px-2"><Badge className={`text-[9px] ${b.status === 'checked_in' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{(b.status || '').replace(/_/g, ' ')}</Badge></td>
                    </tr>
                  ))}
                  {bookings.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No bookings yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── BOOKING DETAIL ─── */}
      {detailBooking && (tab === 'bookings' || tab === 'all') && (
        <Card className="rounded-xl" data-testid="booking-detail">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDetailBooking(null)}><ArrowLeft className="w-4 h-4" /></Button>
              <CardTitle className="text-lg">Room {detailBooking.room_number} — {detailBooking.guest_name}</CardTitle>
              <Badge className={`${detailBooking.status === 'checked_in' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{(detailBooking.status || '').replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className="text-[10px]">{STAY_LABELS[detailBooking.stay_type] || 'Bed Only'}</Badge>
            </div>
            {detailBooking.status === 'checked_in' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditBooking(detailBooking)} data-testid="edit-booking-btn">
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setPayBooking(detailBooking); setPayForm({ amount: detailBooking.outstanding || 0, method: 'cash', reference: '' }); setShowPayment(true); }} data-testid="pay-btn">
                  <CreditCard className="w-3 h-3 mr-1" /> Payment
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleCheckout(detailBooking)} data-testid="checkout-btn">
                  <LogOut className="w-3 h-3 mr-1" /> Check Out
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteBooking(detailBooking)} data-testid="delete-booking-btn">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            )}
            {detailBooking.status !== 'checked_in' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditBooking(detailBooking)} data-testid="edit-booking-btn">
                  <Edit className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteBooking(detailBooking)} data-testid="delete-booking-btn">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-xs text-slate-500">Guest</span><p className="font-medium">{detailBooking.guest_name}</p></div>
              <div><span className="text-xs text-slate-500">Phone</span><p className="font-medium">{detailBooking.guest_phone || '-'}</p></div>
              <div><span className="text-xs text-slate-500">Check-in</span><p className="font-medium">{detailBooking.check_in_date}</p></div>
              <div><span className="text-xs text-slate-500">Check-out</span><p className="font-medium">{detailBooking.check_out_date}</p></div>
              <div><span className="text-xs text-slate-500">Nights</span><p className="font-medium">{detailBooking.nights}</p></div>
              <div><span className="text-xs text-slate-500">Rate/Night</span><p className="font-medium">TT$ {(detailBooking.nightly_rate || 0).toLocaleString()}</p></div>
              <div><span className="text-xs text-slate-500">Stay Type</span><p className="font-medium">{STAY_LABELS[detailBooking.stay_type] || 'Bed Only'}</p></div>
              <div><span className="text-xs text-slate-500">ID</span><p className="font-medium">{detailBooking.guest_id_type ? `${detailBooking.guest_id_type}: ${detailBooking.guest_id_number}` : '-'}</p></div>
            </div>
            {(detailBooking.comments || detailBooking.notes) && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm"><span className="text-xs text-amber-600 font-medium">Notes/Comments:</span><p className="text-slate-700 mt-1">{detailBooking.comments || detailBooking.notes}</p></div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold text-[#1B2A4A]">TT$ {(detailBooking.total_cost || 0).toLocaleString()}</p></div>
              <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Paid</p><p className="text-lg font-bold text-green-700">TT$ {(detailBooking.amount_paid || 0).toLocaleString()}</p></div>
              <div className={`${(detailBooking.outstanding || 0) > 0 ? 'bg-red-50' : 'bg-green-50'} rounded-lg p-3 text-center`}><p className="text-xs text-slate-500">Outstanding</p><p className={`text-lg font-bold ${(detailBooking.outstanding || 0) > 0 ? 'text-red-600' : 'text-green-700'}`}>TT$ {(detailBooking.outstanding || 0).toLocaleString()}</p></div>
            </div>
            {(detailBooking.payments || []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#1B2A4A] mb-2">Payments</h3>
                <div className="space-y-1">
                  {detailBooking.payments.map(p => (
                    <div key={p.payment_id} className="flex items-center gap-2 text-xs bg-green-50 rounded-lg px-3 py-2">
                      <Receipt className="w-3 h-3 text-green-600" />
                      <span className="font-mono text-slate-500">{p.receipt_no}</span>
                      <span className="font-medium">TT$ {p.amount.toLocaleString()}</span>
                      <Badge variant="outline" className="text-[9px]">{p.method}</Badge>
                      <span className="ml-auto text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── CHECK-IN DIALOG ─── */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Check In — Room {selectedRoom?.room_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Guest Full Name *</Label><Input value={bookForm.guest_name} onChange={e => setBookForm({ ...bookForm, guest_name: e.target.value })} data-testid="guest-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Phone</Label><Input value={bookForm.guest_phone} onChange={e => setBookForm({ ...bookForm, guest_phone: e.target.value })} data-testid="guest-phone" /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={bookForm.guest_email} onChange={e => setBookForm({ ...bookForm, guest_email: e.target.value })} data-testid="guest-email" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>ID Type</Label>
                <select value={bookForm.guest_id_type} onChange={e => setBookForm({ ...bookForm, guest_id_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" data-testid="guest-id-type">
                  <option value="">Select</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1"><Label>ID Number</Label><Input value={bookForm.guest_id_number} onChange={e => setBookForm({ ...bookForm, guest_id_number: e.target.value })} data-testid="guest-id-num" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Check-in Date</Label><Input type="date" value={bookForm.check_in_date} onChange={e => setBookForm({ ...bookForm, check_in_date: e.target.value })} data-testid="checkin-date" /></div>
              <div className="space-y-1"><Label>Check-out Date *</Label><Input type="date" value={bookForm.check_out_date} onChange={e => setBookForm({ ...bookForm, check_out_date: e.target.value })} data-testid="checkout-date" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nightly Rate (GHS)</Label><Input type="number" value={bookForm.nightly_rate} onChange={e => setBookForm({ ...bookForm, nightly_rate: parseFloat(e.target.value) || 0 })} data-testid="nightly-rate" /></div>
              <div className="space-y-1">
                <Label>Stay Type</Label>
                <select value={bookForm.stay_type} onChange={e => setBookForm({ ...bookForm, stay_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" data-testid="stay-type-select">
                  <option value="bed_only">Bed Only</option>
                  <option value="bed_and_breakfast">Bed &amp; Breakfast</option>
                </select>
              </div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} rows={2} placeholder="Any special requirements..." data-testid="booking-notes" /></div>
            <div className="space-y-1"><Label>Comments</Label><Textarea value={bookForm.comments} onChange={e => setBookForm({ ...bookForm, comments: e.target.value })} rows={2} placeholder="Internal comments..." data-testid="booking-comments" /></div>
            {nights > 0 && (
              <div className="bg-[#1B2A4A] text-white rounded-lg p-4 text-center">
                <p className="text-xs text-slate-300">{nights} night{nights !== 1 ? 's' : ''} x TT$ {bookForm.nightly_rate} &middot; {STAY_LABELS[bookForm.stay_type]}</p>
                <p className="text-2xl font-bold mt-1">TT$ {totalCost.toLocaleString()}</p>
              </div>
            )}
            <Button onClick={handleCheckIn} className="w-full bg-[#2E6CC4]" data-testid="confirm-checkin-btn">
              <BedDouble className="w-4 h-4 mr-2" /> Check In Guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── PAYMENT DIALOG ─── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {payBooking?.guest_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Outstanding: <strong className="text-red-600">TT$ {(payBooking?.outstanding || 0).toLocaleString()}</strong></p>
            <div className="space-y-1"><Label>Amount (GHS)</Label><Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} data-testid="pay-amount" /></div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" data-testid="pay-method">
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Reference / Transaction ID</Label><Input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="e.g. MoMo transaction ID" data-testid="pay-ref" /></div>
            <Button onClick={handlePayment} className="w-full bg-[#C5A55A] hover:bg-[#B09444]" data-testid="confirm-pay-btn">
              <CreditCard className="w-4 h-4 mr-2" /> Record TT$ {(payForm.amount || 0).toLocaleString()}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── REPORT VIEWER ─── */}
      <FileViewerModal url={reportUrl} open={!!reportUrl} onClose={() => setReportUrl(null)} title={reportTitle} />

      {/* ─── ADD EXPENSE DIALOG ─── */}
      <Dialog open={showExpense} onOpenChange={setShowExpense}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense / Charge</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Description</Label><Input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="e.g. MoMo charges, Cleaning supplies" data-testid="expense-desc" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" data-testid="expense-category">
                  <option value="momo_charges">MoMo Charges</option>
                  <option value="bank_charges">Bank Charges</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="supplies">Supplies</option>
                  <option value="utilities">Utilities</option>
                  <option value="food_breakfast">Food / Breakfast</option>
                  <option value="staff_costs">Staff Costs</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1"><Label>Amount (GHS)</Label><Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })} data-testid="expense-amount" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} data-testid="expense-date" /></div>
              <div className="space-y-1"><Label>Notes</Label><Input value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Optional notes" data-testid="expense-notes" /></div>
            </div>
            <Button onClick={handleAddExpense} className="w-full bg-amber-600 hover:bg-amber-700 text-white" data-testid="confirm-expense-btn">
              <DollarSign className="w-4 h-4 mr-2" /> Record Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT BOOKING DIALOG ─── */}
      <Dialog open={!!editBooking} onOpenChange={(v) => { if (!v) setEditBooking(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Booking — Room {editBooking?.room_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Guest Full Name</Label><Input value={editBookForm.guest_name} onChange={e => setEditBookForm({ ...editBookForm, guest_name: e.target.value })} data-testid="edit-guest-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Phone</Label><Input value={editBookForm.guest_phone} onChange={e => setEditBookForm({ ...editBookForm, guest_phone: e.target.value })} data-testid="edit-guest-phone" /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={editBookForm.guest_email} onChange={e => setEditBookForm({ ...editBookForm, guest_email: e.target.value })} data-testid="edit-guest-email" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>ID Type</Label>
                <select value={editBookForm.guest_id_type} onChange={e => setEditBookForm({ ...editBookForm, guest_id_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="edit-guest-id-type">
                  <option value="">Select</option><option value="Ghana Card">Ghana Card</option><option value="Passport">Passport</option><option value="Voter ID">Voter ID</option><option value="NHIS">NHIS</option><option value="Driver License">Driver License</option><option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1"><Label>ID Number</Label><Input value={editBookForm.guest_id_number} onChange={e => setEditBookForm({ ...editBookForm, guest_id_number: e.target.value })} data-testid="edit-guest-id-num" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Check-in Date</Label><Input type="date" value={editBookForm.check_in_date} onChange={e => setEditBookForm({ ...editBookForm, check_in_date: e.target.value })} data-testid="edit-checkin" /></div>
              <div className="space-y-1"><Label>Check-out Date</Label><Input type="date" value={editBookForm.check_out_date} onChange={e => setEditBookForm({ ...editBookForm, check_out_date: e.target.value })} data-testid="edit-checkout" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Rate / Night (GHS)</Label><Input type="number" value={editBookForm.nightly_rate} onChange={e => setEditBookForm({ ...editBookForm, nightly_rate: parseFloat(e.target.value) || 0 })} data-testid="edit-rate" /></div>
              <div className="space-y-1">
                <Label>Stay Type</Label>
                <select value={editBookForm.stay_type} onChange={e => setEditBookForm({ ...editBookForm, stay_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="edit-stay-type">
                  <option value="bed_only">Bed Only</option><option value="bed_breakfast">Bed & Breakfast</option><option value="full_board">Full Board</option><option value="half_board">Half Board</option>
                </select>
              </div>
            </div>
            <div className="space-y-1"><Label>Notes / Comments</Label><Input value={editBookForm.comments || editBookForm.notes} onChange={e => setEditBookForm({ ...editBookForm, comments: e.target.value, notes: e.target.value })} placeholder="Additional notes..." data-testid="edit-notes" /></div>
            <Button onClick={handleSaveEditBooking} className="w-full bg-[#2E6CC4] hover:bg-[#2E6CC4]/90" data-testid="save-edit-booking">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
