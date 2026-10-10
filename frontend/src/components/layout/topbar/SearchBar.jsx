import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Sparkles, GraduationCap, Users, BookOpen, DollarSign, ListTodo } from 'lucide-react';
import api from '../../../lib/api';

const typeIcons = { student: GraduationCap, staff: Users, class: Users, subject: BookOpen, invoice: DollarSign, task: ListTodo, lesson: BookOpen };
const typeColors = { student: 'text-blue-600', staff: 'text-[#C5A55A]', class: 'text-[#2E6CC4]', subject: 'text-amber-600', invoice: 'text-[#2E6CC4]', task: 'text-red-600', lesson: 'text-[#2E6CC4]' };

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setAiAnswer(''); setAiSuggestions([]); return; }
    try {
      const res = await api.get('/search', { params: { q } });
      setResults(res.data.results || []);
      setShowResults(true);
    } catch { setResults([]); }
  }, []);

  const doAiSearch = async () => {
    if (!query || query.length < 3) return;
    setAiLoading(true);
    try {
      const res = await api.get('/search/ai', { params: { q: query } });
      setAiAnswer(res.data.answer || '');
      setAiSuggestions(res.data.suggestions || []);
      if (res.data.results) setResults(res.data.results);
      setShowResults(true);
    } catch { /* fallback */ }
    setAiLoading(false);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  useEffect(() => {
    const handleClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="hidden md:block relative" ref={searchRef}>
      <div className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2 w-64 lg:w-80">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search or ask AI..."
          value={query}
          onChange={handleSearchChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAiSearch(); } }}
          className="bg-transparent border-none outline-none text-sm text-slate-600 placeholder:text-slate-400 w-full"
          data-testid="global-search-input"
        />
        {aiLoading && <div className="w-4 h-4 border-2 border-[#2E6CC4] border-t-transparent rounded-full animate-spin" />}
        {query && !aiLoading && (
          <button onClick={doAiSearch} className="text-[10px] bg-[#2E6CC4] text-white px-2 py-0.5 rounded-md hover:bg-[#2558A3] shrink-0" data-testid="ai-search-btn">AI</button>
        )}
        {query && <button onClick={() => { setQuery(''); setResults([]); setShowResults(false); setAiAnswer(''); setAiSuggestions([]); }}><X className="w-3 h-3 text-slate-400" /></button>}
      </div>
      {showResults && (results.length > 0 || aiAnswer) && (
        <div className="absolute top-full mt-1 w-80 lg:w-96 bg-white rounded-md shadow-lg border border-slate-100 z-50 max-h-[400px] overflow-y-auto" data-testid="search-results">
          {aiAnswer && (
            <div className="px-3 py-2.5 border-b border-slate-100 bg-blue-50/50">
              <div className="flex items-center gap-1.5 mb-1"><Sparkles className="w-3 h-3 text-[#2E6CC4]" /><span className="text-[10px] font-semibold text-[#2E6CC4] uppercase">AI Answer</span></div>
              <p className="text-xs text-[#1B2A4A] leading-relaxed">{aiAnswer}</p>
              {aiSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {aiSuggestions.map((s, i) => (
                    <button key={i} onClick={() => { setQuery(s); doSearch(s); }} className="text-[9px] bg-[#2E6CC4]/10 text-[#2E6CC4] px-2 py-0.5 rounded-full hover:bg-[#2E6CC4]/20">{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {results.map((r, i) => {
            const Icon = typeIcons[r.type] || Search;
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => { setShowResults(false); setQuery(''); setAiAnswer(''); }}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${typeColors[r.type] || 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2A4A] truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 truncate">{r.subtitle} {r.meta && `| ${r.meta}`}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{r.type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
