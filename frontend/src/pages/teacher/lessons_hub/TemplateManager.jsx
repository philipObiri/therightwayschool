import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { SchemeEditor as RichTextEditor } from '../../../components/SchemeEditor';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import {
  Plus, ArrowLeft, CheckCircle, Trash2, BarChart3, Sparkles, PenSquare,
  Users, Shield, Zap, Save, Loader2, Send, LayoutTemplate, Copy
} from 'lucide-react';

export default function TemplateManager({ templates, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', subject_name: '', year_group: '', curriculum: 'Cambridge', duration_minutes: 45, objectives: '', rich_content: '' });
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiGenForm, setAiGenForm] = useState({ subject_name: '', year_group: '', topic: '', curriculum: 'Cambridge', duration_minutes: 45, lesson_type: 'mixed', custom_instructions: '' });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

  const resetForm = () => { setForm({ name: '', description: '', subject_name: '', year_group: '', curriculum: 'Cambridge', duration_minutes: 45, objectives: '', rich_content: '' }); setEditTemplate(null); setShowCreate(false); setShowEditor(false); setShowAiPanel(false); setAiCustomPrompt(''); };

  const startEdit = (tpl) => {
    setForm({ name: tpl.name, description: tpl.description || '', subject_name: tpl.subject_name || '', year_group: tpl.year_group || '', curriculum: tpl.curriculum || 'Cambridge', duration_minutes: tpl.duration_minutes || 45, objectives: tpl.objectives || '', rich_content: tpl.rich_content || '' });
    setEditTemplate(tpl); setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Template name is required'); return; }
    setSaving(true);
    try {
      if (editTemplate) { await api.put(`/lessons-v2/templates/${editTemplate.template_id}`, form); successToast('Template updated'); }
      else { await api.post('/lessons-v2/templates/create', form); successToast('Template created'); }
      resetForm(); onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSaving(false);
  };
  const handleDelete = async (templateId) => { if (!window.confirm('Delete this template?')) return; try { await api.delete(`/lessons-v2/templates/${templateId}`); successToast('Deleted'); onRefresh(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const handleAiGenerate = async () => { if (!aiGenForm.subject_name) { toast.error('Subject is required'); return; } setAiGenerating(true); try { await api.post('/lessons-v2/templates/ai-generate', aiGenForm); successToast('AI template generated!'); setShowAiGen(false); onRefresh(); } catch (err) { toast.error(err.response?.data?.detail || 'AI generation failed'); } setAiGenerating(false); };
  const handleAiImprove = async (promptType) => { if (!editTemplate?.template_id) return; setAiImproving(true); try { const res = await api.post(`/lessons-v2/templates/${editTemplate.template_id}/ai-improve`, { prompt_type: promptType, custom_prompt: aiCustomPrompt }); setForm({ ...form, rich_content: res.data.ai_content }); successToast(`AI ${promptType} applied`); } catch (err) { toast.error(err.response?.data?.detail || 'AI failed'); } setAiImproving(false); };

  if (showEditor) {
    return createPortal(
      <div className="fixed inset-0 bg-white flex flex-col overflow-hidden" style={{ zIndex: 9999 }} data-testid="template-editor-fullscreen">
        <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => { setShowEditor(false); setShowAiPanel(false); }}><ArrowLeft className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">Back</span></Button>
            <span className="text-xs md:text-sm font-medium text-[#1B2A4A] truncate">{form.name || 'Untitled'}</span>
          </div>
          <div className="flex gap-2">
            {editTemplate && <Button size="sm" className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-xs" onClick={() => setShowAiPanel(!showAiPanel)} data-testid="toggle-template-ai-panel"><Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">AI</span></Button>}
            <Button size="sm" className="rounded-lg bg-[#2E6CC4] text-xs" onClick={() => { setShowEditor(false); setShowAiPanel(false); }}><CheckCircle className="w-3.5 h-3.5 mr-1" /> Done</Button>
          </div>
        </div>
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <div className={`flex-1 overflow-y-auto p-3 md:p-4 ${showAiPanel ? 'md:max-w-[60%]' : ''}`}>
            <style>{`.tpl-editor .ql-container { min-height: 70vh; } .tpl-editor .ql-editor { min-height: 68vh; }`}</style>
            <div className="tpl-editor"><RichTextEditor value={form.rich_content} onChange={v => setForm({...form, rich_content: v})} subject={form.subject_name} /></div>
          </div>
          {showAiPanel && editTemplate && (
            <div className="w-full md:w-[40%] overflow-y-auto p-3 md:p-4 border-t md:border-t-0 md:border-l border-slate-200" data-testid="template-ai-panel">
              <Card className="rounded-lg border-blue-200 bg-[#2E6CC4]/10/50"><CardContent className="p-3 md:p-4 space-y-3">
                <h3 className="text-sm font-bold text-[#1B2A4A] flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Template Assistant</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[{ k: 'improve', l: 'Improve', icon: Sparkles }, { k: 'standardise', l: 'School Standard', icon: Shield }, { k: 'expand', l: 'Expand', icon: Plus }, { k: 'differentiation', l: 'Differentiation', icon: Users }, { k: 'assessment', l: 'Assessments', icon: BarChart3 }, { k: 'engagement', l: 'Engagement', icon: Zap }].map(a => (
                    <Button key={a.k} variant="outline" size="sm" className="rounded-lg text-xs text-[#2E6CC4] border-blue-200 hover:bg-blue-100 justify-start" onClick={() => handleAiImprove(a.k)} disabled={aiImproving} data-testid={`ai-tpl-${a.k}`}>{aiImproving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <a.icon className="w-3 h-3 mr-1.5" />} {a.l}</Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-[#2E6CC4] uppercase">Custom AI Command</Label>
                  <Textarea value={aiCustomPrompt} onChange={e => setAiCustomPrompt(e.target.value)} rows={2} className="text-xs rounded-lg border-blue-200" placeholder="e.g. Add more group activities..." />
                  <Button className="w-full rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-xs" size="sm" onClick={() => handleAiImprove('custom')} disabled={aiImproving || !aiCustomPrompt.trim()} data-testid="ai-tpl-custom">{aiImproving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />} Run</Button>
                </div>
              </CardContent></Card>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-4" data-testid="template-manager">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-[#1B2A4A]">Lesson Plan Templates</h3><p className="text-xs text-slate-400">Create reusable templates for teachers.</p></div>
        <div className="flex gap-2">
          <Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] text-xs" onClick={() => setShowAiGen(!showAiGen)} data-testid="ai-generate-template-btn"><Sparkles className="w-4 h-4 mr-1" /> AI Generate</Button>
          <Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#2558A3] text-xs" onClick={() => { resetForm(); setShowCreate(true); }} data-testid="create-template-btn"><Plus className="w-4 h-4 mr-1" /> New Template</Button>
        </div>
      </div>

      {showAiGen && (
        <Card className="rounded-lg border-blue-300 bg-gradient-to-r from-blue-50 to-blue-50" data-testid="ai-generate-form">
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-[#2E6CC4] uppercase">Subject *</Label><Input value={aiGenForm.subject_name} onChange={e => setAiGenForm({...aiGenForm, subject_name: e.target.value})} placeholder="e.g. Physics" className="rounded-lg border-blue-200" data-testid="ai-gen-subject" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-[#2E6CC4] uppercase">Year Group</Label><Input value={aiGenForm.year_group} onChange={e => setAiGenForm({...aiGenForm, year_group: e.target.value})} placeholder="e.g. Year 10" className="rounded-lg border-blue-200" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[10px] font-semibold text-[#2E6CC4] uppercase">Topic</Label><Input value={aiGenForm.topic} onChange={e => setAiGenForm({...aiGenForm, topic: e.target.value})} placeholder="e.g. Chemical Reactions" className="rounded-lg border-blue-200" data-testid="ai-gen-topic" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-[#2E6CC4] uppercase">Lesson Type</Label><Select value={aiGenForm.lesson_type} onValueChange={v => setAiGenForm({...aiGenForm, lesson_type: v})}><SelectTrigger className="rounded-lg border-blue-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mixed">Mixed</SelectItem><SelectItem value="theory">Theory</SelectItem><SelectItem value="practical">Practical</SelectItem><SelectItem value="assessment">Assessment</SelectItem><SelectItem value="revision">Revision</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-[#2E6CC4] uppercase">Duration</Label><Input type="number" value={aiGenForm.duration_minutes} onChange={e => setAiGenForm({...aiGenForm, duration_minutes: parseInt(e.target.value) || 45})} className="rounded-lg border-blue-200" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-[#2E6CC4] uppercase">Curriculum</Label><Select value={aiGenForm.curriculum} onValueChange={v => setAiGenForm({...aiGenForm, curriculum: v})}><SelectTrigger className="rounded-lg border-blue-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cambridge">Cambridge</SelectItem><SelectItem value="GES">GES</SelectItem><SelectItem value="IB">IB</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A] h-10 text-xs" onClick={handleAiGenerate} disabled={aiGenerating} data-testid="submit-ai-generate">{aiGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}{aiGenerating ? 'Generating...' : 'Generate'}</Button>
              <Button variant="outline" className="rounded-lg border-blue-200 text-xs" onClick={() => setShowAiGen(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card className="rounded-lg border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 md:p-5 space-y-4">
            <h4 className="text-sm font-bold text-[#1B2A4A]">{editTemplate ? 'Edit Template' : 'Create New Template'}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. RightWay Standard Science Lesson" className="rounded-lg" data-testid="template-name-input" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Subject</Label><Input value={form.subject_name} onChange={e => setForm({...form, subject_name: e.target.value})} className="rounded-lg" placeholder="e.g. Mathematics" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Year Group</Label><Input value={form.year_group} onChange={e => setForm({...form, year_group: e.target.value})} className="rounded-lg" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value) || 45})} className="rounded-lg" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Curriculum</Label><Select value={form.curriculum} onValueChange={v => setForm({...form, curriculum: v})}><SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cambridge">Cambridge</SelectItem><SelectItem value="GES">GES</SelectItem><SelectItem value="IB">IB</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="rounded-lg" /></div>
            <div className="space-y-1"><Label className="text-[10px] font-semibold text-slate-500 uppercase">Objectives</Label><Textarea value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})} rows={2} className="rounded-lg" /></div>
            <div className="flex items-center justify-between bg-white rounded-lg border border-blue-200 p-3">
              <div><p className="text-xs font-semibold text-[#1B2A4A]">Template Content</p><p className="text-[10px] text-[#2E6CC4]">{form.rich_content ? `${Math.round(form.rich_content.length / 1000)}KB` : 'No content yet'}</p></div>
              <Button size="sm" variant="outline" className="rounded-lg text-xs border-blue-300 text-[#2E6CC4]" onClick={() => setShowEditor(true)} data-testid="edit-template-content"><PenSquare className="w-3.5 h-3.5 mr-1" /> {form.rich_content ? 'Edit' : 'Add Content'}</Button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#2558A3] flex-1 text-xs" onClick={handleSave} disabled={saving} data-testid="save-template-btn">{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{editTemplate ? 'Update' : 'Create'}</Button>
              <Button variant="outline" className="rounded-lg text-xs" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {templates.length === 0 && !showCreate && (
        <div className="text-center py-12 text-slate-400"><LayoutTemplate className="w-16 h-16 mx-auto mb-3 text-slate-200" /><p className="text-lg font-medium">No templates yet</p></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map(tpl => (
          <Card key={tpl.template_id} className="rounded-lg border-slate-100 hover:border-blue-200 transition-all" data-testid={`mgmt-template-${tpl.template_id}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><LayoutTemplate className="w-5 h-5 text-[#2E6CC4]" /></div>
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-[#1B2A4A] text-sm truncate">{tpl.name}</h3><p className="text-[10px] text-slate-400">{tpl.subject_name || 'All subjects'} | {tpl.year_group || 'All years'} | {tpl.curriculum}</p></div>
              </div>
              {tpl.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{tpl.description}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-slate-400"><Copy className="w-3 h-3" /><span>Used {tpl.usage_count || 0}x</span><span>|</span><span>{tpl.duration_minutes || 45}min</span></div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-[#2E6CC4]" onClick={() => startEdit(tpl)} data-testid={`edit-template-${tpl.template_id}`}><PenSquare className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => handleDelete(tpl.template_id)} data-testid={`delete-template-${tpl.template_id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <p className="text-[9px] text-slate-300 mt-2">Created by {tpl.created_by_name} | {new Date(tpl.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
