import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { UserCheck, Check, X, Clock, Save, Send, ArrowLeft, Calendar, Users } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState('1');
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get('/behaviour/my-classes').then(r => setClasses(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectClass = async (cls) => {
    setSelectedClass(cls);
    try {
      const res = await api.get(`/behaviour/class-students/${cls.class_id}`);
      setStudents(res.data);

      // Load existing attendance for this date/class
      const attRes = await api.get('/attendance', { params: { class_id: cls.class_id, date: selectedDate } });
      const existing = {};
      if (attRes.data.length > 0) {
        attRes.data[0].records?.forEach(r => { existing[r.student_id] = r.status; });
      }
      // Init all as present if no existing record
      const att = {};
      res.data.forEach(s => { att[s.user_id] = existing[s.user_id] || 'present'; });
      setAttendance(att);

      // Load attendance history
      const histRes = await api.get('/attendance', { params: { class_id: cls.class_id } });
      setHistory(histRes.data.slice(0, 10));
    } catch (err) { console.error("Error:", err); }
  };

  const handleSaveAndSubmit = async () => {
    setSaving(true);
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }));
      await api.post('/attendance/record', {
        class_id: selectedClass.class_id,
        date: selectedDate,
        period: selectedPeriod,
        records,
      });

      // Notify management
      const presentCount = Object.values(attendance).filter(s => s === 'present').length;
      const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
      const lateCount = Object.values(attendance).filter(s => s === 'late').length;

      // Send notification to HeadTeacher, Principal, CEO
      try {
        await api.post('/behaviour/reports', {
          student_id: '',
          class_id: selectedClass.class_id,
          category: 'attendance',
          severity: absentCount > 5 ? 'serious' : 'minor',
          title: `Attendance: ${selectedClass.name} - ${selectedDate}`,
          description: `${user?.name} submitted attendance for ${selectedClass.name}.\n\nPresent: ${presentCount}\nAbsent: ${absentCount}\nLate: ${lateCount}\nTotal: ${students.length}\n\nPeriod: ${selectedPeriod}`,
          action_taken: 'Attendance recorded',
        });
      } catch (err) { console.error("Error:", err); } // Don't fail if notification fails

      successToast(`Attendance saved & submitted to management (${presentCount} present, ${absentCount} absent, ${lateCount} late)`);

      // Refresh history
      const histRes = await api.get('/attendance', { params: { class_id: selectedClass.class_id } });
      setHistory(histRes.data.slice(0, 10));
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save attendance'); }
    setSaving(false);
  };

  const summary = { present: 0, absent: 0, late: 0 };
  Object.values(attendance).forEach(s => { summary[s] = (summary[s] || 0) + 1; });

  if (loading) return <AppLoader />;

  // ─── Class Student Attendance View ───
  if (selectedClass && students.length > 0) {
    return (
      <div className="space-y-6" data-testid="attendance-marking">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedClass(null)} data-testid="back-to-classes"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Classes</Button>
          <Button onClick={handleSaveAndSubmit} disabled={saving} className="rounded-md bg-[#C5A55A] hover:bg-[#b8963e]" data-testid="submit-attendance-btn">
            <Send className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save & Submit to Management'}
          </Button>
        </div>

        {/* Class info + date/period */}
        <div className="bg-white rounded-md border border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1B2A4A]">{selectedClass.name}</h2>
              <p className="text-sm text-slate-500">{students.length} students | {selectedClass.teaching_subjects?.join(', ')}</p>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Date</Label>
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-40 h-9" data-testid="att-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Period</Label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-28 h-9" data-testid="att-period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5','6','7','8'].map(p => <SelectItem key={p} value={p}>Period {p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card bg-[#C5A55A]/10 border-[#C5A55A]/20 text-center">
            <Check className="w-6 h-6 text-[#C5A55A] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#C5A55A]">{summary.present}</p>
            <p className="text-xs text-slate-600">Present</p>
          </div>
          <div className="stat-card bg-red-50 border-red-100 text-center">
            <X className="w-6 h-6 text-[#DC2626] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#DC2626]">{summary.absent}</p>
            <p className="text-xs text-slate-600">Absent</p>
          </div>
          <div className="stat-card bg-amber-50 border-amber-100 text-center">
            <Clock className="w-6 h-6 text-[#F59E0B] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#F59E0B]">{summary.late}</p>
            <p className="text-xs text-slate-600">Late</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-md text-xs text-[#C5A55A] border-[#C5A55A]/30" onClick={() => { const a = {}; students.forEach(s => a[s.user_id] = 'present'); setAttendance(a); }} data-testid="mark-all-present">Mark All Present</Button>
          <Button size="sm" variant="outline" className="rounded-md text-xs text-[#DC2626] border-red-200" onClick={() => { const a = {}; students.forEach(s => a[s.user_id] = 'absent'); setAttendance(a); }} data-testid="mark-all-absent">Mark All Absent</Button>
        </div>

        {/* Student list */}
        <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-50 w-10">#</TableHead>
                <TableHead className="bg-slate-50">Student</TableHead>
                <TableHead className="bg-slate-50">ADM No.</TableHead>
                <TableHead className="bg-slate-50">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s, idx) => (
                <TableRow key={s.user_id} data-testid={`att-row-${s.user_id}`}>
                  <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${attendance[s.user_id] === 'present' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : attendance[s.user_id] === 'absent' ? 'bg-red-100 text-[#DC2626]' : 'bg-amber-100 text-[#F59E0B]'}`}>
                        {s.name?.charAt(0)}
                      </div>
                      {s.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{s.admission_number || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {['present', 'absent', 'late'].map(status => (
                        <button
                          key={status}
                          onClick={() => setAttendance({ ...attendance, [s.user_id]: status })}
                          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                            attendance[s.user_id] === status
                              ? status === 'present' ? 'bg-[#C5A55A] text-white' : status === 'absent' ? 'bg-[#DC2626] text-white' : 'bg-[#F59E0B] text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          data-testid={`att-${status}-${s.user_id}`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Recent history */}
        {history.length > 0 && (
          <Card className="rounded-md border-slate-100">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-[#2E6CC4]" /> Recent Attendance Records</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((h, i) => {
                  const p = (h.records || []).filter(r => r.status === 'present').length;
                  const a = (h.records || []).filter(r => r.status === 'absent').length;
                  const l = (h.records || []).filter(r => r.status === 'late').length;
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                      <div>
                        <p className="text-sm font-medium">{h.date} - Period {h.period || '1'}</p>
                        <p className="text-xs text-slate-400">By {h.teacher_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-xs">{p} present</Badge>
                        <Badge className="bg-red-100 text-red-700 text-xs">{a} absent</Badge>
                        {l > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">{l} late</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ─── Class Selection View ───
  return (
    <div className="space-y-6" data-testid="teacher-attendance">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Attendance</h1>
        <p className="text-slate-500 mt-1">Mark attendance for your classes and submit to management</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(cls => (
          <Card key={cls.class_id} className="rounded-md border-slate-100 card-hover cursor-pointer" onClick={() => selectClass(cls)} data-testid={`att-class-${cls.class_id}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-md bg-blue-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#2E6CC4]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1B2A4A]">{cls.name}</h3>
                  <p className="text-xs text-slate-400">{cls.year_group}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span><UserCheck className="w-4 h-4 inline mr-1" />{cls.student_count} students</span>
                <Badge variant="secondary" className="text-[10px]">{cls.teaching_subjects?.[0] || ''}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No classes assigned</p>
          </div>
        )}
      </div>
    </div>
  );
}
