import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { AlertTriangle, Calendar, User, ArrowLeft, Video, MapPin } from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

const severityColors = { minor: 'bg-blue-100 text-blue-700', moderate: 'bg-amber-100 text-amber-700', serious: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };

export default function ParentBehaviour() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const kids = [];
      for (const id of (user?.children_ids || [])) {
        try { const r = await api.get(`/admin/students/${id}`); kids.push(r.data); } catch (err) { console.error("Error:", err); }
      }
      setChildren(kids);
      if (kids.length === 1) selectChild(kids[0]);
      setLoading(false);
    };
    if (user) fetch();
  }, [user]);

  const selectChild = async (child) => {
    setSelectedChild(child);
    try {
      const res = await api.get('/behaviour/reports', { params: { student_id: child.user_id } });
      setReports(res.data);
    } catch { setReports([]); }
  };

  if (loading) return <AppLoader />;
  if (!selectedChild && children.length > 1) {
    return (<div className="space-y-4"><h1 className="text-2xl font-bold text-[#1B2A4A]">Behaviour Reports</h1><div className="grid md:grid-cols-2 gap-4">{children.map(c => (<Card key={c.user_id} className="rounded-md card-hover cursor-pointer" onClick={() => selectChild(c)}><CardContent className="p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-lg font-bold">{c.name?.charAt(0)}</div><div><h3 className="font-semibold">{c.name}</h3><p className="text-xs text-slate-500">{c.year_group}</p></div></CardContent></Card>))}</div></div>);
  }

  return (
    <div className="space-y-6">
      {children.length > 1 && <Button variant="ghost" size="sm" onClick={() => setSelectedChild(null)}><ArrowLeft className="w-4 h-4 mr-1" /> Switch Child</Button>}
      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white font-bold">{selectedChild?.name?.charAt(0)}</div><div><h1 className="text-xl font-bold text-[#1B2A4A]">{selectedChild?.name} - Behaviour Reports</h1><p className="text-xs text-slate-500">{selectedChild?.year_group} | {reports.length} report(s)</p></div></div>

      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map(r => (
            <Card key={r.report_id} className="rounded-md border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2"><Badge className={severityColors[r.severity]}>{r.severity}</Badge><Badge variant="secondary" className="capitalize">{r.category}</Badge></div>
                  <span className="text-[10px] text-slate-400">{r.incident_date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : '')}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#1B2A4A] mb-1">{r.title}</h3>
                <p className="text-xs text-slate-600 mb-2">{r.description}</p>
                {r.action_taken && <div className="bg-blue-50 rounded-md p-2 mb-2"><p className="text-[10px] text-blue-700"><strong>Action Taken:</strong> {r.action_taken}</p></div>}
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {r.reporter_name} ({r.reporter_role})</span>
                  <Badge className={r.status === 'resolved' ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[9px]' : r.status === 'meeting_called' ? 'bg-blue-100 text-[#1B2A4A] text-[9px]' : 'bg-amber-100 text-amber-700 text-[9px]'}>{r.status?.replace(/_/g,' ')}</Badge>
                </div>
                {r.meeting_requested && r.meeting_details && (
                  <div className="mt-2 bg-blue-50 rounded-md p-2 text-[10px] text-[#1B2A4A] flex items-center gap-2">
                    <Video className="w-3 h-3" /> Meeting: {r.meeting_details.date} {r.meeting_details.time} | <MapPin className="w-3 h-3" /> {r.meeting_details.location}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400"><AlertTriangle className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="text-sm">No behaviour reports for {selectedChild?.name}</p></div>
      )}
    </div>
  );
}
