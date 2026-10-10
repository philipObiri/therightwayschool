import React, { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { AppLoader } from '../../components/AppLoader';
import {
  BookOpen, Search, Eye, FileText, Shield, Users,
  Tag, Filter, Download, ChevronRight, BarChart3, Star
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL;

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [view, setView] = useState('grid');

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (query) params.q = query;
      if (category) params.category = category;
      if (department) params.department = department;
      const r = await api.get('/knowledge-base/articles', { params });
      setArticles(r.data);
    } catch (_) { toast.error('Failed to load articles'); }
    setLoading(false);
  }, [query, category, department]);

  const loadMeta = async () => {
    try {
      const [cats, st] = await Promise.all([
        api.get('/knowledge-base/categories'),
        api.get('/knowledge-base/stats'),
      ]);
      setCategories(cats.data.categories || []);
      setDepartments(cats.data.departments || []);
      setStats(st.data);
    } catch (_) {}
  };

  useEffect(() => { loadArticles(); }, [loadArticles]);
  useEffect(() => { loadMeta(); }, []);

  const openArticle = async (id) => {
    try {
      const r = await api.get(`/knowledge-base/articles/${id}`);
      setSelectedArticle(r.data);
    } catch (_) { toast.error('Failed to load article'); }
  };

  const token = localStorage.getItem('rw_token');

  if (selectedArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto" data-testid="kb-article-view">
        <button onClick={() => setSelectedArticle(null)} className="text-xs text-[#2E6CC4] hover:underline mb-4 flex items-center gap-1" data-testid="kb-back-btn">
          <ChevronRight className="w-3 h-3 rotate-180" /> Back to Knowledge Base
        </button>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#1B2A4A]">{selectedArticle.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500">By {selectedArticle.author_name}</span>
                <Badge className="text-[9px]">{selectedArticle.category}</Badge>
                {selectedArticle.watermark && <Badge className="bg-amber-50 text-amber-700 text-[9px] border-amber-200">{selectedArticle.watermark}</Badge>}
                <span className="text-[10px] text-slate-400"><Eye className="w-3 h-3 inline mr-0.5" />{selectedArticle.views} views</span>
              </div>
            </div>
            {selectedArticle.file_id && (
              <a href={`${BACKEND}/api/files/${selectedArticle.file_id}/download?token=${token}`} target="_blank" rel="noreferrer" className="text-xs text-[#2E6CC4] hover:underline flex items-center gap-1" data-testid="kb-download-btn"><Download className="w-3 h-3" /> Download</a>
            )}
          </div>
          {selectedArticle.description && <p className="text-sm text-slate-600 mb-4">{selectedArticle.description}</p>}
          {selectedArticle.tags?.length > 0 && (
            <div className="flex items-center gap-1 mb-4">
              <Tag className="w-3 h-3 text-slate-400" />
              {selectedArticle.tags.map(t => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}
            </div>
          )}
          {selectedArticle.file_id && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <embed src={`${BACKEND}/api/files/${selectedArticle.file_id}/preview?token=${token}`} type={selectedArticle.file_type === 'pdf' ? 'application/pdf' : ''} className="w-full h-[600px] rounded-lg" />
            </div>
          )}
          {selectedArticle.signatures?.length > 0 && (
            <div className="mt-4 p-3 bg-[#C5A55A]/10 rounded-lg border border-[#C5A55A]/20">
              <h4 className="text-xs font-semibold text-[#1B2A4A] mb-2"><Shield className="w-3 h-3 inline mr-1" />{selectedArticle.signatures.length} Digital Signature(s)</h4>
              {selectedArticle.signatures.map((s, i) => <p key={i} className="text-[10px] text-[#C5A55A]">{s.signer_name} — {s.reason}</p>)}
            </div>
          )}
          {selectedArticle.comments?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[#1B2A4A] mb-2">Comments ({selectedArticle.comments.length})</h4>
              {selectedArticle.comments.map((c, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 mb-1">
                  <p className="text-[10px] font-medium text-[#1B2A4A]">{c.author_name}</p>
                  <p className="text-[10px] text-slate-600">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto" data-testid="knowledge-base-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] flex items-center gap-2"><BookOpen className="w-6 h-6 text-[#2E6CC4]" /> Knowledge Base</h1>
          <p className="text-sm text-slate-500">Institutional documents & approved resources</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Articles" value={stats.total_articles} icon={FileText} color="text-[#2E6CC4]" bg="bg-blue-50" />
          <StatCard label="Total Views" value={stats.total_views} icon={Eye} color="text-[#C5A55A]" bg="bg-[#C5A55A]/10" />
          <StatCard label="Categories" value={categories.length} icon={Tag} color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Departments" value={departments.length} icon={Users} color="text-[#2E6CC4]" bg="bg-blue-50" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search articles..." className="pl-10 h-9 text-xs rounded-lg" data-testid="kb-search-input" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white" data-testid="kb-category-filter">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={department} onChange={e => setDepartment(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white" data-testid="kb-dept-filter">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Articles Grid */}
      {loading ? <AppLoader size="sm" /> : articles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No approved articles found</p>
          <p className="text-xs text-slate-400 mt-1">Documents approved in Working Paper will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4" data-testid="kb-articles-grid">
          {articles.map(a => (
            <div key={a.article_id} onClick={() => openArticle(a.article_id)} className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-[#2E6CC4]/30 hover:shadow-md transition-all group" data-testid={`kb-article-${a.article_id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-[#2E6CC4]/10 flex items-center justify-center shrink-0 group-hover:bg-[#2E6CC4]/20 transition-colors">
                  <FileText className="w-5 h-5 text-[#2E6CC4]" />
                </div>
                <div className="flex items-center gap-1">
                  {a.watermark && <Badge className="text-[8px] bg-amber-50 text-amber-700 border-amber-200">{a.watermark}</Badge>}
                  {a.signatures_count > 0 && <Badge className="text-[8px] bg-[#C5A55A]/10 text-[#C5A55A] border-[#C5A55A]/30"><Shield className="w-2 h-2 inline mr-0.5" />{a.signatures_count}</Badge>}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-[#1B2A4A] mb-1 line-clamp-2 group-hover:text-[#2E6CC4] transition-colors">{a.title}</h3>
              {a.description && <p className="text-[10px] text-slate-500 line-clamp-2 mb-2">{a.description}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[8px]">{a.category}</Badge>
                  {a.department && <span className="text-[9px] text-slate-400">{a.department}</span>}
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                  <span><Eye className="w-3 h-3 inline mr-0.5" />{a.views || 0}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[9px] text-slate-400">
                <span>By {a.author_name}</span>
                {a.approved_at && <span>· {new Date(a.approved_at).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Popular Articles Sidebar */}
      {stats?.popular_articles?.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-[#1B2A4A] mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Most Viewed</h3>
          <div className="flex gap-4">
            {stats.popular_articles.map(a => (
              <div key={a.document_id} className="flex items-center gap-2 text-xs text-slate-600 hover:text-[#2E6CC4] cursor-pointer" onClick={() => openArticle(a.document_id)}>
                <BarChart3 className="w-3 h-3 text-amber-500" />
                <span>{a.title}</span>
                <Badge className="text-[8px] bg-slate-100">{a.kb_views} views</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3" data-testid={`kb-stat-${label.toLowerCase().replace(/ /g, '-')}`}>
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${color}`} /></div>
      <div><p className="text-lg font-bold text-[#1B2A4A]">{value}</p><p className="text-[10px] text-slate-500">{label}</p></div>
    </div>
  );
}
