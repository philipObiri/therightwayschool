import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import {
  FileText, Download, ArrowLeft, Eye, BarChart3, FolderOpen, Folder,
  BookOpen, ClipboardList, FlaskConical, FileBarChart, CheckCircle, GraduationCap
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

const FOLDER_CONFIG = {
  end_of_term: { icon: BookOpen, color: '#2E6CC4', bg: 'bg-[#2E6CC4]/10', label: 'End of Term' },
  mid_term: { icon: ClipboardList, color: '#C5A55A', bg: 'bg-[#C5A55A]/10', label: 'Mid Term' },
  mocks: { icon: FlaskConical, color: '#7C3AED', bg: 'bg-violet-50', label: 'Mocks' },
  progressives: { icon: FileBarChart, color: '#059669', bg: 'bg-emerald-50', label: 'Progressives' },
};

const gradeColor = (score) => score >= 80 ? 'text-[#C5A55A]' : score >= 60 ? 'text-[#2E6CC4]' : score >= 45 ? 'text-[#F59E0B]' : 'text-[#DC2626]';
const gradeBg = (grade) => grade === 'A*' || grade === 'A' ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : grade === 'B+' || grade === 'B' ? 'bg-[#2E6CC4]/10 text-[#2E6CC4]' : grade === 'C+' || grade === 'C' ? 'bg-blue-100 text-blue-600' : grade === 'D' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';

function ordinalSuffix(n) {
  if (n % 10 === 1 && n !== 11) return 'st';
  if (n % 10 === 2 && n !== 12) return 'nd';
  if (n % 10 === 3 && n !== 13) return 'rd';
  return 'th';
}

export default function ParentReportCards() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(activeTerm || 'Term 1');
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [reportCard, setReportCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (activeTerm) setSelectedTerm(activeTerm); }, [activeTerm]);

  useEffect(() => {
    const fetchChildren = async () => {
      const kids = [];
      for (const id of (user?.children_ids || [])) {
        try { const r = await api.get(`/admin/students/${id}`); kids.push(r.data); } catch {}
      }
      setChildren(kids);
      if (kids.length === 1) selectChild(kids[0]);
      setLoading(false);
    };
    if (user) fetchChildren();
  }, [user]);

  const selectChild = async (child) => {
    setSelectedChild(child);
    setSelectedFolder(null);
    setReportCard(null);
    try {
      const res = await api.get(`/gradebook/report-types/${child.user_id}`, { params: { term: selectedTerm } });
      setReportTypes(res.data.report_types || []);
    } catch { toast.error('Failed to load report types'); }
  };

  useEffect(() => {
    if (selectedChild) selectChild(selectedChild);
  }, [selectedTerm]);

  const openFolder = async (reportType) => {
    setSelectedFolder(reportType);
    try {
      const res = await api.get(`/gradebook/report-card/${selectedChild.user_id}`, {
        params: { term: selectedTerm, report_type: reportType === 'full' ? undefined : reportType }
      });
      setReportCard(res.data);
    } catch { toast.error('Failed to load report card'); }
  };

  const downloadPdf = (reportType) => {
    const token = localStorage.getItem('rw_token');
    let url = `${BACKEND}/api/gradebook/report-card/${selectedChild.user_id}/pdf?term=${encodeURIComponent(selectedTerm)}`;
    if (reportType && reportType !== 'full') url += `&report_type=${encodeURIComponent(reportType)}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const typeSuffix = reportType && reportType !== 'full' ? `_${reportType}` : '';
        a.download = `ReportCard_${selectedChild.name.replace(/\s/g, '_')}_${selectedTerm.replace(/\s/g, '_')}${typeSuffix}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('PDF downloaded');
      })
      .catch(() => toast.error('Download failed'));
  };

  if (loading) return <AppLoader />;

  // ─── REPORT DETAIL ───
  if (selectedChild && selectedFolder && reportCard) {
    const cfg = FOLDER_CONFIG[selectedFolder] || {};

    return (
      <div className="space-y-6" data-testid="parent-report-card-detail">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {children.length > 1 && <><button onClick={() => { setSelectedChild(null); setSelectedFolder(null); setReportCard(null); setReportTypes([]); }} className="hover:text-[#2E6CC4]">Children</button><span>/</span></>}
          <button onClick={() => { setSelectedFolder(null); setReportCard(null); }} className="hover:text-[#2E6CC4]">{selectedChild.name}</button>
          <span>/</span>
          <span className="text-[#1B2A4A] font-medium">{cfg.label || 'Full Report'}</span>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFolder(null); setReportCard(null); }} data-testid="back-to-folders-parent">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Folders
          </Button>
          <Button className="rounded-lg bg-[#2E6CC4] hover:bg-[#2560B0] text-white" onClick={() => downloadPdf(selectedFolder)} data-testid="parent-download-pdf-btn">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>

        <Card className="rounded-xl border-slate-100 max-w-4xl mx-auto shadow-sm">
          <div className="bg-[#2A7A5A] text-white rounded-t-xl p-6 text-center">
            <p className="text-xl font-bold">The RightWay Centre of Learning</p>
            <p className="text-sm opacity-80 mt-1">{reportCard.report_label || 'Academic Report'} — {selectedTerm}</p>
          </div>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">Student</p><p className="text-sm font-semibold">{reportCard.student?.name}</p></div>
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">Class</p><p className="text-sm font-semibold">{reportCard.class?.name}</p></div>
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">ADM No.</p><p className="text-sm font-semibold">{reportCard.student?.admission_number}</p></div>
              <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">Year Group</p><p className="text-sm font-semibold">{reportCard.student?.year_group}</p></div>
            </div>

            {reportCard.grades?.length > 0 ? (
              <div className="overflow-x-auto">
                {selectedFolder === 'progressives' ? (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Subject</TableHead>
                      <TableHead className="bg-slate-50 text-center">P1 /100</TableHead>
                      <TableHead className="bg-slate-50 text-center">P2 /100</TableHead>
                      <TableHead className="bg-slate-50 text-center">P3 /100</TableHead>
                      <TableHead className="bg-slate-50 text-center">Average</TableHead>
                      <TableHead className="bg-slate-50 text-center">Grade</TableHead>
                      <TableHead className="bg-slate-50">Remark</TableHead>
                    </TableRow></TableHeader>
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
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Subject</TableHead>
                      <TableHead className="bg-slate-50 text-center">Score /100</TableHead>
                      <TableHead className="bg-slate-50 text-center">Grade</TableHead>
                      <TableHead className="bg-slate-50">Remark</TableHead>
                      <TableHead className="bg-slate-50">Teacher Comment</TableHead>
                    </TableRow></TableHeader>
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
                    <TableHeader><TableRow>
                      <TableHead className="bg-slate-50">Subject</TableHead>
                      <TableHead className="bg-slate-50 text-center">CA /30</TableHead>
                      <TableHead className="bg-slate-50 text-center">Exam /70</TableHead>
                      <TableHead className="bg-slate-50 text-center">Final %</TableHead>
                      <TableHead className="bg-slate-50 text-center">Grade</TableHead>
                      <TableHead className="bg-slate-50">Remark</TableHead>
                      <TableHead className="bg-slate-50">Teacher Comment</TableHead>
                    </TableRow></TableHeader>
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
                <p className="text-sm">No grades entered yet for {cfg.label || 'this report'} in {selectedTerm}</p>
              </div>
            )}

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
                      <p className="text-3xl font-bold text-[#1B2A4A]">{reportCard.position}<sup className="text-sm">{ordinalSuffix(reportCard.position)}</sup></p>
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

  // ─── FOLDER VIEW ───
  if (selectedChild) {
    return (
      <div className="space-y-6" data-testid="parent-report-folders">
        {children.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <button onClick={() => { setSelectedChild(null); setReportTypes([]); }} className="hover:text-[#2E6CC4]">Children</button>
            <span>/</span>
            <span className="text-[#1B2A4A] font-medium">{selectedChild.name}</span>
          </div>
        )}

        {children.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => { setSelectedChild(null); setReportTypes([]); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Switch Child
          </Button>
        )}

        <Card className="rounded-xl border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-[#1B2A4A] p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold text-[#C5A55A]">
              {selectedChild.name?.charAt(0)}
            </div>
            <div className="text-white flex-1">
              <h2 className="text-lg font-bold">{selectedChild.name}</h2>
              <p className="text-sm text-slate-300">ADM: {selectedChild.admission_number || 'N/A'} &middot; {selectedChild.year_group}</p>
            </div>
            <div className="w-36">
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="rounded-lg h-9 text-xs bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1">Term 1</SelectItem>
                  <SelectItem value="Term 2">Term 2</SelectItem>
                  <SelectItem value="Term 3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Report Card Folders</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(FOLDER_CONFIG).map(([key, cfg]) => {
              const typeInfo = reportTypes.find(rt => rt.type === key);
              const hasData = typeInfo?.has_data || false;
              const subjectCount = typeInfo?.subject_count || 0;
              const Icon = cfg.icon;
              return (
                <button key={key} onClick={() => openFolder(key)}
                  className={`group relative rounded-xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${hasData ? 'border-slate-200 bg-white cursor-pointer' : 'border-dashed border-slate-200 bg-slate-50/50 cursor-pointer'}`}
                  data-testid={`parent-folder-${key}`}
                >
                  <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)` }} />
                  <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center mb-3`}>
                    {hasData ? <FolderOpen className="w-6 h-6" style={{ color: cfg.color }} /> : <Folder className="w-6 h-6 text-slate-400" />}
                  </div>
                  <p className="font-semibold text-[#1B2A4A] text-sm">{cfg.label}</p>
                  {hasData ? (
                    <p className="text-xs text-slate-500 mt-1">{subjectCount} subject{subjectCount !== 1 ? 's' : ''} graded</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">No data yet</p>
                  )}
                  {hasData && <Badge className="mt-2 bg-[#C5A55A]/15 text-[#C5A55A] text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Available</Badge>}
                </button>
              );
            })}
          </div>
        </div>

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
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => openFolder('full')} data-testid="parent-view-full-report">
                <Eye className="w-3 h-3 mr-1" /> View
              </Button>
              <Button size="sm" className="rounded-lg text-xs bg-[#2E6CC4] hover:bg-[#2560B0] text-white" onClick={() => downloadPdf(null)} data-testid="parent-download-full-report">
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── CHILD SELECTOR ───
  return (
    <div className="space-y-6" data-testid="parent-report-cards-page">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Report Cards</h1>
        <p className="text-slate-500 text-sm mt-1">View your child's categorized report cards</p>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <GraduationCap className="w-14 h-14 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">No wards linked to your account. Contact the school admin.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => (
            <Card key={child.user_id} className="rounded-xl border-slate-200 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all" onClick={() => selectChild(child)}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#1B2A4A] flex items-center justify-center text-white text-xl font-bold">{child.name?.charAt(0)}</div>
                <div>
                  <h3 className="font-semibold text-[#1B2A4A]">{child.name}</h3>
                  <p className="text-xs text-slate-500">{child.year_group} | {child.admission_number}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
