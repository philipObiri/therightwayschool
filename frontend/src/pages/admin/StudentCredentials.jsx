import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, Key, Users, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AppLoader } from '../../components/AppLoader';

const YEARS = ['All', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];

export default function StudentCredentials() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('All');

  useEffect(() => {
    api.get('/admin/students').then(r => setStudents(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s =>
    (yearFilter === 'All' || s.year_group === yearFilter) &&
    (s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()) || s.admission_number?.toLowerCase().includes(search.toLowerCase()))
  );

  const downloadCSV = () => {
    const rows = [['Name', 'Year Group', 'Email (Login)', 'Password', 'Admission No.']];
    filtered.forEach(s => rows.push([s.name, s.year_group, s.email, 'student123', s.admission_number]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RightWay_Student_Logins_${yearFilter.replace(' ', '_')}.csv`;
    a.click();
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="student-credentials">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Student Login Credentials</h1>
          <p className="text-slate-500 mt-1">{students.length} student accounts | Default password: student123</p>
        </div>
        <Button variant="outline" className="rounded-md" onClick={downloadCSV} data-testid="download-csv">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name, email, or ADM no..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="cred-search" />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-36 rounded-md"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Year group summary */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {YEARS.filter(y => y !== 'All').map(y => {
          const count = students.filter(s => s.year_group === y).length;
          return (
            <button key={y} onClick={() => setYearFilter(y)} className={`p-2 rounded-md text-center border-2 transition-all ${yearFilter === y ? 'border-[#2E6CC4] bg-blue-50' : 'border-slate-200'}`}>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-[10px] text-slate-500">{y}</p>
            </button>
          );
        })}
      </div>

      <Card className="rounded-md border-slate-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4 text-[#2E6CC4]" /> {filtered.length} Students - {yearFilter}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-50">#</TableHead>
                <TableHead className="bg-slate-50">Name</TableHead>
                <TableHead className="bg-slate-50">Year</TableHead>
                <TableHead className="bg-slate-50">Email (Login)</TableHead>
                <TableHead className="bg-slate-50">Password</TableHead>
                <TableHead className="bg-slate-50">ADM No.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, i) => (
                <TableRow key={s.user_id} data-testid={`cred-row-${s.user_id}`}>
                  <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{s.year_group}</Badge></TableCell>
                  <TableCell className="text-sm font-mono text-[#2E6CC4]">{s.email}</TableCell>
                  <TableCell className="text-sm font-mono text-slate-500">student123</TableCell>
                  <TableCell className="text-sm text-slate-500">{s.admission_number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
