import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Badge } from './ui/badge';
import { Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_COLORS = {
  Monday: { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', accent: '#3b82f6' },
  Tuesday: { bg: 'bg-[#C5A55A]/10', border: 'border-l-[#C5A55A]', text: 'text-[#C5A55A]', accent: '#C5A55A' },
  Wednesday: { bg: 'bg-[#2E6CC4]/10', border: 'border-l-[#1B2A4A]', text: 'text-[#2E6CC4]', accent: '#1B2A4A' },
  Thursday: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', accent: '#f59e0b' },
  Friday: { bg: 'bg-red-50', border: 'border-l-rose-500', text: 'text-red-700', accent: '#f43f5e' },
};

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const hour = h < 8 ? h + 12 : h;
  return hour * 60 + (m || 0);
}

export default function TimetableWidget({ compact = false, studentId = null }) {
  const [timetable, setTimetable] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    const params = studentId ? `?student_id=${studentId}` : '';
    api.get(`/academic/my-timetable${params}`).then(r => setTimetable(r.data)).catch(err => console.error("Timetable load error:", err)).finally(() => setLoading(false));
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, [studentId]);

  if (loading) return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse" data-testid="timetable-loading">
      <div className="h-4 bg-slate-100 rounded w-40 mb-4" />
      <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-50 rounded" />)}</div>
    </div>
  );
  if (!timetable) return null;

  const entries = timetable.entries || [];
  const todayIdx = currentTime.getDay() - 1;
  const todayName = DAYS[todayIdx] || '';
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Build time slots
  const allTimes = [...new Set(entries.map(e => e.start_time))].sort((a, b) => parseTime(a) - parseTime(b));

  // Find current and next period
  const todayEntries = entries.filter(e => e.day === todayName);
  let currentPeriod = null, nextPeriod = null;
  for (const e of todayEntries) {
    const start = parseTime(e.start_time), end = parseTime(e.end_time);
    if (nowMinutes >= start && nowMinutes < end) currentPeriod = e;
    if (nowMinutes < start && !nextPeriod) nextPeriod = e;
  }
  const minutesToNext = nextPeriod ? parseTime(nextPeriod.start_time) - nowMinutes : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="timetable-widget">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1B2A4A] flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1B2A4A]">Weekly Schedule</h3>
            <span className="text-[10px] text-slate-400">{todayName ? `Today is ${todayName}` : 'Weekend'} {timetable.year_group ? `| ${timetable.year_group}` : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentPeriod && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A55A]/10 border border-[#C5A55A]/30">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C5A55A]/100 animate-pulse" />
              <span className="text-[10px] font-semibold text-[#C5A55A]">Now: {currentPeriod.subject}</span>
            </div>
          )}
          {nextPeriod && minutesToNext !== null && minutesToNext <= 15 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-700">In {minutesToNext}m: {nextPeriod.subject}</span>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Table */}
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="timetable-table">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16 bg-slate-50/50">Time</th>
              {DAYS.map(day => {
                const isToday = day === todayName;
                const colors = DAY_COLORS[day];
                return (
                  <th key={day} className={`px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider transition-colors ${isToday ? 'bg-[#1B2A4A] text-white' : 'text-slate-400'}`}>
                    <div>{day.slice(0, 3)}</div>
                    {isToday && <div className="text-[8px] font-normal opacity-70 mt-0.5">Today</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allTimes.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-slate-400">No timetable data available</td></tr>
            ) : allTimes.map((time, ti) => (
              <tr key={time} className={`border-b border-slate-50 ${ti % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                <td className="px-3 py-2 font-mono text-[10px] text-slate-400 font-medium bg-slate-50/50 align-middle">{time}</td>
                {DAYS.map(day => {
                  const period = entries.find(e => e.day === day && e.start_time === time);
                  const isToday = day === todayName;
                  const colors = DAY_COLORS[day];
                  if (!period) {
                    return <td key={day} className={`px-1 py-1.5 ${isToday ? 'bg-blue-50/20' : ''}`} />;
                  }
                  const start = parseTime(period.start_time), end = parseTime(period.end_time);
                  const isCurrent = isToday && nowMinutes >= start && nowMinutes < end;
                  const isPast = isToday && nowMinutes >= end;
                  const isSelected = selectedCell?.day === day && selectedCell?.time === time;

                  return (
                    <td key={day} className={`px-1 py-1 ${isToday ? 'bg-blue-50/20' : ''}`}>
                      <button
                        onClick={() => setSelectedCell(isSelected ? null : { day, time, period })}
                        data-testid={`cell-${day}-${time}`}
                        className={`w-full text-left px-2 py-1.5 rounded-lg border-l-[3px] transition-all cursor-pointer
                          ${isCurrent
                            ? 'bg-[#1B2A4A] text-white border-l-[#2E6CC4] shadow-md shadow-[#1B2A4A]/20 scale-[1.02]'
                            : isPast
                              ? `${colors.bg} opacity-50 ${colors.border} hover:opacity-70`
                              : isSelected
                                ? `ring-2 ring-[#2E6CC4] ${colors.bg} ${colors.border} shadow-sm`
                                : `${colors.bg} ${colors.border} hover:shadow-sm hover:scale-[1.01]`
                          }
                        `}>
                        <div className={`text-[11px] font-semibold leading-tight truncate ${isCurrent ? 'text-white' : colors.text}`}>
                          {period.subject}
                        </div>
                        <div className={`text-[9px] mt-0.5 ${isCurrent ? 'text-blue-200' : 'text-slate-400'}`}>
                          {period.start_time} - {period.end_time}
                        </div>
                        {period.year_group && (
                          <div className={`text-[8px] mt-0.5 ${isCurrent ? 'text-blue-300' : 'text-slate-400'}`}>
                            {period.year_group}
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Detail */}
      {selectedCell && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 animate-in fade-in" data-testid="cell-detail">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: DAY_COLORS[selectedCell.day]?.accent + '20' }}>
            <Clock className="w-5 h-5" style={{ color: DAY_COLORS[selectedCell.day]?.accent }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#1B2A4A]">{selectedCell.period.subject}</p>
            <p className="text-xs text-slate-500">{selectedCell.day} | {selectedCell.period.start_time} - {selectedCell.period.end_time} {selectedCell.period.year_group ? `| ${selectedCell.period.year_group}` : ''} {selectedCell.period.room ? `| Room: ${selectedCell.period.room}` : ''}</p>
          </div>
          <button onClick={() => setSelectedCell(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100">Close</button>
        </div>
      )}

      {/* Summary Footer */}
      <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
        <span>{entries.length} periods/week</span>
        <span>{todayEntries.length} today</span>
        <span>{[...new Set(entries.map(e => e.subject))].length} subjects</span>
      </div>
    </div>
  );
}
