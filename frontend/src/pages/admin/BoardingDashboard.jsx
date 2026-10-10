import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Users, LogIn, LogOut, AlertTriangle, Calendar, Home, Plus, Check, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const sevColors = { low: 'bg-blue-100 text-blue-700', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700' };
const statusColors = { open: 'bg-red-100 text-red-700', investigating: 'bg-amber-100 text-amber-700', resolved: 'bg-[#C5A55A]/15 text-[#C5A55A]', pending: 'bg-amber-100 text-amber-700', approved: 'bg-[#C5A55A]/15 text-[#C5A55A]', denied: 'bg-red-100 text-red-700' };

export default function BoardingDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [students, setStudents] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [dorms, setDorms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [selectedStudents, setSelectedStudents] = useState([]);

  const load = async () => {
    try {
      const [s, st, ci, inc, lv, dr] = await Promise.all([
        api.get('/boarding/dashboard'), api.get('/boarding/students'),
        api.get('/boarding/checkins'), api.get('/boarding/incidents'),
        api.get('/boarding/leave'), api.get('/boarding/dorms'),
      ]);
      setStats(s.data); setStudents(st.data); setCheckins(ci.data);
      setIncidents(inc.data); setLeaves(lv.data); setDorms(dr.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const bulkCheckin = async (type) => {
    if (selectedStudents.length === 0) { toast.error('Select students first'); return; }
    try {
      await api.post('/boarding/checkin/bulk', { student_ids: selectedStudents, type });
      successToast(`${selectedStudents.length} students ${type === 'check_in' ? 'checked in' : 'checked out'}`);
      setSelectedStudents([]);
      load();
    } catch { toast.error('Failed'); }
  };

  const handleIncident = async (e) => {
    e.preventDefault();
    try {
      await api.post('/boarding/incidents', form);
      successToast('Incident reported');
      setDialog(null); setForm({});
      load();
    } catch { toast.error('Failed'); }
  };

  const handleLeaveAction = async (leaveId, action) => {
    try {
      await api.put(`/boarding/leave/${leaveId}/${action}`);
      successToast(`Leave ${action}d`);
      load();
    } catch { toast.error('Failed'); }
  };

  const handleDorm = async (e) => {
    e.preventDefault();
    try {
      await api.post('/boarding/dorms', form);
      successToast('Dorm created');
      setDialog(null); setForm({});
      load();
    } catch { toast.error('Failed'); }
  };

  const resolveIncident = async (id, resolution) => {
    try {
      await api.put(`/boarding/incidents/${id}`, { status: 'resolved', resolution });
      successToast('Incident resolved');
      load();
    } catch { toast.error('Failed'); }
  };

  const toggleStudent = (sid) => {
    setSelectedStudents(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };
  const selectAll = () => {
    const filtered = students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
    setSelectedStudents(filtered.map(s => s.user_id));
  };

  const changeBoardingStatus = async (studentId, studentName, currentStatus) => {
    const newStatus = currentStatus === 'boarding' ? 'day' : 'boarding';
    const msg = newStatus === 'boarding'
      ? `Change ${studentName} to BOARDING? A boarding fee will be auto-applied and finance will be notified.`
      : `Change ${studentName} to DAY? Finance will be notified to review boarding fees.`;
    if (!window.confirm(msg)) return;
    try {
      const res = await api.put(`/boarding/students/${studentId}/boarding-status`, { boarding_status: newStatus });
      successToast(res.data.message);
      if (res.data.fee_action) toast.info(res.data.fee_action, { duration: 6000 });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="boarding-dashboard">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">Boarding Management</h1><p className="text-slate-500 mt-1">Manage boarding students, check-ins, incidents and leave</p></div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border"><TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger><TabsTrigger value="roll" className="text-xs">Boarding Roll</TabsTrigger><TabsTrigger value="checkin" className="text-xs">Check-In/Out</TabsTrigger><TabsTrigger value="incidents" className="text-xs">Incidents</TabsTrigger><TabsTrigger value="leave" className="text-xs">Leave</TabsTrigger><TabsTrigger value="dorms" className="text-xs">Dorms</TabsTrigger></TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-md"><CardContent className="p-5 text-center"><Users className="w-8 h-8 text-[#2E6CC4] mx-auto mb-2" /><p className="text-3xl font-bold">{stats.total_boarding}</p><p className="text-xs text-slate-500">Boarding Students</p></CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-5 text-center"><LogIn className="w-8 h-8 text-[#C5A55A] mx-auto mb-2" /><p className="text-3xl font-bold">{stats.checked_in_today}</p><p className="text-xs text-slate-500">Checked In Today</p></CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-5 text-center"><Calendar className="w-8 h-8 text-amber-600 mx-auto mb-2" /><p className="text-3xl font-bold">{stats.pending_leave}</p><p className="text-xs text-slate-500">Pending Leave</p></CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-5 text-center"><AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" /><p className="text-3xl font-bold">{stats.open_incidents}</p><p className="text-xs text-slate-500">Open Incidents</p></CardContent></Card>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Recent Check-Ins</CardTitle></CardHeader><CardContent>{checkins.slice(0, 5).map(c => <div key={c.checkin_id} className="flex justify-between py-2 border-b border-slate-50 last:border-0"><span className="text-sm">{c.student_name}</span><Badge className={c.type === 'check_in' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-amber-100 text-amber-700'}>{c.type === 'check_in' ? 'In' : 'Out'} {c.time}</Badge></div>)}{checkins.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No check-ins today</p>}</CardContent></Card>
            <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Open Incidents</CardTitle></CardHeader><CardContent>{incidents.filter(i => i.status !== 'resolved').slice(0, 5).map(i => <div key={i.incident_id} className="flex justify-between py-2 border-b border-slate-50 last:border-0"><div><p className="text-sm font-medium">{i.title}</p><p className="text-xs text-slate-400">{i.student_name}</p></div><Badge className={sevColors[i.severity]}>{i.severity}</Badge></div>)}{incidents.filter(i => i.status !== 'resolved').length === 0 && <p className="text-sm text-slate-400 text-center py-4">No open incidents</p>}</CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="roll" className="mt-4">
          <div className="flex items-center gap-3 mb-4"><div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><Input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-md" /></div></div>
          <div className="bg-white rounded-md border overflow-hidden">
            <Table><TableHeader><TableRow><TableHead className="w-12">#</TableHead><TableHead>Name</TableHead><TableHead>Year</TableHead><TableHead>Class</TableHead><TableHead>Adm No.</TableHead><TableHead>Status</TableHead><TableHead>Dorm</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
              <TableBody>{students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
                <TableRow key={s.user_id}>
                  <TableCell className="text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.year_group}</TableCell>
                  <TableCell className="text-sm">{s.class_name}</TableCell>
                  <TableCell className="text-xs font-mono">{s.admission_number}</TableCell>
                  <TableCell><Badge className={s.boarding_status === 'boarding' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}>{s.boarding_status || 'day'}</Badge></TableCell>
                  <TableCell className="text-xs">{s.dorm_id || '-'}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-md" onClick={(e) => { e.stopPropagation(); changeBoardingStatus(s.user_id, s.name, s.boarding_status); }} data-testid={`change-status-${s.user_id}`}>
                      {s.boarding_status === 'boarding' ? 'Set Day' : 'Set Boarding'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="checkin" className="mt-4 space-y-4">
          <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{selectedStudents.length} selected</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={selectAll} className="text-xs rounded-md">Select All</Button><Button size="sm" className="rounded-md bg-[#C5A55A]" onClick={() => bulkCheckin('check_in')} data-testid="bulk-checkin"><LogIn className="w-3 h-3 mr-1" /> Check In</Button><Button size="sm" className="rounded-md bg-amber-600" onClick={() => bulkCheckin('check_out')} data-testid="bulk-checkout"><LogOut className="w-3 h-3 mr-1" /> Check Out</Button></div>
          </div>
          <div className="bg-white rounded-md border overflow-hidden max-h-[400px] overflow-y-auto">
            <Table><TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Name</TableHead><TableHead>Year</TableHead></TableRow></TableHeader>
              <TableBody>{students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())).map(s => (
                <TableRow key={s.user_id} className={selectedStudents.includes(s.user_id) ? 'bg-blue-50' : ''} onClick={() => toggleStudent(s.user_id)}>
                  <TableCell><input type="checkbox" checked={selectedStudents.includes(s.user_id)} readOnly className="rounded" /></TableCell>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell><TableCell className="text-sm">{s.year_group}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
          <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Today's Log</CardTitle></CardHeader><CardContent>{checkins.map(c => <div key={c.checkin_id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"><span className="text-sm">{c.student_name}</span><div className="flex items-center gap-2"><Badge className={c.type === 'check_in' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-amber-100 text-amber-700'}>{c.type === 'check_in' ? 'IN' : 'OUT'}</Badge><span className="text-xs text-slate-400">{c.time}</span></div></div>)}{checkins.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No records today</p>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="incidents" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button size="sm" className="rounded-md bg-[#2E6CC4]" onClick={() => { setDialog('incident'); setForm({ category: 'general', severity: 'low' }); }} data-testid="new-incident-btn"><Plus className="w-3 h-3 mr-1" /> Report Incident</Button></div>
          <div className="space-y-2">{incidents.map(i => (
            <Card key={i.incident_id} className="rounded-md"><CardContent className="p-4 flex items-start justify-between">
              <div><div className="flex items-center gap-2 mb-1"><h3 className="text-sm font-semibold">{i.title}</h3><Badge className={sevColors[i.severity]}>{i.severity}</Badge><Badge className={statusColors[i.status]}>{i.status}</Badge></div><p className="text-xs text-slate-500">{i.student_name} | {i.category} | {new Date(i.created_at).toLocaleDateString()}</p><p className="text-xs text-slate-400 mt-1">{i.description}</p>{i.resolution && <p className="text-xs text-[#C5A55A] mt-1">Resolution: {i.resolution}</p>}</div>
              {i.status !== 'resolved' && <Button size="sm" variant="outline" className="text-xs rounded-md" onClick={() => resolveIncident(i.incident_id, 'Resolved by officer')}>Resolve</Button>}
            </CardContent></Card>
          ))}{incidents.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No incidents reported</p>}</div>
        </TabsContent>

        <TabsContent value="leave" className="mt-4 space-y-4">
          <div className="space-y-2">{leaves.map(l => (
            <Card key={l.leave_id} className="rounded-md"><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm font-semibold">{l.student_name}</p><p className="text-xs text-slate-500">{l.start_date} to {l.end_date} | {l.reason}</p><p className="text-xs text-slate-400">Requested by {l.requester_name}</p></div>
              <div className="flex items-center gap-2">{l.status === 'pending' ? <><Button size="sm" className="rounded-md bg-[#C5A55A] h-7 text-xs" onClick={() => handleLeaveAction(l.leave_id, 'approve')} data-testid={`approve-${l.leave_id}`}><Check className="w-3 h-3 mr-1" /> Approve</Button><Button size="sm" variant="outline" className="rounded-md h-7 text-xs text-red-600 border-red-200" onClick={() => handleLeaveAction(l.leave_id, 'deny')}><X className="w-3 h-3 mr-1" /> Deny</Button></> : <Badge className={statusColors[l.status]}>{l.status}</Badge>}</div>
            </CardContent></Card>
          ))}{leaves.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No leave requests</p>}</div>
        </TabsContent>

        <TabsContent value="dorms" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button size="sm" className="rounded-md bg-[#2E6CC4]" onClick={() => { setDialog('dorm'); setForm({ gender: 'mixed', capacity: 20 }); }} data-testid="new-dorm-btn"><Plus className="w-3 h-3 mr-1" /> Add Dorm</Button></div>
          <div className="grid md:grid-cols-3 gap-4">{dorms.map(d => (
            <Card key={d.dorm_id} className="rounded-md"><CardContent className="p-5"><Home className="w-6 h-6 text-[#2E6CC4] mb-2" /><h3 className="font-semibold text-[#1B2A4A]">{d.name}</h3><p className="text-xs text-slate-500 mt-1">Capacity: {d.capacity} | Gender: {d.gender}</p><p className="text-xs text-slate-400">Occupancy: {d.occupancy || 0}/{d.capacity}</p></CardContent></Card>
          ))}{dorms.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No dorms configured</p>}</div>
        </TabsContent>
      </Tabs>

      {/* Incident Dialog */}
      <Dialog open={dialog === 'incident'} onOpenChange={() => setDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>Report Boarding Incident</DialogTitle></DialogHeader>
          <form onSubmit={handleIncident} className="space-y-3">
            <div className="space-y-2"><Label>Student</Label><Select value={form.student_id || ''} onValueChange={v => setForm({...form, student_id: v})}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <Input placeholder="Incident title" value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} required />
            <div className="grid grid-cols-2 gap-2"><Select value={form.category || 'general'} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="health">Health</SelectItem><SelectItem value="disciplinary">Disciplinary</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="general">General</SelectItem></SelectContent></Select><Select value={form.severity || 'low'} onValueChange={v => setForm({...form, severity: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
            <Textarea placeholder="Description..." value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} rows={3} />
            <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]">Report Incident</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dorm Dialog */}
      <Dialog open={dialog === 'dorm'} onOpenChange={() => setDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>Add Dorm</DialogTitle></DialogHeader>
          <form onSubmit={handleDorm} className="space-y-3">
            <Input placeholder="Dorm name (e.g. Block A)" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Capacity" value={form.capacity || 20} onChange={e => setForm({...form, capacity: parseInt(e.target.value)})} /><Select value={form.gender || 'mixed'} onValueChange={v => setForm({...form, gender: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="boys">Boys</SelectItem><SelectItem value="girls">Girls</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent></Select></div>
            <Input placeholder="Floor/Building" value={form.floor || ''} onChange={e => setForm({...form, floor: e.target.value})} />
            <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]">Create Dorm</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
