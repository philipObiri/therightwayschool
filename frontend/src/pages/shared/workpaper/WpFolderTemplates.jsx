import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { FolderOpen, ChevronRight, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';

const TPL_ICONS = {
  lesson_planning: { color: 'bg-blue-100 text-blue-700', emoji: 'L' },
  finance: { color: 'bg-[#C5A55A]/15 text-[#C5A55A]', emoji: 'F' },
  hr_records: { color: 'bg-blue-100 text-[#1B2A4A]', emoji: 'H' },
  admissions: { color: 'bg-amber-100 text-amber-700', emoji: 'A' },
  board_meeting: { color: 'bg-red-100 text-red-700', emoji: 'B' },
  department: { color: 'bg-blue-100 text-[#2E6CC4]', emoji: 'D' },
  project: { color: 'bg-orange-100 text-orange-700', emoji: 'P' },
  compliance: { color: 'bg-red-100 text-red-700', emoji: 'C' },
};

export function WpFolderTemplates({ parentId, onCreated, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [customName, setCustomName] = useState('');
  const [department, setDepartment] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { api.get('/wp/folder-templates').then(r => setTemplates(r.data)).catch(() => {}); }, []);

  const handleCreate = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      const r = await api.post('/wp/create-from-template', {
        template_key: selected.key,
        parent_id: parentId || '',
        name: customName || selected.name,
        department,
      });
      successToast(r.data.message);
      onCreated?.(r.data.folder_id);
      onClose?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setCreating(false);
  };

  return (
    <div className="space-y-4" data-testid="folder-templates">
      <p className="text-xs text-slate-500">Select a template to create a pre-structured folder with subfolders.</p>

      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => {
          const style = TPL_ICONS[t.key] || TPL_ICONS.department;
          const isSelected = selected?.key === t.key;
          return (
            <Card key={t.key} className={`rounded-lg cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[#1B2A4A] shadow-md' : 'hover:shadow-sm'}`}
              onClick={() => { setSelected(t); setCustomName(t.name); }} data-testid={`template-${t.key}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${style.color} flex items-center justify-center text-sm font-bold`}>{style.emoji}</div>
                  <div><p className="text-xs font-semibold text-[#1B2A4A]">{t.name}</p><Badge variant="secondary" className="text-[8px]">{t.classification}</Badge></div>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{t.description}</p>
                <div className="flex flex-wrap gap-1">{t.subfolders?.map(s => <Badge key={s} variant="outline" className="text-[8px]">{s}</Badge>)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected && (
        <div className="bg-slate-50 rounded-lg p-3 border space-y-2">
          <h4 className="text-xs font-semibold text-[#1B2A4A]">Customize "{selected.name}"</h4>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Folder Name</Label><Input value={customName} onChange={e => setCustomName(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Department</Label><Input value={department} onChange={e => setDepartment(e.target.value)} className="h-8 text-xs" placeholder="e.g. Mathematics" /></div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Layers className="w-3 h-3" /> Will create {selected.subfolders?.length} subfolders: {selected.subfolders?.join(', ')}
          </div>
          <Button className="w-full bg-[#1B2A4A] rounded-lg text-xs" onClick={handleCreate} disabled={creating} data-testid="create-from-template-btn">
            {creating ? 'Creating...' : `Create ${customName || selected.name}`}
          </Button>
        </div>
      )}
    </div>
  );
}
