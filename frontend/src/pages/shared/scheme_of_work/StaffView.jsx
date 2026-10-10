import React, { useState, useEffect } from 'react';
import { useTerm } from '../../../contexts/TermContext';
import api from '../../../lib/api';
import { AppLoader } from '../../../components/AppLoader';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Plus, Send, FileText, Upload, FolderOpen, CheckCircle,
  Calendar, ChevronRight, RotateCcw, MessageSquare, Sparkles
} from 'lucide-react';
import { STATUS_CONFIG } from './shared';
import CreateScheme from './CreateScheme';
import SchemeEditorView from './SchemeEditorView';

export default function StaffView() {
  const { activeTerm } = useTerm();
  const [view, setView] = useState('dashboard');
  const [schemes, setSchemes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [filter, setFilter] = useState('all');

  const refresh = async () => {
    try {
      const [dRes, sRes, subRes] = await Promise.all([
        api.get('/schemes/my-dashboard'), api.get('/schemes/'), api.get('/academic/subjects'),
      ]);
      setDashboard(dRes.data); setSchemes(sRes.data); setSubjects(subRes.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [activeTerm]);

  if (loading) return <AppLoader />;
  if (view === 'editor' && selectedScheme) return <SchemeEditorView scheme={selectedScheme} subjects={subjects} onBack={() => { setView('dashboard'); setSelectedScheme(null); refresh(); }} />;
  if (view === 'create' || view === 'upload') return <CreateScheme mode={view} subjects={subjects} onBack={() => setView('dashboard')} onCreated={(s, skipAi) => { if (skipAi) { setView('dashboard'); refresh(); } else { setSelectedScheme(s); setView('editor'); } }} />;

  const d = dashboard || {};
  const filtered = filter === 'all' ? schemes : schemes.filter(s => {
    if (filter === 'drafts') return ['draft', 'in_progress'].includes(s.status);
    if (filter === 'submitted') return ['submitted', 'under_review', 'resubmitted'].includes(s.status);
    if (filter === 'returned') return s.status === 'returned';
    if (filter === 'approved') return ['approved', 'published'].includes(s.status);
    return true;
  });

  return (
    <div className="space-y-4 md:space-y-6 p-1" data-testid="scheme-staff-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-[#1B2A4A]">Scheme of Work</h1>
          <p className="text-sm md:text-lg text-slate-500 mt-1">{activeTerm} — Plan, improve, and submit your teaching schemes</p>
        </div>
        <div className="flex gap-2 md:gap-3">
          <Button className="rounded-lg bg-[#2E6CC4] h-10 md:h-12 px-4 md:px-6 text-sm md:text-base" onClick={() => setView('create')} data-testid="create-scheme-btn"><Plus className="w-4 h-4 md:w-5 md:h-5 mr-1.5" /> Create New</Button>
          <Button variant="outline" className="rounded-lg h-10 md:h-12 px-4 md:px-6 text-sm md:text-base" onClick={() => setView('upload')} data-testid="upload-scheme-btn"><Upload className="w-4 h-4 md:w-5 md:h-5 mr-1.5" /> Upload</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {[
          { label: 'Total', value: d.total || 0, icon: FolderOpen, color: '#1B2A4A' },
          { label: 'This Term', value: d.term_schemes || 0, icon: Calendar, color: '#2E6CC4' },
          { label: 'Drafts', value: d.drafts || 0, icon: FileText, color: '#6b7280' },
          { label: 'Submitted', value: d.submitted || 0, icon: Send, color: '#6366f1' },
          { label: 'Returned', value: d.returned || 0, icon: RotateCcw, color: '#ef4444' },
          { label: 'Approved', value: d.approved || 0, icon: CheckCircle, color: '#10b981' },
        ].map(s => (
          <Card key={s.label} className="rounded-lg border-slate-100">
            <CardContent className="p-3 md:p-5 flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '12' }}>
                <s.icon className="w-5 h-5 md:w-7 md:h-7" style={{ color: s.color }} />
              </div>
              <div><p className="text-xl md:text-3xl font-bold" style={{ color: s.color }}>{s.value}</p><p className="text-xs md:text-sm text-slate-400 uppercase">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 md:gap-3 flex-wrap">
        {[{ k: 'all', l: 'All' }, { k: 'drafts', l: 'Drafts' }, { k: 'submitted', l: 'Pending' }, { k: 'returned', l: 'Returned' }, { k: 'approved', l: 'Approved' }].map(f => (
          <Button key={f.k} variant={filter === f.k ? 'default' : 'outline'} size="default" className={`rounded-lg text-sm md:text-base h-9 md:h-11 px-4 md:px-6 ${filter === f.k ? 'bg-[#2E6CC4]' : ''}`} onClick={() => setFilter(f.k)} data-testid={`filter-${f.k}`}>{f.l}</Button>
        ))}
      </div>

      <div className="space-y-3 md:space-y-4">
        {filtered.map(s => {
          const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.draft;
          const Icon = sc.icon;
          return (
            <Card key={s.scheme_id} className="rounded-lg border-slate-100 hover:border-slate-200 transition-all cursor-pointer" onClick={() => { setSelectedScheme(s); setView('editor'); }} data-testid={`scheme-${s.scheme_id}`}>
              <CardContent className="p-3 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${sc.color.split(' ')[0]}`}><Icon className={`w-5 h-5 md:w-6 md:h-6 ${sc.color.split(' ')[1]}`} /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm md:text-lg font-semibold text-[#1B2A4A] truncate">{s.title}</h3>
                      <p className="text-xs md:text-sm text-slate-400 truncate">{s.subject_name} {s.year_group && `| ${s.year_group}`} | {s.term} | v{s.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    {s.ai_processed && <Badge className="bg-blue-100 text-[#2E6CC4] text-[10px] md:text-sm hidden sm:flex"><Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1" />AI</Badge>}
                    <Badge className={`${sc.color} text-[10px] md:text-sm`}>{sc.label}</Badge>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 md:py-20 text-slate-400"><FolderOpen className="w-14 h-14 md:w-20 md:h-20 mx-auto mb-4 text-slate-200" /><p className="text-lg md:text-xl font-medium">No schemes yet</p></div>}
      </div>

      {d.recent_feedback?.length > 0 && (
        <Card className="rounded-lg border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 md:p-5">
            <h3 className="text-sm md:text-base font-bold text-amber-800 mb-3"><MessageSquare className="w-4 h-4 md:w-5 md:h-5 inline mr-2" /> Recent Feedback</h3>
            {d.recent_feedback.map((f, i) => (<div key={i} className="text-xs md:text-sm text-amber-700 py-2 border-b border-amber-100 last:border-0"><strong>{f.user_name}</strong>: {f.text?.slice(0, 100)}{f.text?.length > 100 ? '...' : ''}</div>))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
