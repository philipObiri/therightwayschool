import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AppLoader } from '../../components/AppLoader';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import {
  Plus, Search, HeartPulse, Activity, Clock, User, Thermometer,
  Pill, ArrowLeft, X, FileText, AlertTriangle, BedDouble
} from 'lucide-react';

const STATUS_COLORS = {
  admitted: 'bg-amber-100 text-amber-700',
  under_observation: 'bg-blue-100 text-blue-700',
  resting: 'bg-purple-100 text-purple-700',
  referred_to_hospital: 'bg-red-100 text-red-700',
  discharged: 'bg-green-100 text-green-700',
};

const REASON_CATEGORIES = ['general', 'headache', 'stomach', 'fever', 'injury', 'allergy', 'respiratory', 'skin', 'eye', 'other'];

export default function SickBayAdmissions() {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [showAdmit, setShowAdmit] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [admitForm, setAdmitForm] = useState({ reason: '', reason_category: 'general', symptoms: '', temperature: '', notes: '' });
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [treatmentForm, setTreatmentForm] = useState({ treatment_type: 'medication', description: '', medication: '', dosage: '', notes: '' });
  const [showTreatment, setShowTreatment] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', notes: '' });
  const [showStatus, setShowStatus] = useState(false);

  const fetchAdmissions = useCallback(() => {
    const q = filter === 'all' ? '' : `?status=${filter}`;
    api.get(`/sick-bay/admissions${q}`).then(r => setAdmissions(r.data)).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchAdmissions(); }, [fetchAdmissions]);

  const searchStudents = async (q) => {
    setStudentSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const r = await api.get(`/sick-bay/students/search?q=${encodeURIComponent(q)}`);
    setSearchResults(r.data);
  };

  const handleAdmit = async () => {
    if (!selectedStudent) return toast.error('Select a student');
    try {
      await api.post('/sick-bay/admit', { student_id: selectedStudent.user_id, ...admitForm });
      successToast('Student admitted to sick bay');
      setShowAdmit(false);
      setSelectedStudent(null);
      setAdmitForm({ reason: '', reason_category: 'general', symptoms: '', temperature: '', notes: '' });
      setStudentSearch('');
      fetchAdmissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to admit'); }
  };

  const handleAddTreatment = async () => {
    if (!selectedAdmission) return;
    try {
      await api.post(`/sick-bay/admissions/${selectedAdmission.admission_id}/treatment`, treatmentForm);
      successToast('Treatment recorded');
      setShowTreatment(false);
      setTreatmentForm({ treatment_type: 'medication', description: '', medication: '', dosage: '', notes: '' });
      fetchAdmissions();
    } catch (e) { toast.error('Failed'); }
  };

  const handleStatusChange = async () => {
    if (!selectedAdmission || !statusForm.status) return;
    try {
      await api.put(`/sick-bay/admissions/${selectedAdmission.admission_id}/status`, statusForm);
      successToast(`Status updated to ${statusForm.status.replace(/_/g, ' ')}`);
      setShowStatus(false);
      setStatusForm({ status: '', notes: '' });
      setSelectedAdmission(null);
      fetchAdmissions();
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="sick-bay-admissions">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Sick Bay Admissions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage student health admissions and treatments</p>
        </div>
        <Button onClick={() => setShowAdmit(true)} className="bg-[#2E6CC4] hover:bg-[#1B2A4A] rounded-lg" data-testid="admit-student-btn">
          <Plus className="w-4 h-4 mr-2" /> Admit Student
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['active', 'all', 'discharged', 'referred_to_hospital'].map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f); setLoading(true); }}
            className={filter === f ? 'bg-[#1B2A4A] text-white' : ''}
            data-testid={`filter-${f}`}
          >
            {f === 'active' ? 'Active' : f === 'all' ? 'All' : f === 'discharged' ? 'Discharged' : 'Referred'}
          </Button>
        ))}
      </div>

      {/* Detail View */}
      {selectedAdmission && !showTreatment && !showStatus ? (
        <Card className="rounded-xl" data-testid="admission-detail">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedAdmission(null)} data-testid="back-to-list"><ArrowLeft className="w-4 h-4" /></Button>
              <CardTitle className="text-lg">{selectedAdmission.student_name}</CardTitle>
              <Badge className={STATUS_COLORS[selectedAdmission.status] || 'bg-slate-100'}>{(selectedAdmission.status || '').replace(/_/g, ' ')}</Badge>
            </div>
            {selectedAdmission.status !== 'discharged' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowTreatment(true); }} data-testid="add-treatment-btn">
                  <Pill className="w-3 h-3 mr-1" /> Treatment
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowStatus(true); setStatusForm({ status: '', notes: '' }); }} data-testid="change-status-btn">
                  <Activity className="w-3 h-3 mr-1" /> Status
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-slate-500 text-xs">Class</span><p className="font-medium">{selectedAdmission.class_name || '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Year Group</span><p className="font-medium">{selectedAdmission.year_group || '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Reason</span><p className="font-medium">{selectedAdmission.reason || '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Temperature</span><p className="font-medium">{selectedAdmission.temperature || '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Admitted At</span><p className="font-medium">{selectedAdmission.admitted_at ? new Date(selectedAdmission.admitted_at).toLocaleString() : '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Admitted By</span><p className="font-medium">{selectedAdmission.admitted_by_name || '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Symptoms</span><p className="font-medium">{selectedAdmission.symptoms || '-'}</p></div>
              <div><span className="text-slate-500 text-xs">Notes</span><p className="font-medium">{selectedAdmission.notes || '-'}</p></div>
            </div>

            {/* Treatments */}
            <div>
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-2 flex items-center gap-2"><Pill className="w-4 h-4 text-[#2E6CC4]" /> Treatments</h3>
              {(selectedAdmission.treatments || []).length === 0 ? (
                <p className="text-xs text-slate-400">No treatments recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {selectedAdmission.treatments.map((t, i) => (
                    <div key={i} className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-[#1B2A4A]">{t.treatment_type}: {t.description || t.medication}</span>
                        <span className="text-[10px] text-slate-400">{t.administered_at ? new Date(t.administered_at).toLocaleString() : ''}</span>
                      </div>
                      {t.dosage && <p className="text-xs text-slate-500">Dosage: {t.dosage}</p>}
                      {t.notes && <p className="text-xs text-slate-500">{t.notes}</p>}
                      <p className="text-[10px] text-slate-400 mt-1">By: {t.administered_by}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Log */}
            <div>
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-[#C5A55A]" /> Status History</h3>
              <div className="space-y-1">
                {(selectedAdmission.status_log || []).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[s.status]?.split(' ')[0] || 'bg-slate-200'}`} />
                    <span className="font-medium">{(s.status || '').replace(/_/g, ' ')}</span>
                    <span>&middot; {s.by}</span>
                    <span>&middot; {s.at ? new Date(s.at).toLocaleString() : ''}</span>
                    {s.notes && <span className="text-slate-400">&middot; {s.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Admissions List */
        <Card className="rounded-xl" data-testid="admissions-list">
          <CardContent className="pt-6">
            {admissions.length === 0 ? (
              <div className="text-center py-12">
                <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No admissions found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {admissions.map(a => (
                  <div
                    key={a.admission_id}
                    onClick={() => setSelectedAdmission(a)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer"
                    data-testid={`admission-row-${a.admission_id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      a.status === 'discharged' ? 'bg-green-100' : a.status === 'referred_to_hospital' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1B2A4A]">{a.student_name}</p>
                      <p className="text-xs text-slate-400">{a.reason_category} &middot; {a.class_name || a.year_group} &middot; {a.reason}</p>
                    </div>
                    <Badge className={`text-[10px] ${STATUS_COLORS[a.status] || 'bg-slate-100'}`}>{(a.status || '').replace(/_/g, ' ')}</Badge>
                    <span className="text-[10px] text-slate-400 hidden sm:block">
                      {a.admitted_at ? new Date(a.admitted_at).toLocaleDateString() : ''}
                    </span>
                    {(a.treatments || []).length > 0 && (
                      <Badge variant="outline" className="text-[9px]">{a.treatments.length} treatments</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admit Student Dialog */}
      <Dialog open={showAdmit} onOpenChange={setShowAdmit}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Admit Student to Sick Bay</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Type student name or admission number..."
                  value={studentSearch}
                  onChange={e => searchStudents(e.target.value)}
                  className="pl-9"
                  data-testid="student-search-input"
                />
              </div>
              {searchResults.length > 0 && !selectedStudent && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map(s => (
                    <div key={s.user_id} onClick={() => { setSelectedStudent(s); setSearchResults([]); setStudentSearch(s.name); }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm flex justify-between"
                      data-testid={`search-result-${s.user_id}`}>
                      <span>{s.name}</span>
                      <span className="text-slate-400 text-xs">{s.year_group} &middot; {s.admission_number}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">{selectedStudent.name}</span>
                  <span className="text-slate-400">({selectedStudent.year_group})</span>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="ml-auto h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <select value={admitForm.reason_category} onChange={e => setAdmitForm({ ...admitForm, reason_category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="reason-category-select">
                  {REASON_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input placeholder="e.g. 37.5" value={admitForm.temperature} onChange={e => setAdmitForm({ ...admitForm, temperature: e.target.value })} data-testid="temperature-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="Brief reason for admission" value={admitForm.reason} onChange={e => setAdmitForm({ ...admitForm, reason: e.target.value })} data-testid="reason-input" />
            </div>
            <div className="space-y-2">
              <Label>Symptoms</Label>
              <Textarea placeholder="Describe symptoms..." value={admitForm.symptoms} onChange={e => setAdmitForm({ ...admitForm, symptoms: e.target.value })} rows={2} data-testid="symptoms-input" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes..." value={admitForm.notes} onChange={e => setAdmitForm({ ...admitForm, notes: e.target.value })} rows={2} data-testid="notes-input" />
            </div>
            <Button onClick={handleAdmit} className="w-full bg-[#2E6CC4] hover:bg-[#1B2A4A]" data-testid="confirm-admit-btn">
              <HeartPulse className="w-4 h-4 mr-2" /> Admit to Sick Bay
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Treatment Dialog */}
      <Dialog open={showTreatment} onOpenChange={setShowTreatment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Treatment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <select value={treatmentForm.treatment_type} onChange={e => setTreatmentForm({ ...treatmentForm, treatment_type: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="treatment-type-select">
                <option value="medication">Medication</option>
                <option value="first_aid">First Aid</option>
                <option value="observation">Observation Note</option>
                <option value="rest">Rest Period</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input value={treatmentForm.description} onChange={e => setTreatmentForm({ ...treatmentForm, description: e.target.value })} data-testid="treatment-desc-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Medication</Label><Input value={treatmentForm.medication} onChange={e => setTreatmentForm({ ...treatmentForm, medication: e.target.value })} data-testid="treatment-med-input" /></div>
              <div className="space-y-2"><Label>Dosage</Label><Input value={treatmentForm.dosage} onChange={e => setTreatmentForm({ ...treatmentForm, dosage: e.target.value })} data-testid="treatment-dosage-input" /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={treatmentForm.notes} onChange={e => setTreatmentForm({ ...treatmentForm, notes: e.target.value })} rows={2} data-testid="treatment-notes-input" /></div>
            <Button onClick={handleAddTreatment} className="w-full bg-[#2E6CC4]" data-testid="confirm-treatment-btn">Record Treatment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={showStatus} onOpenChange={setShowStatus}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <select value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="status-select">
                <option value="">Select status</option>
                <option value="under_observation">Under Observation</option>
                <option value="resting">Resting</option>
                <option value="referred_to_hospital">Referred to Hospital</option>
                <option value="discharged">Discharged</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={statusForm.notes} onChange={e => setStatusForm({ ...statusForm, notes: e.target.value })} rows={2} data-testid="status-notes-input" /></div>
            <Button onClick={handleStatusChange} className={`w-full ${statusForm.status === 'discharged' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#2E6CC4]'}`} data-testid="confirm-status-btn">
              {statusForm.status === 'discharged' ? 'Discharge Patient' : 'Update Status'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
