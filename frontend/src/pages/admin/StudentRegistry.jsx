import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { Separator } from '../../components/ui/separator';
import { Plus, Search, GraduationCap, ArrowLeft, Save, User, BookMarked, Mail, Phone, Calendar, Shield, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];

export default function StudentRegistry() {
  const [yearCounts, setYearCounts] = useState([]);
  const [selectedYear, setSelectedYear] = useState('Year 7');
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [profileTab, setProfileTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', class_id: '', year_group: 'Year 7', boarding_status: 'day', phone: '' });

  const fetchCounts = useCallback(async () => {
    try {
      const [ycRes, subjRes, clsRes] = await Promise.all([
        api.get('/admin/students-by-year'),
        api.get('/academic/subjects'),
        api.get('/academic/classes'),
      ]);
      setYearCounts(ycRes.data);
      setSubjects(subjRes.data);
      setClasses(clsRes.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  }, []);

  const fetchStudents = useCallback(async (year) => {
    try {
      const res = await api.get('/admin/students', { params: { year_group: year } });
      setStudents(res.data);
    } catch (err) { console.error("Error:", err); }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchStudents(selectedYear); }, [selectedYear, fetchStudents]);

  const openProfile = async (student) => {
    try {
      const res = await api.get(`/admin/students/${student.user_id}`);
      const s = res.data;
      setSelectedStudent(s);
      setEditForm({
        name: s.name || '', phone: s.phone || '',
        year_group: s.year_group || '', class_id: s.class_id || '',
        boarding_status: s.boarding_status || 'day',
        date_of_birth: s.date_of_birth || '',
        admission_number: s.admission_number || '',
        is_active: s.is_active !== false,
        subject_ids: s.subject_ids || [],
        email: s.email || '',
      });
      setProfileTab('details');
    } catch { toast.error('Failed to load student profile'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/students/${selectedStudent.user_id}`, editForm);
      successToast('Student profile updated');
      fetchStudents(selectedYear);
      fetchCounts();
      setSelectedStudent({ ...selectedStudent, ...editForm });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
    setSaving(false);
  };

  const handleDeleteStudent = async () => {
    if (!window.confirm(`Permanently delete "${selectedStudent.name}"? This will remove all their invoices, payments, grades, and submissions. This cannot be undone.`)) return;
    try {
      const res = await api.delete(`/admin/students/${selectedStudent.user_id}`);
      successToast(res.data.message);
      setSelectedStudent(null);
      fetchStudents(selectedYear);
      fetchCounts();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/students', addForm);
      successToast('Student added');
      setDialogOpen(false);
      setAddForm({ name: '', email: '', class_id: '', year_group: selectedYear, boarding_status: 'day', phone: '' });
      fetchStudents(selectedYear);
      fetchCounts();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const toggleSubject = (subjectId) => {
    const current = editForm.subject_ids || [];
    const newIds = current.includes(subjectId)
      ? current.filter(id => id !== subjectId)
      : [...current, subjectId];
    setEditForm({ ...editForm, subject_ids: newIds });
  };

  const subjectCount = (editForm.subject_ids || []).length;
  const subjectError = subjectCount > 0 && (subjectCount < 3 || subjectCount > 12);

  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <AppLoader />;

  // ─── Student Profile View ───
  if (selectedStudent) {
    return (
      <div className="space-y-6" data-testid="student-profile">
        <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)} data-testid="back-to-students"><ArrowLeft className="w-4 h-4 mr-1" /> Back to {selectedYear}</Button>

        {/* Header */}
        <div className="bg-white rounded-md border border-slate-100 p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-2xl font-bold">{selectedStudent.name?.charAt(0)}</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1B2A4A]" data-testid="student-profile-name">{selectedStudent.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <Badge className="bg-blue-100 text-blue-700">{selectedStudent.year_group}</Badge>
                <Badge variant="secondary">{selectedStudent.admission_number}</Badge>
                <Badge className={selectedStudent.boarding_status === 'boarding' ? 'bg-blue-100 text-[#1B2A4A]' : 'bg-slate-100 text-slate-600'}>{selectedStudent.boarding_status || 'Day'}</Badge>
                <Badge className={selectedStudent.is_active !== false ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-red-100 text-red-700'}>{selectedStudent.is_active !== false ? 'Active' : 'Inactive'}</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">{selectedStudent.email} | {selectedStudent.subjects?.length || 0} subjects enrolled</p>
            </div>
            <Button onClick={handleSave} disabled={saving || subjectError} className="rounded-md bg-[#2E6CC4]" data-testid="save-student-btn"><Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>

        <Tabs value={profileTab} onValueChange={setProfileTab}>
          <TabsList className="bg-white border"><TabsTrigger value="details" className="text-xs">Personal Details</TabsTrigger><TabsTrigger value="subjects" className="text-xs">Subjects ({subjectCount})</TabsTrigger><TabsTrigger value="account" className="text-xs">Account</TabsTrigger></TabsList>

          {/* Details */}
          <TabsContent value="details" className="mt-4">
            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-5 h-5 text-[#2E6CC4]" /> Student Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="rounded-md" data-testid="edit-student-name" /></div>
                  <div className="space-y-2"><Label>Admission Number</Label><Input value={editForm.admission_number} onChange={e => setEditForm({...editForm, admission_number: e.target.value})} className="rounded-md" data-testid="edit-admission" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Year Group</Label>
                    <Select value={editForm.year_group} onValueChange={v => setEditForm({...editForm, year_group: v})}>
                      <SelectTrigger className="rounded-md" data-testid="edit-year-group"><SelectValue /></SelectTrigger>
                      <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Class</Label>
                    <Select value={editForm.class_id} onValueChange={v => setEditForm({...editForm, class_id: v})}>
                      <SelectTrigger className="rounded-md" data-testid="edit-class"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{classes.filter(c => c.year_group === editForm.year_group).map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-2"><Label>Boarding Status</Label>
                    <Select value={editForm.boarding_status} onValueChange={v => setEditForm({...editForm, boarding_status: v})}>
                      <SelectTrigger className="rounded-md" data-testid="edit-boarding"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="weekday_boarder">Weekday Boarder</SelectItem></SelectContent>                    </Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} className="rounded-md" data-testid="edit-dob" /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="rounded-md" data-testid="edit-student-phone" /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subjects */}
          <TabsContent value="subjects" className="mt-4">
            <Card className="rounded-md border-slate-100">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><BookMarked className="w-5 h-5 text-[#2E6CC4]" /> Subject Enrolment</span>
                  <span className={`text-sm font-normal ${subjectError ? 'text-[#DC2626]' : 'text-slate-500'}`}>
                    {subjectCount} selected (min 3, max 12)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subjectError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-[#DC2626]">
                    <AlertCircle className="w-4 h-4" />
                    {subjectCount < 3 ? 'Minimum 3 subjects required' : 'Maximum 12 subjects allowed'}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {subjects.map(subj => {
                    const isSelected = (editForm.subject_ids || []).includes(subj.subject_id);
                    const canAdd = subjectCount < 12 || isSelected;
                    return (
                      <div
                        key={subj.subject_id}
                        onClick={() => canAdd && toggleSubject(subj.subject_id)}
                        className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all cursor-pointer ${
                          isSelected ? 'border-[#2E6CC4] bg-blue-50' : canAdd ? 'border-slate-200 hover:border-slate-300 bg-white' : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        }`}
                        data-testid={`subject-${subj.subject_id}`}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <div>
                          <p className="text-sm font-medium text-[#1B2A4A]">{subj.name}</p>
                          <p className="text-[10px] text-slate-400">{subj.code} | {subj.department || 'General'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account */}
          <TabsContent value="account" className="mt-4">
            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-5 h-5 text-[#2E6CC4]" /> Account Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md">
                  <div><p className="text-sm font-medium">Account Active</p><p className="text-xs text-slate-500">Deactivating prevents login</p></div>
                  <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm({...editForm, is_active: v})} data-testid="toggle-student-active" />
                </div>
                <div className="p-4 bg-slate-50 rounded-md"><p className="text-sm font-medium">User ID</p><p className="text-xs text-slate-400 font-mono">{selectedStudent.user_id}</p></div>
                <div className="p-4 bg-slate-50 rounded-md space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-[#2E6CC4]" /> Login Email</Label>
                  <Input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="rounded-md" placeholder="student@rightway.student" data-testid="edit-student-email" />
                  <p className="text-[10px] text-slate-400">Changing this will update the student's login email</p>
                </div>
                <div className="border-t border-red-200 pt-4 mt-4">
                  <p className="text-sm font-medium text-red-600 mb-2">Danger Zone</p>
                  <Button variant="outline" className="rounded-md border-red-300 text-red-600 hover:bg-red-50 text-xs" onClick={handleDeleteStudent} data-testid="delete-student-btn">
                    <Trash2 className="w-3 h-3 mr-2" /> Delete Student Permanently
                  </Button>
                  <p className="text-[10px] text-slate-400 mt-1">Removes student and all related records (invoices, payments, grades). This cannot be undone.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ─── Year Group + Student List View ───
  return (
    <div className="space-y-6" data-testid="student-registry">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Student Registry</h1>
          <p className="text-slate-500 mt-1">{yearCounts.reduce((s, y) => s + y.count, 0)} students enrolled</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="add-student-btn"><Plus className="w-4 h-4 mr-2" /> Add Student</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Full Name</Label><Input value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} required data-testid="new-student-name" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} required data-testid="new-student-email" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Year Group</Label>
                  <Select value={addForm.year_group} onValueChange={v => setAddForm({...addForm, year_group: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{YEAR_GROUPS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Boarding</Label>
                  <Select value={addForm.boarding_status} onValueChange={v => setAddForm({...addForm, boarding_status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="day">Day</SelectItem><SelectItem value="boarding">Boarding</SelectItem><SelectItem value="weekday_boarder">Weekday Boarder</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-new-student">Add Student</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Year group cards */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
        {yearCounts.map(yc => (
          <button
            key={yc.year_group}
            onClick={() => { setSelectedYear(yc.year_group); setSearchTerm(''); }}
            className={`p-4 rounded-md border-2 text-center transition-all ${selectedYear === yc.year_group ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            data-testid={`year-btn-${yc.year_group.replace(' ', '-')}`}
          >
            <p className={`text-lg font-bold ${selectedYear === yc.year_group ? 'text-[#2E6CC4]' : 'text-[#1B2A4A]'}`}>{yc.count}</p>
            <p className="text-xs text-slate-500">{yc.year_group}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 max-w-md">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder={`Search in ${selectedYear}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="student-search" />
      </div>

      {/* Student table */}
      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1B2A4A]">{selectedYear} Students</h3>
          <span className="text-xs text-slate-400">{filtered.length} students</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-white">#</TableHead>
              <TableHead className="bg-white">Name</TableHead>
              <TableHead className="bg-white">ADM No.</TableHead>
              <TableHead className="bg-white">Status</TableHead>
              <TableHead className="bg-white">Subjects</TableHead>
              <TableHead className="bg-white w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s, idx) => (
              <TableRow
                key={s.user_id}
                className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                onClick={() => openProfile(s)}
                data-testid={`student-row-${s.user_id}`}
              >
                <TableCell className="text-xs text-slate-400 w-10">{idx + 1}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-[#2E6CC4] text-sm font-semibold">{s.name?.charAt(0)}</div>
                    <span className="hover:text-[#2E6CC4] transition-colors">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-500 text-sm">{s.admission_number || '-'}</TableCell>
                <TableCell>
                  <Badge className={s.boarding_status === 'boarding' ? 'bg-blue-100 text-[#1B2A4A]' : 'bg-slate-100 text-slate-600'}>{s.boarding_status || 'day'}</Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-400">{s.subject_ids?.length || 0} subjects</TableCell>
                <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                    data-testid={`delete-student-list-${s.user_id}`}
                    onClick={async () => {
                      if (!window.confirm(`Permanently delete "${s.name}"? All invoices, payments, grades will be removed. This cannot be undone.`)) return;
                      try {
                        await api.delete(`/admin/students/${s.user_id}`);
                        successToast(`${s.name} deleted`);
                        fetchStudents(selectedYear);
                        fetchCounts();
                      } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                    }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No students found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}