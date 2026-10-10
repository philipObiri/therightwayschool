import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, GripVertical, RotateCcw, Check, AlertTriangle, Zap, Loader2, CheckCircle, XCircle, Download, Save } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_COLORS = {
  Monday: { bg: '#eff6ff', accent: '#3b82f6', text: '#1d4ed8' },
  Tuesday: { bg: '#ecfdf5', accent: '#C5A55A', text: '#047857' },
  Wednesday: { bg: '#f5f3ff', accent: '#1B2A4A', text: '#6d28d9' },
  Thursday: { bg: '#fffbeb', accent: '#f59e0b', text: '#b45309' },
  Friday: { bg: '#fff1f2', accent: '#f43f5e', text: '#be123c' },
};

function parseTime(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h < 8 ? h + 12 : h) * 60 + (m || 0);
}

export default function TimetableManager() {
  const [view, setView] = useState('manager'); // 'manager' | 'generator'
  const isAdmin = true; // all viewers of this page are admin+

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <button className={`px-4 py-2.5 text-sm font-medium border-b-2 ${view === 'manager' ? 'border-[#2E6CC4] text-[#2E6CC4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setView('manager')}>
          <Clock className="w-4 h-4 inline mr-1.5" />Timetable Manager
        </button>
        <button className={`px-4 py-2.5 text-sm font-medium border-b-2 ${view === 'generator' ? 'border-[#2E6CC4] text-[#2E6CC4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`} onClick={() => setView('generator')} data-testid="generator-tab">
          <Zap className="w-4 h-4 inline mr-1.5" />Auto-Generator
        </button>
      </div>
      {view === 'manager' ? <TimetableManagerView /> : <TimetableGenerator />}
    </div>
  );
}

function TimetableManagerView() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [yearGroups, setYearGroups] = useState([]);
  const [selectedYG, setSelectedYG] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragEntry, setDragEntry] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadTimetable = useCallback(async (yg) => {
    setLoading(true);
    try {
      const r = await api.get(`/academic/admin-timetable${yg ? `?year_group=${encodeURIComponent(yg)}` : ''}`);
      setEntries(r.data.entries || []);
      const ygs = (r.data.year_groups || []).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setYearGroups(ygs);
      // Only auto-select on initial load (when no yg was specified)
      if (!yg && ygs.length) {
        setSelectedYG(ygs[0]);
      }
    } catch (e) { toast.error('Failed to load timetable'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTimetable('');
  }, []);

  useEffect(() => {
    if (selectedYG) loadTimetable(selectedYG);
  }, [selectedYG]);

  // Build time slots from entries
  const allTimes = [...new Set(entries.map(e => e.start_time))].sort((a, b) => parseTime(a) - parseTime(b));

  // Build a lookup: day+time -> entry
  const cellMap = {};
  entries.forEach(e => {
    const key = `${e.day}|${e.start_time}`;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(e);
  });

  // --- Drag Handlers ---
  const handleDragStart = (e, entry) => {
    setDragEntry(entry);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.entry_id);
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDragEntry(null);
    setDropTarget(null);
  };

  const handleDragOver = (e, day, time) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const key = `${day}|${time}`;
    if (dropTarget !== key) setDropTarget(key);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e, day, time) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragEntry) return;

    // If dropping on same slot, ignore
    if (dragEntry.day === day && dragEntry.start_time === time) {
      setDragEntry(null);
      return;
    }

    // Check if target slot is occupied
    const targetKey = `${day}|${time}`;
    const occupants = cellMap[targetKey] || [];
    const targetEntry = occupants.find(occ => occ.entry_id !== dragEntry.entry_id);

    setSaving(true);
    try {
      // Calculate end_time based on duration
      const origStart = parseTime(dragEntry.start_time);
      const origEnd = parseTime(dragEntry.end_time);
      const duration = origEnd - origStart;
      const newStartMin = parseTime(time);
      const newEndMin = newStartMin + duration;
      const newEndH = Math.floor(newEndMin / 60);
      const newEndM = newEndMin % 60;
      const newEnd = `${newEndH > 12 ? newEndH - 12 : newEndH}:${String(newEndM).padStart(2, '0')}`;

      // Save undo state
      setUndoStack(prev => [...prev, {
        entryId: dragEntry.entry_id,
        oldDay: dragEntry.day,
        oldStart: dragEntry.start_time,
        oldEnd: dragEntry.end_time,
        targetEntryId: targetEntry?.entry_id,
        targetOldDay: targetEntry?.day,
        targetOldStart: targetEntry?.start_time,
        targetOldEnd: targetEntry?.end_time,
      }]);

      if (targetEntry) {
        // Swap
        await api.put(`/academic/timetable/${dragEntry.entry_id}/swap`, {
          target_entry_id: targetEntry.entry_id,
        });
        toast.success(`Swapped ${dragEntry.subject} with ${targetEntry.subject}`);
      } else {
        // Move to empty slot
        await api.put(`/academic/timetable/${dragEntry.entry_id}/reschedule`, {
          day, start_time: time, end_time: newEnd,
        });
        toast.success(`Moved ${dragEntry.subject} to ${day} ${time}`);
      }

      await loadTimetable(selectedYG);
    } catch (err) {
      toast.error('Reschedule failed');
    }
    setSaving(false);
    setDragEntry(null);
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setSaving(true);
    try {
      await api.put(`/academic/timetable/${last.entryId}/reschedule`, {
        day: last.oldDay, start_time: last.oldStart, end_time: last.oldEnd,
      });
      if (last.targetEntryId) {
        await api.put(`/academic/timetable/${last.targetEntryId}/reschedule`, {
          day: last.targetOldDay, start_time: last.targetOldStart, end_time: last.targetOldEnd,
        });
      }
      setUndoStack(prev => prev.slice(0, -1));
      toast.success('Undone');
      await loadTimetable(selectedYG);
    } catch { toast.error('Undo failed'); }
    setSaving(false);
  };

  const now = new Date();
  const todayName = DAYS[now.getDay() - 1] || '';

  return (
    <div className="space-y-4" data-testid="timetable-manager">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#1B2A4A]">Timetable Manager</h1>
          <p className="text-xs md:text-sm text-slate-500">Drag and drop to reschedule periods</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#1B2A4A]/5 rounded-xl p-1">
            {yearGroups.map(yg => (
              <button key={yg} onClick={() => setSelectedYG(yg)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedYG === yg ? 'bg-[#1B2A4A] text-white shadow-sm' : 'text-slate-600 hover:text-[#1B2A4A] hover:bg-white'}`}
                data-testid={`yg-btn-${yg.replace(' ', '-')}`}
              >{yg}</button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={handleUndo} disabled={undoStack.length === 0 || saving} data-testid="undo-btn"
            className="text-xs rounded-lg"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Undo ({undoStack.length})</Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700">
        <GripVertical className="w-3.5 h-3.5" />
        <span><strong>Drag</strong> any period to an empty slot to move it, or <strong>drop onto another period</strong> to swap them.</span>
        {saving && <span className="ml-auto text-amber-600 font-semibold animate-pulse">Saving...</span>}
      </div>

      {/* Timetable Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading timetable...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="admin-timetable-table">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 bg-slate-50">Time</th>
                  {DAYS.map(day => {
                    const isToday = day === todayName;
                    const c = DAY_COLORS[day];
                    return (
                      <th key={day} className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ background: isToday ? '#1B2A4A' : c.bg, color: isToday ? 'white' : c.text }}>
                        {day.slice(0, 3)}
                        {isToday && <div className="text-[8px] font-normal opacity-70">Today</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allTimes.map((time, ti) => {
                  // Calculate end time from the entries in this time slot
                  const sampleEntry = entries.find(e => e.start_time === time);
                  const endTime = sampleEntry?.end_time || '';
                  return (
                    <tr key={time} className={`border-b border-slate-50 ${ti % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                      <td className="px-3 py-1.5 bg-slate-50/80 align-middle">
                        <div className="font-mono text-[11px] font-semibold text-slate-500">{time}</div>
                        {endTime && <div className="font-mono text-[9px] text-slate-300">{endTime}</div>}
                      </td>
                      {DAYS.map(day => {
                        const key = `${day}|${time}`;
                        const occupants = cellMap[key] || [];
                        const isToday = day === todayName;
                        const c = DAY_COLORS[day];
                        const isDragOver = dropTarget === key;
                        const isDragging = dragEntry && dragEntry.day === day && dragEntry.start_time === time;

                        return (
                          <td key={day} className="px-1 py-1 align-middle" style={{ minWidth: '140px' }}
                            onDragOver={(e) => handleDragOver(e, day, time)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day, time)}
                          >
                            <div className={`min-h-[48px] rounded-lg transition-all ${isDragOver ? 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-50' : ''}`}>
                              {occupants.length > 0 ? occupants.map(entry => (
                                <div
                                  key={entry.entry_id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, entry)}
                                  onDragEnd={handleDragEnd}
                                  data-testid={`entry-${entry.entry_id}`}
                                  className="group px-2.5 py-2 rounded-lg border-l-[3px] cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:scale-[1.02] select-none"
                                  style={{
                                    borderLeftColor: c.accent,
                                    background: isDragging ? '#e0e7ff' : c.bg,
                                  }}
                                >
                                  <div className="flex items-start gap-1.5">
                                    <GripVertical className="w-3 h-3 text-slate-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-bold truncate" style={{ color: c.text }}>{entry.subject}</div>
                                      <div className="text-[9px] text-slate-400 mt-0.5">{entry.start_time} - {entry.end_time}</div>
                                      {entry.year_group && <div className="text-[8px] text-slate-300 mt-0.5">{entry.year_group}</div>}
                                    </div>
                                  </div>
                                </div>
                              )) : (
                                <div className={`min-h-[48px] rounded-lg border border-dashed transition-colors ${isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-transparent hover:border-slate-200'}`} />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Summary */}
          <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex gap-4">
              <span>{entries.length} periods total</span>
              <span>{allTimes.length} time slots</span>
              <span>{[...new Set(entries.map(e => e.subject))].length} subjects</span>
            </div>
            <div className="flex gap-2">
              {undoStack.length > 0 && <span className="text-indigo-500 font-semibold">{undoStack.length} change(s) made</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timetable Generator ───
function TimetableGenerator() {
  const [config, setConfig] = useState(null);
  const [selectedYears, setSelectedYears] = useState(new Set(['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13']));
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [applying, setApplying] = useState(false);
  const [previewYG, setPreviewYG] = useState('');

  useEffect(() => {
    api.get('/timetable-generator/config').then(r => setConfig(r.data)).catch(() => toast.error('Failed to load config'));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await api.post('/timetable-generator/generate', { year_groups: [...selectedYears] });
      setResult(res.data);
      const ygs = Object.keys(res.data.year_groups || {});
      if (ygs.length) setPreviewYG(ygs[0]);
      if (res.data.total_clashes === 0) successToast('Timetable generated with 0 clashes!');
      else toast.warning(`Generated with ${res.data.total_clashes} clash(es)`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Generation failed'); }
    setGenerating(false);
  };

  const handleApply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      await api.post('/timetable-generator/apply', { timetable: result.year_groups });
      successToast('Timetable applied successfully!');
    } catch (e) { toast.error(e.response?.data?.detail || 'Apply failed'); }
    setApplying(false);
  };

  const toggleYear = (yg) => {
    setSelectedYears(prev => {
      const next = new Set(prev);
      next.has(yg) ? next.delete(yg) : next.add(yg);
      return next;
    });
  };

  if (!config) return <div className="text-center py-12 text-slate-400"><Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" /><p className="text-sm">Loading generator...</p></div>;

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const previewData = result?.year_groups?.[previewYG];

  return (
    <div className="space-y-5" data-testid="timetable-generator">
      <div>
        <h2 className="text-lg font-bold text-[#1B2A4A]">Auto-Generate Timetable</h2>
        <p className="text-xs text-slate-500 mt-1">Generates clash-free timetables based on teacher assignments. Teachers cannot be scheduled in two classes at the same time.</p>
      </div>

      {/* Teacher summary */}
      <Card className="rounded-lg border-slate-100">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Teachers Available ({config.teachers.length})</h3>
          <div className="flex flex-wrap gap-2">
            {config.teachers.map(t => (
              <div key={t.user_id} className="bg-slate-50 rounded-lg px-3 py-1.5 text-xs border border-slate-100">
                <span className="font-medium text-[#1B2A4A]">{t.name}</span>
                <span className="text-slate-400 ml-1">({t.teaching_subjects?.join(', ')})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Year group selection */}
      <Card className="rounded-lg border-slate-100">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Generate For</h3>
          <div className="flex flex-wrap gap-3">
            {config.year_groups.map(yg => (
              <label key={yg} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selectedYears.has(yg)} onCheckedChange={() => toggleYear(yg)} />
                <span className="text-sm text-[#1B2A4A] font-medium">{yg}</span>
              </label>
            ))}
          </div>
          <Button className="mt-4 rounded-lg bg-[#2E6CC4] hover:bg-[#1B2A4A]" onClick={handleGenerate} disabled={generating || selectedYears.size === 0} data-testid="generate-timetable-btn">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Zap className="w-4 h-4 mr-2" /> Generate Timetable</>}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-lg border-slate-100"><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-[#1B2A4A]">{Object.keys(result.year_groups).length}</p>
              <p className="text-[10px] text-slate-500 uppercase">Year Groups</p>
            </CardContent></Card>
            <Card className={`rounded-lg ${result.total_clashes === 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}><CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${result.total_clashes === 0 ? 'text-emerald-600' : 'text-red-600'}`}>{result.total_clashes}</p>
              <p className="text-[10px] text-slate-500 uppercase">Clashes</p>
            </CardContent></Card>
            <Card className="rounded-lg border-[#C5A55A]/20 bg-[#C5A55A]/5"><CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-[#C5A55A]">{Object.values(result.year_groups).reduce((a, v) => a + v.total_placed, 0)}</p>
              <p className="text-[10px] text-slate-500 uppercase">Periods Placed</p>
            </CardContent></Card>
          </div>

          {/* Clash warnings */}
          {result.clashes.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-red-800 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Clashes Detected</h4>
              {result.clashes.map((c, i) => (
                <p key={i} className="text-xs text-red-700 mt-1">{c.year_group} — {c.day} {c.slot}: {c.subject} ({c.teacher}) — {c.reason}</p>
              ))}
            </div>
          )}

          {/* Preview tabs */}
          <div className="flex gap-1 bg-[#1B2A4A]/5 rounded-xl p-1 flex-wrap">
            {Object.keys(result.year_groups).sort((a, b) => parseInt(a.replace('Year ', '')) - parseInt(b.replace('Year ', ''))).map(yg => {
              const d = result.year_groups[yg];
              const hasClash = d.clashes?.length > 0;
              return (
                <button key={yg} onClick={() => setPreviewYG(yg)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${previewYG === yg ? 'bg-[#1B2A4A] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
                  {yg}
                  {hasClash ? <XCircle className="w-3 h-3 text-red-400" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Timetable grid preview */}
          {previewData && (
            <div className="overflow-x-auto bg-white rounded-lg border border-slate-100">
              {previewData.unassigned_subjects?.length > 0 && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
                  <strong>No teacher found for:</strong> {previewData.unassigned_subjects.map(u => u.subject).join(', ')}
                </div>
              )}
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-2 py-2 text-left text-slate-500 w-16">Time</th>
                    {DAYS.map(d => <th key={d} className="px-2 py-2 text-center text-slate-500">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(previewData.entries?.length > 0 ? [...new Set(previewData.entries.map(e => e.start_time))].sort() : []).map(startTime => {
                    const endTime = previewData.entries.find(e => e.start_time === startTime)?.end_time || '';
                    return (
                      <tr key={startTime} className="border-t border-slate-50">
                        <td className="px-2 py-1 text-[10px] text-slate-400 font-mono whitespace-nowrap">{startTime}<br/>{endTime}</td>
                        {DAYS.map(day => {
                          const cell = previewData.entries.find(e => e.day === day && e.start_time === startTime);
                          if (!cell) return <td key={day} className="px-1 py-1"><div className="h-10 bg-slate-50/50 rounded" /></td>;
                          return (
                            <td key={day} className="px-1 py-1">
                              <div className={`rounded-md px-2 py-1 h-10 flex flex-col justify-center ${cell.clash ? 'bg-red-100 border border-red-300' : 'bg-[#1B2A4A]/5'}`}>
                                <p className={`text-[10px] font-semibold truncate ${cell.clash ? 'text-red-700' : 'text-[#1B2A4A]'}`}>{cell.subject}</p>
                                <p className="text-[8px] text-slate-400 truncate">{cell.teacher_name}</p>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Apply button */}
          <div className="flex gap-3">
            <Button className="rounded-lg bg-[#C5A55A] hover:bg-[#b8963e]" onClick={handleApply} disabled={applying} data-testid="apply-timetable-btn">
              {applying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying...</> : <><Save className="w-4 h-4 mr-2" /> Apply to System</>}
            </Button>
            <Button variant="outline" className="rounded-lg" onClick={handleGenerate} disabled={generating}>
              <RotateCcw className="w-4 h-4 mr-2" /> Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
