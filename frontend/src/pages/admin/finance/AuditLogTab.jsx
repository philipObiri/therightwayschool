import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Search, Shield, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { AppLoader } from '../../../components/AppLoader';

const ACTION_COLORS = {
  create: 'bg-[#C5A55A]/15 text-[#C5A55A]',
  update: 'bg-blue-100 text-blue-700',
  approve: 'bg-indigo-100 text-indigo-700',
  reject: 'bg-red-100 text-red-700',
  pay: 'bg-blue-100 text-[#2E6CC4]',
  void: 'bg-red-100 text-red-700',
  generate: 'bg-amber-100 text-amber-700',
};

function getActionColor(action) {
  const key = Object.keys(ACTION_COLORS).find(k => action?.toLowerCase().includes(k));
  return ACTION_COLORS[key] || 'bg-slate-100 text-slate-600';
}

export function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/finance/audit-log');
      setLogs(r.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l =>
    l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4" data-testid="audit-log-tab">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#1B2A4A]">Finance Audit Log</h2><p className="text-xs text-slate-500">Complete audit trail of all financial operations</p></div>
        <Button variant="outline" size="sm" className="rounded-md text-xs" onClick={load}><RefreshCw className="w-3 h-3 mr-1" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="text-2xl font-bold">{logs.length}</p><p className="text-xs text-slate-500">Total Actions</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-[#2E6CC4]">{new Set(logs.map(l => l.user_id)).size}</p><p className="text-xs text-slate-500">Unique Users</p></div>
        <div className="stat-card"><p className="text-2xl font-bold text-amber-600">{logs.filter(l => l.timestamp?.startsWith(new Date().toISOString().split('T')[0])).length}</p><p className="text-xs text-slate-500">Actions Today</p></div>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-md border px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by user, action, or entity..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="audit-search" />
      </div>

      <Card className="rounded-md"><CardContent className="p-0">
        {loading ? (
          <AppLoader size="sm" />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="bg-slate-50">Timestamp</TableHead>
              <TableHead className="bg-slate-50">User</TableHead>
              <TableHead className="bg-slate-50">Action</TableHead>
              <TableHead className="bg-slate-50">Entity</TableHead>
              <TableHead className="bg-slate-50">Entity ID</TableHead>
              <TableHead className="bg-slate-50">Details</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((log, i) => (
                <TableRow key={log.audit_id || i} data-testid={`audit-row-${i}`}>
                  <TableCell className="text-[10px] text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-medium">{log.user_name}</TableCell>
                  <TableCell><Badge className={`text-[9px] ${getActionColor(log.action)}`}>{log.action?.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="text-xs capitalize">{log.entity_type}</TableCell>
                  <TableCell className="text-[10px] font-mono text-slate-400 max-w-[120px] truncate">{log.entity_id}</TableCell>
                  <TableCell className="text-[10px] text-slate-500 max-w-[200px] truncate">{log.after ? JSON.stringify(log.after).slice(0, 80) : '-'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400 text-sm"><Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />No audit entries found</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
