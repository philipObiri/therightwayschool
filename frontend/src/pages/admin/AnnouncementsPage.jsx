import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Megaphone, Send, Eye, Clock, XCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [target, setTarget] = useState('all');
  const [targetIds, setTargetIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('create');

  const fetchData = async () => {
    try {
      const [annRes, logRes] = await Promise.all([
        api.get('/announcements/all'),
        api.get('/announcements/logs'),
      ]);
      setAnnouncements(annRes.data || []);
      setLogs(logRes.data || []);
    } catch (err) { console.error("Error:", err); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (target !== 'individuals') return;
    const search = async () => {
      try {
        const res = await api.get('/announcements/search-users', { params: { q: userSearch } });
        setSearchResults(res.data || []);
      } catch (err) { console.error("Error:", err); }
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [userSearch, target]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { toast.error('Title and body are required'); return; }
    if (target === 'individuals' && targetIds.length === 0) { toast.error('Select at least one person'); return; }
    setSending(true);
    try {
      await api.post('/announcements/create', { title, body, duration_days: durationDays, target, target_ids: targetIds.map(u => u.user_id) });
      successToast('Announcement published!');
      setTitle(''); setBody(''); setTarget('all'); setTargetIds([]); setUserSearch('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSending(false);
  };

  const handleDeactivate = async (id) => {
    try {
      await api.patch(`/announcements/${id}/deactivate`);
      successToast('Announcement deactivated');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="p-6 space-y-6" data-testid="announcements-page">
      <div className="flex items-center gap-3">
        <Megaphone className="w-6 h-6 text-[#C5A55A]" />
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Announcements</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="create" className="text-xs" data-testid="ann-tab-create">Create</TabsTrigger>
          <TabsTrigger value="history" className="text-xs" data-testid="ann-tab-history">History ({announcements.length})</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs" data-testid="ann-tab-logs">Read Logs ({logs.length})</TabsTrigger>
        </TabsList>

        {/* CREATE */}
        <TabsContent value="create" className="mt-4">
          <Card className="rounded-md border-slate-100 max-w-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4 text-[#2E6CC4]" /> New Announcement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-slate-500">Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Important School Notice" className="rounded-md mt-1" data-testid="ann-title-input" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Message Body</Label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write the full announcement here. Users will need to scroll to the end and click 'I have read it' before they can dismiss."
                  rows={8}
                  className="w-full mt-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  data-testid="ann-body-input"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Show for how many days?</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input type="number" min={1} max={90} value={durationDays} onChange={e => setDurationDays(parseInt(e.target.value) || 1)} className="rounded-md w-24" data-testid="ann-duration-input" />
                  <span className="text-xs text-slate-400">days (1–90)</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Who should see this?</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[{v:'all',l:'Everyone'},{v:'parents',l:'Parents Only'},{v:'students',l:'Students Only'},{v:'teachers',l:'Teachers Only'},{v:'individuals',l:'Specific People'}].map(o => (
                    <Button key={o.v} size="sm" variant={target === o.v ? 'default' : 'outline'}
                      className={`text-xs rounded-md h-8 ${target === o.v ? 'bg-[#1B2A4A]' : ''}`}
                      onClick={() => { setTarget(o.v); setTargetIds([]); }} data-testid={`ann-target-${o.v}`}>
                      {o.l}
                    </Button>
                  ))}
                </div>
              </div>
              {target === 'individuals' && (
                <div className="space-y-2">
                  <Input placeholder="Search by name..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    className="rounded-md" data-testid="ann-user-search" />
                  {targetIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {targetIds.map(u => (
                        <Badge key={u.user_id} className="bg-blue-100 text-blue-700 text-[10px] cursor-pointer hover:bg-red-100 hover:text-red-600"
                          onClick={() => setTargetIds(prev => prev.filter(p => p.user_id !== u.user_id))}>
                          {u.name} ({u.role}) &times;
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="max-h-[150px] overflow-auto border border-slate-100 rounded-md">
                    {searchResults.filter(u => !targetIds.find(t => t.user_id === u.user_id)).map(u => (
                      <div key={u.user_id} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs"
                        onClick={() => setTargetIds(prev => [...prev, u])} data-testid={`ann-pick-${u.user_id}`}>
                        <span>{u.name}</span>
                        <Badge variant="secondary" className="text-[9px]">{u.role}{u.year_group ? ` · ${u.year_group}` : ''}</Badge>
                      </div>
                    ))}
                    {searchResults.length === 0 && <p className="text-center text-slate-400 text-xs py-3">No results</p>}
                  </div>
                </div>
              )}
              <Button onClick={handleSend} disabled={sending} className="rounded-md bg-[#1B2A4A] hover:bg-[#2E6CC4] text-sm" data-testid="ann-send-btn">
                <Megaphone className="w-4 h-4 mr-2" />
                {sending ? 'Publishing...' : 'Publish Announcement'}
              </Button>
              <p className="text-[10px] text-slate-400">This will appear as a mandatory popup for every user on their next login. They must scroll to the end and click "I have read it".</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4">
          <Card className="rounded-md border-slate-100">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-[10px]">Title</TableHead>
                    <TableHead className="text-[10px]">Sent By</TableHead>
                    <TableHead className="text-[10px]">Target</TableHead>
                    <TableHead className="text-[10px]">Date</TableHead>
                    <TableHead className="text-[10px] text-center">Read By</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map(a => (
                    <TableRow key={a.announcement_id}>
                      <TableCell className="text-xs font-medium max-w-[200px] truncate">{a.title}</TableCell>
                      <TableCell className="text-xs text-slate-500">{a.sender_name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[9px] capitalize">{a.target || 'all'}{a.target === 'individuals' ? ` (${(a.target_ids || []).length})` : ''}</Badge></TableCell>
                      <TableCell className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell className="text-[10px] text-slate-500">{a.duration_days || '—'} days{a.expires_at ? ` (until ${new Date(a.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})` : ''}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[9px]"><Users className="w-3 h-3 mr-1" />{a.read_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={a.is_active ? 'bg-[#C5A55A]/15 text-[#C5A55A] text-[9px]' : 'bg-slate-100 text-slate-500 text-[9px]'}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.is_active && (
                          <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700 h-7"
                            onClick={() => handleDeactivate(a.announcement_id)} data-testid={`ann-deactivate-${a.announcement_id}`}>
                            <XCircle className="w-3 h-3 mr-1" /> Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {announcements.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400 text-sm">No announcements yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="mt-4">
          <Card className="rounded-md border-slate-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#C5A55A]" /> Acknowledgment Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-[10px]">Announcement</TableHead>
                      <TableHead className="text-[10px]">Read By</TableHead>
                      <TableHead className="text-[10px]">Role</TableHead>
                      <TableHead className="text-[10px]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l, i) => (
                      <TableRow key={l.log_id || i}>
                        <TableCell className="text-xs font-medium max-w-[180px] truncate">{l.announcement_title}</TableCell>
                        <TableCell className="text-xs">{l.user_name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[9px]">{l.user_role}</Badge></TableCell>
                        <TableCell className="text-[10px] text-slate-400">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(l.acknowledged_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400 text-sm">No acknowledgments yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
