import React, { useState, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTerm } from '../../../contexts/TermContext';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Plus, ArrowLeft, Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function CreateScheme({ mode, subjects, onBack, onCreated }) {
  const { user } = useAuth();
  const { activeTerm, academicYear } = useTerm();
  const [form, setForm] = useState({ title: '', subject_id: '', subject_name: '', year_group: '', class_name: '', department: user?.department || '', curriculum: 'Cambridge', term: activeTerm, academic_year: academicYear || '2025-2026' });
  const [uploading, setUploading] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [skipAi, setSkipAi] = useState(false);
  const fileRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try { const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setFileId(res.data.file_id); setFileName(file.name); successToast('File uploaded'); } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    const subj = subjects.find(s => s.subject_id === form.subject_id);
    const payload = { ...form, subject_name: subj?.name || form.subject_name };
    try {
      let res;
      if (mode === 'upload' && fileId) {
        res = await api.post('/schemes/upload', { ...payload, file_id: fileId, skip_ai: skipAi });
      } else {
        res = await api.post('/schemes/', payload);
      }
      successToast(skipAi ? 'Original scheme uploaded successfully' : 'Scheme created');
      onCreated(res.data, skipAi);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="space-y-5 max-w-2xl" data-testid="create-scheme-view">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
      <h2 className="text-lg md:text-xl font-bold text-[#1B2A4A]">{mode === 'upload' ? 'Upload Scheme of Work' : 'Create New Scheme of Work'}</h2>
      <Card className="rounded-lg border-slate-100"><CardContent className="p-4 md:p-6 space-y-4">
        <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Title</Label>
          <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Mathematics Scheme - Year 10 Term 2" data-testid="scheme-title-input" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Subject</Label>
            <Select value={form.subject_id} onValueChange={v => { const s = subjects.find(x => x.subject_id === v); setForm({...form, subject_id: v, subject_name: s?.name || ''}); }}>
              <SelectTrigger data-testid="scheme-subject"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Year Group</Label>
            <Select value={form.year_group} onValueChange={v => setForm({...form, year_group: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{['Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Term</Label>
            <Select value={form.term} onValueChange={v => setForm({...form, term: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Curriculum</Label>
            <Select value={form.curriculum} onValueChange={v => setForm({...form, curriculum: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cambridge">Cambridge</SelectItem><SelectItem value="GES">GES</SelectItem><SelectItem value="IB">IB</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
            <Input value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g. Sciences" /></div>
        </div>
        {mode === 'upload' && (
          <div className="space-y-3">
            <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Upload Document</Label>
              <input ref={fileRef} type="file" className="hidden" accept=".doc,.docx,.pdf" onChange={handleFileUpload} />
              {!fileId ? (
                <div className="border-2 border-dashed border-slate-300 hover:border-[#2E6CC4] rounded-lg p-6 md:p-8 text-center cursor-pointer transition-colors" onClick={() => fileRef.current?.click()} data-testid="upload-scheme-file">
                  {uploading ? <Loader2 className="w-8 h-8 mx-auto text-[#2E6CC4] animate-spin" /> : <><Upload className="w-10 h-10 mx-auto text-slate-300 mb-2" /><p className="text-sm text-slate-500">Click to upload (.doc, .docx, .pdf)</p></>}
                </div>
              ) : (
                <div className="bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#C5A55A] flex-shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#1B2A4A] truncate">{fileName}</p></div>
                  <Button variant="ghost" size="sm" onClick={() => { setFileId(null); setFileName(''); }}><XCircle className="w-4 h-4 text-slate-400" /></Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
              <button
                type="button"
                onClick={() => setSkipAi(!skipAi)}
                className={`relative w-10 h-5 rounded-full transition-colors ${skipAi ? 'bg-[#C5A55A]' : 'bg-slate-300'}`}
                data-testid="skip-ai-toggle"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${skipAi ? 'translate-x-5' : ''}`} />
              </button>
              <div>
                <p className="text-sm font-medium text-[#1B2A4A]">Upload as original (no AI)</p>
                <p className="text-xs text-slate-500">{skipAi ? 'The document will be uploaded as-is and ready to submit for approval' : 'AI will process and digitalize the document into editable format'}</p>
              </div>
            </div>
          </div>
        )}
        <Button className="w-full h-11 md:h-12 rounded-lg bg-[#2E6CC4] text-sm md:text-base font-semibold" onClick={handleCreate} data-testid="submit-create-scheme">
          {mode === 'upload' ? (skipAi ? <><Upload className="w-4 h-4 mr-2" /> Upload Original</> : <><Plus className="w-4 h-4 mr-2" /> Create & Process</>) : <><Plus className="w-4 h-4 mr-2" /> Create Scheme</>}
        </Button>
      </CardContent></Card>
    </div>
  );
}
