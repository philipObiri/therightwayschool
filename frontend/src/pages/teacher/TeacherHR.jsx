import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Calendar, Clock, Star, FileText, Plus, CheckCircle, XCircle, Timer, Upload, Download, Paperclip, FolderOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

export default function TeacherHR() {
  const { user } = useAuth();
  const [tab, setTab] = useState('leave');
  const [leaves, setLeaves] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [clockHistory, setClockHistory] = useState([]);
  const [myDocs, setMyDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '', attachment_file_id: '' });
  const [leaveFileName, setLeaveFileName] = useState('');
  const [leaveUploading, setLeaveUploading] = useState(false);
  const [docDialog, setDocDialog] = useState(false);
  const [docType, setDocType] = useState('cv');
  const [docTitle, setDocTitle] = useState('');
  const [docUploading, setDocUploading] = useState(false);
  const leaveFileRef = useRef(null);
  const docFileRef = useRef(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [leaveRes, reviewRes, clockRes, docsRes] = await Promise.all([
        api.get('/hr/leave'),
        api.get('/performance/reviews'),
        api.get('/hr/clock/history'),
        api.get('/hr/staff-documents', { params: { user_id: user?.user_id } }),
      ]);
      setLeaves(leaveRes.data);
      setReviews(reviewRes.data);
      setClockHistory(clockRes.data);
      setMyDocs(docsRes.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hr/leave', leaveForm);
      toast.success('Leave request submitted');
      setLeaveDialog(false);
      setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '', attachment_file_id: '' });
      setLeaveFileName('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleLeaveFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLeaveUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLeaveForm(p => ({ ...p, attachment_file_id: res.data.file_id }));
      setLeaveFileName(file.name);
      toast.success('File attached');
    } catch { toast.error('Upload failed'); }
    setLeaveUploading(false);
    e.target.value = '';
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const uploadRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.post('/hr/staff-documents', {
        user_id: user?.user_id,
        file_id: uploadRes.data.file_id,
        filename: file.name,
        doc_type: docType,
        title: docTitle || file.name,
      });
      toast.success('Document uploaded');
      setDocDialog(false);
      setDocTitle('');
      fetchData();
    } catch { toast.error('Upload failed'); }
    setDocUploading(false);
    e.target.value = '';
  };

  const deleteDoc = async (docId) => {
    try { await api.delete(`/hr/staff-documents/${docId}`); toast.success('Deleted'); fetchData(); } catch (err) { console.error("Error:", err); }
  };

  const handleAcknowledge = async (reviewId) => {
    try {
      await api.post(`/performance/reviews/${reviewId}/acknowledge`, { comments: '' });
      toast.success('Review acknowledged');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  // Calculate total hours this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  let weekHours = 0;
  clockHistory.forEach(e => {
    if (e.clock_in >= weekStartStr && e.clock_out) {
      weekHours += (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
    }
  });

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="teacher-hr">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">HR & My Records</h1>
        <p className="text-slate-500 mt-1">Leave requests, performance reviews, and attendance history</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="leave" className="text-xs">Leave Requests</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">My Documents</TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs">My Reviews</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs">My Attendance</TabsTrigger>
        </TabsList>

        {/* Leave Requests */}
        <TabsContent value="leave" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{leaves.length} leave request(s)</p>
            <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-md bg-[#2E6CC4]" data-testid="request-leave-btn"><Plus className="w-4 h-4 mr-2" /> Request Leave</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
                <form onSubmit={handleLeave} className="space-y-4">
                  <div className="space-y-2"><Label>Leave Type</Label>
                    <Select value={leaveForm.leave_type} onValueChange={v => setLeaveForm({...leaveForm, leave_type: v})}>
                      <SelectTrigger data-testid="leave-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['annual', 'sick', 'personal', 'maternity', 'paternity', 'compassionate', 'study', 'other'].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} required data-testid="leave-start" /></div>
                    <div className="space-y-2"><Label>End Date</Label><Input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} required data-testid="leave-end" /></div>
                  </div>
                  <div className="space-y-2"><Label>Reason</Label><Textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} rows={3} placeholder="Explain the reason for your leave request..." data-testid="leave-reason" /></div>
                  {/* File attachment for sick leave (doctor's report) */}
                  <div className="space-y-2">
                    <Label>{leaveForm.leave_type === 'sick' ? "Doctor's Report (required)" : "Supporting Document (optional)"}</Label>
                    <input ref={leaveFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleLeaveFileUpload} />
                    {leaveFileName ? (
                      <div className="flex items-center gap-2 bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-md px-3 py-2">
                        <Paperclip className="w-4 h-4 text-[#C5A55A]" />
                        <span className="text-xs text-[#C5A55A] flex-1">{leaveFileName}</span>
                        <button onClick={() => { setLeaveForm(p => ({...p, attachment_file_id: ''})); setLeaveFileName(''); }} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" className="w-full rounded-md border-dashed" onClick={() => leaveFileRef.current?.click()} disabled={leaveUploading}>
                        <Upload className="w-4 h-4 mr-2" /> {leaveUploading ? 'Uploading...' : leaveForm.leave_type === 'sick' ? 'Upload Doctor\'s Report' : 'Attach Document'}
                      </Button>
                    )}
                  </div>
                  <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-leave">Submit Request</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">Dates</TableHead><TableHead className="bg-slate-50">Reason</TableHead><TableHead className="bg-slate-50">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {leaves.map(l => (
                  <TableRow key={l.leave_id}>
                    <TableCell><Badge variant="secondary" className="capitalize">{l.leave_type}</Badge></TableCell>
                    <TableCell className="text-sm text-slate-500">{l.start_date} to {l.end_date}</TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">{l.reason || '-'}</TableCell>
                    <TableCell><Badge className={l.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {leaves.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">No leave requests</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* My Documents */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{myDocs.length} document(s) uploaded</p>
            <Dialog open={docDialog} onOpenChange={setDocDialog}>
              <DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]"><Upload className="w-4 h-4 mr-2" /> Upload Document</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload Document to HR</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Document Type</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cv">CV / Resume</SelectItem>
                        <SelectItem value="certificate">Certificate</SelectItem>
                        <SelectItem value="qualification">Qualification</SelectItem>
                        <SelectItem value="id_document">ID Document</SelectItem>
                        <SelectItem value="reference">Reference Letter</SelectItem>
                        <SelectItem value="medical">Medical Record</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Title</Label><Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="e.g. Teaching Certificate 2024" /></div>
                  <input ref={docFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" onChange={handleDocUpload} />
                  <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={() => docFileRef.current?.click()} disabled={docUploading}>
                    <Upload className="w-4 h-4 mr-2" /> {docUploading ? 'Uploading...' : 'Choose File & Upload'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead className="bg-slate-50">Document</TableHead><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">File</TableHead><TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {myDocs.map(d => (
                  <TableRow key={d.doc_id}>
                    <TableCell className="font-medium text-sm">{d.title}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize text-xs">{d.doc_type?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-500">{d.filename}</TableCell>
                    <TableCell className="text-xs text-slate-400">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <a href={`${BACKEND}/api/files/${d.file_id}/download`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" className="h-7 text-xs"><Download className="w-3 h-3 mr-1" /> View</Button></a>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => deleteDoc(d.doc_id)}><X className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {myDocs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400"><FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />No documents uploaded yet. Upload your CV, certificates, and qualifications.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Performance Reviews */}
        <TabsContent value="reviews" className="mt-4 space-y-4">
          {reviews.length > 0 ? reviews.map(r => (
            <Card key={r.review_id} className="rounded-md border-slate-100">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[#1B2A4A]">Performance Review - {r.cycle}</h3>
                    <p className="text-xs text-slate-400">Reviewed by {r.reviewer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= r.overall_rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}`} />)}</div>
                    <Badge className={r.status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : r.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>{r.status}</Badge>
                  </div>
                </div>
                {r.strengths && <div className="bg-[#C5A55A]/10 rounded-md p-3 mb-2"><p className="text-xs"><strong className="text-[#C5A55A]">Strengths:</strong> {r.strengths}</p></div>}
                {r.areas_for_development && <div className="bg-amber-50 rounded-md p-3 mb-2"><p className="text-xs"><strong className="text-amber-700">Areas for Development:</strong> {r.areas_for_development}</p></div>}
                {r.action_items && <div className="bg-blue-50 rounded-md p-3 mb-2"><p className="text-xs"><strong className="text-blue-700">Action Items:</strong> {r.action_items}</p></div>}
                {r.targets && r.targets.length > 0 && (
                  <div className="mt-2"><p className="text-xs font-semibold text-slate-500 mb-1">Targets:</p>
                    {r.targets.map((t, i) => <p key={i} className="text-xs text-slate-600 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-slate-300" /> {t.text || t}</p>)}
                  </div>
                )}
                {r.status === 'submitted' && (
                  <Button size="sm" className="mt-3 rounded-md bg-[#2E6CC4] text-xs" onClick={() => handleAcknowledge(r.review_id)} data-testid={`ack-review-${r.review_id}`}>Acknowledge Review</Button>
                )}
              </CardContent>
            </Card>
          )) : <p className="text-center py-12 text-slate-400">No performance reviews yet</p>}
        </TabsContent>

        {/* Attendance History */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-card text-center"><p className="text-2xl font-bold text-[#2E6CC4]">{weekHours.toFixed(1)}h</p><p className="text-xs text-slate-500">This Week</p></div>
            <div className="stat-card text-center"><p className="text-2xl font-bold">{clockHistory.length}</p><p className="text-xs text-slate-500">Total Records</p></div>
          </div>
          <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Clock In</TableHead><TableHead className="bg-slate-50">Clock Out</TableHead><TableHead className="bg-slate-50">Duration</TableHead></TableRow></TableHeader>
              <TableBody>
                {clockHistory.slice(0, 20).map((e, i) => {
                  const duration = e.clock_out ? Math.floor((new Date(e.clock_out) - new Date(e.clock_in)) / 1000) : null;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{e.clock_in ? new Date(e.clock_in).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="text-sm text-[#C5A55A]">{e.clock_in ? new Date(e.clock_in).toLocaleTimeString() : '-'}</TableCell>
                      <TableCell className="text-sm text-[#DC2626]">{e.clock_out ? new Date(e.clock_out).toLocaleTimeString() : <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Active</Badge>}</TableCell>
                      <TableCell className="text-sm font-medium">{duration !== null ? `${Math.floor(duration/3600)}h ${Math.floor((duration%3600)/60)}m` : '-'}</TableCell>
                    </TableRow>
                  );
                })}
                {clockHistory.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">No attendance records</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
