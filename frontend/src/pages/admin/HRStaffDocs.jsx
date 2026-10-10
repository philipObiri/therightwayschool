import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, ArrowLeft, FileText, Upload, Download, User, Paperclip, X, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

export default function HRStaffDocs() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [docType, setDocType] = useState('cv');
  const [docTitle, setDocTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/admin/staff').then(r => setStaff(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openStaff = async (member) => {
    setSelectedStaff(member);
    try {
      const res = await api.get('/hr/staff-documents', { params: { user_id: member.user_id } });
      setDocuments(res.data);
    } catch { setDocuments([]); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const uploadRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.post('/hr/staff-documents', {
        user_id: selectedStaff.user_id,
        file_id: uploadRes.data.file_id,
        filename: file.name,
        doc_type: docType,
        title: docTitle || file.name,
      });
      toast.success('Document uploaded');
      setUploadDialog(false);
      setDocTitle('');
      openStaff(selectedStaff);
    } catch { toast.error('Upload failed'); }
    setUploading(false);
    e.target.value = '';
  };

  const deleteDoc = async (docId) => {
    try {
      await api.delete(`/hr/staff-documents/${docId}`);
      toast.success('Deleted');
      openStaff(selectedStaff);
    } catch { toast.error('Failed'); }
  };

  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) || s.role?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <AppLoader />;

  // Staff document view
  if (selectedStaff) {
    return (
      <div className="space-y-5" data-testid="staff-doc-view">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedStaff(null)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <Button className="rounded-md bg-[#2E6CC4]" onClick={() => setUploadDialog(true)} data-testid="upload-doc-btn"><Upload className="w-4 h-4 mr-2" /> Upload Document</Button>
        </div>
        <div className="bg-white rounded-md border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-lg font-bold">{selectedStaff.name?.charAt(0)}</div>
          <div>
            <h2 className="text-lg font-bold text-[#1B2A4A]">{selectedStaff.name}</h2>
            <div className="flex gap-2 mt-1"><Badge variant="secondary">{selectedStaff.role?.replace(/_/g,' ')}</Badge><Badge variant="secondary">{selectedStaff.department}</Badge></div>
          </div>
        </div>
        <Card className="rounded-md border-slate-200">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="w-4 h-4 text-[#2E6CC4]" /> Documents ({documents.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead className="bg-slate-50">Document</TableHead><TableHead className="bg-slate-50">Type</TableHead><TableHead className="bg-slate-50">File</TableHead><TableHead className="bg-slate-50">Date</TableHead><TableHead className="bg-slate-50">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {documents.map(d => (
                <TableRow key={d.doc_id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize text-xs">{d.doc_type?.replace(/_/g,' ')}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-500">{d.filename}</TableCell>
                  <TableCell className="text-xs text-slate-400">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <a href={`${BACKEND}/api/files/${d.file_id}/download`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" className="h-7 text-xs"><Download className="w-3 h-3 mr-1" /> Download</Button></a>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => deleteDoc(d.doc_id)}><X className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">No documents uploaded yet</TableCell></TableRow>}
            </TableBody></Table>
          </CardContent>
        </Card>

        <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document for {selectedStaff.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cv">CV / Resume</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="certificate">Certificate</SelectItem>
                    <SelectItem value="id_document">ID Document</SelectItem>
                    <SelectItem value="qualification">Qualification</SelectItem>
                    <SelectItem value="reference">Reference Letter</SelectItem>
                    <SelectItem value="medical">Medical Record</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Title</Label><Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="e.g. Teaching Certificate 2024" /></div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" />
              <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Choose File & Upload'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Staff list
  return (
    <div className="space-y-5" data-testid="hr-staff-docs">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">Staff Documents</h1><p className="text-slate-500 mt-1">View and manage CVs, certificates, and forms for each staff member</p></div>
      <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-3 py-2 max-w-md">
        <Search className="w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(s => (
          <Card key={s.user_id} className="rounded-md border-slate-200 card-hover cursor-pointer" onClick={() => openStaff(s)} data-testid={`hr-staff-${s.user_id}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white font-bold">{s.name?.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1B2A4A] truncate">{s.name}</p>
                <p className="text-[10px] text-slate-400">{s.role?.replace(/_/g,' ')} | {s.department || '-'}</p>
              </div>
              <FileText className="w-4 h-4 text-slate-300" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
