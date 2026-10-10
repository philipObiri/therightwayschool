import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Plus, BookMarked, Users, ArrowLeft, Search, User, FileText,
  BookOpen, ClipboardList, Presentation, PenSquare, Upload, Eye, Download, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';
import FileViewerModal from '../../components/FileViewerModal';

const BACKEND = import.meta.env.VITE_API_URL;
const getToken = () => localStorage.getItem('rw_token') || '';

const TYPE_CONFIG = {
  lesson: { label: 'Lesson Plan', icon: BookOpen, color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  assignment: { label: 'Assignment', icon: ClipboardList, color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
  scheme_of_work: { label: 'Scheme of Work', icon: PenSquare, color: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  lecture: { label: 'Lecture', icon: Presentation, color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  uploaded_file: { label: 'Uploaded File', icon: Upload, color: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
};

// Subject color palette
const SUBJECT_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', hover: 'hover:border-blue-400 hover:shadow-md' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', hover: 'hover:border-emerald-400 hover:shadow-md' },
  { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', hover: 'hover:border-amber-400 hover:shadow-md' },
  { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', hover: 'hover:border-purple-400 hover:shadow-md' },
  { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600', hover: 'hover:border-rose-400 hover:shadow-md' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'text-cyan-600', hover: 'hover:border-cyan-400 hover:shadow-md' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:border-indigo-400 hover:shadow-md' },
  { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', hover: 'hover:border-orange-400 hover:shadow-md' },
];

export default function AcademicsPage() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [classDialog, setClassDialog] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', department: '' });
  const [classForm, setClassForm] = useState({ name: '', year_group: '', form_teacher_id: '' });

  // Drill-down state
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectTeachers, setSubjectTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherFiles, setTeacherFiles] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewingFile, setViewingFile] = useState(null);
  const [contentViewer, setContentViewer] = useState(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState(null); // { doc, content, loading }

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [subjRes, clsRes, staffRes] = await Promise.all([
        api.get('/academic/subjects'),
        api.get('/academic/classes'),
        api.get('/admin/staff'),
      ]);
      setSubjects(subjRes.data);
      setClasses(clsRes.data);
      setTeachers(staffRes.data.filter(s => s.role === 'Teacher' || s.role === 'HeadOfAcademics'));
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/academic/subjects', subjectForm);
      successToast('Subject created');
      setSubjectDialog(false);
      setSubjectForm({ name: '', code: '', department: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    try {
      await api.post('/academic/classes', classForm);
      successToast('Class created');
      setClassDialog(false);
      setClassForm({ name: '', year_group: '', form_teacher_id: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  // Drill into a subject -> get teachers
  const openSubject = async (subj) => {
    setSelectedSubject(subj);
    setSelectedTeacher(null);
    setTeacherFiles([]);
    setDrillLoading(true);
    try {
      const r = await api.get(`/academic/subjects/${encodeURIComponent(subj.name)}/teachers`);
      setSubjectTeachers(r.data);
    } catch { toast.error('Failed to load teachers'); setSubjectTeachers([]); }
    setDrillLoading(false);
  };

  // Drill into a teacher -> get all files
  const openTeacher = async (teacher) => {
    setSelectedTeacher(teacher);
    setActiveTypeFilter(null);
    setDrillLoading(true);
    try {
      const r = await api.get(`/academic/subjects/${encodeURIComponent(selectedSubject.name)}/teacher/${teacher.user_id}/files`);
      setTeacherFiles(r.data);
    } catch { toast.error('Failed to load files'); setTeacherFiles([]); }
    setDrillLoading(false);
  };

  const goBack = () => {
    if (selectedTeacher) { setSelectedTeacher(null); setTeacherFiles([]); }
    else if (selectedSubject) { setSelectedSubject(null); setSubjectTeachers([]); }
  };

  const openFilePreview = (fileId) => {
    const token = getToken();
    setViewingFile(`${BACKEND}/api/files/${fileId}/download?token=${token}`);
  };

  // Open a document — fetch its full content and show in viewer
  const openDocument = async (doc) => {
    // If it has attached files, open the first one directly
    const allFileIds = [
      ...(doc.file_ids || []).map(f => typeof f === 'string' ? f : f?.file_id).filter(Boolean),
      ...(doc.original_file_id ? [doc.original_file_id] : []),
    ];

    // For uploaded files with only file_ids, open file viewer directly
    if (doc.type === 'uploaded_file' && allFileIds.length > 0) {
      openFilePreview(allFileIds[0]);
      return;
    }

    // For content-based docs — fetch full content
    setContentViewer({ doc, content: null, loading: true, fileIds: allFileIds });
    try {
      let endpoint;
      if (doc.type === 'scheme_of_work') endpoint = 'schemes';
      else if (doc.type === 'lesson') endpoint = 'lessons-v2';
      else if (doc.type === 'lecture') endpoint = 'lectures';
      else endpoint = 'assignments';

      const r = await api.get(`/${endpoint}/${doc.doc_id}`);
      const data = r.data;

      let html = '';

      if (doc.type === 'scheme_of_work') {
        // Schemes use rich_content which is already a full HTML table
        html = data.rich_content || '';
        // Fallback: build from weeks if no rich_content
        if (!html && data.weeks && Array.isArray(data.weeks) && data.weeks.length > 0) {
          html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#1B2A4A;color:white;">' +
            '<th style="padding:8px;border:1px solid #334155;">Week</th><th style="padding:8px;border:1px solid #334155;">Topic</th>' +
            '<th style="padding:8px;border:1px solid #334155;">Objectives</th><th style="padding:8px;border:1px solid #334155;">Activities</th>' +
            '<th style="padding:8px;border:1px solid #334155;">Assessment</th><th style="padding:8px;border:1px solid #334155;">Resources</th></tr></thead><tbody>' +
            data.weeks.map((w, i) =>
              `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;">${w.week_number || i+1}</td>` +
              `<td style="padding:8px;border:1px solid #e2e8f0;">${w.topic || ''}</td>` +
              `<td style="padding:8px;border:1px solid #e2e8f0;">${w.objectives || ''}</td>` +
              `<td style="padding:8px;border:1px solid #e2e8f0;">${w.activities || ''}</td>` +
              `<td style="padding:8px;border:1px solid #e2e8f0;">${w.assessment || ''}</td>` +
              `<td style="padding:8px;border:1px solid #e2e8f0;">${w.resources || ''}</td></tr>`
            ).join('') + '</tbody></table>';
        }
        // Add title header
        if (html) {
          html = `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <h2 style="margin:0;color:#1B2A4A;">${data.title || data.subject_name || 'Scheme of Work'}</h2>
            <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${data.subject_name || ''} | ${data.year_group || ''} | ${data.term || ''} ${data.academic_year || ''} | ${data.teacher_name || ''}</p>
          </div>` + html;
        }
      } else if (doc.type === 'lesson') {
        // Lessons use rich_content as primary HTML content
        html = data.rich_content || data.content_html || data.content_text || '';
        if (html) {
          html = `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <h2 style="margin:0;color:#1B2A4A;">${data.title || 'Lesson Plan'}</h2>
            <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${data.subject_name || ''} | ${data.year_group || ''} | ${data.teacher_name || ''}</p>
            ${data.objectives ? `<p style="margin:8px 0 0;"><strong>Objectives:</strong> ${data.objectives}</p>` : ''}
          </div>` + html;
        }
      } else if (doc.type === 'lecture') {
        html = data.rich_content || '';
        if (!html && data.slides && Array.isArray(data.slides) && data.slides.length > 0) {
          html = data.slides.map((s, i) =>
            `<div style="margin-bottom:24px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
              <h3 style="margin:0 0 8px;color:#1B2A4A;">Slide ${i+1}${s.title ? ': ' + s.title : ''}</h3>
              <div>${s.content || s.content_html || ''}</div>
            </div>`
          ).join('');
        }
        if (html) {
          html = `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <h2 style="margin:0;color:#1B2A4A;">${data.title || 'Lecture'}</h2>
            <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${data.subject || ''} | ${data.year_group || ''} | ${data.teacher_name || ''}</p>
          </div>` + html;
        }
      } else if (doc.type === 'assignment') {
        const parts = [];
        if (data.instructions) parts.push(data.instructions);
        if (data.description) parts.push(data.description);
        if (data.rich_content) parts.push(data.rich_content);
        html = parts.join('<hr style="margin:12px 0"/>');
        if (html) {
          html = `<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <h2 style="margin:0;color:#1B2A4A;">${data.title || 'Assignment'}</h2>
            <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${data.subject || ''} | ${data.year_group || ''}</p>
          </div>` + html;
        }
      }

      if (!html) {
        html = '<div style="text-align:center;padding:40px 0;color:#94a3b8;">No viewable content found — check attached files below</div>';
      }

      setContentViewer(prev => ({ ...prev, content: html, loading: false }));
    } catch (err) {
      setContentViewer(prev => ({ ...prev, content: `<p style="color:#ef4444;text-align:center;padding:40px 0">Failed to load document: ${err.response?.data?.detail || 'Unknown error'}</p>`, loading: false }));
    }
  };

  const filteredSubjects = search
    ? subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.code || '').toLowerCase().includes(search.toLowerCase()))
    : subjects;

  if (loading) return <AppLoader />;

  // ─── LEVEL 3: Teacher's Files ───
  if (selectedSubject && selectedTeacher) {
    const filesByType = {};
    teacherFiles.forEach(f => { if (!filesByType[f.type]) filesByType[f.type] = []; filesByType[f.type].push(f); });

    return (
      <div className="space-y-6" data-testid="teacher-files-view">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} data-testid="back-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">{selectedTeacher.name}</h1>
            <p className="text-sm text-slate-500">{selectedSubject.name} &middot; All Documents & Files</p>
          </div>
        </div>

        {/* Summary cards - CLICKABLE */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const count = (filesByType[key] || []).length;
            const isActive = activeTypeFilter === key;
            return (
              <Card
                key={key}
                className={`rounded-md border cursor-pointer transition-all ${isActive ? `${cfg.border} ring-2 ring-offset-1 ring-${cfg.border.replace('border-','')} shadow-md` : `${cfg.border} hover:shadow-md`} ${count > 0 ? '' : 'opacity-50'}`}
                onClick={() => {
                  if (count > 0) setActiveTypeFilter(isActive ? null : key);
                }}
                data-testid={`type-card-${key}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-md ${cfg.color} flex items-center justify-center`}>
                    <cfg.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#1B2A4A]">{count}</p>
                    <p className="text-[10px] text-slate-500">{cfg.label}s</p>
                  </div>
                  {count > 0 && <Eye className="w-3.5 h-3.5 text-slate-300 ml-auto" />}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {activeTypeFilter && (
          <div className="flex items-center gap-2">
            <Badge className={`${(TYPE_CONFIG[activeTypeFilter] || {}).color || 'bg-slate-100'} text-xs`}>
              Showing: {(TYPE_CONFIG[activeTypeFilter] || {}).label || activeTypeFilter}s
            </Badge>
            <button onClick={() => setActiveTypeFilter(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">Show all</button>
          </div>
        )}

        {drillLoading ? <AppLoader /> : teacherFiles.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents found for this teacher in {selectedSubject.name}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(filesByType)
              .filter(([type]) => !activeTypeFilter || type === activeTypeFilter)
              .map(([type, docs]) => {
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.uploaded_file;
              return (
                <div key={type}>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <cfg.icon className="w-4 h-4" /> {cfg.label}s ({docs.length})
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {docs.map(doc => (
                      <Card
                        key={doc.doc_id}
                        className={`rounded-md border ${cfg.border} hover:shadow-md transition-shadow cursor-pointer`}
                        onClick={() => openDocument(doc)}
                        data-testid={`doc-card-${doc.doc_id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-md ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                              <cfg.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#1B2A4A] truncate">{doc.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {doc.year_group && <Badge variant="secondary" className="text-[9px]">{doc.year_group}</Badge>}
                                {doc.status && <Badge className={`text-[9px] ${doc.status === 'approved' || doc.status === 'published' ? 'bg-green-100 text-green-700' : doc.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{doc.status}</Badge>}
                              </div>
                              {doc.created_at && <p className="text-[10px] text-slate-400 mt-1">{new Date(doc.created_at).toLocaleDateString('en-GB')}</p>}
                            </div>
                            <Eye className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                          </div>

                          {/* File count indicator */}
                          {((doc.file_ids || []).length > 0 || doc.original_file_id) && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {(doc.file_ids || []).length + (doc.original_file_id ? 1 : 0)} attached file(s)
                                {doc.has_content && <span>&middot; Has content</span>}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewingFile && <FileViewerModal url={viewingFile} onClose={() => setViewingFile(null)} />}

        {/* Document Content Viewer Dialog */}
        <Dialog open={!!contentViewer} onOpenChange={(v) => { if (!v) setContentViewer(null); }}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {contentViewer?.doc && (() => {
                  const cfg = TYPE_CONFIG[contentViewer.doc.type] || TYPE_CONFIG.uploaded_file;
                  return <>
                    <div className={`w-7 h-7 rounded-md ${cfg.color} flex items-center justify-center flex-shrink-0`}><cfg.icon className="w-4 h-4" /></div>
                    <span className="truncate">{contentViewer.doc.title}</span>
                    <Badge className={`text-[9px] ml-2 ${cfg.color}`}>{cfg.label}</Badge>
                  </>;
                })()}
              </DialogTitle>
              {contentViewer?.doc && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {contentViewer.doc.year_group && <span>{contentViewer.doc.year_group}</span>}
                  {contentViewer.doc.subject && <span>&middot; {contentViewer.doc.subject}</span>}
                  {contentViewer.doc.created_at && <span>&middot; {new Date(contentViewer.doc.created_at).toLocaleDateString('en-GB')}</span>}
                </div>
              )}
            </DialogHeader>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto min-h-0 border rounded-md bg-white">
              {contentViewer?.loading ? (
                <div className="flex items-center justify-center py-20"><AppLoader /></div>
              ) : (
                <div
                  className="p-6"
                  style={{ fontSize: '14px', lineHeight: '1.7' }}
                >
                  <style>{`
                    .doc-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                    .doc-content table th { background: #1B2A4A; color: white; padding: 10px 12px; text-align: left; border: 1px solid #334155; font-size: 13px; font-weight: 600; }
                    .doc-content table td { padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
                    .doc-content table tr:nth-child(even) { background: #f8fafc; }
                    .doc-content table tr:hover { background: #eff6ff; }
                    .doc-content table ul { margin: 4px 0; padding-left: 18px; }
                    .doc-content table li { margin-bottom: 4px; }
                    .doc-content h1, .doc-content h2, .doc-content h3 { color: #1B2A4A; margin-top: 16px; }
                    .doc-content p { margin: 8px 0; }
                    .doc-content strong { color: #1e293b; }
                  `}</style>
                  <div className="doc-content" dangerouslySetInnerHTML={{ __html: contentViewer?.content || '' }} />
                </div>
              )}
            </div>

            {/* Attached files buttons */}
            {contentViewer?.fileIds?.length > 0 && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold self-center mr-1">Attached Files:</span>
                {contentViewer.fileIds.map((fid, fi) => (
                  <Button key={fi} size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setContentViewer(null); openFilePreview(fid); }} data-testid={`content-file-${fi}`}>
                    <FileText className="w-3.5 h-3.5 mr-1" /> Open File {fi + 1}
                  </Button>
                ))}
                {contentViewer.fileIds.map((fid, fi) => (
                  <a key={`dl-${fi}`} href={`${BACKEND}/api/files/${fid}/download?token=${getToken()}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-[#C5A55A]">
                      <Download className="w-3.5 h-3.5 mr-1" /> Download {fi + 1}
                    </Button>
                  </a>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── LEVEL 2: Subject's Teachers ───
  if (selectedSubject) {
    return (
      <div className="space-y-6" data-testid="subject-teachers-view">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} data-testid="back-btn"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Subjects</Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">{selectedSubject.name}</h1>
            <p className="text-sm text-slate-500">Code: {selectedSubject.code} &middot; {selectedSubject.department || 'General'} &middot; Select a teacher to view their files</p>
          </div>
        </div>

        {drillLoading ? <AppLoader /> : subjectTeachers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No teachers found for {selectedSubject.name}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectTeachers.map((t, i) => (
              <Card
                key={t.user_id}
                className="rounded-md border border-slate-200 hover:border-[#2E6CC4] hover:shadow-md transition-all cursor-pointer"
                onClick={() => openTeacher(t)}
                data-testid={`teacher-tile-${t.user_id}`}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white font-bold text-lg">
                    {t.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-[#1B2A4A] truncate">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.department || 'Teacher'}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-300" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── LEVEL 1: Subject Tiles + Classes Tab ───
  return (
    <div className="space-y-6" data-testid="academics-page">
      <h1 className="text-2xl font-bold text-[#1B2A4A]">Academic Management</h1>

      <Tabs defaultValue="subjects">
        <TabsList className="bg-white border" data-testid="academics-tabs">
          <TabsTrigger value="subjects" data-testid="subjects-tab">Subjects ({subjects.length})</TabsTrigger>
          <TabsTrigger value="classes" data-testid="classes-tab">Classes ({classes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search subjects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="subject-search"
              />
            </div>
            <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-md bg-[#2E6CC4]" data-testid="add-subject-btn"><Plus className="w-4 h-4 mr-2" /> Add Subject</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
                <form onSubmit={handleAddSubject} className="space-y-4">
                  <div className="space-y-2"><Label>Name</Label><Input value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} required data-testid="subject-name-input" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Code</Label><Input value={subjectForm.code} onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} required data-testid="subject-code-input" /></div>
                    <div className="space-y-2"><Label>Department</Label><Input value={subjectForm.department} onChange={e => setSubjectForm({...subjectForm, department: e.target.value})} data-testid="subject-dept-input" /></div>
                  </div>
                  <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-subject-btn">Create Subject</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Subject Tiles Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
            {filteredSubjects.map((s, i) => {
              const c = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
              return (
                <div
                  key={s.subject_id}
                  onClick={() => openSubject(s)}
                  className={`${c.bg} border ${c.border} rounded-lg p-5 cursor-pointer transition-all ${c.hover} group`}
                  data-testid={`subject-tile-${s.subject_id}`}
                >
                  <div className={`w-11 h-11 rounded-lg bg-white/80 flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform`}>
                    <BookMarked className={`w-5 h-5 ${c.icon}`} />
                  </div>
                  <h3 className="text-base font-bold text-[#1B2A4A] mb-0.5">{s.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px] bg-white/60">{s.code}</Badge>
                    {s.department && <span className="text-[10px] text-slate-500">{s.department}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredSubjects.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <BookMarked className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? 'No subjects match your search' : 'No subjects added yet'}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="classes" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={classDialog} onOpenChange={setClassDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-md bg-[#2E6CC4]" data-testid="add-class-btn"><Plus className="w-4 h-4 mr-2" /> Add Class</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
                <form onSubmit={handleAddClass} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Name</Label><Input value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} required data-testid="class-name-input" /></div>
                    <div className="space-y-2"><Label>Year Group</Label><Input value={classForm.year_group} onChange={e => setClassForm({...classForm, year_group: e.target.value})} required data-testid="class-year-input" /></div>
                  </div>
                  <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-class-btn">Create Class</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-md border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="bg-slate-50">Class</TableHead>
                <TableHead className="bg-slate-50">Year Group</TableHead>
                <TableHead className="bg-slate-50">Students</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {classes.map(c => (
                  <TableRow key={c.class_id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#19C37D]" /> {c.name}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{c.year_group}</Badge></TableCell>
                    <TableCell className="text-slate-500">{c.student_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
