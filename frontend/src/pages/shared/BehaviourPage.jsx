import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import {
  AlertTriangle, Forward, Video, Bell, CheckCircle, Clock,
  User, ArrowLeft, Calendar, MapPin, Users as UsersIcon, X
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const severityColors = { minor: 'bg-blue-100 text-blue-700', moderate: 'bg-amber-100 text-amber-700', serious: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const statusColors = { submitted: 'bg-blue-100 text-blue-700', forwarded: 'bg-amber-100 text-amber-700', meeting_called: 'bg-blue-100 text-[#1B2A4A]', resolved: 'bg-[#C5A55A]/15 text-[#C5A55A]', closed: 'bg-slate-100 text-slate-600' };
const categoryIcons = { general: '📋', academic: '📚', conduct: '⚠️', attendance: '🕐', bullying: '🚨', other: '📝' };

export default function BehaviourPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [forwardDialog, setForwardDialog] = useState(null);
  const [meetingDialog, setMeetingDialog] = useState(null);
  const [meetingForm, setMeetingForm] = useState({ date: '', time: '', location: 'Head Office', agenda: '' });
  const [staff, setStaff] = useState([]);
  const [meetingAttendees, setMeetingAttendees] = useState([]);

  const canCallMeeting = ['CEO', 'Principal', 'HeadTeacher'].includes(user?.role);
  const canForward = ['Principal', 'HeadTeacher', 'Admin', 'SuperAdmin'].includes(user?.role);
  const canResolve = ['CEO', 'Founder', 'Principal', 'HeadTeacher', 'Admin', 'SuperAdmin'].includes(user?.role);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [repRes, notifRes] = await Promise.all([
        api.get('/behaviour/reports'),
        api.get('/behaviour/notifications'),
      ]);
      setReports(repRes.data);
      setNotifications(notifRes.data);
      try { const s = await api.get('/admin/staff'); setStaff(s.data); } catch (err) { console.error("Error:", err); }
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleForward = async (reportId, toRole) => {
    try {
      await api.post(`/behaviour/reports/${reportId}/forward`, { to_role: toRole, comment: '' });
      successToast(`Report forwarded to ${toRole}`);
      setForwardDialog(null);
      fetchData();
    } catch { toast.error('Failed to forward'); }
  };

  const handleMeeting = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/behaviour/reports/${meetingDialog}/meeting`, { ...meetingForm, attendees: meetingAttendees });
      successToast('Meeting called - notifications sent');
      setMeetingDialog(null);
      setMeetingForm({ date: '', time: '', location: 'Head Office', agenda: '' });
      setMeetingAttendees([]);
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const handleResolve = async (reportId) => {
    try {
      await api.post(`/behaviour/reports/${reportId}/resolve`, { resolution: 'Resolved' });
      successToast('Report resolved');
      setSelectedReport(null);
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const markNotifRead = async (notifId) => {
    try { await api.post(`/behaviour/notifications/${notifId}/read`); fetchData(); } catch (err) { console.error("Error:", err); }
  };

  if (loading) return <AppLoader />;

  const unreadNotifs = notifications.filter(n => !n.is_read);

  // Group reports by teacher
  const byTeacher = {};
  reports.forEach(r => {
    const key = r.reporter_name || 'Unknown';
    if (!byTeacher[key]) byTeacher[key] = { name: key, role: r.reporter_role, reports: [] };
    byTeacher[key].reports.push(r);
  });

  // ─── Selected Report Detail View ───
  if (selectedReport) {
    const r = selectedReport;
    return (
      <div className="space-y-6" data-testid="report-detail">
        <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)} data-testid="back-from-report">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Reports
        </Button>

        <div className="bg-white rounded-md border border-slate-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-md bg-red-100 flex items-center justify-center text-[#DC2626] text-xl font-bold">
                {r.student_name?.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1B2A4A]">{r.student_name}</h2>
                <p className="text-sm text-slate-500">{r.student_year} | {r.class_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={severityColors[r.severity]}>{r.severity}</Badge>
              <Badge className={statusColors[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#1B2A4A] mb-1">{r.title}</h3>
              <Badge variant="secondary" className="capitalize mb-3">{categoryIcons[r.category]} {r.category}</Badge>
            </div>

            <div className="bg-slate-50 rounded-md p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.description}</p>
            </div>

            {r.action_taken && (
              <div className="bg-blue-50 rounded-md p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Action Taken</p>
                <p className="text-sm text-slate-700">{r.action_taken}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-md p-3">
                <p className="text-xs text-slate-400">Reported By</p>
                <p className="font-medium">{r.reporter_name} <span className="text-slate-400">({r.reporter_role})</span></p>
              </div>
              <div className="bg-slate-50 rounded-md p-3">
                <p className="text-xs text-slate-400">Date</p>
                <p className="font-medium">{r.incident_date || new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Forwarding history */}
            {r.forwarded_history?.length > 0 && (
              <div className="bg-amber-50 rounded-md p-4">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Forwarding History</p>
                {r.forwarded_history.map((fh, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1">
                    <Forward className="w-3 h-3 text-amber-500" />
                    <span>{fh.from_name} forwarded to <strong>{fh.to_role}</strong></span>
                    <span className="text-xs text-slate-400">{new Date(fh.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Meeting details */}
            {r.meeting_requested && r.meeting_details && (
              <div className="bg-blue-50 rounded-md p-4">
                <p className="text-xs font-semibold text-[#2E6CC4] uppercase tracking-wider mb-2">Meeting Called</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-[#2E6CC4]" /> {r.meeting_details.date} {r.meeting_details.time}</div>
                  <div className="flex items-center gap-1"><MapPin className="w-4 h-4 text-[#2E6CC4]" /> {r.meeting_details.location}</div>
                  <div className="flex items-center gap-1"><UsersIcon className="w-4 h-4 text-[#2E6CC4]" /> {r.meeting_details.attendees?.length} attendees</div>
                </div>
                <p className="text-sm mt-2 text-slate-600">{r.meeting_details.agenda}</p>
                <p className="text-xs text-slate-400 mt-1">Called by {r.meeting_details.called_by_name}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <Separator className="my-4" />
          <div className="flex gap-3 flex-wrap">
            {canForward && r.status !== 'resolved' && (
              <Button variant="outline" className="rounded-md" onClick={() => setForwardDialog(r.report_id)} data-testid="forward-report-btn">
                <Forward className="w-4 h-4 mr-2" /> Forward
              </Button>
            )}
            {canCallMeeting && r.status !== 'resolved' && (
              <Button className="rounded-md bg-[#1B2A4A] hover:bg-[#0E2E68]" onClick={() => {
                setMeetingDialog(r.report_id);
                setMeetingForm({ ...meetingForm, agenda: `Discussion: ${r.title}` });
                if (r.reporter_id) setMeetingAttendees([r.reporter_id]);
              }} data-testid="call-meeting-btn">
                <Video className="w-4 h-4 mr-2" /> Call Meeting
              </Button>
            )}
            {canResolve && r.status !== 'resolved' && (
              <Button className="rounded-md bg-[#C5A55A] hover:bg-[#b8963e]" onClick={() => handleResolve(r.report_id)} data-testid="resolve-report-btn">
                <CheckCircle className="w-4 h-4 mr-2" /> Resolve
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Tile View ───
  return (
    <div className="space-y-6" data-testid="behaviour-page">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Behaviour Reports</h1>
        <p className="text-slate-500 mt-1">{reports.length} reports from {Object.keys(byTeacher).length} teachers</p>
      </div>

      {/* Notifications */}
      {unreadNotifs.length > 0 && (
        <Card className="rounded-md border-amber-200 bg-amber-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-amber-600" /> Notifications ({unreadNotifs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unreadNotifs.slice(0, 4).map(n => (
              <div key={n.notif_id} className="flex items-center gap-3 bg-white rounded-md p-3 border border-amber-100" data-testid={`notif-${n.notif_id}`}>
                {n.type === 'meeting_called' ? <Video className="w-4 h-4 text-[#2E6CC4] flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2A4A]">{n.title}</p>
                  <p className="text-xs text-slate-500 truncate">{n.message}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => markNotifRead(n.notif_id)}>Dismiss</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reports grouped by teacher as tiles */}
      {Object.values(byTeacher).map(teacher => (
        <div key={teacher.name} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-sm font-bold">{teacher.name.charAt(0)}</div>
            <div>
              <h3 className="text-sm font-semibold text-[#1B2A4A]">{teacher.name}</h3>
              <p className="text-[10px] text-slate-400">{teacher.role} | {teacher.reports.length} report(s)</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 pl-11">
            {teacher.reports.map(r => (
              <div
                key={r.report_id}
                onClick={() => setSelectedReport(r)}
                className="bg-white rounded-md border border-slate-100 p-4 cursor-pointer hover:border-[#2E6CC4] hover:shadow-md transition-all card-hover"
                data-testid={`report-tile-${r.report_id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-md bg-red-50 flex items-center justify-center text-[#DC2626] text-sm font-bold">{r.student_name?.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold text-[#1B2A4A]">{r.student_name}</p>
                      <p className="text-[10px] text-slate-400">{r.student_year} | {r.class_name}</p>
                    </div>
                  </div>
                  <Badge className={severityColors[r.severity]} data-testid={`severity-${r.report_id}`}>{r.severity}</Badge>
                </div>
                <p className="text-xs font-medium text-[#1B2A4A] mb-1">{r.title}</p>
                <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{r.description}</p>
                <div className="flex items-center justify-between">
                  <Badge className={statusColors[r.status]} data-testid={`status-${r.report_id}`}>{r.status?.replace(/_/g, ' ')}</Badge>
                  <span className="text-[10px] text-slate-400">{r.incident_date || new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.meeting_requested && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[#2E6CC4]"><Video className="w-3 h-3" /> Meeting scheduled</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {reports.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <AlertTriangle className="w-14 h-14 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">No behaviour reports submitted yet</p>
        </div>
      )}

      {/* Forward Dialog */}
      <Dialog open={!!forwardDialog} onOpenChange={() => setForwardDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>Forward Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Forward this report to:</p>
            <div className="grid grid-cols-2 gap-3">
              {['CEO', 'Principal', 'HeadTeacher'].filter(r => r !== user?.role).map(role => (
                <Button key={role} variant="outline" className="rounded-md h-14 flex-col" onClick={() => handleForward(forwardDialog, role)} data-testid={`forward-to-${role.toLowerCase()}`}>
                  <span className="font-semibold">{role === 'HeadTeacher' ? 'Head Teacher' : role}</span>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={!!meetingDialog} onOpenChange={() => setMeetingDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>Call Meeting</DialogTitle></DialogHeader>
          <form onSubmit={handleMeeting} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={meetingForm.date} onChange={e => setMeetingForm({...meetingForm, date: e.target.value})} required data-testid="meeting-date" /></div>
              <div className="space-y-2"><Label>Time</Label><Input type="time" value={meetingForm.time} onChange={e => setMeetingForm({...meetingForm, time: e.target.value})} required data-testid="meeting-time" /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input value={meetingForm.location} onChange={e => setMeetingForm({...meetingForm, location: e.target.value})} data-testid="meeting-location" /></div>
            <div className="space-y-2"><Label>Agenda</Label><Textarea value={meetingForm.agenda} onChange={e => setMeetingForm({...meetingForm, agenda: e.target.value})} rows={2} data-testid="meeting-agenda" /></div>
            <div className="space-y-2">
              <Label>Invite Attendees</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {staff.filter(s => ['Teacher','HeadTeacher','Principal','Admin','CEO'].includes(s.role)).map(s => (
                  <label key={s.user_id} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${meetingAttendees.includes(s.user_id) ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={meetingAttendees.includes(s.user_id)} onChange={e => {
                      if (e.target.checked) setMeetingAttendees([...meetingAttendees, s.user_id]);
                      else setMeetingAttendees(meetingAttendees.filter(id => id !== s.user_id));
                    }} className="rounded" />
                    <span className="text-xs">{s.name} <span className="text-slate-400">({s.role})</span></span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full rounded-md bg-[#1B2A4A] hover:bg-[#0E2E68]" data-testid="submit-meeting">
              <Video className="w-4 h-4 mr-2" /> Call Meeting ({meetingAttendees.length} attendees)
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
