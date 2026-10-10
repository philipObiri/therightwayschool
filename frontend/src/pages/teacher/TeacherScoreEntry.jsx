import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTerm } from '../../contexts/TermContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Save, BarChart3, CheckCircle, Calculator, BookOpen, FileText, PenSquare, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { AppLoader } from '../../components/AppLoader';

const SCORE_TYPES = [
  { value: 'classwork', label: 'Homework / Classwork', icon: PenSquare, max: 100 },
  { value: 'progressive_test_1', label: 'Progressive Test 1', icon: FileText, max: 100 },
  { value: 'progressive_test_2', label: 'Progressive Test 2', icon: FileText, max: 100 },
  { value: 'progressive_test_3', label: 'Progressive Test 3', icon: FileText, max: 100 },
  { value: 'mid_term', label: 'Mid Term Exam', icon: ClipboardList, max: 100 },
  { value: 'mock_exam', label: 'Mock Exam', icon: ClipboardList, max: 100 },
  { value: 'end_of_term', label: 'End of Term Exam', icon: BookOpen, max: 70 },
];

function gradeColor(g) {
  if (!g) return 'bg-slate-100 text-slate-400';
  if (g === 'A*' || g === 'A') return 'bg-[#C5A55A]/15 text-[#C5A55A]';
  if (g === 'B+' || g === 'B') return 'bg-[#2E6CC4]/10 text-[#2E6CC4]';
  if (g === 'C+' || g === 'C') return 'bg-blue-100 text-blue-600';
  if (g === 'D') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

export default function TeacherScoreEntry() {
  const { user } = useAuth();
  const { activeTerm } = useTerm();
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState(activeTerm || 'Term 1');
  const [selectedScoreType, setSelectedScoreType] = useState('end_of_term');
  const [scores, setScores] = useState({});
  const [existingGrades, setExistingGrades] = useState({});
  const [caBreakdown, setCaBreakdown] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (activeTerm) setSelectedTerm(activeTerm); }, [activeTerm]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [clsRes, subjRes] = await Promise.all([api.get('/behaviour/my-classes'), api.get('/academic/subjects')]);
        setClasses(clsRes.data); setSubjects(subjRes.data);
      } catch (err) { console.error("API error:", err); }
      setLoading(false);
    };
    fetch();
  }, []);

  const loadStudents = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const params = selectedSubject ? { subject_id: selectedSubject } : {};
      const res = await api.get(`/behaviour/class-students/${selectedClass}`, { params });
      setStudents(res.data);

      if (selectedSubject) {
        // Load existing grades for the selected score type
        const gradeRes = await api.get('/gradebook/entries', {
          params: { class_id: selectedClass, subject_id: selectedSubject, term: selectedTerm, score_type: selectedScoreType }
        });
        const existing = {};
        const scoreInit = {};
        for (const g of gradeRes.data) {
          if (g.score_type && g.score_type !== selectedScoreType) continue;
          existing[g.student_id] = g;
          if (selectedScoreType === 'end_of_term') {
            scoreInit[g.student_id] = { ca_score: g.ca_score || '', exam_score: g.exam_score || '', teacher_comment: g.teacher_comment || '' };
          } else {
            scoreInit[g.student_id] = { exam_score: g.exam_score || g.ca_score || '', teacher_comment: g.teacher_comment || '' };
          }
        }
        setExistingGrades(existing);
        for (const s of res.data) {
          if (!scoreInit[s.user_id]) {
            scoreInit[s.user_id] = selectedScoreType === 'end_of_term'
              ? { ca_score: '', exam_score: '', teacher_comment: '' }
              : { exam_score: '', teacher_comment: '' };
          }
        }
        setScores(scoreInit);

        // Load CA breakdown for end_of_term view
        if (selectedScoreType === 'end_of_term') {
          try {
            const caRes = await api.get('/gradebook/ca-breakdown', { params: { class_id: selectedClass, subject_id: selectedSubject, term: selectedTerm } });
            const caMap = {};
            for (const c of caRes.data) {
              caMap[c.student_id] = c;
              // Auto-populate CA score if not already set
              if (c.ca_30 > 0 && !scoreInit[c.student_id]?.ca_score) {
                scoreInit[c.student_id] = { ...scoreInit[c.student_id], ca_score: c.ca_30.toString() };
              }
            }
            setCaBreakdown(caMap);
            setScores({ ...scoreInit });
          } catch { /* silent */ }
        }
      }
    } catch (err) { console.error("API error:", err); }
  }, [selectedClass, selectedSubject, selectedTerm, selectedScoreType]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const updateScore = (studentId, field, value) => {
    setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const isEndOfTerm = selectedScoreType === 'end_of_term';
  const currentType = SCORE_TYPES.find(t => t.value === selectedScoreType);
  const scoreMax = currentType?.max || 100;

  const saveAllScores = async () => {
    if (!selectedSubject) { toast.error('Select a subject first'); return; }
    setSaving(true);
    let saved = 0, errors = 0;

    for (const student of students) {
      const s = scores[student.user_id];
      if (!s) continue;
      if (isEndOfTerm && s.ca_score === '' && s.exam_score === '') continue;
      if (!isEndOfTerm && s.exam_score === '') continue;

      try {
        const payload = {
          student_id: student.user_id,
          subject_id: selectedSubject,
          term: selectedTerm,
          score_type: selectedScoreType,
          teacher_comment: s.teacher_comment || '',
        };
        if (isEndOfTerm) {
          payload.ca_score = parseFloat(s.ca_score) || 0;
          payload.ca_max = 30;
          payload.exam_score = parseFloat(s.exam_score) || 0;
          payload.exam_max = 70;
        } else {
          // For component scores, store as exam_score (the raw score out of 100)
          payload.ca_score = 0;
          payload.ca_max = 100;
          payload.exam_score = parseFloat(s.exam_score) || 0;
          payload.exam_max = 100;
        }
        await api.post('/gradebook/entries', payload);
        saved++;
      } catch { errors++; }
    }

    setSaving(false);
    if (saved > 0) successToast(`Saved ${saved} scores`);
    if (errors > 0) toast.error(`${errors} failed to save`);
    loadStudents();
  };

  const saveSingle = async (studentId) => {
    const s = scores[studentId];
    if (!s || !selectedSubject) return;
    try {
      const payload = {
        student_id: studentId, subject_id: selectedSubject, term: selectedTerm,
        score_type: selectedScoreType, teacher_comment: s.teacher_comment || '',
      };
      if (isEndOfTerm) {
        payload.ca_score = parseFloat(s.ca_score) || 0; payload.ca_max = 30;
        payload.exam_score = parseFloat(s.exam_score) || 0; payload.exam_max = 70;
      } else {
        payload.ca_score = 0; payload.ca_max = 100;
        payload.exam_score = parseFloat(s.exam_score) || 0; payload.exam_max = 100;
      }
      const res = await api.post('/gradebook/entries', payload);
      setExistingGrades(prev => ({ ...prev, [studentId]: res.data }));
      successToast('Saved');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <AppLoader />;

  const selectedClassName = classes.find(c => c.class_id === selectedClass)?.name || '';
  const selectedSubjectName = subjects.find(s => s.subject_id === selectedSubject)?.name || '';

  return (
    <div className="space-y-6" data-testid="score-entry-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#1B2A4A]" style={{ fontFamily: 'Outfit, sans-serif' }}>Score Entry</h1>
          <p className="text-xs md:text-sm text-slate-500">Record CA components and exam scores — CA auto-calculates from classwork, progressives & midterms</p>
        </div>
        {students.length > 0 && selectedSubject && (
          <Button onClick={saveAllScores} disabled={saving} className="rounded-xl bg-[#C5A55A] hover:bg-[#b8963e] h-10 md:h-11 px-5 md:px-6 text-sm shadow-lg shadow-[#C5A55A]/20" data-testid="save-all-scores">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save All'}
          </Button>
        )}
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div>
          <Label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Class</Label>
          <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setStudents([]); setScores({}); }}>
            <SelectTrigger className="rounded-lg h-10 text-sm" data-testid="score-class-select"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.class_id} value={c.class_id}>{c.name} ({c.student_count})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Subject</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="rounded-lg h-10 text-sm" data-testid="score-subject-select"><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>{subjects.filter(s => !user?.teaching_subjects?.length || user.teaching_subjects.includes(s.name)).map(s => <SelectItem key={s.subject_id} value={s.subject_id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Term</Label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="rounded-lg h-10 text-sm" data-testid="score-term-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Term 1">Term 1</SelectItem><SelectItem value="Term 2">Term 2</SelectItem><SelectItem value="Term 3">Term 3</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Assessment Type</Label>
          <Select value={selectedScoreType} onValueChange={setSelectedScoreType}>
            <SelectTrigger className="rounded-lg h-10 text-sm" data-testid="score-type-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCORE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Score Type Pills */}
      <div className="flex gap-1.5 bg-[#1B2A4A]/5 rounded-xl p-1 flex-wrap">
        {SCORE_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.value} onClick={() => setSelectedScoreType(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedScoreType === t.value ? 'bg-[#1B2A4A] text-white shadow-sm' : 'text-slate-600 hover:text-[#1B2A4A] hover:bg-white'}`}
              data-testid={`type-pill-${t.value}`}
            >
              <Icon className="w-3 h-3" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Info Banner */}
      {selectedClass && selectedSubject && (
        <Card className="rounded-xl border-[#2E6CC4]/20 bg-[#2E6CC4]/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#2E6CC4]/10 flex items-center justify-center">
              {isEndOfTerm ? <Calculator className="w-5 h-5 text-[#2E6CC4]" /> : <currentType.icon className="w-5 h-5 text-[#2E6CC4]" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1B2A4A]">{selectedClassName} — {selectedSubjectName} ({selectedTerm})</p>
              {isEndOfTerm ? (
                <p className="text-xs text-slate-500">
                  <span className="text-[#C5A55A] font-semibold">CA (30%)</span> auto-calculates from Classwork + Progressives + Midterm | <span className="text-[#2E6CC4] font-semibold">Exam (70%)</span> entered manually
                </p>
              ) : (
                <p className="text-xs text-slate-500">Enter {currentType?.label} scores out of {scoreMax} — feeds into automatic CA calculation</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Entry Table */}
      {students.length > 0 && selectedSubject ? (
        <div className="bg-white rounded-xl border border-slate-200/60 overflow-x-auto shadow-[0_2px_10px_rgba(27,42,74,0.02)]">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#1B2A4A]/[0.03]">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase w-10">#</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase min-w-[180px]">Student</th>
                {isEndOfTerm && (
                  <>
                    <th className="text-center px-2 py-3 text-[10px] font-bold text-[#C5A55A] uppercase w-14" title="Homework / Classwork">CW</th>
                    <th className="text-center px-2 py-3 text-[10px] font-bold text-[#C5A55A] uppercase w-14" title="Progressive 1">P1</th>
                    <th className="text-center px-2 py-3 text-[10px] font-bold text-[#C5A55A] uppercase w-14" title="Progressive 2">P2</th>
                    <th className="text-center px-2 py-3 text-[10px] font-bold text-[#C5A55A] uppercase w-14" title="Progressive 3">P3</th>
                    <th className="text-center px-2 py-3 text-[10px] font-bold text-[#C5A55A] uppercase w-14" title="Midterm">MT</th>
                    <th className="text-center px-2 py-3 text-[10px] font-bold text-[#C5A55A] uppercase w-16 bg-[#C5A55A]/5" title="CA Score out of 30">CA/30</th>
                  </>
                )}
                <th className="text-center px-3 py-3 text-[10px] font-bold text-[#2E6CC4] uppercase w-20">
                  {isEndOfTerm ? 'Exam /70' : `Score /${scoreMax}`}
                </th>
                {isEndOfTerm && <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase w-16">Final</th>}
                {isEndOfTerm && <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase w-14">Grade</th>}
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase min-w-[120px]">Comment</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => {
                const s = scores[student.user_id] || {};
                const existing = existingGrades[student.user_id];
                const ca = caBreakdown[student.user_id];
                const caScore = isEndOfTerm ? (parseFloat(s.ca_score) || 0) : 0;
                const examScore = parseFloat(s.exam_score) || 0;
                const finalScore = isEndOfTerm
                  ? (existing?.final_score || (caScore > 0 || examScore > 0 ? Math.round(caScore + examScore) : null))
                  : null;
                const grade = existing?.grade_letter || '';

                return (
                  <tr key={student.user_id} className={`border-t border-slate-50 ${existing ? 'bg-[#C5A55A]/[0.03]' : 'hover:bg-slate-50/50'}`} data-testid={`score-row-${student.user_id}`}>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">{student.name?.charAt(0)}</div>
                        <span className="text-xs font-medium text-[#1B2A4A]">{student.name}</span>
                      </div>
                    </td>
                    {isEndOfTerm && (
                      <>
                        <td className="px-2 py-2.5 text-center text-[11px] text-slate-500 tabular-nums">{ca?.classwork || '—'}</td>
                        <td className="px-2 py-2.5 text-center text-[11px] text-slate-500 tabular-nums">{ca?.progressive_1 || '—'}</td>
                        <td className="px-2 py-2.5 text-center text-[11px] text-slate-500 tabular-nums">{ca?.progressive_2 || '—'}</td>
                        <td className="px-2 py-2.5 text-center text-[11px] text-slate-500 tabular-nums">{ca?.progressive_3 || '—'}</td>
                        <td className="px-2 py-2.5 text-center text-[11px] text-slate-500 tabular-nums">{ca?.midterm || '—'}</td>
                        <td className="px-2 py-2.5 text-center bg-[#C5A55A]/5">
                          <Input
                            type="number" min="0" max="30" step="0.5"
                            value={s.ca_score || ''}
                            onChange={e => updateScore(student.user_id, 'ca_score', e.target.value)}
                            className="h-8 text-center text-xs w-16 mx-auto rounded-lg border-[#C5A55A]/30 font-semibold text-[#C5A55A]"
                            placeholder={ca?.ca_30 > 0 ? ca.ca_30.toString() : '0'}
                            data-testid={`ca-${student.user_id}`}
                          />
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <Input
                        type="number" min="0" max={isEndOfTerm ? 70 : scoreMax} step="0.5"
                        value={s.exam_score || ''}
                        onChange={e => updateScore(student.user_id, 'exam_score', e.target.value)}
                        className="h-8 text-center text-xs w-16 mx-auto rounded-lg"
                        placeholder="0"
                        data-testid={`exam-${student.user_id}`}
                      />
                    </td>
                    {isEndOfTerm && (
                      <td className="px-3 py-2.5 text-center">
                        {finalScore !== null ? (
                          <span className={`text-sm font-bold tabular-nums ${finalScore >= 60 ? 'text-[#C5A55A]' : finalScore >= 40 ? 'text-[#F59E0B]' : 'text-red-500'}`}>{finalScore}%</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    )}
                    {isEndOfTerm && (
                      <td className="px-3 py-2.5 text-center">
                        {grade ? <Badge className={`${gradeColor(grade)} text-[10px] font-bold px-2`}>{grade}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <Input value={s.teacher_comment || ''} onChange={e => updateScore(student.user_id, 'teacher_comment', e.target.value)} className="h-8 text-xs rounded-lg" placeholder="Comment..." data-testid={`comment-${student.user_id}`} />
                    </td>
                    <td className="px-2 py-2.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveSingle(student.user_id)} data-testid={`save-single-${student.user_id}`}>
                        {existing ? <CheckCircle className="w-4 h-4 text-[#C5A55A]" /> : <Save className="w-4 h-4 text-slate-400" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-14 h-14 mx-auto mb-4 text-slate-200" />
          <p className="text-sm">{!selectedClass ? 'Select a class to begin' : !selectedSubject ? 'Select a subject' : 'No students in this class'}</p>
        </div>
      )}
    </div>
  );
}
