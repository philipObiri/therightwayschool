import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Briefcase, Clock, LogIn, LogOut, Calendar, Users, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function HRDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [clockStatus, setClockStatus] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [clockRes, leaveRes] = await Promise.all([
        api.get('/hr/clock/status'),
        api.get('/hr/leave'),
      ]);
      setClockStatus(clockRes.data);
      setLeaves(leaveRes.data);
      try {
        const dashRes = await api.get('/hr/dashboard');
        setDashboard(dashRes.data);
      } catch (err) { console.error("Error:", err); }
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleClock = async (action) => {
    try {
      await api.post('/hr/clock', { action, method: 'manual' });
      toast.success(action === 'clock_in' ? 'Clocked in' : 'Clocked out');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleLeaveRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hr/leave', leaveForm);
      toast.success('Leave request submitted');
      setLeaveDialog(false);
      setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleLeaveApproval = async (leaveId, approved) => {
    try {
      await api.post(`/hr/leave/${leaveId}/approve`, { approved, comment: '' });
      toast.success(`Leave ${approved ? 'approved' : 'rejected'}`);
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  const isAdmin = ['Admin', 'SuperAdmin', 'HR_Officer', 'CEO', 'Principal', 'HeadTeacher'].includes(user?.role);

  return (
    <div className="space-y-6" data-testid="hr-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1B2A4A]">HR & Staff Management</h1>
          <p className="text-slate-500 mt-1 text-xs md:text-base">Clock in/out, leave management, and staff monitoring</p>
        </div>
        <div className="flex gap-2">
          {!clockStatus?.clocked_in ? (
            <Button onClick={() => handleClock('clock_in')} className="rounded-md bg-[#C5A55A] hover:bg-[#b8963e]" data-testid="clock-in-btn">
              <LogIn className="w-4 h-4 mr-2" /> Clock In
            </Button>
          ) : (
            <Button onClick={() => handleClock('clock_out')} className="rounded-md bg-[#DC2626] hover:bg-red-700" data-testid="clock-out-btn">
              <LogOut className="w-4 h-4 mr-2" /> Clock Out
            </Button>
          )}
          <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-md" data-testid="request-leave-btn"><Calendar className="w-4 h-4 mr-2" /> Request Leave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
              <form onSubmit={handleLeaveRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={leaveForm.leave_type} onValueChange={v => setLeaveForm({...leaveForm, leave_type: v})}>
                    <SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['annual', 'sick', 'personal', 'maternity', 'other'].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} required data-testid="leave-start-date" /></div>
                  <div className="space-y-2"><Label>End Date</Label><Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} required data-testid="leave-end-date" /></div>
                </div>
                <div className="space-y-2"><Label>Reason</Label><Textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} data-testid="leave-reason" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-leave-btn">Submit Request</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Clock status */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-md border border-slate-100">
        <div className={`w-3 h-3 rounded-md ${clockStatus?.clocked_in ? 'bg-[#C5A55A]' : 'bg-slate-300'}`} />
        <span className="text-sm font-medium text-[#1B2A4A]">
          {clockStatus?.clocked_in ? 'Currently clocked in' : 'Not clocked in'}
        </span>
        {clockStatus?.entry?.clock_in && (
          <span className="text-xs text-slate-400 ml-2">Since: {new Date(clockStatus.entry.clock_in).toLocaleTimeString()}</span>
        )}
      </div>

      {/* Admin stats */}
      {isAdmin && dashboard && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="stat-card"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><Users className="w-4 h-4 md:w-5 md:h-5 text-[#2E6CC4]" /></div><p className="text-xl md:text-2xl font-bold">{dashboard.total_staff}</p><p className="text-xs md:text-sm text-slate-500">Total Staff</p></div>
          <div className="stat-card"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center mb-2"><Clock className="w-4 h-4 md:w-5 md:h-5 text-[#C5A55A]" /></div><p className="text-xl md:text-2xl font-bold">{dashboard.clocked_in_count}</p><p className="text-xs md:text-sm text-slate-500">Clocked In Now</p></div>
          <div className="stat-card"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-amber-50 flex items-center justify-center mb-2"><Calendar className="w-4 h-4 md:w-5 md:h-5 text-[#F59E0B]" /></div><p className="text-xl md:text-2xl font-bold">{leaves.filter(l => l.status === 'pending').length}</p><p className="text-xs md:text-sm text-slate-500">Pending Leave</p></div>
          <div className="stat-card"><div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-blue-50 flex items-center justify-center mb-2"><Briefcase className="w-4 h-4 md:w-5 md:h-5 text-[#2E6CC4]" /></div><p className="text-xl md:text-2xl font-bold">{dashboard.staff?.filter(s => s.doc_count > 0).length || 0}</p><p className="text-xs md:text-sm text-slate-500">CVs Uploaded</p></div>
        </div>

        <Tabs defaultValue="clockins">
          <TabsList className="bg-white border">
            <TabsTrigger value="clockins" className="text-xs">Clock-In Status</TabsTrigger>
            <TabsTrigger value="cvs" className="text-xs">Staff CVs & Documents</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Live Activity</TabsTrigger>
            <TabsTrigger value="leaves" className="text-xs">Leave Requests</TabsTrigger>
          </TabsList>

          {/* Clock-In Status */}
          <TabsContent value="clockins" className="mt-4">
            <Card className="rounded-md"><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Staff</TableHead><TableHead className="bg-slate-50">Role</TableHead><TableHead className="bg-slate-50">Status</TableHead><TableHead className="bg-slate-50">Clock In Time</TableHead><TableHead className="bg-slate-50">Method</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dashboard.staff?.sort((a, b) => (b.clocked_in ? 1 : 0) - (a.clocked_in ? 1 : 0)).map(s => (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium text-sm">{s.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{s.role}</Badge></TableCell>
                      <TableCell>{s.clocked_in ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]"><LogIn className="w-3 h-3 mr-1" />Clocked In</Badge> : <Badge className="bg-slate-100 text-slate-500">Not In</Badge>}</TableCell>
                      <TableCell className="text-xs text-slate-500">{s.clock_in_time ? new Date(s.clock_in_time).toLocaleTimeString() : '-'}</TableCell>
                      <TableCell className="text-xs text-slate-400">{s.clock_method || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* Staff CVs */}
          <TabsContent value="cvs" className="mt-4">
            <div className="space-y-2">
              {dashboard.staff?.map(s => (
                <Card key={s.user_id} className="rounded-md"><CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-sm font-bold">{s.name?.charAt(0)}</div>
                    <div><p className="text-sm font-medium">{s.name}</p><p className="text-[10px] text-slate-400">{s.role} | {s.department || 'N/A'}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.doc_count > 0 ? (
                      <div className="flex gap-1">{s.documents.map(d => (
                        <button key={d.doc_id} onClick={() => { const token = localStorage.getItem('rw_token'); if (d.file_id) { fetch(`${import.meta.env.VITE_API_URL}/api/files/${d.file_id}/preview`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), '_blank')).catch(() => {}); }}} className="flex items-center gap-1 border rounded px-2 py-1 hover:bg-slate-50 text-xs">
                          <Briefcase className="w-3 h-3 text-[#2E6CC4]" />{d.doc_type || 'CV'}
                        </button>
                      ))}</div>
                    ) : <span className="text-[10px] text-slate-400">No documents</span>}
                    <Badge className={s.doc_count > 0 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-slate-100 text-slate-500'}>{s.doc_count} docs</Badge>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>

          {/* Live Activity */}
          <TabsContent value="activity" className="mt-4 space-y-4">
            <div className="flex items-center gap-2 mb-2"><Badge className="bg-[#C5A55A]/15 text-[#C5A55A] animate-pulse">Live — Last 30 mins</Badge></div>
            {dashboard.live_activity?.length > 0 ? (
              <div className="space-y-2">{dashboard.live_activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-md border p-3">
                  <div className="w-7 h-7 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{a.user_name?.charAt(0)}</div>
                  <div className="flex-1"><p className="text-xs"><span className="font-semibold text-[#1B2A4A]">{a.user_name}</span> <span className="text-slate-500">{a.action?.replace(/_/g, ' ')}</span></p><p className="text-[10px] text-slate-400">{a.description}</p><p className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleString()}</p></div>
                </div>
              ))}</div>
            ) : <p className="text-sm text-slate-400 text-center py-8">No activity in the last 30 minutes</p>}
            {dashboard.wp_recent?.length > 0 && (
              <Card className="rounded-md"><CardHeader><CardTitle className="text-sm">Working Paper Activity</CardTitle></CardHeader><CardContent>
                <div className="space-y-1">{dashboard.wp_recent.slice(0, 15).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span className="font-semibold">{a.user_name}</span><span className="text-slate-500">{a.action?.replace(/_/g, ' ')}</span><span className="text-slate-400 ml-auto">{new Date(a.timestamp).toLocaleString()}</span></div>
                ))}</div>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* Leave Requests */}
          <TabsContent value="leaves" className="mt-4">
      <Card className="rounded-md border-slate-100">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="bg-slate-50">Staff</TableHead>
              <TableHead className="bg-slate-50">Type</TableHead>
              <TableHead className="bg-slate-50">Dates</TableHead>
              <TableHead className="bg-slate-50">Status</TableHead>
              {isAdmin && <TableHead className="bg-slate-50">Action</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {leaves.map(l => (
                <TableRow key={l.leave_id} data-testid={`leave-row-${l.leave_id}`}>
                  <TableCell className="font-medium">{l.user_name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{l.leave_type}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-500">{l.start_date} to {l.end_date}</TableCell>
                  <TableCell>
                    <Badge className={l.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  {isAdmin && <TableCell>
                    {l.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-[#C5A55A]" onClick={() => handleLeaveApproval(l.leave_id, true)} data-testid={`approve-leave-${l.leave_id}`}><CheckCircle className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleLeaveApproval(l.leave_id, false)} data-testid={`reject-leave-${l.leave_id}`}><XCircle className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </TableCell>}
                </TableRow>
              ))}
              {leaves.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">No leave requests</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
          </TabsContent>
        </Tabs>
        </>
      )}

      {/* Non-admin leave view */}
      {!isAdmin && (
      <Card className="rounded-md border-slate-100">
        <CardHeader><CardTitle>My Leave Requests</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="bg-slate-50">Type</TableHead>
              <TableHead className="bg-slate-50">Dates</TableHead>
              <TableHead className="bg-slate-50">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {leaves.map(l => (
                <TableRow key={l.leave_id}>
                  <TableCell><Badge variant="secondary" className="capitalize">{l.leave_type}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-500">{l.start_date} to {l.end_date}</TableCell>
                  <TableCell><Badge className={l.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{l.status}</Badge></TableCell>
                </TableRow>
              ))}
              {leaves.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-400">No leave requests</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
