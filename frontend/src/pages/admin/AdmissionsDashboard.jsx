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
import { UserPlus, ClipboardList, ArrowRight, ArrowLeft, Search, Plus, FileText, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const stageColors = {
  received: 'bg-slate-100 text-slate-600', reviewed: 'bg-blue-100 text-blue-700',
  interviewed: 'bg-blue-100 text-[#1B2A4A]', accepted: 'bg-[#C5A55A]/15 text-[#C5A55A]',
  waitlisted: 'bg-amber-100 text-amber-700', enrolled: 'bg-[#C5A55A]/15 text-[#C5A55A]',
  rejected: 'bg-red-100 text-red-700',
};
const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];
const REQUIRED_DOCS = ['Birth Certificate', 'Previous School Report', 'Passport Photos', 'Medical Records', 'Immunization Records', 'Guardian ID Copy', 'Recommendation Letter'];

export default function AdmissionsDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ by_stage: {} });
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      const [d, a] = await Promise.all([api.get('/admissions/dashboard'), api.get('/admissions/applications')]);
      setStats(d.data); setApps(a.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admissions/applications', form);
      successToast('Application created');
      setDialog(null); setForm({});
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const changeStatus = async (appId, status) => {
    try {
      await api.put(`/admissions/applications/${appId}/status`, { status });
      successToast(`Status changed to ${status}`);
      load();
      if (selected?.application_id === appId) setSelected(prev => ({ ...prev, status }));
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleEnroll = async (appId) => {
    if (!window.confirm('Enroll this student? This will create a student account.')) return;
    try {
      const res = await api.post(`/admissions/applications/${appId}/enroll`);
      successToast(res.data.message);
      load();
      setSelected(null);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    try {
      await api.put(`/admissions/applications/${selected.application_id}`, form);
      successToast('Application updated');
      load();
      setSelected(prev => ({ ...prev, ...form }));
    } catch { toast.error('Failed'); }
  };

  const toggleDoc = (doc) => {
    const docs = form.documents_submitted || selected?.documents_submitted || [];
    const updated = docs.includes(doc) ? docs.filter(d => d !== doc) : [...docs, doc];
    setForm({ ...form, documents_submitted: updated });
  };

  const filtered = apps.filter(a => {
    const matchSearch = a.student_name?.toLowerCase().includes(search.toLowerCase()) || a.guardian_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <AppLoader />;

  // ─── Application Detail ───
  if (selected) {
    const docs = form.documents_submitted || selected.documents_submitted || [];
    return (
      <div className="space-y-6" data-testid="application-detail">
        <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setForm({}); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back to Applications</Button>
        <div className="bg-white rounded-md border p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1B2A4A]">{selected.student_name}</h2>
              <div className="flex items-center gap-2 mt-1"><Badge className={stageColors[selected.status]}>{selected.status}</Badge><span className="text-sm text-slate-500">Applying for {selected.applying_for}</span></div>
            </div>
            <div className="flex gap-2">
              {selected.status === 'received' && <Button size="sm" className="rounded-md bg-blue-600" onClick={() => changeStatus(selected.application_id, 'reviewed')}>Mark Reviewed</Button>}
              {selected.status === 'reviewed' && <Button size="sm" className="rounded-md bg-[#1B2A4A]" onClick={() => changeStatus(selected.application_id, 'interviewed')}>Interviewed</Button>}
              {selected.status === 'interviewed' && <><Button size="sm" className="rounded-md bg-[#C5A55A]" onClick={() => changeStatus(selected.application_id, 'accepted')}>Accept</Button><Button size="sm" variant="outline" className="rounded-md text-amber-600" onClick={() => changeStatus(selected.application_id, 'waitlisted')}>Waitlist</Button><Button size="sm" variant="outline" className="rounded-md text-red-600" onClick={() => changeStatus(selected.application_id, 'rejected')}>Reject</Button></>}
              {selected.status === 'accepted' && <Button size="sm" className="rounded-md bg-[#C5A55A]" onClick={() => handleEnroll(selected.application_id)} data-testid="enroll-btn"><UserPlus className="w-3 h-3 mr-1" /> Enroll Student</Button>}
              {selected.status === 'waitlisted' && <Button size="sm" className="rounded-md bg-[#C5A55A]" onClick={() => changeStatus(selected.application_id, 'accepted')}>Accept</Button>}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Student Details</CardTitle></CardHeader><CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Full Name</Label><Input value={form.student_name ?? selected.student_name} onChange={e => setForm({...form, student_name: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Date of Birth</Label><Input type="date" value={form.date_of_birth ?? selected.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Gender</Label><Select value={(form.gender ?? selected.gender) || ''} onValueChange={v => setForm({...form, gender: v})}><SelectTrigger className="mt-1"><SelectValue placeholder="Gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Applying For</Label><Select value={form.applying_for ?? selected.applying_for} onValueChange={v => setForm({...form, applying_for: v})}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Boarding Status</Label><Select value={form.boarding_status ?? selected.boarding_status} onValueChange={v => setForm({...form, boarding_status: v})}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="weekday_boarder">Weekday Boarder</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Previous School</Label><Input value={form.previous_school ?? selected.previous_school} onChange={e => setForm({...form, previous_school: e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes ?? selected.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="mt-1" /></div>
            <Button size="sm" className="rounded-md bg-[#2E6CC4]" onClick={handleUpdate}>Save Changes</Button>
          </CardContent></Card>
          <div className="space-y-4">
            <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Guardian Info</CardTitle></CardHeader><CardContent className="space-y-3">
              <Input placeholder="Guardian Name" value={form.guardian_name ?? selected.guardian_name} onChange={e => setForm({...form, guardian_name: e.target.value})} />
              <Input placeholder="Phone" value={form.guardian_phone ?? selected.guardian_phone} onChange={e => setForm({...form, guardian_phone: e.target.value})} />
              <Input placeholder="Email" value={form.guardian_email ?? selected.guardian_email} onChange={e => setForm({...form, guardian_email: e.target.value})} />
            </CardContent></Card>
            <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Document Checklist</CardTitle></CardHeader><CardContent>
              <div className="space-y-1.5">{REQUIRED_DOCS.map(doc => (
                <label key={doc} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-xs ${docs.includes(doc) ? 'border-[#C5A55A]/40 bg-[#C5A55A]/10' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={docs.includes(doc)} onChange={() => toggleDoc(doc)} className="rounded" />
                  <FileText className="w-3 h-3 text-slate-400" /> {doc}
                  {docs.includes(doc) && <CheckCircle className="w-3 h-3 text-[#C5A55A] ml-auto" />}
                </label>
              ))}</div>
              <p className="text-[10px] text-slate-400 mt-2">{docs.length}/{REQUIRED_DOCS.length} documents submitted</p>
            </CardContent></Card>
          </div>
        </div>
        {selected.status_history?.length > 0 && (
          <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Status History</CardTitle></CardHeader><CardContent>
            <div className="space-y-1">{selected.status_history.map((h, i) => <div key={i} className="flex items-center gap-2 text-xs text-slate-500"><Badge className={stageColors[h.status]} variant="secondary">{h.status}</Badge><span>by {h.changed_by}</span><span className="text-slate-400">{new Date(h.at).toLocaleString()}</span></div>)}</div>
          </CardContent></Card>
        )}
      </div>
    );
  }

  // ─── Main View ───
  return (
    <div className="space-y-6" data-testid="admissions-dashboard">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">Admissions</h1><p className="text-slate-500 mt-1">Manage student applications and enrollment pipeline</p></div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border"><TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger><TabsTrigger value="applications" className="text-xs">Applications</TabsTrigger><TabsTrigger value="pipeline" className="text-xs">Pipeline</TabsTrigger></TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-md"><CardContent className="p-5 text-center"><ClipboardList className="w-8 h-8 text-[#2E6CC4] mx-auto mb-2" /><p className="text-3xl font-bold">{stats.total_applications}</p><p className="text-xs text-slate-500">Total Applications</p></CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-5 text-center"><Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" /><p className="text-3xl font-bold">{(stats.by_stage?.received || 0) + (stats.by_stage?.reviewed || 0)}</p><p className="text-xs text-slate-500">Pending Review</p></CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-5 text-center"><CheckCircle className="w-8 h-8 text-[#C5A55A] mx-auto mb-2" /><p className="text-3xl font-bold">{stats.by_stage?.accepted || 0}</p><p className="text-xs text-slate-500">Accepted</p></CardContent></Card>
            <Card className="rounded-md"><CardContent className="p-5 text-center"><UserPlus className="w-8 h-8 text-[#C5A55A] mx-auto mb-2" /><p className="text-3xl font-bold">{stats.by_stage?.enrolled || 0}</p><p className="text-xs text-slate-500">Enrolled</p></CardContent></Card>
          </div>
          <Card className="rounded-md mt-4"><CardHeader><CardTitle className="text-sm">Pipeline Breakdown</CardTitle></CardHeader><CardContent>
            <div className="flex gap-2 flex-wrap">{Object.entries(stats.by_stage || {}).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2"><Badge className={stageColors[stage]}>{stage}</Badge><span className="text-sm font-bold">{count}</span></div>
            ))}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="applications" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 flex-1"><div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><Input placeholder="Search by name or guardian..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-md" /></div>
              <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-40 rounded-md"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{['received','reviewed','interviewed','accepted','waitlisted','enrolled','rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <Button className="rounded-md bg-[#2E6CC4]" onClick={() => { setDialog('new'); setForm({ applying_for: 'Year 7', boarding_status: 'day' }); }} data-testid="new-application-btn"><Plus className="w-4 h-4 mr-2" /> New Application</Button>
          </div>
          <div className="bg-white rounded-md border overflow-hidden">
            <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Applying For</TableHead><TableHead>Guardian</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{filtered.map(a => (
                <TableRow key={a.application_id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelected(a); setForm({}); }}>
                  <TableCell className="font-medium text-sm">{a.student_name}</TableCell>
                  <TableCell className="text-sm">{a.applying_for}</TableCell>
                  <TableCell className="text-sm">{a.guardian_name}</TableCell>
                  <TableCell><Badge className={stageColors[a.status]}>{a.status}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><ArrowRight className="w-4 h-4 text-slate-400" /></TableCell>
                </TableRow>
              ))}{filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No applications found</TableCell></TableRow>}</TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {['received','reviewed','interviewed','accepted','waitlisted','enrolled','rejected'].map(stage => {
              const stageApps = apps.filter(a => a.status === stage);
              return (
                <div key={stage} className="bg-white rounded-md border p-3">
                  <div className="flex items-center justify-between mb-2"><Badge className={stageColors[stage]}>{stage}</Badge><span className="text-xs font-bold text-slate-500">{stageApps.length}</span></div>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">{stageApps.map(a => (
                    <div key={a.application_id} className="bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSelected(a); setForm({}); }}>
                      <p className="text-xs font-medium truncate">{a.student_name}</p>
                      <p className="text-[10px] text-slate-400">{a.applying_for}</p>
                    </div>
                  ))}</div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Application Dialog */}
      <Dialog open={dialog === 'new'} onOpenChange={() => setDialog(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Application</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Student Name</Label><Input value={form.student_name || ''} onChange={e => setForm({...form, student_name: e.target.value})} required /></div>
              <div className="space-y-1"><Label className="text-xs">Date of Birth</Label><Input type="date" value={form.date_of_birth || ''} onChange={e => setForm({...form, date_of_birth: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">Gender</Label><Select value={form.gender || ''} onValueChange={v => setForm({...form, gender: v})}><SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Applying For</Label><Select value={form.applying_for || 'Year 7'} onValueChange={v => setForm({...form, applying_for: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Boarding</Label><Select value={form.boarding_status || 'day'} onValueChange={v => setForm({...form, boarding_status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="weekday_boarder">Weekday Boarder</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Previous School</Label><Input value={form.previous_school || ''} onChange={e => setForm({...form, previous_school: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Guardian Name</Label><Input value={form.guardian_name || ''} onChange={e => setForm({...form, guardian_name: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Guardian Phone</Label><Input value={form.guardian_phone || ''} onChange={e => setForm({...form, guardian_phone: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">Guardian Email</Label><Input value={form.guardian_email || ''} onChange={e => setForm({...form, guardian_email: e.target.value})} /></div>
            </div>
            <Textarea placeholder="Notes..." value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
            <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]">Submit Application</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
