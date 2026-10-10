import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import {
  ArrowUpCircle, Users, Search, GraduationCap, TrendingUp,
  ChevronRight, AlertTriangle, Loader2, CheckCircle, Trophy, Medal
} from 'lucide-react';

const YEAR_ORDER = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];
const NEXT_YEAR = { 'Year 7': 'Year 8', 'Year 8': 'Year 9', 'Year 9': 'Year 10', 'Year 10': 'Year 11', 'Year 11': 'Year 12', 'Year 12': 'Year 13' };

function gradeColor(grade) {
  if (!grade) return 'bg-slate-100 text-slate-500';
  if (grade === 'A*') return 'bg-[#C5A55A]/15 text-[#C5A55A]';
  if (grade === 'A') return 'bg-[#C5A55A]/15 text-[#C5A55A]';
  if (grade === 'B+') return 'bg-[#2E6CC4]/10 text-[#2E6CC4]';
  if (grade === 'B') return 'bg-[#2E6CC4]/10 text-[#2E6CC4]';
  if (grade === 'C+' || grade === 'C') return 'bg-blue-100 text-blue-600';
  if (grade === 'D') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

function rankBadge(index) {
  if (index === 0) return <Trophy className="w-4 h-4 text-[#C5A55A]" />;
  if (index === 1) return <Medal className="w-4 h-4 text-slate-400" />;
  if (index === 2) return <Medal className="w-4 h-4 text-amber-600" />;
  return <span className="text-[10px] font-bold text-slate-400 w-4 text-center">{index + 1}</span>;
}

export default function StudentPromotion() {
  const { activeTerm } = useTerm();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedYear, setSelectedYear] = useState('Year 7');
  const [selectedTerm, setSelectedTerm] = useState(activeTerm || 'Term 1');
  const [targetYear, setTargetYear] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [mode, setMode] = useState('individual'); // 'individual' | 'bulk'

  useEffect(() => { if (activeTerm) setSelectedTerm(activeTerm); }, [activeTerm]);

  useEffect(() => {
    setTargetYear(NEXT_YEAR[selectedYear] || '');
    setSelected(new Set());
    loadStudents();
  }, [selectedYear, selectedTerm]);

  useEffect(() => {
    api.get('/academic/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/promotion/students?year_group=${encodeURIComponent(selectedYear)}&term=${encodeURIComponent(selectedTerm)}`);
      setStudents(r.data || []);
    } catch { toast.error('Failed to load students'); }
    setLoading(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.user_id)));
  };

  const handlePromote = async () => {
    if (!targetYear) { toast.error('Select a target year group'); return; }
    const ids = mode === 'bulk' ? students.map(s => s.user_id) : [...selected];
    if (ids.length === 0) { toast.error('No students selected'); return; }

    const confirmMsg = mode === 'bulk'
      ? `Promote ALL ${students.length} students from ${selectedYear} to ${targetYear}?`
      : `Promote ${ids.length} selected student(s) to ${targetYear}?`;
    if (!window.confirm(confirmMsg)) return;

    setPromoting(true);
    try {
      const endpoint = mode === 'bulk' ? '/admin/promotion/bulk' : '/admin/promotion/promote';
      const payload = mode === 'bulk'
        ? { source_year_group: selectedYear, target_year_group: targetYear, target_class_id: targetClass }
        : { student_ids: ids, target_year_group: targetYear, target_class_id: targetClass };
      const r = await api.post(endpoint, payload);
      successToast(`Promoted ${r.data.promoted} students to ${targetYear}`);
      loadStudents();
      setSelected(new Set());
    } catch (err) { toast.error(err.response?.data?.detail || 'Promotion failed'); }
    setPromoting(false);
  };

  const filtered = searchQ
    ? students.filter(s => s.name?.toLowerCase().includes(searchQ.toLowerCase()) || s.admission_number?.toLowerCase().includes(searchQ.toLowerCase()))
    : students;

  const targetClasses = classes.filter(c => c.year_group === targetYear);
  const stats = {
    total: students.length,
    graded: students.filter(s => s.avg_score != null).length,
    avgScore: students.filter(s => s.avg_score != null).length > 0
      ? (students.filter(s => s.avg_score != null).reduce((a, s) => a + s.avg_score, 0) / students.filter(s => s.avg_score != null).length).toFixed(1)
      : 'N/A',
    topPerformers: students.filter(s => s.grade === 'A' || s.grade === 'B').length,
  };

  return (
    <div className="space-y-6" data-testid="student-promotion">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#1B2A4A]" style={{ fontFamily: 'Outfit, sans-serif' }}>Student Promotion</h1>
          <p className="text-xs md:text-sm text-slate-500">Promote students by exam performance — individual or bulk</p>
        </div>
      </div>

      {/* Year Group Selector + Term */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1 bg-[#1B2A4A]/5 rounded-xl p-1 flex-wrap flex-1">
          {YEAR_ORDER.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedYear === y ? 'bg-[#1B2A4A] text-white shadow-sm' : 'text-slate-600 hover:text-[#1B2A4A] hover:bg-white'}`}
              data-testid={`promo-year-${y.replace(' ', '-')}`}
            >{y} <span className="text-[10px] opacity-60">({students.length > 0 && selectedYear === y ? students.length : ''})</span></button>
          ))}
        </div>
        <div className="w-36">
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="rounded-lg h-9 text-xs" data-testid="promo-term-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Term 1">Term 1</SelectItem>
              <SelectItem value="Term 2">Term 2</SelectItem>
              <SelectItem value="Term 3">Term 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-xl border-slate-200/60"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1B2A4A]/5 flex items-center justify-center"><Users className="w-5 h-5 text-[#1B2A4A]" /></div>
          <div><p className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'Outfit' }}>{stats.total}</p><p className="text-[10px] text-slate-500 uppercase">Total Students</p></div>
        </CardContent></Card>
        <Card className="rounded-xl border-slate-200/60"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2E6CC4]/10 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-[#2E6CC4]" /></div>
          <div><p className="text-2xl font-bold text-[#2E6CC4]" style={{ fontFamily: 'Outfit' }}>{stats.graded}</p><p className="text-[10px] text-slate-500 uppercase">Graded</p></div>
        </CardContent></Card>
        <Card className="rounded-xl border-slate-200/60"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C5A55A]/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#C5A55A]" /></div>
          <div><p className="text-2xl font-bold text-[#C5A55A]" style={{ fontFamily: 'Outfit' }}>{stats.avgScore}%</p><p className="text-[10px] text-slate-500 uppercase">Avg Score</p></div>
        </CardContent></Card>
        <Card className="rounded-xl border-slate-200/60"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C5A55A]/10 flex items-center justify-center"><Trophy className="w-5 h-5 text-[#C5A55A]" /></div>
          <div><p className="text-2xl font-bold text-[#C5A55A]" style={{ fontFamily: 'Outfit' }}>{stats.topPerformers}</p><p className="text-[10px] text-slate-500 uppercase">A/B Performers</p></div>
        </CardContent></Card>
      </div>

      {/* Promotion Controls */}
      <Card className="rounded-xl border-[#C5A55A]/30 bg-[#C5A55A]/5">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Mode</p>
                <div className="flex gap-1 bg-white rounded-lg p-0.5 border border-slate-200">
                  <button onClick={() => setMode('individual')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'individual' ? 'bg-[#1B2A4A] text-white' : 'text-slate-600'}`} data-testid="mode-individual">Individual</button>
                  <button onClick={() => setMode('bulk')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'bulk' ? 'bg-[#1B2A4A] text-white' : 'text-slate-600'}`} data-testid="mode-bulk">Bulk (All)</button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Target Year</p>
                <Select value={targetYear} onValueChange={setTargetYear}>
                  <SelectTrigger className="rounded-lg h-9 text-xs" data-testid="target-year-select"><SelectValue placeholder="Select target" /></SelectTrigger>
                  <SelectContent>{YEAR_ORDER.filter(y => y !== selectedYear).map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Target Class (optional)</p>
                <Select value={targetClass || "auto"} onValueChange={v => setTargetClass(v === "auto" ? "" : v)}>
                  <SelectTrigger className="rounded-lg h-9 text-xs" data-testid="target-class-select"><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-assign</SelectItem>
                    {targetClasses.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="rounded-xl bg-[#C5A55A] hover:bg-[#b8963e] text-white h-10 px-6 shadow-lg shadow-[#C5A55A]/20"
              onClick={handlePromote}
              disabled={promoting || (mode === 'individual' && selected.size === 0)}
              data-testid="promote-btn"
            >
              {promoting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpCircle className="w-4 h-4 mr-2" />}
              {mode === 'bulk'
                ? `Promote All ${students.length} to ${targetYear}`
                : `Promote ${selected.size} Selected`}
            </Button>
          </div>
          {mode === 'bulk' && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">Bulk mode will promote <strong>all {students.length} students</strong> in {selectedYear} to {targetYear}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search + Select All */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name or admission number..." className="pl-9 rounded-lg" data-testid="promo-search" />
        </div>
        {mode === 'individual' && (
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={toggleAll} data-testid="select-all-btn">
            {selected.size === filtered.length ? 'Deselect All' : `Select All (${filtered.length})`}
          </Button>
        )}
        {mode === 'individual' && selected.size > 0 && (
          <Badge className="bg-[#2E6CC4]/10 text-[#2E6CC4] text-xs px-3">{selected.size} selected</Badge>
        )}
      </div>

      {/* Student Table */}
      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto text-[#2E6CC4] animate-spin mb-3" /><p className="text-sm text-slate-400">Loading students...</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-x-auto shadow-[0_2px_10px_rgba(27,42,74,0.02)]">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-[#1B2A4A]/[0.03]">
                {mode === 'individual' && <th className="w-10 px-4 py-3"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>}
                <th className="w-10 px-2 py-3 text-[10px] font-bold text-slate-500 uppercase text-center">Rank</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Student</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Admission</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Class</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Subjects</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Avg Score</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Grade</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.user_id}
                  className={`border-t border-slate-50 transition-colors ${selected.has(s.user_id) ? 'bg-[#2E6CC4]/[0.04]' : 'hover:bg-slate-50/50'} ${mode === 'individual' ? 'cursor-pointer' : ''}`}
                  onClick={mode === 'individual' ? () => toggleSelect(s.user_id) : undefined}
                  data-testid={`student-row-${s.user_id}`}
                >
                  {mode === 'individual' && (
                    <td className="w-10 px-4 py-3"><Checkbox checked={selected.has(s.user_id)} onCheckedChange={() => toggleSelect(s.user_id)} /></td>
                  )}
                  <td className="w-10 px-2 py-3 text-center">{rankBadge(i)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {s.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[#1B2A4A]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{s.admission_number || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.class_name || s.year_group}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500">{s.subjects_graded || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {s.avg_score != null ? (
                      <span className={`text-sm font-bold ${s.avg_score >= 70 ? 'text-[#C5A55A]' : s.avg_score >= 50 ? 'text-[#2E6CC4]' : 'text-red-500'}`}>{s.avg_score}%</span>
                    ) : <span className="text-xs text-slate-300">No scores</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.grade ? <Badge className={`${gradeColor(s.grade)} text-xs font-bold px-2.5`}>{s.grade}</Badge> : <span className="text-xs text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-slate-400"><GraduationCap className="w-10 h-10 mx-auto mb-3 text-slate-200" /><p className="text-sm">No students found in {selectedYear}</p></div>}
        </div>
      )}
    </div>
  );
}
