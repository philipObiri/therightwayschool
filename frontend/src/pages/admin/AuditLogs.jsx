import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Shield } from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/admin/audit-logs');
        setLogs(res.data);
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <AppLoader />;

  const actionColor = (action) => {
    if (action.includes('create') || action.includes('register')) return 'bg-[#C5A55A]/15 text-[#C5A55A]';
    if (action.includes('delete')) return 'bg-red-100 text-red-700';
    if (action.includes('update') || action.includes('grade')) return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="space-y-6" data-testid="audit-logs">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Audit Logs</h1>
        <p className="text-slate-500 mt-1">Complete trail of all system actions</p>
      </div>

      <Card className="rounded-md border-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#2E6CC4]" /> Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-50">Timestamp</TableHead>
                <TableHead className="bg-slate-50">User</TableHead>
                <TableHead className="bg-slate-50">Action</TableHead>
                <TableHead className="bg-slate-50">Entity</TableHead>
                <TableHead className="bg-slate-50">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, i) => (
                <TableRow key={log.log_id || i} data-testid={`audit-row-${i}`}>
                  <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium">{log.user_name}</TableCell>
                  <TableCell>
                    <Badge className={actionColor(log.action)}>{log.action.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{log.entity_type}</TableCell>
                  <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">
                    {JSON.stringify(log.details)}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">No audit logs</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
