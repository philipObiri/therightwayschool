import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { UserCheck, Check, X, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function AttendanceEntry() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/academic/classes');
        setClasses(res.data);
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    fetchClasses();
  }, []);

  const loadStudents = async (classId) => {
    setSelectedClass(classId);
    try {
      const res = await api.get('/admin/students', { params: { class_id: classId } });
      setStudents(res.data);
      // Load existing attendance
      const attRes = await api.get('/attendance', { params: { class_id: classId, date: selectedDate } });
      const existing = {};
      if (attRes.data.length > 0) {
        attRes.data[0].records?.forEach(r => {
          existing[r.student_id] = r.status;
        });
      }
      // Initialize attendance
      const att = {};
      res.data.forEach(s => { att[s.user_id] = existing[s.user_id] || 'present'; });
      setAttendance(att);
    } catch { toast.error('Failed to load students'); }
  };

  const handleSave = async () => {
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({
        student_id, status
      }));
      await api.post('/attendance/record', {
        class_id: selectedClass,
        date: selectedDate,
        period: '1',
        records
      });
      toast.success('Attendance saved');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const statusColors = {
    present: 'bg-[#C5A55A]/15 text-[#C5A55A]',
    absent: 'bg-red-100 text-red-700',
    late: 'bg-amber-100 text-amber-700',
  };

  const statusIcons = { present: Check, absent: X, late: Clock };

  if (loading) return <AppLoader />;

  const summary = { present: 0, absent: 0, late: 0 };
  Object.values(attendance).forEach(s => { summary[s] = (summary[s] || 0) + 1; });

  return (
    <div className="space-y-6" data-testid="attendance-entry">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Attendance Entry</h1>
        <p className="text-slate-500 mt-1">Mark daily attendance for your classes</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Class</label>
          <Select value={selectedClass} onValueChange={loadStudents}>
            <SelectTrigger className="w-48 rounded-md" data-testid="attendance-class-select"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Date</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-48 rounded-md" data-testid="attendance-date-input" />
        </div>
        {selectedClass && students.length > 0 && (
          <Button onClick={handleSave} className="rounded-md bg-[#19C37D] hover:bg-[#C5A55A]" data-testid="save-attendance-btn">
            <Save className="w-4 h-4 mr-2" /> Save Attendance
          </Button>
        )}
      </div>

      {selectedClass && students.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {['present', 'absent', 'late'].map(status => {
              const Icon = statusIcons[status];
              return (
                <div key={status} className="stat-card flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center ${statusColors[status]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{summary[status]}</p>
                    <p className="text-xs text-slate-500 capitalize">{status}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Student list */}
          <Card className="rounded-md border-slate-100">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-slate-50">Student</TableHead>
                    <TableHead className="bg-slate-50">ADM No.</TableHead>
                    <TableHead className="bg-slate-50">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(s => (
                    <TableRow key={s.user_id} data-testid={`attendance-row-${s.user_id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-slate-400" />
                          {s.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">{s.admission_number || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {['present', 'absent', 'late'].map(status => (
                            <button
                              key={status}
                              onClick={() => setAttendance({...attendance, [s.user_id]: status})}
                              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                attendance[s.user_id] === status
                                  ? statusColors[status]
                                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
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
            </CardContent>
          </Card>
        </>
      )}

      {selectedClass && students.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No students in this class</p>
        </div>
      )}
    </div>
  );
}
