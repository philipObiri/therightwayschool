import React, { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { AppLoader } from '../../components/AppLoader';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2,
  Video, FileText, Clock, AlertTriangle, DollarSign, Edit2, X
} from 'lucide-react';

const COLORS = { custom: '#2E6CC4', meeting: '#ef4444', wp_task: '#f59e0b', doc_expiry: '#dc2626', payroll: '#10b981' };
const TYPE_LABELS = { custom: 'Event', meeting: 'Meeting', wp_task: 'WP Task', doc_expiry: 'Expiry', payroll: 'Payroll' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '', color: '#2E6CC4', all_day: false });
  const [view, setView] = useState('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month + 2, 0).toISOString();
      const r = await api.get('/calendar/events', { params: { start, end } });
      setEvents(r.data);
    } catch (_) { toast.error('Failed to load events'); }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const createEvent = async () => {
    if (!form.title.trim() || !form.start_time) { toast.error('Title and start time required'); return; }
    try {
      await api.post('/calendar/events', { ...form, start_time: new Date(form.start_time).toISOString(), end_time: form.end_time ? new Date(form.end_time).toISOString() : '' });
      successToast('Event created');
      setShowCreate(false);
      setForm({ title: '', description: '', start_time: '', end_time: '', color: '#2E6CC4', all_day: false });
      loadEvents();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const deleteEvent = async (id) => {
    try { await api.delete(`/calendar/events/${id}`); successToast('Deleted'); loadEvents(); } catch (_) {}
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getEventsForDate = (d) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return events.filter(e => {
      const eDate = e.start.substring(0, 10);
      return eDate === dateStr;
    });
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const TypeIcon = ({ type }) => {
    if (type === 'meeting') return <Video className="w-3 h-3" />;
    if (type === 'wp_task') return <FileText className="w-3 h-3" />;
    if (type === 'doc_expiry') return <AlertTriangle className="w-3 h-3" />;
    if (type === 'payroll') return <DollarSign className="w-3 h-3" />;
    return <CalendarIcon className="w-3 h-3" />;
  };

  if (loading && events.length === 0) return <AppLoader fullPage />;

  return (
    <div className="p-6 max-w-[1400px] mx-auto" data-testid="calendar-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Calendar</h1>
          <p className="text-sm text-slate-500">Meetings, tasks, deadlines & events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="rounded-lg text-xs">Today</Button>
          <div className="flex items-center bg-white border rounded-lg">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-50" data-testid="prev-month"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-sm font-semibold text-[#1B2A4A] min-w-[140px] text-center">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-50" data-testid="next-month"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <Button onClick={() => { setShowCreate(true); if (selectedDate) { const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}T09:00`; setForm(f => ({ ...f, start_time: d })); } }} className="bg-[#2E6CC4] rounded-lg text-xs" data-testid="create-event-btn"><Plus className="w-4 h-4 mr-1" /> New Event</Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="calendar-grid">
          <div className="grid grid-cols-7">
            {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase py-2 border-b bg-slate-50">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="min-h-[90px] border-b border-r border-slate-100 bg-slate-50/30" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const dayEvents = getEventsForDate(d);
              const isSelected = selectedDate === d;
              return (
                <div key={d} onClick={() => setSelectedDate(d)} className={`min-h-[90px] border-b border-r border-slate-100 p-1 cursor-pointer transition-colors ${isSelected ? 'bg-[#2E6CC4]/5 ring-1 ring-inset ring-[#2E6CC4]/20' : 'hover:bg-slate-50'}`} data-testid={`cal-day-${d}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-0.5 ${isToday ? 'bg-[#2E6CC4] text-white' : 'text-[#1B2A4A]'}`}>{d}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.event_id} className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium truncate" style={{ backgroundColor: (e.color || '#2E6CC4') + '15', color: e.color || '#2E6CC4' }}>
                        <TypeIcon type={e.type} />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[9px] text-slate-400 px-1">+{dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — Day Detail */}
        <div className="w-[280px] shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-[#1B2A4A] mb-3">
              {selectedDate ? `${MONTHS[month]} ${selectedDate}, ${year}` : 'Select a day'}
            </h3>
            {selectedDate ? (
              <div className="space-y-2">
                {selectedEvents.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No events this day</p>}
                {selectedEvents.map(e => (
                  <div key={e.event_id} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: e.color || '#2E6CC4' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1B2A4A] truncate">{e.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge className="text-[8px] py-0 px-1" style={{ backgroundColor: (e.color || '#2E6CC4') + '15', color: e.color || '#2E6CC4' }}>{TYPE_LABELS[e.type] || e.type}</Badge>
                          {e.start && <span className="text-[9px] text-slate-400">{new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        {e.description && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{e.description}</p>}
                      </div>
                      {e.editable && <button onClick={() => deleteEvent(e.event_id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">Click a day to see events</p>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mt-4">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Event Types</h4>
            <div className="space-y-1.5">
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[k] }} />
                  <span className="text-[10px] text-slate-600">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-[#2E6CC4]" /> New Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-xs" placeholder="Event title" data-testid="event-title-input" /></div>
            <div><Label className="text-xs">Description</Label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full h-16 rounded-lg border border-slate-200 px-3 py-2 text-xs resize-none outline-none" placeholder="Optional" data-testid="event-desc-input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Start</Label><input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none" data-testid="event-start-input" /></div>
              <div><Label className="text-xs">End</Label><input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none" data-testid="event-end-input" /></div>
            </div>
            <div><Label className="text-xs">Color</Label>
              <div className="flex gap-1.5 mt-1">
                {['#2E6CC4', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'].map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 ${form.color === c ? 'border-[#1B2A4A] scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Button className="w-full bg-[#2E6CC4] rounded-lg text-xs" onClick={createEvent} data-testid="save-event-btn"><Plus className="w-3 h-3 mr-1" /> Create Event</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
