import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Search, Filter, X } from 'lucide-react';

export function WpAdvancedSearch({ staff, onSearch, onClose }) {
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [status, setStatus] = useState('');
  const [fileType, setFileType] = useState('');
  const [tag, setTag] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const doSearch = () => {
    const params = {};
    if (q) params.q = q;
    if (department) params.department = department;
    if (authorId) params.author_id = authorId;
    if (status) params.status = status;
    if (fileType) params.file_type = fileType;
    if (tag) params.tag = tag;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    onSearch?.(params);
  };

  const clearAll = () => {
    setQ(''); setDepartment(''); setAuthorId(''); setStatus('');
    setFileType(''); setTag(''); setDateFrom(''); setDateTo('');
  };

  const activeFilters = [department, authorId, status, fileType, tag, dateFrom, dateTo].filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3" data-testid="wp-advanced-search">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Search className="w-4 h-4 text-[#1B2A4A]" /><h3 className="text-sm font-semibold text-[#1B2A4A]">Advanced Search</h3>
          {activeFilters > 0 && <Badge className="bg-[#1B2A4A] text-white text-[9px]">{activeFilters} filters</Badge>}
        </div>
        <div className="flex gap-1">
          {activeFilters > 0 && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearAll}>Clear All</Button>}
          {onClose && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><X className="w-3 h-3" /></Button>}
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search documents, folders, tags..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} className="flex-1 h-9 text-xs" data-testid="search-query-input" />
        <Button size="sm" className="bg-[#1B2A4A] rounded-lg text-xs" onClick={doSearch} data-testid="search-submit-btn"><Search className="w-3 h-3 mr-1" /> Search</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <Label className="text-[10px] text-slate-500">Department</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>{['Academics', 'Administration', 'Finance', 'HR', 'ICT', 'Leadership'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">Author</Label>
          <Select value={authorId} onValueChange={setAuthorId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>{(staff || []).map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>{['draft', 'under_review', 'approved', 'rejected', 'published', 'archived'].map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">File Type</Label>
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>{['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg'].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-[10px] text-slate-500">Tag</Label><Input placeholder="e.g. policy" value={tag} onChange={e => setTag(e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-[10px] text-slate-500">From Date</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-[10px] text-slate-500">To Date</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" /></div>
      </div>
    </div>
  );
}
