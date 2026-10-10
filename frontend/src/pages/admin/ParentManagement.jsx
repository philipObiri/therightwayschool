import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Users, ArrowLeft, GraduationCap, Key, Link2, X, UserCheck, Copy, Eye, EyeOff, Trash2, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from '../../components/ui/alert-dialog';

export default function ParentManagement() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: 'parent123', phone: '', ward_ids: [] });
  const [wardSearch, setWardSearch] = useState('');
  const [activeTab, setActiveTab] = useState('manage');
  const [showPasswords, setShowPasswords] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [parentRes, studentRes] = await Promise.all([
        api.get('/auth/users', { params: { role: 'Parent' } }),
        api.get('/admin/students'),
      ]);
      // Enrich parents with ward names
      const enriched = await Promise.all((parentRes.data || []).map(async (p) => {
        const wardIds = p.children_ids || [];
        const wards = [];
        for (const wid of wardIds) {
          const student = studentRes.data.find(s => s.user_id === wid);
          if (student) wards.push({ user_id: student.user_id, name: student.name, year_group: student.year_group });
        }
        return { ...p, wards };
      }));
      setParents(enriched);
      setStudents(studentRes.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/register', { ...form, role: 'Parent' });
      // Link wards
      if (form.ward_ids.length > 0) {
        await api.put(`/auth/users/${res.data.user.user_id}`, { children_ids: form.ward_ids });
      }
      successToast(`Parent account created: ${form.email} / ${form.password}`);
      setCreateDialog(false);
      setForm({ name: '', email: '', password: 'parent123', phone: '', ward_ids: [] });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleLinkWard = async () => {
    if (!selectedStudent || !linkDialog) return;
    try {
      const currentWards = linkDialog.children_ids || [];
      if (currentWards.includes(selectedStudent)) { toast.error('Already linked'); return; }
      await api.put(`/auth/users/${linkDialog.user_id}`, { children_ids: [...currentWards, selectedStudent] });
      successToast('Ward linked to parent');
      setLinkDialog(null);
      setSelectedStudent('');
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  const handleUnlinkWard = async (parent, wardId) => {
    try {
      const newWards = (parent.children_ids || []).filter(id => id !== wardId);
      await api.put(`/auth/users/${parent.user_id}`, { children_ids: newWards });
      successToast('Ward unlinked');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const toggleSelect = (uid) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filtered.map(p => p.user_id);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const r = await api.post('/auth/users/bulk-delete', { user_ids: ids });
      successToast(`Deleted ${r.data.deleted_count} parent account(s)`);
      clearSelection();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
    setDeleting(false);
  };

  const handleDeleteOne = async (uid, name) => {
    try {
      await api.delete(`/auth/users/${uid}`);
      successToast(`Deleted ${name}`);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(uid); return n; });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const addWardToForm = (studentId) => {
    if (!form.ward_ids.includes(studentId)) {
      setForm({ ...form, ward_ids: [...form.ward_ids, studentId] });
    }
    setWardSearch('');
  };

  const removeWardFromForm = (studentId) => {
    setForm({ ...form, ward_ids: form.ward_ids.filter(id => id !== studentId) });
  };

  const getStudentName = (id) => students.find(s => s.user_id === id)?.name || id;

  const filtered = parents.filter(p => {
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) ||
      (p.wards || []).some(w => w.name?.toLowerCase().includes(q));
  });
  const wardSearchResults = students.filter(s => wardSearch && (s.name.toLowerCase().includes(wardSearch.toLowerCase()) || s.admission_number?.toLowerCase().includes(wardSearch.toLowerCase())));

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="parent-management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Parent/Guardian Management</h1>
          <p className="text-slate-500 text-sm mt-1">{parents.length} parent accounts</p>
        </div>
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogTrigger asChild><Button className="rounded-md bg-[#2E6CC4]" data-testid="add-parent-btn"><Plus className="w-4 h-4 mr-2" /> Add Parent</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Parent Account</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Mr. John Forson" data-testid="parent-name" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+233..." data-testid="parent-phone" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Email (Login)</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="parent@rightway.parent" data-testid="parent-email" /></div>
                <div className="space-y-2"><Label>Password</Label><Input value={form.password} onChange={e => setForm({...form, password: e.target.value})} required data-testid="parent-password" /></div>
              </div>
              {/* Link wards */}
              <div className="space-y-2">
                <Label>Link Ward(s) / Children</Label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-md border border-slate-200 px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input type="text" value={wardSearch} onChange={e => setWardSearch(e.target.value)} placeholder="Search student by name..." className="bg-transparent border-none outline-none text-sm w-full" data-testid="ward-search" />
                </div>
                {wardSearchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-md shadow-md max-h-32 overflow-y-auto">
                    {wardSearchResults.slice(0, 8).map(s => (
                      <div key={s.user_id} onClick={() => addWardToForm(s.user_id)} className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between">
                        <span className="font-medium">{s.name}</span><span className="text-slate-400">{s.year_group}</span>
                      </div>
                    ))}
                  </div>
                )}
                {form.ward_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.ward_ids.map(id => (
                      <Badge key={id} className="bg-blue-100 text-blue-700 flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" /> {getStudentName(id)}
                        <X className="w-3 h-3 cursor-pointer ml-1" onClick={() => removeWardFromForm(id)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-700">
                <strong>Login details:</strong> {form.email || '[email]'} / {form.password}
                <br/>Parent will see their ward's grades, attendance, fees, and report cards.
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-parent">Create Parent Account</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-md w-fit">
        <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'manage' ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} data-testid="tab-manage">
          <Users className="w-4 h-4 inline mr-1.5" /> Manage ({parents.length})
        </button>
        <button onClick={() => setActiveTab('logins')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'logins' ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} data-testid="tab-logins">
          <Key className="w-4 h-4 inline mr-1.5" /> Parent Logins
        </button>
      </div>

      {/* ── LOGINS TAB ── */}
      {activeTab === 'logins' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search by parent name, email, or child name..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="login-search" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowPasswords(!showPasswords)} data-testid="toggle-passwords">
                {showPasswords ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showPasswords ? 'Hide' : 'Show'} Passwords
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                const rows = filtered.map((p, i) => `${i+1}\t${p.name}\t${p.email}\tparent123\t${(p.wards || []).map(w => w.name).join(', ')}`);
                navigator.clipboard.writeText(`#\tParent Name\tEmail\tPassword\tChildren\n${rows.join('\n')}`);
                successToast('All login details copied to clipboard');
              }} data-testid="copy-all-logins">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy All
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs w-10">#</TableHead>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs">Parent / Guardian</TableHead>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs">Email (Login)</TableHead>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs">Password</TableHead>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs">Phone</TableHead>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs">Child(ren)</TableHead>
                  <TableHead className="bg-[#1B2A4A] text-white text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400 text-sm">No parent accounts match your search</TableCell></TableRow>
                ) : filtered.map((p, idx) => (
                  <TableRow key={p.user_id} className={idx % 2 === 0 ? '' : 'bg-slate-50/50'} data-testid={`login-row-${p.user_id}`}>
                    <TableCell className="text-xs text-slate-400 font-mono">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-sm text-[#1B2A4A]">{p.name}</TableCell>
                    <TableCell className="text-sm font-mono text-[#2E6CC4]">{p.email}</TableCell>
                    <TableCell className="text-sm font-mono">{showPasswords ? 'parent123' : '••••••••'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{p.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(p.wards || []).map(w => (
                          <Badge key={w.user_id} variant="secondary" className="text-[9px]">
                            {w.name} <span className="text-slate-400 ml-0.5">({w.year_group})</span>
                          </Badge>
                        ))}
                        {(p.wards || []).length === 0 && <span className="text-[10px] text-red-400">No ward linked</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => { navigator.clipboard.writeText(`Email: ${p.email}\nPassword: parent123`); successToast('Copied'); }} className="p-1 text-slate-400 hover:text-[#2E6CC4] rounded" title="Copy login" data-testid={`copy-login-${p.user_id}`}>
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[10px] text-slate-400 text-right">{filtered.length} parent account{filtered.length !== 1 ? 's' : ''} shown &middot; Default password: parent123</p>
        </div>
      )}

      {/* ── MANAGE TAB ── */}
      {activeTab === 'manage' && (<div className="space-y-4 animate-fade-in">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 max-w-md flex-1">
          <Search className="w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search parents..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 animate-fade-in" data-testid="bulk-action-bar">
            <span className="text-xs font-medium text-red-700">{selectedIds.size} selected</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-600" onClick={clearSelection} data-testid="clear-selection">
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={deleting} data-testid="bulk-delete-btn">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete {selectedIds.size}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="bulk-delete-dialog">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} parent account{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the selected parent login(s). Linked children (students) will NOT be deleted, but they will lose the parent link. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="bulk-delete-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleBulkDelete} data-testid="bulk-delete-confirm">
                    Delete {selectedIds.size}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="bg-slate-50 w-10">
              <button onClick={toggleSelectAllVisible} className="p-1 rounded hover:bg-slate-200 transition-colors" data-testid="select-all-parents" aria-label="Select all">
                {filtered.length > 0 && filtered.every(p => selectedIds.has(p.user_id))
                  ? <CheckSquare className="w-4 h-4 text-[#2E6CC4]" />
                  : <Square className="w-4 h-4 text-slate-400" />}
              </button>
            </TableHead>
            <TableHead className="bg-slate-50">Parent/Guardian</TableHead>
            <TableHead className="bg-slate-50">Email (Login)</TableHead>
            <TableHead className="bg-slate-50">Phone</TableHead>
            <TableHead className="bg-slate-50">Ward(s)</TableHead>
            <TableHead className="bg-slate-50">Password</TableHead>
            <TableHead className="bg-slate-50">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.user_id} data-testid={`parent-row-${p.user_id}`} className={selectedIds.has(p.user_id) ? 'bg-blue-50/60' : ''}>
                <TableCell className="w-10">
                  <button onClick={() => toggleSelect(p.user_id)} className="p-1 rounded hover:bg-slate-200 transition-colors" data-testid={`select-parent-${p.user_id}`} aria-label="Select row">
                    {selectedIds.has(p.user_id)
                      ? <CheckSquare className="w-4 h-4 text-[#2E6CC4]" />
                      : <Square className="w-4 h-4 text-slate-400" />}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm font-mono text-[#2E6CC4]">{p.email}</TableCell>
                <TableCell className="text-sm text-slate-500">{p.phone || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(p.wards || []).map(w => (
                      <Badge key={w.user_id} variant="secondary" className="text-[10px] flex items-center gap-1">
                        <GraduationCap className="w-2.5 h-2.5" /> {w.name} ({w.year_group})
                        <X className="w-2.5 h-2.5 cursor-pointer ml-0.5" onClick={() => handleUnlinkWard(p, w.user_id)} />
                      </Badge>
                    ))}
                    {(p.wards || []).length === 0 && <span className="text-xs text-slate-400">No wards linked</span>}
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-500">parent123</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs h-7 rounded-md" onClick={() => setLinkDialog(p)} data-testid={`link-ward-${p.user_id}`}>
                      <Link2 className="w-3 h-3 mr-1" /> Link Ward
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors" title={`Delete ${p.name}`} data-testid={`delete-parent-${p.user_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the parent login for <strong>{p.email}</strong>. Linked children will not be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteOne(p.user_id, p.name)} data-testid={`confirm-delete-${p.user_id}`}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">No parent accounts yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      </div>)}

      {/* Link Ward Dialog */}
      <Dialog open={!!linkDialog} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Ward to {linkDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Select Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger data-testid="link-student-select"><SelectValue placeholder="Choose a student" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name} ({s.year_group})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={handleLinkWard} data-testid="confirm-link-ward">
              <Link2 className="w-4 h-4 mr-2" /> Link Ward
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
