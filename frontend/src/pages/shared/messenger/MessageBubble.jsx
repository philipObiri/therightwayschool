import React, { useState } from 'react';
import { Check, CheckCheck, Pin, Star, Forward, FileText, Image as ImageIcon, Download, File as FileIcon, Mic, Headphones } from 'lucide-react';
import api from '../../../lib/api';

const BACKEND = import.meta.env.VITE_API_URL;

const FILE_ICONS = {
  pdf: { color: 'text-red-500', bg: 'bg-red-50' },
  docx: { color: 'text-blue-600', bg: 'bg-blue-50' },
  doc: { color: 'text-blue-600', bg: 'bg-blue-50' },
  xlsx: { color: 'text-[#C5A55A]', bg: 'bg-[#C5A55A]/10' },
  xls: { color: 'text-[#C5A55A]', bg: 'bg-[#C5A55A]/10' },
  pptx: { color: 'text-orange-500', bg: 'bg-orange-50' },
  csv: { color: 'text-[#C5A55A]', bg: 'bg-[#C5A55A]/10' },
  txt: { color: 'text-slate-500', bg: 'bg-slate-50' },
};

function getFileStyle(ext) {
  return FILE_ICONS[(ext || '').toLowerCase()] || { color: 'text-slate-400', bg: 'bg-slate-50' };
}

export function MessageBubble({ msg, isOwn, showSender, currentUserId, onContextMenu, onReact, onReply }) {
  if (msg.message_type === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[10px] text-slate-500 bg-white/70 px-3 py-1 rounded-full">{msg.content}</span>
      </div>
    );
  }

  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hasAttachments = msg.attachments && msg.attachments.length > 0;
  const isImage = msg.message_type === 'image';
  const reactionEntries = Object.entries(msg.reactions || {});
  const isStarred = msg.starred_by?.includes(currentUserId);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`} onContextMenu={e => onContextMenu(e, msg)} data-testid={`msg-${msg.message_id}`}>
      <div className={`max-w-[65%] min-w-[120px] ${isOwn ? 'order-1' : 'order-1'}`}>
        {showSender && <p className="text-[10px] font-bold text-[#2E6CC4] ml-2 mb-0.5">{msg.sender_name}</p>}

        {msg.forwarded_from && (
          <div className="flex items-center gap-1 text-[9px] text-slate-400 ml-2 mb-0.5">
            <Forward className="w-3 h-3" /> Forwarded from {msg.forwarded_from.sender_name}
          </div>
        )}

        <div className={`rounded-md px-3 py-2 shadow-sm relative ${isOwn ? 'bg-[#2E6CC4] text-white' : 'bg-white text-[#1B2A4A]'}`}>
          {msg.reply_to && (
            <div className={`mb-1.5 pl-2 border-l-2 rounded-sm py-1 ${isOwn ? 'border-white/50 bg-white/10' : 'border-[#2E6CC4] bg-[#2E6CC4]/5'}`}>
              <p className={`text-[10px] font-bold ${isOwn ? 'text-white/80' : 'text-[#2E6CC4]'}`}>{msg.reply_to.sender_name}</p>
              <p className={`text-[10px] truncate ${isOwn ? 'text-white/60' : 'text-slate-500'}`}>{msg.reply_to.content || 'File'}</p>
            </div>
          )}

          {hasAttachments && !isImage && msg.attachments.map((a, i) => {
            const fs = getFileStyle(a.file_type);
            return (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg mb-1.5 ${isOwn ? 'bg-white/15' : 'bg-slate-50'}`}>
                <div className={`w-10 h-10 ${fs.bg} rounded-lg flex items-center justify-center shrink-0`}>
                  <FileText className={`w-5 h-5 ${fs.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isOwn ? 'text-white' : 'text-[#1B2A4A]'}`}>{a.filename}</p>
                  <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>{a.file_type?.toUpperCase()} {a.size_bytes ? `| ${(a.size_bytes / 1024).toFixed(0)}KB` : ''}</p>
                </div>
                <a href={`${BACKEND}/api/files/${a.file_id}/download`} target="_blank" rel="noreferrer" className={`p-1.5 rounded-full ${isOwn ? 'hover:bg-white/20' : 'hover:bg-slate-200'}`}>
                  <Download className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-slate-500'}`} />
                </a>
              </div>
            );
          })}

          {hasAttachments && isImage && msg.attachments.map((a, i) => (
            <div key={i} className="rounded-lg overflow-hidden mb-1.5">
              <img src={`${BACKEND}/api/files/${a.file_id}/preview`} alt={a.filename} className="max-w-full rounded-lg cursor-pointer" style={{ maxHeight: '280px' }} onClick={() => window.open(`${BACKEND}/api/files/${a.file_id}/download`, '_blank')} />
            </div>
          ))}

          {msg.message_type === 'voice' && hasAttachments && msg.attachments.map((a, i) => (
            <VoiceNote key={i} attachment={a} isOwn={isOwn} msgId={msg.message_id} currentUserId={currentUserId} listenedBy={msg.listened_by || []} />
          ))}

          {msg.content && msg.message_type !== 'voice' && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}

          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-end'}`}>
            {isStarred && <Star className={`w-2.5 h-2.5 ${isOwn ? 'text-yellow-300' : 'text-yellow-500'} fill-current`} />}
            {msg.pinned && <Pin className={`w-2.5 h-2.5 ${isOwn ? 'text-white/50' : 'text-slate-400'}`} />}
            {msg.edited && <span className={`text-[9px] ${isOwn ? 'text-white/50' : 'text-slate-400'}`}>edited</span>}
            <span className={`text-[9px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>{time}</span>
            {isOwn && <CheckCheck className="w-3 h-3 text-white/60" />}
          </div>
        </div>

        {reactionEntries.length > 0 && (
          <div className="flex gap-1 mt-0.5 ml-2 flex-wrap">
            {reactionEntries.map(([emoji, userIds]) => (
              <button key={emoji} onClick={() => onReact(msg.message_id, emoji)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all ${userIds.includes(currentUserId) ? 'bg-[#2E6CC4]/10 border-[#2E6CC4]/30' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <span>{emoji}</span><span className="text-[10px] text-slate-500">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VoiceNote({ attachment, isOwn, msgId, currentUserId, listenedBy }) {
  const [listened, setListened] = useState(listenedBy.includes(currentUserId));
  const listenerCount = listenedBy.length;

  const onPlay = async () => {
    if (!listened && !isOwn) {
      setListened(true);
      try { await api.post(`/chat/messages/${msgId}/listen`); } catch (err) { console.error("Error:", err); }
    }
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg mb-1.5 ${isOwn ? 'bg-white/15' : 'bg-slate-50'}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-[#2E6CC4]/10'}`}>
        <Mic className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-[#2E6CC4]'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <audio controls preload="none" className="h-8 w-full" style={{ maxWidth: '220px' }} onPlay={onPlay} data-testid={`voice-audio-${msgId}`}>
          <source src={`${BACKEND}/api/files/${attachment.file_id}/download`} type="audio/webm" />
        </audio>
        {isOwn && listenerCount > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Headphones className="w-3 h-3 text-white/50" />
            <span className="text-[9px] text-white/50">{listenerCount} listened</span>
          </div>
        )}
      </div>
    </div>
  );
}
