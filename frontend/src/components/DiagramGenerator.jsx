import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, ImagePlus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'economics', label: 'Economics' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'physics', label: 'Physics' },
  { value: 'geography', label: 'Geography' },
  { value: 'ict', label: 'ICT / Computer Science' },
  { value: 'general', label: 'General / Other' },
];

export default function DiagramGenerator({ open, onClose, onInsert, defaultSubject }) {
  const [prompt, setPrompt] = useState('');
  const [subject, setSubject] = useState(defaultSubject || 'general');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [inserted, setInserted] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Describe the diagram you need'); return; }
    setLoading(true);
    setResult(null);
    setInserted(false);
    try {
      const res = await api.post('/ai-diagrams/generate', { prompt, subject, context });
      const fileId = res.data.file_id;
      const imageUrl = `${import.meta.env.VITE_API_URL}/api/ai-diagrams/image/${fileId}`;
      setResult({ ...res.data, image_url: imageUrl });
      toast.success('Diagram generated!');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Generation failed — try again';
      if (err.response?.status === 402 || detail.toLowerCase().includes('budget')) {
        toast.error('AI budget exceeded — go to Profile → Universal Key → Add Balance to top up', { duration: 8000 });
      } else {
        toast.error(detail);
      }
    }
    setLoading(false);
  };

  const handleInsert = () => {
    if (result?.image_url && onInsert) {
      onInsert(result.image_url, prompt);
      setInserted(true);
      toast.success('Diagram inserted into editor');
    }
  };

  const handleClose = () => {
    setPrompt('');
    setContext('');
    setResult(null);
    setInserted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1B2A4A]">
            <ImagePlus className="w-5 h-5 text-[#2E6CC4]" /> AI Diagram Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase">Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="rounded-lg mt-1" data-testid="diagram-subject"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase">Describe the diagram</Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. A quadratic graph of y = x² - 4x + 3 showing the vertex, roots, and axis of symmetry"
              className="rounded-lg mt-1 text-sm"
              data-testid="diagram-prompt"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase">Additional context (optional)</Label>
            <Input
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. For Year 11 IGCSE students, show coordinates of key points"
              className="rounded-lg mt-1 text-sm"
              data-testid="diagram-context"
            />
          </div>

          <Button
            className="w-full rounded-lg bg-[#2E6CC4] hover:bg-[#245299]"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            data-testid="generate-diagram-btn"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating diagram (up to 60s)...</>
            ) : (
              <><ImagePlus className="w-4 h-4 mr-2" /> Generate Diagram</>
            )}
          </Button>

          {result?.image_url && (
            <div className="space-y-3 border border-slate-200 rounded-lg p-3" data-testid="diagram-result">
              <img
                src={result.image_url}
                alt={prompt}
                className="w-full rounded-lg border border-slate-100"
                data-testid="diagram-preview"
              />
              <div className="flex gap-2">
                <Button
                  className={`flex-1 rounded-lg ${inserted ? 'bg-[#C5A55A]' : 'bg-[#2E6CC4] hover:bg-[#245299]'}`}
                  onClick={handleInsert}
                  data-testid="insert-diagram-btn"
                >
                  {inserted ? <><Check className="w-4 h-4 mr-2" /> Inserted</> : <><Copy className="w-4 h-4 mr-2" /> Insert into Editor</>}
                </Button>
                <Button variant="outline" className="rounded-lg" onClick={handleGenerate} disabled={loading} data-testid="regenerate-diagram-btn">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
