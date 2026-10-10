import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTerm } from '../../../contexts/TermContext';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { AppLoader } from '../../../components/AppLoader';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import {
  Plus, ArrowLeft, Upload, CheckCircle, XCircle, Search, Sparkles,
  LayoutTemplate, Loader2
} from 'lucide-react';

export default function CreateLesson({ mode, subjects, classes, onBack, onCreated }) {
  const { user } = useAuth();
  const { activeTerm, academicYear } = useTerm();
  const teacherSubjects = user?.teaching_subjects || [];
  const filteredSubjects = teacherSubjects.length > 0 ? subjects.filter(s => teacherSubjects.includes(s.name)) : subjects;
  const teacherYears = user?.assigned_year_groups || [];
  const filteredClasses = teacherYears.length > 0 ? classes.filter(c => teacherYears.includes(c.year_group)) : classes;
  const yearGroups = [...new Set(filteredClasses.map(c => c.year_group))].sort();

  const [step, setStep] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [templateFilter, setTemplateFilter] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiForm, setAiForm] = useState({ topic: '', additional_instructions: '' });

  const [form, setForm] = useState({
    title: '', subject_id: '', subject_name: '', year_group: '', class_ids: [],
    department: user?.department || '', curriculum: 'Cambridge',
    term: activeTerm, academic_year: academicYear || '2025-2026',
    objectives: '', description: '', duration_minutes: 45, rich_content: '',
  });
  const [uploading, setUploading] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try { const res = await api.get('/lessons-v2/templates/list'); setTemplates(res.data); } catch (err) { console.error("API error:", err); }
      setLoadingTemplates(false);
    };
    loadTemplates();
  }, []);

  const applyTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    const subj = subjects.find(s => s.name === tpl.subject_name);
    setForm({
      ...form, title: tpl.name ? `${tpl.name}` : form.title,
      subject_id: subj?.subject_id || form.subject_id, subject_name: tpl.subject_name || form.subject_name,
      year_group: tpl.year_group || form.year_group, curriculum: tpl.curriculum || form.curriculum,
      duration_minutes: tpl.duration_minutes || 45, objectives: tpl.objectives || form.objectives,
      description: tpl.description || form.description, rich_content: tpl.rich_content || '',
    });
    setStep('form');
  };

  const handleAiGenerate = async () => {
    if (!form.subject_name || !form.year_group) { toast.error('Select subject and year group first'); return; }
    if (!aiForm.topic.trim()) { toast.error('Enter a topic for AI generation'); return; }
    setAiGenerating(true);
    try {
      const res = await api.post('/lessons-v2/ai-generate-lesson', {
        subject: form.subject_name, year_group: form.year_group, curriculum: form.curriculum || 'Cambridge',
        topic: aiForm.topic, duration_minutes: form.duration_minutes || 45, additional_instructions: aiForm.additional_instructions,
      });
      const gen = res.data;
      setForm(prev => ({ ...prev, title: gen.title || prev.title, objectives: gen.objectives || prev.objectives, description: gen.description || prev.description, rich_content: gen.rich_content || '' }));
      successToast('AI generated your lesson plan!');
      setStep('form');
    } catch (err) { toast.error(err.response?.data?.detail || 'AI generation failed'); }
    setAiGenerating(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try { const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setFileId(res.data.file_id); setFileName(file.name); successToast('File uploaded'); } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    const subj = subjects.find(s => s.subject_id === form.subject_id);
    const payload = { ...form, subject_name: subj?.name || form.subject_name };
    if (selectedTemplate) payload.template_id = selectedTemplate.template_id;
    try {
      let res;
      if (mode === 'upload' && fileId) { res = await api.post('/lessons-v2/upload', { ...payload, file_id: fileId }); }
      else { res = await api.post('/lessons-v2/', payload); }
      successToast('Lesson created');
      onCreated(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const filteredTemplates = templateFilter
    ? templates.filter(t => t.name?.toLowerCase().includes(templateFilter.toLowerCase()) || t.subject_name?.toLowerCase().includes(templateFilter.toLowerCase()) || t.year_group?.toLowerCase().includes(templateFilter.toLowerCase()))
    : templates;

  return (
    <div className="space-y-5 max-w-3xl" data-testid="create-lesson-view">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={step === 'form' && templates.length > 0 ? () => setStep('templates') : onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {step === 'form' && templates.length > 0 ? 'Templates' : 'Back'}
        </Button>
        {selectedTemplate && step === 'form' && (
          <Badge className="bg-blue-100 text-[#2E6CC4] text-xs"><LayoutTemplate className="w-3 h-3 mr-1" /> Using: {selectedTemplate.name}</Badge>
        )}
      </div>

      {/* Template Selection */}
      {step === 'templates' && mode !== 'upload' && (
        <div data-testid="template-selection-step">
          <h2 className="text-lg md:text-xl font-bold text-[#1B2A4A]">Start from a Template</h2>
          <p className="text-sm text-slate-500 mb-4">Choose a pre-built template to save time, or start from scratch</p>
          {loadingTemplates ? <AppLoader /> : (
            <>
              {templates.length > 0 && (
                <div className="relative mb-4">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input value={templateFilter} onChange={e => setTemplateFilter(e.target.value)} placeholder="Search templates..." className="pl-9 rounded-lg" data-testid="template-search" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                <Card className="rounded-lg border-2 border-dashed border-slate-300 hover:border-[#2E6CC4] transition-all cursor-pointer group"
                  onClick={() => { setSelectedTemplate(null); setStep('form'); }} data-testid="start-blank-lesson">
                  <CardContent className="p-5 flex flex-col items-center justify-center text-center min-h-[120px] md:min-h-[140px]">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center mb-3 transition-colors"><Plus className="w-6 h-6 text-slate-400 group-hover:text-[#2E6CC4] transition-colors" /></div>
                    <h3 className="font-semibold text-[#1B2A4A] text-sm">Start from Scratch</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Create a blank lesson plan</p>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-2 border-dashed border-blue-300 hover:border-[#2E6CC4] transition-all cursor-pointer group"
                  onClick={() => { setSelectedTemplate(null); setStep('ai-generate'); }} data-testid="start-ai-lesson">
                  <CardContent className="p-5 flex flex-col items-center justify-center text-center min-h-[120px] md:min-h-[140px]">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center mb-3 transition-colors"><Sparkles className="w-6 h-6 text-[#2E6CC4] group-hover:text-[#2E6CC4] transition-colors" /></div>
                    <h3 className="font-semibold text-[#1B2A4A] text-sm">AI Generate Lesson</h3>
                    <p className="text-[10px] text-[#2E6CC4] mt-1">Let AI create a full lesson plan</p>
                  </CardContent>
                </Card>
                {filteredTemplates.map(tpl => (
                  <Card key={tpl.template_id} className="rounded-lg border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => applyTemplate(tpl)} data-testid={`template-${tpl.template_id}`}>
                    <CardContent className="p-5 min-h-[120px] md:min-h-[140px]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><LayoutTemplate className="w-5 h-5 text-[#2E6CC4]" /></div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-[#1B2A4A] text-sm truncate">{tpl.name}</h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">{tpl.subject_name && <span>{tpl.subject_name}</span>}{tpl.year_group && <span> | {tpl.year_group}</span>}{tpl.curriculum && <span> | {tpl.curriculum}</span>}</p>
                        </div>
                      </div>
                      {tpl.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{tpl.description}</p>}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400"><span>{tpl.duration_minutes || 45}min</span><span>|</span><span>Used {tpl.usage_count || 0} times</span></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {templates.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <LayoutTemplate className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                  <p className="text-sm">No templates available yet</p>
                  <Button className="mt-4 rounded-lg bg-[#2E6CC4]" onClick={() => { setSelectedTemplate(null); setStep('form'); }} data-testid="skip-to-blank"><Plus className="w-4 h-4 mr-2" /> Start from Scratch</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AI Generate Step */}
      {step === 'ai-generate' && (
        <div className="max-w-xl" data-testid="ai-generate-step">
          <h2 className="text-lg md:text-xl font-bold text-[#1B2A4A] flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#2E6CC4]" /> AI Generate Lesson Plan</h2>
          <p className="text-sm text-slate-500 mb-5">Tell AI what you want to teach, and it'll create a complete lesson plan for you.</p>
          <Card className="rounded-lg border-blue-200 bg-[#2E6CC4]/10/30"><CardContent className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-xs font-semibold text-[#2E6CC4] uppercase">Subject</Label>
                <Select value={form.subject_id} onValueChange={v => { const s = subjects.find(x => x.subject_id === v); setForm({...form, subject_id: v, subject_name: s?.name || ''}); }}>
                  <SelectTrigger data-testid="ai-subject-select"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent>{filteredSubjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label className="text-xs font-semibold text-[#2E6CC4] uppercase">Year Group</Label>
                <Select value={form.year_group} onValueChange={v => setForm({...form, year_group: v})}>
                  <SelectTrigger data-testid="ai-year-select"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>{yearGroups.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-xs font-semibold text-[#2E6CC4] uppercase">Curriculum</Label>
                <Select value={form.curriculum} onValueChange={v => setForm({...form, curriculum: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cambridge">Cambridge</SelectItem><SelectItem value="GES">GES</SelectItem><SelectItem value="IB">IB</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-xs font-semibold text-[#2E6CC4] uppercase">Duration (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value) || 45})} /></div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-semibold text-[#2E6CC4] uppercase">Topic / What to Teach</Label>
              <Input value={aiForm.topic} onChange={e => setAiForm({...aiForm, topic: e.target.value})} placeholder="e.g. Photosynthesis, Quadratic equations, Macbeth Act 1..." className="border-blue-200" data-testid="ai-topic-input" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold text-[#2E6CC4] uppercase">Additional Instructions (optional)</Label>
              <Textarea value={aiForm.additional_instructions} onChange={e => setAiForm({...aiForm, additional_instructions: e.target.value})} rows={2} placeholder="e.g. Include a practical activity..." className="border-blue-200" data-testid="ai-instructions-input" /></div>
            <Button className="w-full h-11 md:h-12 rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-sm md:text-base font-semibold" onClick={handleAiGenerate} disabled={aiGenerating || !aiForm.topic.trim()} data-testid="ai-generate-lesson-btn">
              {aiGenerating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5 mr-2" /> Generate Lesson Plan</>}
            </Button>
          </CardContent></Card>
        </div>
      )}

      {/* Lesson Form */}
      {(step === 'form' || mode === 'upload') && (
        <>
          <h2 className="text-lg md:text-xl font-bold text-[#1B2A4A]">{mode === 'upload' ? 'Upload Lesson Plan' : 'Create New Lesson Plan'}</h2>
          <Card className="rounded-lg border-slate-100"><CardContent className="p-4 md:p-6 space-y-4">
            <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Title</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Introduction to Quadratic Equations" data-testid="lesson-title-input" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Subject</Label>
                <Select value={form.subject_id} onValueChange={v => { const s = subjects.find(x => x.subject_id === v); setForm({...form, subject_id: v, subject_name: s?.name || ''}); }}>
                  <SelectTrigger data-testid="lesson-subject-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{filteredSubjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Year Group</Label>
                <Select value={form.year_group} onValueChange={v => setForm({...form, year_group: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{yearGroups.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Term</Label>
                <Select value={form.term} onValueChange={v => setForm({...form, term: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Duration (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value) || 45})} /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Curriculum</Label>
                <Select value={form.curriculum} onValueChange={v => setForm({...form, curriculum: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cambridge">Cambridge</SelectItem><SelectItem value="GES">GES</SelectItem><SelectItem value="IB">IB</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Learning Objectives</Label>
              <Textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})} rows={2} placeholder="By the end of this lesson, students will be able to..." data-testid="lesson-objectives-input" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Description</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="Brief overview..." /></div>
            {filteredClasses.length > 0 && (
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Classes (optional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredClasses.map(c => {
                    const selected = form.class_ids.includes(c.class_id);
                    return (
                      <button key={c.class_id} type="button" onClick={() => { const ids = selected ? form.class_ids.filter(id => id !== c.class_id) : [...form.class_ids, c.class_id]; setForm({...form, class_ids: ids}); }}
                        className={`px-3 py-2 rounded-md text-xs font-medium border-2 transition-all ${selected ? 'border-[#2E6CC4] bg-blue-50 text-[#2E6CC4]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{c.name}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {mode === 'upload' && (
              <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500 uppercase">Upload Document</Label>
                <input ref={fileRef} type="file" className="hidden" accept=".doc,.docx,.pdf,.ppt,.pptx" onChange={handleFileUpload} />
                {!fileId ? (
                  <div className="border-2 border-dashed border-slate-300 hover:border-[#2E6CC4] rounded-lg p-6 md:p-8 text-center cursor-pointer transition-colors" onClick={() => fileRef.current?.click()} data-testid="upload-lesson-file">
                    {uploading ? <Loader2 className="w-8 h-8 mx-auto text-[#2E6CC4] animate-spin" /> : <><Upload className="w-10 h-10 mx-auto text-slate-300 mb-2" /><p className="text-sm text-slate-500">Click to upload</p></>}
                  </div>
                ) : (
                  <div className="bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-[#C5A55A] flex-shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[#1B2A4A] truncate">{fileName}</p><p className="text-[10px] text-[#C5A55A]">File uploaded</p></div>
                    <Button variant="ghost" size="sm" onClick={() => { setFileId(null); setFileName(''); }}><XCircle className="w-4 h-4 text-slate-400" /></Button>
                  </div>
                )}
              </div>
            )}
            {selectedTemplate?.rich_content && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                <div className="flex items-center gap-2 mb-2"><LayoutTemplate className="w-4 h-4 text-[#2E6CC4]" /><span className="text-xs font-semibold text-[#2E6CC4]">Template Content Pre-loaded</span></div>
                <p className="text-[10px] text-[#2E6CC4]">The template's content structure has been applied. You can edit it in the full editor after creation.</p>
              </div>
            )}
            <Button className="w-full h-11 md:h-12 rounded-lg bg-[#2E6CC4] text-sm md:text-base font-semibold" onClick={handleCreate} data-testid="submit-create-lesson">
              {mode === 'upload' ? <><Upload className="w-4 h-4 mr-2" /> Create & Prepare for AI Processing</> : <><Plus className="w-4 h-4 mr-2" /> Create Lesson Plan</>}
            </Button>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
