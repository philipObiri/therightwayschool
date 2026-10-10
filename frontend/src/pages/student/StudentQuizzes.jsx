import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Zap, CheckCircle, XCircle, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function StudentQuizzes() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/quiz/student/available').then(r => setQuizzes(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startQuiz = (quiz) => { setActiveQuiz(quiz); setAnswers({}); setResults(null); };

  const selectAnswer = (qNum, opt) => { if (!results) setAnswers(p => ({ ...p, [qNum]: opt })); };

  const handleSubmit = async () => {
    const qs = activeQuiz.questions || [];
    if (Object.keys(answers).length < qs.length) { toast.error(`Answer all ${qs.length} questions before submitting`); return; }
    setSubmitting(true);
    try {
      const res = await api.post(`/quiz/${activeQuiz.quiz_id}/submit`, { answers });
      setResults(res.data);
      toast.success(`Score: ${res.data.correct_count}/${res.data.total_questions} (${res.data.percentage}%)`);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  if (loading) return <AppLoader />;

  // ─── Taking Quiz ───
  if (activeQuiz) {
    const qs = activeQuiz.questions || [];
    const answered = Object.keys(answers).length;
    const resultMap = {};
    if (results) { (results.results || []).forEach(r => { resultMap[r.number] = r; }); }

    return (
      <div className="space-y-6" data-testid="student-quiz">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setActiveQuiz(null); setResults(null); }}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          {!results && <Button className="rounded-md bg-[#C5A55A]" onClick={handleSubmit} disabled={submitting || answered < qs.length} data-testid="submit-quiz">
            {submitting ? 'Submitting...' : `Submit (${answered}/${qs.length})`}
          </Button>}
          {results && <Badge className={`text-base px-4 py-1.5 ${results.percentage >= 60 ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : results.percentage >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{results.correct_count}/{results.total_questions} ({results.percentage}%)</Badge>}
        </div>
        <div className="bg-white rounded-md border border-slate-100 p-4">
          <h2 className="text-lg font-bold text-[#1B2A4A]">{activeQuiz.title}</h2>
          {!results && <p className="text-xs text-slate-500 mt-1">{answered}/{qs.length} answered</p>}
        </div>
        <div className="space-y-4">
          {qs.map((q, idx) => {
            const r = resultMap[q.number];
            return (
              <Card key={idx} className={`rounded-md ${r ? (r.is_correct ? 'border-[#C5A55A]/40 bg-[#C5A55A]/10/30' : 'border-red-300 bg-red-50/30') : 'border-slate-100'}`}>
                <CardContent className="p-5">
                  <p className="text-sm font-semibold text-[#1B2A4A] mb-3"><span className="text-[#2E6CC4] mr-2">Q{q.number}.</span>{q.question}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(q.options || {}).map(([k, v]) => {
                      const selected = answers[String(q.number)] === k;
                      const isCorrect = r && k === r.correct_answer;
                      const isWrong = r && selected && !r.is_correct;
                      let cls = 'border-slate-200 hover:border-[#2E6CC4] hover:bg-blue-50';
                      if (selected && !results) cls = 'border-[#2E6CC4] bg-blue-50 text-[#2E6CC4]';
                      if (isCorrect) cls = 'border-[#C5A55A] bg-[#C5A55A]/10 text-[#C5A55A]';
                      if (isWrong) cls = 'border-red-500 bg-red-50 text-red-700';
                      return (
                        <button key={k} onClick={() => selectAnswer(String(q.number), k)} className={`flex items-center gap-3 px-4 py-2.5 rounded-md border-2 text-left text-sm transition-all ${cls}`} data-testid={`ans-${q.number}-${k}`}>
                          <span className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${selected || isCorrect ? 'border-current' : 'border-slate-300'}`}>{k}</span>
                          <span className="flex-1">{v}</span>
                          {isCorrect && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                          {isWrong && <XCircle className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {r && q.explanation && <div className="mt-3 bg-blue-50 rounded-md p-3 text-xs text-blue-700"><strong>Explanation:</strong> {q.explanation}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Quiz List ───
  const available = quizzes.filter(q => !q.my_submission);
  const completed = quizzes.filter(q => q.my_submission);

  return (
    <div className="space-y-6" data-testid="student-quizzes">
      <div><h1 className="text-2xl font-bold text-[#1B2A4A]">My Quizzes</h1><p className="text-slate-500 mt-1">{available.length} available, {completed.length} completed</p></div>
      {available.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-600 flex items-center gap-1"><Clock className="w-4 h-4" /> Available Now</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {available.map(q => (
              <Card key={q.quiz_id} className="rounded-md border-amber-200 bg-amber-50/30 card-hover cursor-pointer" onClick={() => startQuiz(q)} data-testid={`take-quiz-${q.quiz_id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2"><Zap className="w-6 h-6 text-amber-600" /><Badge className="bg-amber-100 text-amber-700">{q.question_count} MCQs</Badge></div>
                  <h3 className="font-semibold text-[#1B2A4A]">{q.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">Click to start - answers are auto-marked</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#C5A55A] flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Completed</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {completed.map(q => (
              <Card key={q.quiz_id} className="rounded-md border-[#C5A55A]/30 bg-[#C5A55A]/10/30">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2"><Zap className="w-5 h-5 text-[#C5A55A]" /><Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">{q.my_submission.percentage}%</Badge></div>
                  <h3 className="font-semibold text-[#1B2A4A]">{q.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">Score: {q.my_submission.correct_count}/{q.my_submission.total_questions} | {new Date(q.my_submission.submitted_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {quizzes.length === 0 && <div className="text-center py-12 text-slate-400"><Zap className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>No quizzes available yet</p></div>}
    </div>
  );
}
