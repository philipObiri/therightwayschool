import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const LESSON_STATUSES = ['requested', 'approved', 'in_progress', 'completed', 'cancelled'];

const statusColor = (s) => {
  const map = {
    requested: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-slate-100 text-slate-600';
};

/**
 * Shared dialog for viewing & discussing a Booster Lesson.
 * Used by both the admin BoosterConcernsPage tiles and TeacherBoosterList cards.
 * - Shows student/teacher/subject details
 * - Lets teachers (assigned) and management post comments / progress updates
 * - Teachers can update status (how it's going) and progress notes
 */
export function BoosterLessonDetailDialog({ open, onOpenChange, lesson, currentUser, onUpdated }) {
  const [detail, setDetail] = useState(lesson);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState(lesson?.status || 'requested');
  const [progressNote, setProgressNote] = useState(lesson?.notes || '');
  const [savingProgress, setSavingProgress] = useState(false);
  const bottomRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!lesson?.lesson_id) return;
    try {
      const r = await api.get('/booster/lessons');
      const fresh = (r.data || []).find(l => l.lesson_id === lesson.lesson_id);
      if (fresh) {
        setDetail(fresh);
        setStatus(fresh.status || 'requested');
        setProgressNote(fresh.notes || '');
      }
    } catch (err) { console.error("Error:", err); }
  }, [lesson?.lesson_id]);

  useEffect(() => {
    if (open) {
      setDetail(lesson);
      setStatus(lesson?.status || 'requested');
      setProgressNote(lesson?.notes || '');
      setComment('');
      // scroll to bottom of comments when opened
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
    }
  }, [open, lesson]);

  const postComment = async () => {
    const msg = comment.trim();
    if (!msg) return;
    setPosting(true);
    try {
      await api.post(`/booster/lessons/${detail.lesson_id}/comment`, { message: msg });
      setComment('');
      await refresh();
      onUpdated && onUpdated();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post comment');
    }
    setPosting(false);
  };

  const saveProgress = async () => {
    setSavingProgress(true);
    try {
      await api.put(`/booster/lessons/${detail.lesson_id}`, {
        status,
        notes: progressNote,
      });
      toast.success('Progress updated');
      await refresh();
      onUpdated && onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save progress');
    }
    setSavingProgress(false);
  };

  if (!detail) return null;

  const comments = detail.comments || [];
  const isOwnCommenter = (c) => c.by_id === currentUser?.user_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="booster-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#2E6CC4]" />
            Booster: {detail.student_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-slate-50 rounded-md p-3 text-sm space-y-1.5">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="font-semibold text-[#1B2A4A]">{detail.student_name} <span className="text-xs text-slate-400 font-normal">({detail.student_year})</span></p>
                <p className="text-xs text-slate-500">Subject: <strong className="text-[#1B2A4A]">{detail.subject}</strong></p>
                <p className="text-xs text-slate-500">Teacher: <strong className="text-[#1B2A4A]">{detail.teacher_name || 'Unassigned'}</strong></p>
              </div>
              <Badge className={`text-[10px] ${statusColor(detail.status)}`}>{detail.status?.replace('_',' ')}</Badge>
            </div>
            {detail.reason && <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2 mt-2">{detail.reason}</p>}
            {detail.preferred_days?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {detail.preferred_days.map(d => <Badge key={d} variant="secondary" className="text-[9px]">{d.slice(0,3)}</Badge>)}
              </div>
            )}
            <p className="text-[10px] text-slate-400 pt-1">Booked by {detail.booked_by_name} &middot; {new Date(detail.created_at).toLocaleDateString()}</p>
          </div>

          {/* Progress Update (for assigned teacher and management) */}
          <div className="bg-white border border-slate-200 rounded-md p-3 space-y-3" data-testid="progress-update-section">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Update Progress</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Label className="text-[10px] text-slate-500">Status</Label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E6CC4]/30"
                  data-testid="progress-status-select"
                >
                  {LESSON_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] text-slate-500">How it's going (internal note)</Label>
                <Textarea
                  value={progressNote}
                  onChange={e => setProgressNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Improving fast on algebra..."
                  className="text-xs"
                  data-testid="progress-note-input"
                />
              </div>
            </div>
            <Button
              onClick={saveProgress}
              disabled={savingProgress}
              size="sm"
              className="w-full bg-[#2E6CC4] hover:bg-[#2E6CC4]/90 text-white rounded-md h-8"
              data-testid="save-progress-btn"
            >
              {savingProgress ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
              Save Progress
            </Button>
          </div>

          {/* Comments thread */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Comments & Discussion ({comments.length})</p>
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1" data-testid="comments-list">
              {comments.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No comments yet. Start the discussion below.</p>
              ) : comments.map((c) => (
                <div
                  key={c.comment_id || c.at}
                  className={`rounded-md p-2.5 ${isOwnCommenter(c) ? 'bg-[#2E6CC4]/8 border border-[#2E6CC4]/20 ml-6' : 'bg-slate-50 mr-6'}`}
                >
                  <p className="text-sm text-[#1B2A4A] whitespace-pre-wrap">{c.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    <strong>{c.by}</strong> <span className="capitalize">({c.role})</span> &middot; {new Date(c.at).toLocaleString()}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Comment input */}
          <div className="flex gap-2 items-end border-t border-slate-100 pt-3">
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Leave a comment for the team..."
              rows={2}
              className="text-sm flex-1 resize-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
              data-testid="comment-input"
            />
            <Button
              onClick={postComment}
              disabled={posting || !comment.trim()}
              className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90 text-white rounded-md shrink-0 h-10"
              data-testid="post-comment-btn"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BoosterLessonDetailDialog;
