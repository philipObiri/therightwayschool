import { useTerm } from '../../contexts/TermContext';
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import {
  FileText, Download, GraduationCap, ArrowLeft, Eye,
  CheckCircle, Clock, Search, BarChart3, FolderOpen, Folder,
  BookOpen, ClipboardList, FlaskConical, FileBarChart
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;
const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];

const FOLDER_CONFIG = {
  end_of_term: { icon: BookOpen, color: '#2E6CC4', bg: 'bg-[#2E6CC4]/10', label: 'End of Term' },
  mid_term: { icon: ClipboardList, color: '#C5A55A', bg: 'bg-[#C5A55A]/10', label: 'Mid Term' },
  mocks: { icon: FlaskConical, color: '#7C3AED', bg: 'bg-violet-50', label: 'Mocks' },
  progressives: { icon: FileBarChart, color: '#059669', bg: 'bg-emerald-50', label: 'Progressives' },
};

export default function ReportCardsPage() {
  const { activeTerm } = useTerm();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(activeTerm || 'Term 1');
  useEffect(() => { setSelectedTerm(activeTerm); }, [activeTerm]);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [reportCard, setReportCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/academic/classes').then(r => setClasses(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadStudents = async (classId) => {
    setSelectedClass(classId);
    setSelectedStudent(null);
    setReportTypes([]);
    setSelectedFolder(null);
    setReportCard(null);
    try {
      const res = await api.get('/admin/students', { params: { class_id: classId } });
      const enriched = await Promise.all(res.data.map(async (s) => {
        try {
          const grades = await api.get('/gradebook/entries', { params: { student_id: s.user_id, term: selectedTerm } });
          s.grade_count = grades.data.length;
          s.has_grades = grades.data.length > 0;
          const finals = grades.data.filter(g => g.final_score).map(g => g.final_score);
          s.avg_score = finals.length > 0 ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : null;
        } catch { s.grade_count = 0; s.has_grades = false; s.avg_score = null; }
        return s;
      }));
      setStudents(enriched);
    } catch { toast.error('Failed to load students'); }
  };

  const selectStudent = async (student) => {
    setSelectedStudent(student);
    setSelectedFolder(null);
    setReportCard(null);
    try {
      const res = await api.get(`/gradebook/report-types/${student.user_id}`, { params: { term: selectedTerm } });
      setReportTypes(res.data.report_types || []);
    } catch { toast.error('Failed to load report types'); }
  };

  const openFolder = async (reportType) => {
    setSelectedFolder(reportType);
    try {
      const res = await api.get(`/gradebook/report-card/${selectedStudent.user_id}`, {
        params: { term: selectedTerm, report_type: reportType }
      });
      setReportCard(res.data);
    } catch { toast.error('Failed to load report card'); }
  };

  const downloadPdf = (studentId, studentName, reportType) => {
    const token = localStorage.getItem('rw_token');
    let url = `${BACKEND}/api/gradebook/report-card/${studentId}/pdf?term=${encodeURIComponent(selectedTerm)}`;
    if (reportType) url += `&report_type=${encodeURIComponent(reportType)}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const typeSuffix = reportType ? `_${reportType}` : '';
        a.download = `ReportCard_${studentName.replace(/\s/g, '_')}_${selectedTerm.replace(/\s/g, '_')}${typeSuffix}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('PDF downloaded');
      })
      .catch(() => toast.error('Download failed'));
  };

  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const studentsWithGrades = students.filter(s => s.has_grades);

  if (loading) return <AppLoader />;

  // ─── STEP 3: Report Card Detail (inside a folder) ───
  if (selectedStudent && selectedFolder && reportCard) {
    const gradeColor = (score) => score >= 80 ? 'text-[#C5A55A]' : score >= 60 ? 'text-[#2E6CC4]' : score >= 45 ? 'text-[#F59E0B]' : 'text-[#DC2626]';
    const gradeBg = (grade) => grade === 'A*' || grade === 'A' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : grade === 'B+' || grade === 'B' ? 'bg-[#2E6CC4]/10 text-[#2E6CC4]' : grade === 'C+' || grade === 'C' ? 'bg-blue-100 text-blue-600' : grade === 'D' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
    const cfg = FOLDER_CONFIG[selectedFolder] || {};

    return (
      <div className="space-y-6" data-testid="report-card-detail">
        {/* Breadcrumb nav */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button onClick={() => { setSelectedStudent(null); setSelectedFolder(null); setReportCard(null); setReportTypes([]); }} className="hover:text-[#2E6CC4] transition-colors" data-testid="breadcrumb-students">Students</button>
          <span>/</span>
          <button onClick={() => { setSelectedFolder(null); setReportCard(null); }} className="hover:text-[#2E6CC4] transition-colors" data-testid="breadcrumb-folders">{selectedStudent.name}</button>
          <span>/</span>
          <span className="text-[#1B2A4A] font-medium">{cfg.label || selectedFolder}</span>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFolder(null); setReportCard(null); }} data-testid="back-to-folders">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Folders
          </Button>
          <Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#2560B0] text-white" onClick={() => downloadPdf(selectedStudent.user_id, selectedStudent.name, selectedFolder)} data-testid="download-pdf-btn">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>

        <Card className="rounded-xl border-slate-100 max-w-4xl mx-auto shadow-sm">
          <div className="bg-[#2A7A5A] text-white rounded-t-xl p-6 text-center">
            <p className="text-xl font-bold">The RightWay Centre of Learning</p>
            <p className="text-sm opacity-80 mt-1">{reportCard.report_label || 'Academic Report'} — {selectedTerm}</p>
          </div>
          <CardContent className="p-6 space-y-5">
            {/* Student info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">Student</p><p className="text-sm font-semibold">{reportCard.student?.name}</p></div>
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">Class</p><p className="text-sm font-semibold">{reportCard.class?.name}</p></div>
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">ADM No.</p><p className="text-sm font-semibold">{reportCard.student?.admission_number}</p></div>
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">Year Group</p><p className="text-sm font-semibold">{reportCard.student?.year_group}</p></div>
            </div>

            {/* Grades table */}
            {reportCard.grades?.length > 0 ? (
              <div className="overflow-x-auto">
                {selectedFolder === 'progressives' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-slate-50">Subject</TableHead>
                        <TableHead className="bg-slate-50 text-center">P1 /100</TableHead>
                        <TableHead className="bg-slate-50 text-center">P2 /100</TableHead>
                        <TableHead className="bg-slate-50 text-center">P3 /100</TableHead>
                        <TableHead className="bg-slate-50 text-center">Average</TableHead>
                        <TableHead className="bg-slate-50 text-center">Grade</TableHead>
                        <TableHead className="bg-slate-50">Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportCard.grades.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{g.subject}</TableCell>
                          <TableCell className="text-center">{g.progressive_1 || '-'}</TableCell>
                          <TableCell className="text-center">{g.progressive_2 || '-'}</TableCell>
                          <TableCell className="text-center">{g.progressive_3 || '-'}</TableCell>
                          <TableCell className={`text-center font-bold ${gradeColor(g.average)}`}>{g.average}%</TableCell>
                          <TableCell className="text-center"><Badge className={gradeBg(g.grade)}>{g.grade}</Badge></TableCell>
                          <TableCell className="text-sm text-slate-500">{g.remark}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (selectedFolder === 'mid_term' || selectedFolder === 'mocks') ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-slate-50">Subject</TableHead>
                        <TableHead className="bg-slate-50 text-center">Score /100</TableHead>
                        <TableHead className="bg-slate-50 text-center">Grade</TableHead>
                        <TableHead className="bg-slate-50">Remark</TableHead>
                        <TableHead className="bg-slate-50">Teacher Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportCard.grades.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{g.subject}</TableCell>
                          <TableCell className={`text-center font-bold ${gradeColor(g.score)}`}>{g.score}/{g.max_score}</TableCell>
                          <TableCell className="text-center"><Badge className={gradeBg(g.grade)}>{g.grade}</Badge></TableCell>
                          <TableCell className="text-sm text-slate-500">{g.remark}</TableCell>
                          <TableCell className="text-xs text-slate-400 max-w-[150px] truncate">{g.comment || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-slate-50">Subject</TableHead>
                        <TableHead className="bg-slate-50 text-center">CA /30</TableHead>
                        <TableHead className="bg-slate-50 text-center">Exam /70</TableHead>
                        <TableHead className="bg-slate-50 text-center">Final %</TableHead>
                        <TableHead className="bg-slate-50 text-center">Grade</TableHead>
                        <TableHead className="bg-slate-50">Remark</TableHead>
                        <TableHead className="bg-slate-50">Teacher Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportCard.grades.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{g.subject}</TableCell>
                          <TableCell className="text-center">{g.ca_score}/{g.ca_max}</TableCell>
                          <TableCell className="text-center">{g.exam_score}/{g.exam_max}</TableCell>
                          <TableCell className={`text-center font-bold ${gradeColor(g.final_score)}`}>{g.final_score}%</TableCell>
                          <TableCell className="text-center"><Badge className={gradeBg(g.grade)}>{g.grade}</Badge></TableCell>
                          <TableCell className="text-sm text-slate-500">{g.remark}</TableCell>
                          <TableCell className="text-xs text-slate-400 max-w-[150px] truncate">{g.comment || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No grades entered yet for {cfg.label} in {selectedTerm}</p>
              </div>
            )}

            {/* Summary */}
            {reportCard.grades?.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#1B2A4A] rounded-lg p-4 text-center">
                  <p className="text-[10px] text-[#C5A55A] uppercase tracking-wide font-semibold">Overall GPA</p>
                  <p className="text-4xl font-bold text-white mt-1">{reportCard.overall_gpa?.toFixed(2) || '0.00'}</p>
                  <p className="text-xs text-slate-300 mt-1">out of 4.00</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Average</p>
                  <p className={`text-3xl font-bold ${gradeColor(reportCard.average)}`}>{reportCard.average}%</p>
                  <Badge className={`mt-1 ${gradeBg(reportCard.overall_grade)}`}>{reportCard.overall_grade} — {reportCard.overall_remark}</Badge>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Class Position</p>
                  {reportCard.position ? (
                    <>
                      <p className="text-3xl font-bold text-[#1B2A4A]">{reportCard.position}<sup className="text-sm">{reportCard.position % 10 === 1 && reportCard.position !== 11 ? 'st' : reportCard.position % 10 === 2 && reportCard.position !== 12 ? 'nd' : reportCard.position % 10 === 3 && reportCard.position !== 13 ? 'rd' : 'th'}</sup></p>
                      <p className="text-xs text-slate-400 mt-1">out of {reportCard.total_in_class} students</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 mt-2">Not ranked yet</p>
                  )}
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Attendance</p>
                  <p className="text-sm mt-2">Present: <strong>{reportCard.attendance?.present || 0}</strong> | Absent: <strong>{reportCard.attendance?.absent || 0}</strong></p>
                  <p className="text-xs text-slate-400 mt-1">Rate: {reportCard.attendance?.total ? Math.round(reportCard.attendance.present / reportCard.attendance.total * 100) : 0}%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── STEP 2: Folder View for Selected Student ───
  if (selectedStudent) {
    return (
      <div className="space-y-6" data-testid="report-folders-view">
        {/* Breadcrumb nav */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button onClick={() => { setSelectedStudent(null); setReportTypes([]); }} className="hover:text-[#2E6CC4] transition-colors" data-testid="breadcrumb-students-list">Students</button>
          <span>/</span>
          <span className="text-[#1B2A4A] font-medium">{selectedStudent.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setReportTypes([]); }} data-testid="back-to-students">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Students
          </Button>
        </div>

        {/* Student header card */}
        <Card className="rounded-xl border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-[#1B2A4A] p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold text-[#C5A55A]">
              {selectedStudent.name?.charAt(0)}
            </div>
            <div className="text-white">
              <h2 className="text-lg font-bold">{selectedStudent.name}</h2>
              <p className="text-sm text-slate-300">ADM: {selectedStudent.admission_number || 'N/A'} &middot; {selectedTerm}</p>
            </div>
            {selectedStudent.avg_score !== null && (
              <div className="ml-auto text-center">
                <p className="text-3xl font-bold text-[#C5A55A]">{selectedStudent.avg_score}%</p>
                <p className="text-xs text-slate-300">Overall Avg</p>
              </div>
            )}
          </div>
        </Card>

        {/* Report Type Folders */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Report Card Folders</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(FOLDER_CONFIG).map(([key, cfg]) => {
              const typeInfo = reportTypes.find(rt => rt.type === key);
              const hasData = typeInfo?.has_data || false;
              const subjectCount = typeInfo?.subject_count || 0;
              const Icon = cfg.icon;

              return (
                <button
                  key={key}
                  onClick={() => openFolder(key)}
                  className={`group relative rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${hasData ? 'border-slate-200 bg-white cursor-pointer' : 'border-dashed border-slate-200 bg-slate-50/50 cursor-pointer'}`}
                  data-testid={`folder-${key}`}
                >
                  {/* Hover accent */}
                  <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)` }} />

                  <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center mb-3`}>
                    {hasData ? (
                      <FolderOpen className="w-6 h-6" style={{ color: cfg.color }} />
                    ) : (
                      <Folder className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <p className="font-semibold text-[#1B2A4A] text-sm">{cfg.label}</p>
                  {hasData ? (
                    <p className="text-xs text-slate-500 mt-1">{subjectCount} subject{subjectCount !== 1 ? 's' : ''} graded</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">No data yet</p>
                  )}
                  {hasData && (
                    <Badge className="mt-2 bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]">
                      <CheckCircle className="w-3 h-3 mr-1" /> Available
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Full Report shortcut */}
        <Card className="rounded-xl border-slate-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1B2A4A]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#1B2A4A]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1B2A4A]">Full Academic Report</p>
                <p className="text-xs text-slate-500">Combined report with all assessment types</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => openFolder('full')} data-testid="view-full-report">
                <Eye className="w-3 h-3 mr-1" /> View
              </Button>
              <Button size="sm" className="rounded-lg text-xs bg-[#2E6CC4] hover:bg-[#2560B0] text-white" onClick={() => downloadPdf(selectedStudent.user_id, selectedStudent.name, null)} data-testid="download-full-report">
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── STEP 1: Class & Student List ───
  return (
    <div className="space-y-6" data-testid="report-cards-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Report Cards</h1>
          <p className="text-slate-500 text-sm mt-1">Select a student to view categorized report card folders</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="flex gap-4 items-end flex-wrap">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-600">Class</Label>
          <Select value={selectedClass} onValueChange={loadStudents}>
            <SelectTrigger className="w-52 rounded-lg" data-testid="rc-class-select"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-600">Term</Label>
          <Select value={selectedTerm} onValueChange={v => { setSelectedTerm(v); if (selectedClass) loadStudents(selectedClass); }}>
            <SelectTrigger className="w-36 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent>
          </Select>
        </div>
        {students.length > 0 && (
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2 flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" data-testid="rc-search" />
          </div>
        )}
      </div>

      {/* Progress summary */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#1B2A4A]">{students.length}</p>
            <p className="text-xs text-slate-500">Total Students</p>
          </div>
          <div className="bg-white rounded-xl border border-[#C5A55A]/20 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#C5A55A]">{studentsWithGrades.length}</p>
            <p className="text-xs text-slate-600">Have Grades</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-[#F59E0B]">{students.length - studentsWithGrades.length}</p>
            <p className="text-xs text-slate-600">Awaiting Grades</p>
          </div>
        </div>
      )}

      {/* Student list */}
      {students.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider">#</TableHead>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider">Student</TableHead>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider">ADM No.</TableHead>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider text-center">Subjects</TableHead>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider text-center">Average</TableHead>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="bg-slate-50/50 text-xs uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, idx) => (
                <TableRow key={s.user_id} className={`${s.has_grades ? '' : 'opacity-60'} hover:bg-slate-50/50 transition-colors cursor-pointer`} onClick={() => selectStudent(s)} data-testid={`rc-row-${s.user_id}`}>
                  <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${s.has_grades ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : 'bg-slate-100 text-slate-400'}`}>{s.name?.charAt(0)}</div>
                      <span className="text-sm">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{s.admission_number || '-'}</TableCell>
                  <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{s.grade_count || 0}</Badge></TableCell>
                  <TableCell className="text-center">{s.avg_score !== null ? <span className={`font-bold text-sm ${s.avg_score >= 60 ? 'text-[#C5A55A]' : s.avg_score >= 40 ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{s.avg_score}%</span> : <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-center">{s.has_grades ? <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Ready</Badge> : <Badge className="bg-slate-100 text-slate-500 text-[10px]"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-[#2E6CC4]" onClick={(e) => { e.stopPropagation(); selectStudent(s); }} data-testid={`open-folders-${s.user_id}`}>
                      <FolderOpen className="w-3 h-3 mr-1" /> Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!selectedClass && (
        <div className="text-center py-16 text-slate-400">
          <GraduationCap className="w-14 h-14 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Select a class to view student report cards</p>
        </div>
      )}

      {selectedClass && students.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <GraduationCap className="w-14 h-14 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">No students found in this class</p>
        </div>
      )}
    </div>
  );
}
