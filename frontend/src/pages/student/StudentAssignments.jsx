import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ClipboardList, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function StudentAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitDialog, setSubmitDialog] = useState(null);
  const [submitContent, setSubmitContent] = useState('');

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await api.get('/assignments');
        setAssignments(res.data);
      } catch (err) { console.error("Error:", err); }
      setLoading(false);
    };
    fetchAssignments();
  }, []);

  const handleSubmit = async (assignmentId) => {
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { content: submitContent });
      toast.success('Assignment submitted');
      setSubmitDialog(null);
      setSubmitContent('');
      const res = await api.get('/assignments');
      setAssignments(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to submit'); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="student-assignments">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">My Assignments</h1>
        <p className="text-slate-500 mt-1">{assignments.length} assignments</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map(a => {
          const submitted = !!a.my_submission;
          const graded = a.my_submission?.grade !== null && a.my_submission?.grade !== undefined;

          return (
            <Card key={a.assignment_id} className="rounded-md border-slate-100 card-hover" data-testid={`student-assignment-${a.assignment_id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-md bg-[#C5A55A]/10 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-[#19C37D]" />
                  </div>
                  {graded ? (
                    <Badge className="bg-blue-100 text-blue-700">Score: {a.my_submission.grade}/{a.max_score}</Badge>
                  ) : submitted ? (
                    <Badge className="bg-[#C5A55A]/15 text-[#C5A55A]">Submitted</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                  )}
                </div>
                <h3 className="font-semibold text-[#1B2A4A] mb-1">{a.title}</h3>
                <p className="text-sm text-slate-500 mb-2 line-clamp-2">{a.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>{a.subject_name}</span>
                  {a.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {a.due_date}</span>}
                </div>
                {graded && a.my_submission.feedback && (
                  <div className="bg-blue-50 rounded-md p-2 mb-3">
                    <p className="text-xs text-blue-700"><strong>Feedback:</strong> {a.my_submission.feedback}</p>
                  </div>
                )}
                {!submitted && (
                  <Button size="sm" className="w-full rounded-md bg-[#2E6CC4]" onClick={() => setSubmitDialog(a.assignment_id)} data-testid={`submit-btn-${a.assignment_id}`}>
                    <Send className="w-3 h-3 mr-1" /> Submit
                  </Button>
                )}
                {submitted && !graded && (
                  <div className="flex items-center gap-1 text-xs text-[#C5A55A]">
                    <CheckCircle className="w-3 h-3" /> Submitted - Awaiting grade
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {assignments.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No assignments yet</p>
          </div>
        )}
      </div>

      {/* Submit dialog */}
      <Dialog open={!!submitDialog} onOpenChange={() => setSubmitDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Type your answer here..."
              value={submitContent}
              onChange={e => setSubmitContent(e.target.value)}
              rows={6}
              data-testid="submission-content"
            />
            <Button className="w-full rounded-md bg-[#2E6CC4]" onClick={() => handleSubmit(submitDialog)} data-testid="confirm-submit-btn">
              <Send className="w-4 h-4 mr-2" /> Submit Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
