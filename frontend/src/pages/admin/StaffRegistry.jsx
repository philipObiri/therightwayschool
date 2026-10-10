import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Plus, Search, Users, ArrowLeft, Save, Shield, Mail, Phone, Building, User, Key, Clock, Trash2, BookOpen, GraduationCap, FileText, ClipboardList, Eye, Send, MessageSquare, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const ALL_ROLES = ['CEO','Founder','Principal','HeadTeacher','Admin','SuperAdmin','Teacher','FinanceOfficer','HR_Officer','HeadOfAcademics','HoD','Librarian','AdmissionsOfficer','BoardingOfficer','Nurse','Receptionist','IT_Support'];

const ALL_DEPARTMENTS = ['Mathematics','Science','English','ICT','Business','Humanities','Languages','Creative Arts','Religious Studies','Administration','Finance','Human Resources','Leadership','Library','Boarding','Health','Reception'];

const PERMISSIONS_MAP = {
  Teacher: ['view_classes', 'create_lessons', 'create_assignments', 'take_attendance', 'grade_submissions', 'view_mail', 'view_tasks'],
  Admin: ['manage_students', 'manage_staff', 'manage_classes', 'manage_finance', 'manage_settings', 'view_audit_logs', 'manage_tasks', 'view_all'],
  SuperAdmin: ['full_access'],
  FinanceOfficer: ['manage_finance', 'view_invoices', 'record_payments', 'manage_allocations', 'view_reports'],
  HR_Officer: ['manage_staff', 'manage_leave', 'view_clock_entries', 'manage_reviews'],
  HeadOfAcademics: ['view_all_teachers', 'manage_observations', 'approve_lesson_plans', 'manage_monitoring', 'manage_tasks'],
  HoD: ['view_dept_teachers', 'approve_lesson_plans', 'manage_observations', 'manage_tasks'],
  Nurse: ['manage_sick_bay', 'admit_students', 'manage_medical_inventory', 'trigger_emergency'],
  Receptionist: ['manage_inventory', 'manage_procurement', 'manage_billing', 'parent_communication', 'manage_guesthouse'],
};

export default function StaffRegistry() {
  const { user: currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [profileTab, setProfileTab] = useState('details');
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Teacher', department: '', phone: '' });
  const [allSubjects, setAllSubjects] = useState([]);
  const [allClasses, setAllClasses] = useState([]);

  const canAllocate = ['CEO', 'SuperAdmin'].includes(currentUser?.role);

  useEffect(() => {
    fetchStaff();
    api.get('/academic/subjects').then(r => setAllSubjects(r.data)).catch(() => {});
    api.get('/academic/classes').then(r => setAllClasses(r.data)).catch(() => {});
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/admin/staff');
      setStaff(res.data);
    } catch { toast.error('Failed to load staff'); }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      successToast('Staff member added');
      setDialogOpen(false);
      setForm({ name: '', email: '', password: '', role: 'Teacher', department: '', phone: '' });
      fetchStaff();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add staff'); }
  };

  const openProfile = (member) => {
    setSelectedStaff(member);
    setEditForm({
      name: member.name || '',
      email: member.email || '',
      role: member.role || 'Teacher',
      roles: member.roles || [],
      department: member.department || '',
      phone: member.phone || '',
      is_active: member.is_active !== false,
      teaching_subjects: member.teaching_subjects || [],
      assigned_year_groups: member.assigned_year_groups || [],
    });
    setProfileTab('details');
  };

  const handleSave = async () => {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      await api.put(`/auth/users/${selectedStaff.user_id}`, editForm);
      successToast('Staff profile updated');
      fetchStaff();
      // Refresh selected staff data
      setSelectedStaff({ ...selectedStaff, ...editForm });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
    setSaving(false);
  };

  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleBadge = (role) => {
    const colors = {
      Admin: 'bg-blue-100 text-blue-700', SuperAdmin: 'bg-blue-100 text-[#1B2A4A]',
      Teacher: 'bg-[#C5A55A]/15 text-[#C5A55A]', FinanceOfficer: 'bg-amber-100 text-amber-700',
      HR_Officer: 'bg-blue-100 text-[#2E6CC4]', HeadOfAcademics: 'bg-indigo-100 text-indigo-700',
      HoD: 'bg-blue-100 text-[#2E6CC4]',
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  if (loading) return <AppLoader />;

  // ─── Staff Profile View ───
  if (selectedStaff) {
    const permissions = PERMISSIONS_MAP[editForm.role] || [];
    return (
      <div className="space-y-6" data-testid="staff-profile">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedStaff(null)} data-testid="back-to-list-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Staff List
          </Button>
        </div>

        {/* Profile Header */}
        <div className="bg-white rounded-md border border-slate-100 p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-2xl font-bold">
              {selectedStaff.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1B2A4A]" data-testid="profile-name">{selectedStaff.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <Badge className={roleBadge(selectedStaff.role)} data-testid="profile-role">{selectedStaff.role?.replace(/_/g, ' ')}</Badge>
                <span className="text-sm text-slate-500">{selectedStaff.department || 'No department'}</span>
                <Badge className={selectedStaff.is_active !== false ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-red-100 text-red-700'}>
                  {selectedStaff.is_active !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedStaff.email}</span>
                {selectedStaff.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedStaff.phone}</span>}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="rounded-md bg-[#2E6CC4]" data-testid="save-profile-btn">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Profile Tabs */}
        <Tabs value={profileTab} onValueChange={setProfileTab}>
          <TabsList className="bg-white border">
            <TabsTrigger value="details" className="text-xs">Personal Details</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Activity & Work</TabsTrigger>
            <TabsTrigger value="role" className="text-xs">Role & Permissions</TabsTrigger>
            {canAllocate && <TabsTrigger value="allocation" className="text-xs">Subjects & Classes</TabsTrigger>}
            <TabsTrigger value="account" className="text-xs">Account Settings</TabsTrigger>
          </TabsList>

          {/* Personal Details */}
          <TabsContent value="details" className="mt-4">
            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-5 h-5 text-[#2E6CC4]" /> Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="rounded-md" data-testid="edit-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input value={editForm.email} disabled className="rounded-md bg-slate-50 cursor-not-allowed" />
                    <p className="text-[10px] text-slate-400">Email cannot be changed</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="+233..." className="rounded-md" data-testid="edit-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={editForm.department} onValueChange={v => setEditForm({...editForm, department: v})}>
                      <SelectTrigger className="rounded-md" data-testid="edit-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {ALL_DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity & Work */}
          <TabsContent value="activity" className="mt-4">
            <StaffActivityView staffId={selectedStaff.user_id} staffName={selectedStaff.name} />
          </TabsContent>

          {/* Role & Permissions */}
          <TabsContent value="role" className="mt-4 space-y-4">
            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="w-5 h-5 text-[#2E6CC4]" /> Role Assignment</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Primary Role</Label>
                  <Select value={editForm.role} onValueChange={v => setEditForm({...editForm, role: v})}>
                    <SelectTrigger className="rounded-md max-w-xs" data-testid="edit-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map(r => (
                        <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {['CEO', 'Admin', 'SuperAdmin'].includes(currentUser?.role) && (
                  <div className="space-y-2">
                    <Label>Additional Roles</Label>
                    <p className="text-[10px] text-slate-400">Grant multiple roles to give combined permissions</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ALL_ROLES.filter(r => r !== editForm.role).map(r => {
                        const checked = (editForm.roles || []).includes(r);
                        return (
                          <label key={r} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${checked ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="checkbox" checked={checked} onChange={e => {
                              const roles = e.target.checked
                                ? [...(editForm.roles || []), r]
                                : (editForm.roles || []).filter(x => x !== r);
                              setEditForm({...editForm, roles});
                            }} className="rounded" />
                            <span className="text-xs">{r.replace(/_/g, ' ')}</span>
                          </label>
                        );
                      })}
                    </div>
                    {(editForm.roles || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] text-slate-500">Active roles:</span>
                        <Badge className="bg-[#2E6CC4] text-white text-[10px]">{editForm.role?.replace(/_/g, ' ')}</Badge>
                        {(editForm.roles || []).map(r => <Badge key={r} variant="secondary" className="text-[10px]">{r.replace(/_/g, ' ')}</Badge>)}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-400">Changing roles updates permissions immediately after saving</p>
              </CardContent>
            </Card>

            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-5 h-5 text-[#2E6CC4]" /> Permissions for {editForm.role?.replace(/_/g, ' ')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {permissions.map(perm => (
                    <div key={perm} className="flex items-center gap-2 bg-[#C5A55A]/10 rounded-md px-3 py-2">
                      <div className="w-2 h-2 rounded-md bg-[#C5A55A]" />
                      <span className="text-xs text-slate-700">{perm.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                  {permissions.length === 0 && <p className="text-xs text-slate-400 col-span-full">No specific permissions defined for this role</p>}
                </div>
                <p className="text-[10px] text-slate-400 mt-3">Permissions are automatically assigned based on role. To grant custom permissions, change the role above.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subjects & Classes Allocation */}
          {canAllocate && (
            <TabsContent value="allocation" className="mt-4 space-y-4">
              <Card className="rounded-md border-slate-100">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#2E6CC4]" /> Teaching Subjects</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">Select the subjects this teacher is responsible for</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {allSubjects.map(s => {
                      const checked = (editForm.teaching_subjects || []).includes(s.name);
                      return (
                        <label key={s.subject_id} className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all ${checked ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="checkbox" checked={checked} onChange={e => {
                            const subjects = e.target.checked
                              ? [...(editForm.teaching_subjects || []), s.name]
                              : (editForm.teaching_subjects || []).filter(x => x !== s.name);
                            setEditForm({...editForm, teaching_subjects: subjects});
                          }} className="rounded" />
                          <span className="text-xs font-medium">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {(editForm.teaching_subjects || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(editForm.teaching_subjects || []).map(s => <Badge key={s} className="bg-[#2E6CC4] text-white text-[10px]">{s}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-md border-slate-100">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-5 h-5 text-[#2E6CC4]" /> Assigned Year Groups / Classes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">Select the year groups and classes this teacher is assigned to</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {allClasses.map(c => {
                      const label = c.name || c.year_group;
                      const checked = (editForm.assigned_year_groups || []).includes(c.year_group);
                      return (
                        <label key={c.class_id} className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-all ${checked ? 'border-[#C5A55A] bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="checkbox" checked={checked} onChange={e => {
                            const groups = e.target.checked
                              ? [...new Set([...(editForm.assigned_year_groups || []), c.year_group])]
                              : (editForm.assigned_year_groups || []).filter(x => x !== c.year_group);
                            setEditForm({...editForm, assigned_year_groups: groups});
                          }} className="rounded" />
                          <span className="text-xs font-medium">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {(editForm.assigned_year_groups || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(editForm.assigned_year_groups || []).map(g => <Badge key={g} className="bg-[#C5A55A] text-white text-[10px]">{g}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Button onClick={handleSave} disabled={saving} className="w-full rounded-md bg-[#2E6CC4] h-11">
                <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Subject & Class Changes'}
              </Button>
            </TabsContent>
          )}

          {/* Account Settings */}
          <TabsContent value="account" className="mt-4 space-y-4">
            {/* Login Credentials - CEO/Admin only */}
            {['CEO', 'Admin', 'SuperAdmin'].includes(currentUser?.role) && (
              <Card className="rounded-md border-[#2E6CC4]/20 bg-blue-50/30">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="w-5 h-5 text-[#2E6CC4]" /> Login Credentials</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-md p-4 border border-slate-200">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Login Email</p>
                      <p className="text-sm font-mono font-semibold text-[#2E6CC4] select-all">{selectedStaff.email}</p>
                    </div>
                    <div className="bg-white rounded-md p-4 border border-slate-200">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current Password</p>
                      <p className="text-sm font-mono font-semibold text-[#1B2A4A] select-all">
                        {selectedStaff.last_set_password || (
                          selectedStaff.role === 'Teacher' ? 'teacher123' :
                          selectedStaff.role === 'CEO' ? 'ceo123' :
                          selectedStaff.role === 'Principal' ? 'principal123' :
                          selectedStaff.role === 'HeadTeacher' ? 'headteacher123' :
                          selectedStaff.role === 'Founder' ? 'founder123' :
                          selectedStaff.role === 'FinanceOfficer' ? 'finance123' :
                          selectedStaff.role === 'HR_Officer' ? 'hr123' :
                          selectedStaff.role === 'Admin' ? 'admin123' :
                          'teacher123'
                        )}
                      </p>
                      {selectedStaff.password_changed_at
                        ? <p className="text-[9px] text-amber-600 mt-1">Changed by user on {new Date(selectedStaff.password_changed_at).toLocaleString()}</p>
                        : <p className="text-[9px] text-slate-400 mt-1">Default password (not changed)</p>
                      }
                    </div>
                  </div>
                  {/* Reset Password */}
                  {['CEO', 'SuperAdmin'].includes(currentUser?.role) && (
                    <ResetPasswordSection userId={selectedStaff.user_id} />
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-md border-slate-100">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-5 h-5 text-[#2E6CC4]" /> Account Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-[#1B2A4A]">Account Active</p>
                    <p className="text-xs text-slate-500">Deactivating will prevent the user from logging in</p>
                  </div>
                  <Switch
                    checked={editForm.is_active}
                    onCheckedChange={v => setEditForm({...editForm, is_active: v})}
                    data-testid="toggle-active"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-[#1B2A4A]">User ID</p>
                    <p className="text-xs text-slate-400 font-mono">{selectedStaff.user_id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-[#1B2A4A]">Account Created</p>
                    <p className="text-xs text-slate-400">{selectedStaff.created_at ? new Date(selectedStaff.created_at).toLocaleString() : 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-md border-red-100">
              <CardHeader><CardTitle className="text-base text-[#DC2626] flex items-center gap-2"><Trash2 className="w-5 h-5" /> Danger Zone</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1B2A4A]">Deactivate this account</p>
                    <p className="text-xs text-slate-500">The user will no longer be able to access the system</p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-md border-red-200 text-[#DC2626] hover:bg-red-50"
                    onClick={() => { setEditForm({...editForm, is_active: false}); handleSave(); }}
                    data-testid="deactivate-btn"
                  >
                    Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ─── Staff List View ───
  return (
    <div className="space-y-6" data-testid="staff-registry">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Staff Registry</h1>
          <p className="text-slate-500 mt-1">{staff.length} staff members</p>
        </div>
        {['CEO', 'Admin', 'SuperAdmin'].includes(currentUser?.role) && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-md bg-[#2E6CC4]" data-testid="add-staff-btn">
              <Plus className="w-4 h-4 mr-2" /> Create Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create New Account</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="rounded-md" data-testid="staff-name-input" /></div>
                <div className="space-y-2"><Label>Email (Login)</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="rounded-md" placeholder="name@rightway.demo" data-testid="staff-email-input" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required className="rounded-md" data-testid="staff-password-input" /></div>
                <div className="space-y-2"><Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                    <SelectTrigger className="rounded-md" data-testid="staff-role-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Department</Label>
                  <Select value={form.department} onValueChange={v => setForm({...form, department: v})}>
                    <SelectTrigger className="rounded-md" data-testid="staff-dept-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {ALL_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="rounded-md" placeholder="+233..." data-testid="staff-phone-input" /></div>
              </div>
              <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-700">Account will be created with the specified email and password. The user can change their password after first login.</div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-staff-btn">Create Account</Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 max-w-md">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by name, email, role, department..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="staff-search-input" />
      </div>

      <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-slate-50">Name</TableHead>
              <TableHead className="bg-slate-50">Role</TableHead>
              <TableHead className="bg-slate-50">Department</TableHead>
              <TableHead className="bg-slate-50">Email</TableHead>
              <TableHead className="bg-slate-50">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow
                key={s.user_id}
                className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                onClick={() => openProfile(s)}
                data-testid={`staff-row-${s.user_id}`}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-sm font-semibold">
                      {s.name?.charAt(0)}
                    </div>
                    <span className="hover:text-[#2E6CC4] transition-colors">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge className={roleBadge(s.role)}>{s.role?.replace(/_/g, ' ')}</Badge>
                    {(s.roles || []).map(r => <Badge key={r} variant="secondary" className="text-[9px]">{r.replace(/_/g, ' ')}</Badge>)}
                  </div>
                </TableCell>
                <TableCell className="text-slate-500">{s.department || '-'}</TableCell>
                <TableCell className="text-slate-500 text-sm">{s.email}</TableCell>
                <TableCell>
                  <Badge className={s.is_active !== false ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-red-100 text-red-700'}>
                    {s.is_active !== false ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


function StaffActivityView({ staffId, staffName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actTab, setActTab] = useState('lessons');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/admin/staff/${staffId}/activity`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [staffId]);

  const loadComments = async (lessonId) => {
    try { const r = await api.get(`/admin/comments/lesson/${lessonId}`); setComments(r.data); } catch (err) { console.error("Error:", err); }
  };

  const openLesson = (lesson) => {
    setSelectedLesson(lesson);
    loadComments(lesson.lesson_id);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await api.post(`/admin/comments/lesson/${selectedLesson.lesson_id}`, { text: commentText });
      successToast('Comment added');
      setCommentText('');
      loadComments(selectedLesson.lesson_id);
    } catch { toast.error('Failed'); }
  };

  const reviewLesson = async (approved) => {
    try {
      const action = approved ? 'approve' : 'return';
      await api.post(`/lessons-v2/${selectedLesson.lesson_id}/review`, { action, comment: reviewFeedback || (approved ? 'Approved' : 'Needs revision') });
      successToast(approved ? 'Lesson approved' : 'Lesson returned for revision');
      setReviewFeedback('');
      setSelectedLesson(prev => ({ ...prev, submission_status: approved ? 'approved' : 'returned' }));
      api.get(`/admin/staff/${staffId}/activity`).then(r => setData(r.data)).catch(() => {});
    } catch { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;
  if (error) return <p className="text-sm text-red-500 text-center py-8">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400 text-center py-8">No data available</p>;

  if (selectedLesson) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <Card className="rounded-md"><CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-[#1B2A4A]">{selectedLesson.title}</h3>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary">{selectedLesson.subject_name}</Badge>
                <Badge variant="secondary">{selectedLesson.lesson_type}</Badge>
                {selectedLesson.submission_status && <Badge className={selectedLesson.submission_status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : selectedLesson.submission_status === 'returned' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{selectedLesson.submission_status}</Badge>}
              </div>
            </div>
          </div>
          {selectedLesson.description && <p className="text-sm text-slate-600 mb-3">{selectedLesson.description}</p>}
          {selectedLesson.content_text && <div className="bg-slate-50 rounded-md p-4 text-sm whitespace-pre-wrap mb-3">{selectedLesson.content_text}</div>}
          {selectedLesson.content_url && <a href={selectedLesson.content_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#2E6CC4] hover:underline block mb-3">{selectedLesson.content_url}</a>}

          {/* Review Actions */}
          {selectedLesson.submitted_to_management && selectedLesson.submission_status !== 'approved' && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4 space-y-3">
              <p className="text-sm font-semibold text-[#1B2A4A]">Review This Lesson</p>
              <Textarea placeholder="Write feedback for the teacher..." value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} rows={2} className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" className="rounded-md bg-[#C5A55A]" onClick={() => reviewLesson(true)}>Approve</Button>
                <Button size="sm" className="rounded-md bg-red-600" onClick={() => reviewLesson(false)}>Return for Revision</Button>
              </div>
            </div>
          )}
        </CardContent></Card>

        {/* Comments */}
        <Card className="rounded-md"><CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#2E6CC4]" /> Comments & Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && addComment()} />
              <Button size="sm" className="rounded-md bg-[#2E6CC4]" onClick={addComment}><Send className="w-3 h-3" /></Button>
            </div>
            {comments.map(c => (
              <div key={c.comment_id} className="bg-slate-50 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-[#1B2A4A]">{c.commenter_name}</span><Badge variant="secondary" className="text-[9px]">{c.commenter_role}</Badge><span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span></div>
                <p className="text-sm text-slate-600">{c.text}</p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No comments yet</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-md border p-3 text-center"><BookOpen className="w-5 h-5 text-[#2E6CC4] mx-auto mb-1" /><p className="text-xl font-bold">{data.lessons.length}</p><p className="text-[10px] text-slate-500">Lessons</p></div>
        <div className="bg-white rounded-md border p-3 text-center"><ClipboardList className="w-5 h-5 text-amber-600 mx-auto mb-1" /><p className="text-xl font-bold">{data.assignments.length}</p><p className="text-[10px] text-slate-500">Assignments</p></div>
        <div className="bg-white rounded-md border p-3 text-center"><FileText className="w-5 h-5 text-[#2E6CC4] mx-auto mb-1" /><p className="text-xl font-bold">{data.resources.length}</p><p className="text-[10px] text-slate-500">Resources</p></div>
        <div className="bg-white rounded-md border p-3 text-center"><BarChart3 className="w-5 h-5 text-[#C5A55A] mx-auto mb-1" /><p className="text-xl font-bold">{data.attendance_count}</p><p className="text-[10px] text-slate-500">Attendance</p></div>
        <div className="bg-white rounded-md border p-3 text-center"><GraduationCap className="w-5 h-5 text-[#2E6CC4] mx-auto mb-1" /><p className="text-xl font-bold">{data.cpd_enrolments.length}</p><p className="text-[10px] text-slate-500">CPD Courses</p></div>
      </div>

      <Tabs value={actTab} onValueChange={setActTab}>
        <TabsList className="bg-white border"><TabsTrigger value="lessons" className="text-xs">Lessons ({data.lessons.length})</TabsTrigger><TabsTrigger value="assignments" className="text-xs">Assignments ({data.assignments.length})</TabsTrigger><TabsTrigger value="resources" className="text-xs">Resources ({data.resources.length})</TabsTrigger><TabsTrigger value="logs" className="text-xs">Activity Logs</TabsTrigger></TabsList>

        <TabsContent value="lessons" className="mt-3 space-y-2">
          {data.lessons.map(l => (
            <Card key={l.lesson_id} className="rounded-md card-hover cursor-pointer" onClick={() => openLesson(l)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1B2A4A]">{l.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{l.subject_name}</span>
                    <Badge variant="secondary" className="text-[9px]">{l.lesson_type}</Badge>
                    {l.published && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[9px]">Published</Badge>}
                    {l.submission_status && <Badge className={l.submission_status === 'approved' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : l.submission_status === 'returned' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} >{l.submission_status}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleDateString()}</span>
                  <Eye className="w-4 h-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
          {data.lessons.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No lessons uploaded</p>}
        </TabsContent>

        <TabsContent value="assignments" className="mt-3 space-y-2">
          {data.assignments.map(a => (
            <Card key={a.assignment_id} className="rounded-md">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1B2A4A]">{a.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{a.subject_name}</span>
                    {a.published && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[9px]">Published</Badge>}
                    <span className="text-xs text-slate-500">{a.submission_count} submissions</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">{a.due_date || 'No deadline'}</span>
              </CardContent>
            </Card>
          ))}
          {data.assignments.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No assignments created</p>}
        </TabsContent>

        <TabsContent value="resources" className="mt-3 space-y-2">
          {data.resources.slice(0, 30).map(r => (
            <div key={r.resource_id} className="flex items-center justify-between bg-white rounded-md border p-3">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <div><p className="text-sm font-medium text-[#1B2A4A]">{r.title}</p><p className="text-[10px] text-slate-400">{r.resource_type?.replace(/_/g, ' ')} | {r.subject_name}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {r.published && <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[9px]">Published</Badge>}
                {r.file_ids?.length > 0 && <Badge className="bg-red-100 text-red-700 text-[9px]">PDF</Badge>}
              </div>
            </div>
          ))}
          {data.resources.length > 30 && <p className="text-xs text-slate-400 text-center">Showing 30 of {data.resources.length}</p>}
          {data.resources.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No resources uploaded</p>}
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <div className="bg-white rounded-md border overflow-hidden max-h-[400px] overflow-y-auto">
            {data.audit_logs.map((l, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-[#2E6CC4] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#1B2A4A]"><span className="font-semibold">{l.action?.replace(/_/g, ' ')}</span> on {l.entity_type}</p>
                  <p className="text-[10px] text-slate-400">{new Date(l.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {data.audit_logs.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No activity logs</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


function ResetPasswordSection({ userId }) {
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!newPass || newPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setResetting(true);
    try {
      await api.post(`/auth/reset-password/${userId}`, { new_password: newPass });
      successToast('Password reset successfully');
      setNewPass('');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setResetting(false);
  };

  return (
    <div className="bg-white rounded-md p-4 border border-slate-200 mt-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Reset Password</p>
      <div className="flex gap-2">
        <Input type="text" placeholder="Enter new password..." value={newPass} onChange={e => setNewPass(e.target.value)} className="flex-1 h-9 text-sm font-mono" />
        <Button size="sm" className="rounded-md bg-[#2E6CC4] h-9" onClick={handleReset} disabled={resetting}>
          <Key className="w-3 h-3 mr-1" /> {resetting ? 'Resetting...' : 'Reset'}
        </Button>
      </div>
      <p className="text-[9px] text-slate-400 mt-1">Set a new password for this staff member</p>
    </div>
  );
}
