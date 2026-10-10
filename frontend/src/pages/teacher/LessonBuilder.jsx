import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, BookOpen, Video, FileText, Link, Type, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const typeIcons = { video: Video, pdf: FileText, text: Type, link: Link };

export default function LessonBuilder() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', subject_id: '', class_ids: [],
    lesson_type: 'text', content_url: '', content_text: '',
    tags: '', published: true
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';
      const params = isAdmin ? {} : { teacher_id: user?.user_id };
      const [lesRes, subjRes, clsRes] = await Promise.all([
        api.get('/lms/lessons', { params }),
        api.get('/academic/subjects'),
        api.get('/academic/classes'),
      ]);
      setLessons(lesRes.data);
      setSubjects(subjRes.data);
      setClasses(clsRes.data);
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/lms/lessons', {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        class_ids: form.class_ids
      });
      toast.success('Lesson created');
      setDialogOpen(false);
      setForm({ title: '', description: '', subject_id: '', class_ids: [], lesson_type: 'text', content_url: '', content_text: '', tags: '', published: true });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/lms/lessons/${id}`);
      toast.success('Lesson deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="lesson-builder">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Lessons</h1>
          <p className="text-slate-500 mt-1">{lessons.length} lessons</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-md bg-[#2E6CC4]" data-testid="create-lesson-btn"><Plus className="w-4 h-4 mr-2" /> Create Lesson</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Lesson</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required data-testid="lesson-title-input" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} data-testid="lesson-desc-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={form.subject_id} onValueChange={v => setForm({...form, subject_id: v})}>
                    <SelectTrigger data-testid="lesson-subject-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.lesson_type} onValueChange={v => setForm({...form, lesson_type: v})}>
                    <SelectTrigger data-testid="lesson-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="link">External Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(form.lesson_type === 'video' || form.lesson_type === 'pdf' || form.lesson_type === 'link') && (
                <div className="space-y-2">
                  <Label>Content URL</Label>
                  <Input value={form.content_url} onChange={e => setForm({...form, content_url: e.target.value})} placeholder="https://..." data-testid="lesson-url-input" />
                </div>
              )}
              {form.lesson_type === 'text' && (
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea value={form.content_text} onChange={e => setForm({...form, content_text: e.target.value})} rows={5} data-testid="lesson-text-input" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="algebra, basics" data-testid="lesson-tags-input" />
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-lesson-btn">Create Lesson</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lessons.map(l => {
          const Icon = typeIcons[l.lesson_type] || BookOpen;
          return (
            <Card key={l.lesson_id} className="rounded-md border-slate-100 card-hover" data-testid={`lesson-card-${l.lesson_id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#2E6CC4]" />
                  </div>
                  <div className="flex gap-1">
                    <Badge className={l.published ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-slate-100 text-slate-500'}>
                      {l.published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>
                <h3 className="font-semibold text-[#1B2A4A] mb-1 line-clamp-1">{l.title}</h3>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{l.description || 'No description'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{l.subject_name}</span>
                  <span>{l.teacher_name}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {l.tags?.slice(0, 3).map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(l.lesson_id)} data-testid={`delete-lesson-${l.lesson_id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {lessons.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No lessons yet. Create your first lesson.</p>
          </div>
        )}
      </div>
    </div>
  );
}
