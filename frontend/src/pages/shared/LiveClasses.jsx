import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Video, Plus, Users, ExternalLink, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function LiveClasses() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [jitsiDialog, setJitsiDialog] = useState(null);
  const [form, setForm] = useState({ title: '', class_id: '', subject_id: '', scheduled_at: '', duration_minutes: 45, description: '' });

  const canCreate = ['Admin', 'SuperAdmin', 'Teacher', 'HeadOfAcademics'].includes(user?.role);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [sessRes, subjRes, clsRes] = await Promise.all([
        api.get('/live/sessions'),
        api.get('/academic/subjects'),
        api.get('/academic/classes'),
      ]);
      setSessions(sessRes.data);
      setSubjects(subjRes.data);
      setClasses(clsRes.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/live/sessions', form);
      toast.success('Live session created');
      setCreateDialog(false);
      setForm({ title: '', class_id: '', subject_id: '', scheduled_at: '', duration_minutes: 45, description: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleJoin = async (session) => {
    try {
      const res = await api.post(`/live/sessions/${session.session_id}/join`);
      setJitsiDialog(res.data);
    } catch (err) { toast.error('Failed to join'); }
  };

  const handleEnd = async (sessionId) => {
    try {
      await api.post(`/live/sessions/${sessionId}/end`);
      toast.success('Session ended');
      setJitsiDialog(null);
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  const statusColors = { scheduled: 'bg-blue-100 text-blue-700', active: 'bg-[#C5A55A]/15 text-[#C5A55A]', ended: 'bg-slate-100 text-slate-500' };

  return (
    <div className="space-y-6" data-testid="live-classes">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Live Classes</h1>
          <p className="text-slate-500 mt-1">Video sessions powered by Jitsi Meet</p>
        </div>
        {canCreate && (
          <Dialog open={createDialog} onOpenChange={setCreateDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-md bg-[#2E6CC4]" data-testid="create-session-btn"><Plus className="w-4 h-4 mr-2" /> New Session</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Live Session</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required data-testid="session-title" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Subject</Label>
                    <Select value={form.subject_id} onValueChange={v => setForm({...form, subject_id: v})}>
                      <SelectTrigger data-testid="session-subject"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Class</Label>
                    <Select value={form.class_id} onValueChange={v => setForm({...form, class_id: v})}>
                      <SelectTrigger data-testid="session-class"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{classes.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Scheduled At</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} data-testid="session-time" /></div>
                  <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value) || 45})} data-testid="session-duration" /></div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} data-testid="session-desc" /></div>
                <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-session-btn">Create Session</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map(s => (
          <Card key={s.session_id} className="rounded-md border-slate-100 card-hover" data-testid={`session-card-${s.session_id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center">
                  <Video className="w-5 h-5 text-[#2E6CC4]" />
                </div>
                <Badge className={statusColors[s.status] || 'bg-slate-100 text-slate-500'}>{s.status}</Badge>
              </div>
              <h3 className="font-semibold text-[#1B2A4A] mb-1">{s.title}</h3>
              <p className="text-sm text-slate-500 mb-2">{s.subject_name} {s.class_name && `- ${s.class_name}`}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                <span>Host: {s.host_name}</span>
                {s.scheduled_at && <span>| {new Date(s.scheduled_at).toLocaleString()}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                <Users className="w-3 h-3" /> {s.attendees?.length || 0} attendees | {s.duration_minutes}min
              </div>
              {s.status !== 'ended' && (
                <Button size="sm" className="w-full rounded-md bg-[#2E6CC4]" onClick={() => handleJoin(s)} data-testid={`join-session-${s.session_id}`}>
                  <Play className="w-3 h-3 mr-1" /> Join Session
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {sessions.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Video className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No live sessions scheduled</p>
          </div>
        )}
      </div>

      {/* Jitsi iframe dialog */}
      <Dialog open={!!jitsiDialog} onOpenChange={() => setJitsiDialog(null)}>
        <DialogContent className="sm:max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Live Session</span>
              <div className="flex gap-2">
                <a href={jitsiDialog?.jitsi_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#2E6CC4] hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open in new tab
                </a>
              </div>
            </DialogTitle>
          </DialogHeader>
          {jitsiDialog && (
            <iframe
              src={jitsiDialog.jitsi_url}
              className="w-full flex-1 rounded-md border"
              style={{ height: 'calc(80vh - 100px)' }}
              allow="camera; microphone; fullscreen; display-capture"
              title="Live Session"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
