import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { AlertTriangle, BookOpen, Plus, Search, MessageSquare, Trash2, Edit2, ChevronDown, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';
import { BoosterLessonDetailDialog } from '../shared/booster/BoosterLessonDetailDialog';

// Searchable dropdown component using native elements
function SearchableSelect({ placeholder, onSearch, onSelect, renderItem, value, label }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (val.length >= 2) {
        const r = await onSearch(val);
        setResults(r || []);
        setOpen(true);
      } else {
        setResults([]);
        setOpen(false);
      }
    }, 300);
  };

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="flex items-center gap-2 border border-slate-200 rounded-md px-3 py-2 bg-slate-50">
          <span className="flex-1 text-sm font-medium text-[#1B2A4A]">{label}</span>
          <button type="button" onClick={() => { onSelect(null); setQuery(''); }} className="text-slate-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => { if (results.length) setOpen(true); }}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30 focus:border-[#2E6CC4]"
            data-testid="searchable-select-input"
          />
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm transition-colors border-b border-slate-50 last:border-b-0"
              onClick={() => { onSelect(item); setOpen(false); setQuery(''); }}
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CONCERN_CATEGORIES = ['academic', 'behaviour', 'health', 'financial', 'general', 'other'];
const CONCERN_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const LESSON_STATUSES = ['requested', 'approved', 'in_progress', 'completed', 'cancelled'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BoosterConcernsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('concerns');
  const [loading, setLoading] = useState(true);

  // Concerns state
  const [concerns, setConcerns] = useState([]);
  const [showConcernForm, setShowConcernForm] = useState(false);
  const [editingConcern, setEditingConcern] = useState(null);
  const [concernForm, setConcernForm] = useState({ student_id: '', student_name: '', student_year: '', subject: '', category: 'academic', description: '', notes: '' });
  const [respondDialog, setRespondDialog] = useState(null);
  const [responseMsg, setResponseMsg] = useState('');
  const [responseStatus, setResponseStatus] = useState('');

  // Booster Lessons state
  const [lessons, setLessons] = useState([]);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({ student_id: '', student_name: '', student_year: '', class_id: '', subject: '', reason: '', notes: '', preferred_days: [], teacher_id: '', teacher_name: '' });

  // Classes
  const [classes, setClasses] = useState([]);

  // Booster detail dialog
  const [detailLesson, setDetailLesson] = useState(null);

  const fetchConcerns = useCallback(async () => {
    try {
      const r = await api.get('/booster/concerns');
      setConcerns(r.data);
    } catch { toast.error('Failed to load concerns'); }
  }, []);

  const fetchLessons = useCallback(async () => {
    try {
      const r = await api.get('/booster/lessons');
      setLessons(r.data);
    } catch { toast.error('Failed to load lessons'); }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const r = await api.get('/academic/classes');
      setClasses(r.data);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchConcerns(), fetchLessons(), fetchClasses()]).finally(() => setLoading(false));
  }, [fetchConcerns, fetchLessons, fetchClasses]);

  const searchStudents = async (q) => {
    try { const r = await api.get(`/booster/students/search?q=${encodeURIComponent(q)}`); return r.data; } catch { return []; }
  };

  const searchTeachers = async (q) => {
    try { const r = await api.get(`/booster/teachers/search?q=${encodeURIComponent(q)}`); return r.data; } catch { return []; }
  };

  // ── CONCERN HANDLERS ──
  const handleConcernSubmit = async (e) => {
    e.preventDefault();
    if (!concernForm.student_id) { toast.error('Please select a student'); return; }
    if (!concernForm.subject.trim()) { toast.error('Please enter a subject'); return; }
    try {
      if (editingConcern) {
        await api.put(`/booster/concerns/${editingConcern.concern_id}`, concernForm);
        toast.success('Concern updated');
      } else {
        await api.post('/booster/concerns', concernForm);
        toast.success('Parent concern raised successfully');
      }
      setShowConcernForm(false);
      setEditingConcern(null);
      setConcernForm({ student_id: '', student_name: '', student_year: '', subject: '', category: 'academic', description: '', notes: '' });
      fetchConcerns();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRespondConcern = async () => {
    if (!responseMsg.trim()) { toast.error('Enter a response'); return; }
    try {
      await api.post(`/booster/concerns/${respondDialog.concern_id}/respond`, { message: responseMsg, status: responseStatus || undefined });
      toast.success('Response added');
      setRespondDialog(null);
      setResponseMsg('');
      setResponseStatus('');
      fetchConcerns();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deleteConcern = async (id) => {
    if (!window.confirm('Delete this concern?')) return;
    try { await api.delete(`/booster/concerns/${id}`); toast.success('Deleted'); fetchConcerns(); } catch { toast.error('Failed to delete'); }
  };

  const editConcern = (c) => {
    setEditingConcern(c);
    setConcernForm({ student_id: c.student_id, student_name: c.student_name, student_year: c.student_year, subject: c.subject, category: c.category, description: c.description, notes: c.notes || '' });
    setShowConcernForm(true);
  };

  // ── BOOSTER LESSON HANDLERS ──
  const handleLessonSubmit = async (e) => {
    e.preventDefault();
    if (!lessonForm.student_id) { toast.error('Please select a student'); return; }
    if (!lessonForm.subject.trim()) { toast.error('Please enter a subject'); return; }
    try {
      if (editingLesson) {
        await api.put(`/booster/lessons/${editingLesson.lesson_id}`, lessonForm);
        toast.success('Booster lesson updated');
      } else {
        await api.post('/booster/lessons', lessonForm);
        toast.success('Booster lesson booked');
      }
      setShowLessonForm(false);
      setEditingLesson(null);
      setLessonForm({ student_id: '', student_name: '', student_year: '', class_id: '', subject: '', reason: '', notes: '', preferred_days: [], teacher_id: '', teacher_name: '' });
      fetchLessons();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deleteLesson = async (id) => {
    if (!window.confirm('Delete this booster lesson?')) return;
    try { await api.delete(`/booster/lessons/${id}`); toast.success('Deleted'); fetchLessons(); } catch { toast.error('Failed to delete'); }
  };

  const editLesson = (l) => {
    setEditingLesson(l);
    setLessonForm({
      student_id: l.student_id, student_name: l.student_name, student_year: l.student_year || '',
      class_id: l.class_id || '', subject: l.subject, reason: l.reason || '', notes: l.notes || '',
      preferred_days: l.preferred_days || [], teacher_id: l.teacher_id || '', teacher_name: l.teacher_name || '',
    });
    setShowLessonForm(true);
  };

  const toggleDay = (day) => {
    setLessonForm(f => ({ ...f, preferred_days: f.preferred_days.includes(day) ? f.preferred_days.filter(d => d !== day) : [...f.preferred_days, day] }));
  };

  const statusColor = (s) => {
    const map = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-600', requested: 'bg-blue-100 text-blue-700', approved: 'bg-emerald-100 text-emerald-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
    return map[s] || 'bg-slate-100 text-slate-600';
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="booster-concerns-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Parent Concerns & Booster Lessons</h1>
          <p className="text-slate-500 text-sm mt-1">Track student support needs and extra class bookings</p>
        </div>
        <Button
          onClick={() => {
            if (activeTab === 'concerns') {
              setEditingConcern(null);
              setConcernForm({ student_id: '', student_name: '', student_year: '', subject: '', category: 'academic', description: '', notes: '' });
              setShowConcernForm(true);
            } else {
              setEditingLesson(null);
              setLessonForm({ student_id: '', student_name: '', student_year: '', class_id: '', subject: '', reason: '', notes: '', preferred_days: [], teacher_id: '', teacher_name: '' });
              setShowLessonForm(true);
            }
          }}
          className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90 text-white rounded-md"
          data-testid="add-new-btn"
        >
          <Plus className="w-4 h-4 mr-1" />
          {activeTab === 'concerns' ? 'Raise Concern' : 'Book Booster Lesson'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Open Concerns</p>
            <p className="text-2xl font-bold text-[#DC2626]">{concerns.filter(c => c.status === 'open').length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Concerns</p>
            <p className="text-2xl font-bold text-[#1B2A4A]">{concerns.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Active Boosters</p>
            <p className="text-2xl font-bold text-[#2E6CC4]">{lessons.filter(l => ['requested', 'approved', 'in_progress'].includes(l.status)).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-100">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Boosters</p>
            <p className="text-2xl font-bold text-[#1B2A4A]">{lessons.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-md w-fit">
        <button
          onClick={() => setActiveTab('concerns')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'concerns' ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          data-testid="tab-concerns"
        >
          <AlertTriangle className="w-4 h-4 inline mr-1.5" /> Parent Concerns ({concerns.length})
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'lessons' ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          data-testid="tab-lessons"
        >
          <BookOpen className="w-4 h-4 inline mr-1.5" /> Booster Lessons ({lessons.length})
        </button>
      </div>

      {/* ── CONCERNS TAB ── */}
      {activeTab === 'concerns' && (
        <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
          {concerns.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No parent concerns raised yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-slate-50">Student</TableHead>
                  <TableHead className="bg-slate-50">Subject</TableHead>
                  <TableHead className="bg-slate-50">Category</TableHead>
                  <TableHead className="bg-slate-50">Status</TableHead>
                  <TableHead className="bg-slate-50">Raised By</TableHead>
                  <TableHead className="bg-slate-50">Date</TableHead>
                  <TableHead className="bg-slate-50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {concerns.map(c => (
                  <TableRow key={c.concern_id} data-testid={`concern-row-${c.concern_id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-[#1B2A4A]">{c.student_name}</p>
                        <p className="text-[10px] text-slate-400">{c.student_year}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{c.subject}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{c.category}</Badge></TableCell>
                    <TableCell><Badge className={`text-[10px] ${statusColor(c.status)}`}>{c.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-500">{c.raised_by_name}<br /><span className="text-[10px] text-slate-400">{c.raised_by_role}</span></TableCell>
                    <TableCell className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" onClick={() => { setRespondDialog(c); setResponseStatus(c.status); }} data-testid={`respond-concern-${c.concern_id}`}>
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => editConcern(c)} data-testid={`edit-concern-${c.concern_id}`}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => deleteConcern(c.concern_id)} data-testid={`delete-concern-${c.concern_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ── BOOSTER LESSONS TAB ── */}
      {activeTab === 'lessons' && (
        <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
          {lessons.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No booster lessons booked yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-slate-50">Student</TableHead>
                  <TableHead className="bg-slate-50">Subject</TableHead>
                  <TableHead className="bg-slate-50">Teacher</TableHead>
                  <TableHead className="bg-slate-50">Days</TableHead>
                  <TableHead className="bg-slate-50">Status</TableHead>
                  <TableHead className="bg-slate-50">Booked By</TableHead>
                  <TableHead className="bg-slate-50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map(l => (
                  <TableRow key={l.lesson_id} data-testid={`lesson-row-${l.lesson_id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-[#1B2A4A]">{l.student_name}</p>
                        <p className="text-[10px] text-slate-400">{l.student_year}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{l.subject}</TableCell>
                    <TableCell className="text-sm text-slate-600">{l.teacher_name || <span className="text-slate-300">Unassigned</span>}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {(l.preferred_days || []).map(d => <Badge key={d} variant="secondary" className="text-[9px] py-0">{d.slice(0, 3)}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell><Badge className={`text-[10px] ${statusColor(l.status)}`}>{l.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-500">{l.booked_by_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#2E6CC4] relative" onClick={() => setDetailLesson(l)} data-testid={`chat-lesson-${l.lesson_id}`} title="Comments & progress">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {l.comments?.length > 0 && <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-[#C5A55A] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{l.comments.length}</span>}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => editLesson(l)} data-testid={`edit-lesson-${l.lesson_id}`}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => deleteLesson(l.lesson_id)} data-testid={`delete-lesson-${l.lesson_id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ── CONCERN FORM DIALOG ── */}
      <Dialog open={showConcernForm} onOpenChange={setShowConcernForm}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConcern ? 'Edit Concern' : 'Raise Parent Concern'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConcernSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <SearchableSelect
                placeholder="Search student by name or admission no..."
                onSearch={searchStudents}
                onSelect={(s) => {
                  if (s) setConcernForm(f => ({ ...f, student_id: s.user_id, student_name: s.name, student_year: s.year_group || '' }));
                  else setConcernForm(f => ({ ...f, student_id: '', student_name: '', student_year: '' }));
                }}
                renderItem={(s) => <span>{s.name} <span className="text-slate-400 text-xs">({s.admission_number || s.year_group})</span></span>}
                value={concernForm.student_id}
                label={concernForm.student_name}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject / Title *</Label>
              <Input value={concernForm.subject} onChange={e => setConcernForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Poor math performance" required data-testid="concern-subject" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={concernForm.category}
                onChange={e => setConcernForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30"
                data-testid="concern-category"
              >
                {CONCERN_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={concernForm.description} onChange={e => setConcernForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Detailed description of the concern..." data-testid="concern-description" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={concernForm.notes} onChange={e => setConcernForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes..." data-testid="concern-notes" />
            </div>
            <Button type="submit" className="w-full rounded-md bg-[#1B2A4A] hover:bg-[#1B2A4A]/90" data-testid="submit-concern-btn">
              {editingConcern ? 'Update Concern' : 'Raise Concern'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── RESPOND TO CONCERN DIALOG ── */}
      <Dialog open={!!respondDialog} onOpenChange={() => setRespondDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Concern: {respondDialog?.subject}</DialogTitle>
          </DialogHeader>
          {respondDialog && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-md p-3">
                <p className="text-xs text-slate-500 mb-1">Student: <strong>{respondDialog.student_name}</strong> ({respondDialog.student_year})</p>
                <p className="text-xs text-slate-500 mb-1">Category: <strong className="capitalize">{respondDialog.category}</strong></p>
                <p className="text-sm text-[#1B2A4A] mt-2">{respondDialog.description}</p>
                {respondDialog.notes && <p className="text-xs text-slate-400 mt-1 italic">Notes: {respondDialog.notes}</p>}
              </div>
              {/* Previous responses */}
              {respondDialog.responses?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Previous Responses</p>
                  {respondDialog.responses.map((r, i) => (
                    <div key={i} className="bg-blue-50 rounded-md p-3 text-sm">
                      <p className="text-[#1B2A4A]">{r.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{r.by} ({r.role}) - {new Date(r.at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Label>Update Status</Label>
                <select
                  value={responseStatus}
                  onChange={e => setResponseStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30"
                  data-testid="response-status"
                >
                  {CONCERN_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Response Message *</Label>
                <Textarea value={responseMsg} onChange={e => setResponseMsg(e.target.value)} rows={3} placeholder="Type your response..." data-testid="response-message" />
              </div>
              <Button onClick={handleRespondConcern} className="w-full rounded-md bg-[#2E6CC4] hover:bg-[#2E6CC4]/90" data-testid="submit-response-btn">
                Add Response
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── BOOSTER LESSON FORM DIALOG ── */}
      <Dialog open={showLessonForm} onOpenChange={setShowLessonForm}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Edit Booster Lesson' : 'Book Booster Lesson'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLessonSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <SearchableSelect
                placeholder="Search student by name or admission no..."
                onSearch={searchStudents}
                onSelect={(s) => {
                  if (s) setLessonForm(f => ({ ...f, student_id: s.user_id, student_name: s.name, student_year: s.year_group || '', class_id: s.class_id || '' }));
                  else setLessonForm(f => ({ ...f, student_id: '', student_name: '', student_year: '', class_id: '' }));
                }}
                renderItem={(s) => <span>{s.name} <span className="text-slate-400 text-xs">({s.admission_number || s.year_group})</span></span>}
                value={lessonForm.student_id}
                label={lessonForm.student_name}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input value={lessonForm.subject} onChange={e => setLessonForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" required data-testid="lesson-subject" />
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <select
                  value={lessonForm.class_id}
                  onChange={e => setLessonForm(f => ({ ...f, class_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30"
                  data-testid="lesson-class"
                >
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign Teacher</Label>
              <SearchableSelect
                placeholder="Search teacher by name..."
                onSearch={searchTeachers}
                onSelect={(t) => {
                  if (t) setLessonForm(f => ({ ...f, teacher_id: t.user_id, teacher_name: t.name }));
                  else setLessonForm(f => ({ ...f, teacher_id: '', teacher_name: '' }));
                }}
                renderItem={(t) => <span>{t.name} <span className="text-slate-400 text-xs">({t.department || 'Teacher'})</span></span>}
                value={lessonForm.teacher_id}
                label={lessonForm.teacher_name}
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${lessonForm.preferred_days.includes(d) ? 'bg-[#2E6CC4] text-white border-[#2E6CC4]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                    data-testid={`day-${d.toLowerCase()}`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={lessonForm.reason} onChange={e => setLessonForm(f => ({ ...f, reason: e.target.value }))} rows={2} placeholder="Why does this student need extra lessons?" data-testid="lesson-reason" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={lessonForm.notes} onChange={e => setLessonForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional notes..." data-testid="lesson-notes" />
            </div>
            {editingLesson && (
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={lessonForm.status || editingLesson.status}
                  onChange={e => setLessonForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30"
                  data-testid="lesson-status"
                >
                  {LESSON_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
            )}
            <Button type="submit" className="w-full rounded-md bg-[#1B2A4A] hover:bg-[#1B2A4A]/90" data-testid="submit-lesson-btn">
              {editingLesson ? 'Update Booster Lesson' : 'Book Booster Lesson'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Booster Lesson Detail (comments + progress) */}
      <BoosterLessonDetailDialog
        open={!!detailLesson}
        onOpenChange={(o) => { if (!o) setDetailLesson(null); }}
        lesson={detailLesson}
        currentUser={user}
        onUpdated={fetchLessons}
      />
    </div>
  );
}
