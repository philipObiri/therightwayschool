import React, { useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Upload, FileSpreadsheet, FileText, CheckCircle, AlertCircle, Users, GraduationCap, ArrowRight, Loader2, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';

export default function BulkUploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ create_students: true, create_parents: true, default_year_group: '' });

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'docx'].includes(ext)) {
      toast.error('Please upload an Excel (.xlsx/.xls) or Word (.docx) file');
      return;
    }
    setFile(f);
    setPreview(null);
    setResult(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/bulk-upload/preview?account_type=student', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(r.data);
      if (r.data.total_rows === 0) toast.error('No student records found in the file');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to parse file'); }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!preview?.all_data) return;
    setCreating(true);
    try {
      const r = await api.post('/bulk-upload/create-accounts', {
        records: preview.all_data,
        ...options,
      });
      setResult(r.data);
      successToast(`${r.data.students_created} students & ${r.data.parents_created} parents created`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to create accounts'); }
    setCreating(false);
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); };

  const downloadTemplate = async (fmt) => {
    try {
      const r = await api.get(`/bulk-upload/template?fmt=${fmt}`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: r.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RightWay_Bulk_Upload_Template.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      successToast(`Template downloaded (.${fmt})`);
    } catch (e) { toast.error('Failed to download template'); }
  };

  // ─── RESULT VIEW ───
  if (result) {
    return (
      <div className="space-y-6 animate-fade-in" data-testid="bulk-upload-result">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">Upload Complete</h1>
            <p className="text-sm text-slate-500">Accounts created successfully</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
          <Card className="rounded-md border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.students_created}</p>
              <p className="text-[10px] text-green-600 uppercase tracking-wider">Students Created</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{result.parents_created}</p>
              <p className="text-[10px] text-blue-600 uppercase tracking-wider">Parents Created</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{result.parents_updated}</p>
              <p className="text-[10px] text-amber-600 uppercase tracking-wider">Parents Updated</p>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{result.students_skipped}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Already Existed</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-md border-slate-200">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Default Login Credentials</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-md p-3">
                <p className="text-xs text-slate-500 uppercase mb-1">Students</p>
                <p className="font-mono text-[#1B2A4A]">Password: <strong>{result.default_passwords?.students || 'student123'}</strong></p>
              </div>
              <div className="bg-slate-50 rounded-md p-3">
                <p className="text-xs text-slate-500 uppercase mb-1">Parents</p>
                <p className="font-mono text-[#1B2A4A]">Password: <strong>{result.default_passwords?.parents || 'parent123'}</strong></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={reset} className="bg-[#2E6CC4]" data-testid="upload-another-btn">
          <Upload className="w-4 h-4 mr-2" /> Upload Another File
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bulk-upload-page">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Bulk Account Upload</h1>
          <p className="text-slate-500 text-sm mt-1">Upload an Excel or Word file with student/parent data to create accounts in bulk</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-md" onClick={() => downloadTemplate('xlsx')} data-testid="download-xlsx-template">
            <Download className="w-4 h-4 mr-1.5" /> Excel Template
          </Button>
          <Button variant="outline" size="sm" className="rounded-md" onClick={() => downloadTemplate('docx')} data-testid="download-docx-template">
            <Download className="w-4 h-4 mr-1.5" /> Word Template
          </Button>
        </div>
      </div>

      {/* Step 1: File Upload */}
      <Card className="rounded-md border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#2E6CC4] text-white flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-base font-semibold text-[#1B2A4A]">Upload File</h2>
          </div>

          {!file ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-10 cursor-pointer hover:border-[#2E6CC4] hover:bg-blue-50/30 transition-all" data-testid="file-dropzone">
              <input type="file" accept=".xlsx,.xls,.docx" className="hidden" onChange={handleFileSelect} data-testid="file-input" />
              <Upload className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-[#1B2A4A] mb-1">Click to upload Excel or Word file</p>
              <p className="text-xs text-slate-400">Supports .xlsx, .xls, .docx</p>
              <div className="flex gap-3 mt-4">
                <Badge variant="secondary" className="text-[10px]"><FileSpreadsheet className="w-3 h-3 mr-1" /> Excel</Badge>
                <Badge variant="secondary" className="text-[10px]"><FileText className="w-3 h-3 mr-1" /> Word</Badge>
              </div>
            </label>
          ) : (
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-4">
              <FileSpreadsheet className="w-8 h-8 text-[#2E6CC4]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1B2A4A]">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => { setFile(null); setPreview(null); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded" data-testid="remove-file">
                <X className="w-4 h-4" />
              </button>
              {!preview && (
                <Button onClick={handlePreview} disabled={uploading} className="bg-[#2E6CC4]" data-testid="preview-btn">
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  {uploading ? 'Parsing...' : 'Parse & Preview'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Preview */}
      {preview && (
        <Card className="rounded-md border-slate-200 animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#C5A55A] text-white flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-base font-semibold text-[#1B2A4A]">Preview & Configure</h2>
              <Badge className="bg-green-100 text-green-700 text-xs ml-auto">{preview.total_rows} records found</Badge>
            </div>

            {/* Column mapping */}
            <div className="mb-4 bg-slate-50 rounded-md p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Detected Columns</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.column_mapping || {}).map(([field, col]) => (
                  <Badge key={field} variant="secondary" className="text-[10px]">
                    <span className="text-[#2E6CC4] font-bold">{field.replace('_', ' ')}</span>
                    <span className="mx-1 text-slate-300">&rarr;</span>
                    <span>{col}</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 bg-white rounded-md border border-slate-200 cursor-pointer hover:border-[#2E6CC4] transition-colors">
                <input type="checkbox" checked={options.create_students} onChange={e => setOptions({ ...options, create_students: e.target.checked })} className="w-4 h-4 rounded" data-testid="opt-students" />
                <div>
                  <p className="text-sm font-medium text-[#1B2A4A]"><GraduationCap className="w-3.5 h-3.5 inline mr-1" />Create Students</p>
                  <p className="text-[10px] text-slate-400">Default pw: student123</p>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 bg-white rounded-md border border-slate-200 cursor-pointer hover:border-[#2E6CC4] transition-colors">
                <input type="checkbox" checked={options.create_parents} onChange={e => setOptions({ ...options, create_parents: e.target.checked })} className="w-4 h-4 rounded" data-testid="opt-parents" />
                <div>
                  <p className="text-sm font-medium text-[#1B2A4A]"><Users className="w-3.5 h-3.5 inline mr-1" />Create Parents</p>
                  <p className="text-[10px] text-slate-400">Default pw: parent123</p>
                </div>
              </label>
              <div className="p-3 bg-white rounded-md border border-slate-200">
                <Label className="text-xs text-slate-500 mb-1 block">Default Year Group (if not in file)</Label>
                <select value={options.default_year_group} onChange={e => setOptions({ ...options, default_year_group: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" data-testid="default-year">
                  <option value="">Auto-detect</option>
                  {['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Data preview table */}
            <div className="border rounded-md overflow-x-auto max-h-[350px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px] w-8">#</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Student Name</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Year</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Gender</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Boarding</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Parent Name</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Parent Email</TableHead>
                    <TableHead className="bg-[#1B2A4A] text-white text-[10px]">Parent Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(preview.all_data || []).map((r, i) => (
                    <TableRow key={i} className={i % 2 === 0 ? '' : 'bg-slate-50/50'}>
                      <TableCell className="text-[10px] text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{r.student_name}</TableCell>
                      <TableCell className="text-xs">{r.year_group || <span className="text-slate-300">-</span>}</TableCell>
                      <TableCell className="text-xs">{r.gender || '-'}</TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary" className="text-[9px] capitalize">{r.boarding_status}</Badge></TableCell>
                      <TableCell className="text-xs">{r.parent_name || <span className="text-slate-300">-</span>}</TableCell>
                      <TableCell className="text-xs font-mono text-[#2E6CC4]">{r.parent_email || <span className="text-slate-300">auto-gen</span>}</TableCell>
                      <TableCell className="text-xs">{r.parent_phone || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full mt-4 bg-[#1B2A4A] hover:bg-[#1B2A4A]/90 h-11 text-base" data-testid="create-accounts-btn">
              {creating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
              {creating ? 'Creating Accounts...' : `Create ${preview.total_rows} Account(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Help text */}
      <div className="bg-blue-50/50 rounded-md border border-blue-100 p-4">
        <h3 className="text-xs font-semibold text-[#2E6CC4] mb-2">How it works</h3>
        <ul className="text-xs text-slate-500 space-y-1">
          <li>1. <strong>Download a template</strong> (Excel or Word) using the buttons above — it has the exact headers the system understands plus 3 example rows.</li>
          <li>2. Fill in your students (only <strong>Student Name</strong> is required; all other columns are optional).</li>
          <li>3. Upload the file — the system auto-detects columns (name, year group, parent email, phone, etc.).</li>
          <li>4. Preview the parsed data and choose what accounts to create.</li>
          <li>5. Click "Create Accounts" — students get <code className="bg-slate-100 px-1 rounded">student123</code> and parents get <code className="bg-slate-100 px-1 rounded">parent123</code> as default passwords.</li>
          <li>6. Duplicate students (same name) are automatically skipped. Siblings are linked to the same parent account.</li>
        </ul>
      </div>
    </div>
  );
}
