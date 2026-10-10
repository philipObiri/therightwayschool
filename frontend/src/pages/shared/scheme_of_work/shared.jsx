import React from 'react';
import {
  FileText, PenSquare, Send, Eye, RotateCcw, CheckCircle, XCircle, Clock,
  BookOpen, Archive
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';

export const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileText },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: PenSquare },
  submitted: { label: 'Submitted', color: 'bg-indigo-100 text-indigo-700', icon: Send },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700', icon: Eye },
  returned: { label: 'Returned', color: 'bg-red-100 text-red-700', icon: RotateCcw },
  resubmitted: { label: 'Resubmitted', color: 'bg-orange-100 text-orange-700', icon: Send },
  approved: { label: 'Approved', color: 'bg-[#C5A55A]/15 text-[#C5A55A]', icon: CheckCircle },
  published: { label: 'Published', color: 'bg-[#C5A55A]/15 text-[#1B2A4A]', icon: BookOpen },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500', icon: Archive },
};

export const MGMT_ROLES = ['SuperAdmin', 'Admin', 'CEO', 'Principal', 'HeadTeacher', 'Founder', 'HeadOfAcademics'];

export const schemeTableCSS = `
.scheme-html-view table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 16px 0; font-size: 13px; }
.scheme-html-view table td { padding: 8px 12px; border: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; }
.scheme-html-view table tbody tr:nth-child(even) td { background: #f8fafc; }
.scheme-html-view table tbody tr:hover td { background: #eef2ff; }
.scheme-html-view table ul, .scheme-html-view table ol { margin: 4px 0; padding-left: 18px; }
.scheme-html-view table li { margin-bottom: 2px; }
.scheme-html-view h2 { color: #1B2A4A; margin: 12px 0 8px; font-size: 1.25rem; font-weight: 600; }
.scheme-html-view p { margin: 6px 0; }
`;

export function injectTableStyles(html) {
  if (!html) return html;
  return html
    .replace(/<th([^>]*)>/gi, '<th$1 style="padding:10px 12px;text-align:left;font-weight:600;font-size:12px;background:#1B2A4A;color:white;border:1px solid #2E6CC4;text-transform:uppercase;letter-spacing:0.5px;position:sticky;top:0;z-index:5;">')
    .replace(/<td([^>]*)>/gi, '<td$1 style="padding:8px 12px;border:1px solid #e2e8f0;vertical-align:top;line-height:1.5;">')
    .replace(/<sub>/gi, '<sub style="font-size:0.75em;vertical-align:sub;">')
    .replace(/<sup>/gi, '<sup style="font-size:0.75em;vertical-align:super;">');
}

export function ApprovalChainBadge({ chain, label }) {
  if (!chain || chain.length === 0) return null;
  const completed = chain.filter(s => s.status === 'approved' || s.status === 'auto_approved').length;
  return (
    <div className="flex items-center gap-1" title={label || ''}>
      {chain.map((s, i) => {
        const colors = { approved: 'bg-[#C5A55A]/100', auto_approved: 'bg-[#C5A55A]/25', pending: 'bg-slate-200', returned: 'bg-red-500' };
        return <div key={i} className={`w-2 h-2 rounded-full ${colors[s.status] || colors.pending}`} title={`${s.label}: ${s.status}${s.user_name ? ' — ' + s.user_name : ''}`} />;
      })}
      <span className="text-[9px] text-slate-400 ml-1">{completed}/{chain.length}</span>
    </div>
  );
}

export function ApprovalChainDetail({ chain }) {
  if (!chain || chain.length === 0) return <p className="text-xs text-slate-400">No approval chain (legacy submission)</p>;
  return (
    <div className="space-y-2" data-testid="approval-chain-detail">
      {chain.map((s, i) => {
        const isApproved = s.status === 'approved' || s.status === 'auto_approved';
        const isPending = s.status === 'pending';
        const isReturned = s.status === 'returned';
        return (
          <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border ${isApproved ? 'border-[#C5A55A]/30 bg-[#C5A55A]/10/50' : isReturned ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isApproved ? 'bg-[#C5A55A]/100' : isReturned ? 'bg-red-500' : 'bg-slate-300'}`}>
                {isApproved ? <CheckCircle className="w-4 h-4 text-white" /> : isReturned ? <XCircle className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-white" />}
              </div>
              {i < chain.length - 1 && <div className={`w-0.5 h-4 mt-1 ${isApproved ? 'bg-[#C5A55A]/25' : 'bg-slate-200'}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#1B2A4A]">Step {s.step}: {s.label}</span>
                <Badge className={`text-[9px] ${isApproved ? 'bg-[#C5A55A]/15 text-[#C5A55A]' : isReturned ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.status === 'auto_approved' ? 'Auto' : s.status}
                </Badge>
              </div>
              {s.user_name && <p className="text-[10px] text-slate-500 mt-0.5">{s.user_name} {s.acted_at ? `— ${new Date(s.acted_at).toLocaleString()}` : ''}</p>}
              {s.comment && s.comment !== 'Auto-approved (submitter holds this role)' && <p className="text-[10px] text-slate-600 mt-0.5 italic">"{s.comment}"</p>}
              {isPending && <p className="text-[10px] text-amber-600 mt-0.5 font-medium">Awaiting review...</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
