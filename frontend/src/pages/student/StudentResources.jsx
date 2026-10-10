import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FolderOpen, FileText, BookOpen, ClipboardList, GraduationCap, ArrowLeft, Download, Eye } from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;
const typeIcons = { past_paper: FileText, syllabus: GraduationCap, scheme_of_work: BookOpen, revision_notes: BookOpen, test: ClipboardList, worksheet: FileText, other: FolderOpen };
const typeColors = { past_paper: 'bg-indigo-50 text-indigo-600', syllabus: 'bg-blue-50 text-[#2E6CC4]', scheme_of_work: 'bg-[#C5A55A]/10 text-[#C5A55A]', revision_notes: 'bg-blue-50 text-blue-600', test: 'bg-red-50 text-red-600', worksheet: 'bg-amber-50 text-amber-600', other: 'bg-slate-50 text-slate-600' };

export default function StudentResources() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewingPdf, setViewingPdf] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    api.get('/lms/resources/student').then(r => setResources(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const viewPdf = (resource) => {
    if (resource.file_ids?.length > 0) {
      const token = localStorage.getItem('rw_token');
      const previewUrl = `${BACKEND}/api/files/${resource.file_ids[0]}/preview?token=${encodeURIComponent(token)}`;
      setPdfUrl(previewUrl);
      setViewingPdf(resource);
    }
  };

  const closePdf = () => { setPdfUrl(null); setViewingPdf(null); };

  if (loading) return <AppLoader />;

  if (viewingPdf && pdfUrl) {
    return (
      <div className="space-y-4" data-testid="resource-pdf-view">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={closePdf}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[#1B2A4A]">{viewingPdf.title}</h2>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2E6CC4] hover:underline">Open in New Tab</a>
            <a href={pdfUrl.replace('/preview?', '/download?')} className="text-xs text-[#C5A55A] hover:underline"><Download className="w-3 h-3 inline mr-1" />Download</a>
          </div>
        </div>
        <div className="bg-white rounded-md border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 14rem)' }}>
          <iframe src={pdfUrl} title={viewingPdf.title} className="w-full h-full border-0" sandbox="allow-same-origin allow-scripts allow-popups" />
        </div>
        <p className="text-xs text-slate-400 text-center">If the document doesn't display, click "Open in New Tab" or "Download".</p>
      </div>
    );
  }

  const types = ['all', 'past_paper', 'syllabus', 'scheme_of_work', 'revision_notes', 'worksheet', 'test'];
  const filtered = filter === 'all' ? resources : resources.filter(r => r.resource_type === filter);

  return (
    <div className="space-y-6" data-testid="student-resources">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">My Resources</h1>
        <p className="text-slate-500 mt-1">{resources.length} resources shared by your teachers</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <Button key={t} size="sm" variant={filter === t ? 'default' : 'outline'} className={`rounded-md text-xs ${filter === t ? 'bg-[#2E6CC4]' : ''}`} onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ({t === 'all' ? resources.length : resources.filter(r => r.resource_type === t).length})
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => {
          const Icon = typeIcons[r.resource_type] || FolderOpen;
          const color = typeColors[r.resource_type] || typeColors.other;
          const hasPdf = r.file_ids?.length > 0;
          return (
            <Card key={r.resource_id} className={`rounded-md border-slate-200 card-hover ${hasPdf ? 'cursor-pointer' : ''}`} onClick={hasPdf ? () => viewPdf(r) : undefined} data-testid={`res-${r.resource_id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center ${color.split(' ')[0]}`}><Icon className={`w-5 h-5 ${color.split(' ')[1]}`} /></div>
                  <div className="flex gap-1">
                    {hasPdf && <Badge className="bg-red-100 text-red-700 text-[9px]">PDF</Badge>}
                    <Badge variant="secondary" className="capitalize text-[9px]">{r.resource_type?.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-[#1B2A4A] line-clamp-2">{r.title}</h3>
                <p className="text-[10px] text-slate-400 mt-1">By {r.teacher_name}</p>
                {hasPdf && <p className="text-[10px] text-[#2E6CC4] mt-2 flex items-center gap-1"><Eye className="w-3 h-3" /> Click to view</p>}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400"><FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="text-sm">No resources published to your class yet</p></div>}
      </div>
    </div>
  );
}
