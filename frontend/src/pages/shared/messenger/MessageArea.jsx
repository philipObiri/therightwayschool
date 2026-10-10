import React, { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import {
  ArrowLeft, Send, Paperclip, Smile, MoreVertical, Pin, Search,
  Info, Users, Megaphone, Check, CheckCheck, Reply, Pencil, Trash2,
  Forward, Star, Copy, X, Download, FileText, Image as ImageIcon,
  Mic, MicOff, Clock, Calendar, Timer, Video
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { EmojiPicker } from './EmojiPicker';
import { MessageBubble } from './MessageBubble';
import { AppLoader } from '../../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;

export function MessageArea({ chat, messages, setMessages, loading, currentUser, onlineUsers, typingUsers, onSendTyping, onToggleInfo, showInfo, contacts, loadChats, loadMessages, loadChatDetail, chats }) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [contextMsg, setContextMsg] = useState(null);
  const [contextPos, setContextPos] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ content: '', scheduled_for: '', recurrence: 'none', recurrence_end: '' });
  const [scheduledMsgs, setScheduledMsgs] = useState([]);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const mediaRecRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isPrivate = chat.type === 'private';
  const isChannel = chat.type === 'channel';
  const otherUser = isPrivate ? chat.members?.find(m => m.user_id !== currentUser?.user_id) : null;
  const displayName = isPrivate ? (otherUser?.name || 'Chat') : chat.name;
  const isOtherOnline = otherUser && onlineUsers.includes(otherUser.user_id);
  const memberCount = chat.members?.length || 0;
  const canPost = chat.my_role !== 'readonly' && !(chat.settings?.only_admins_post && chat.my_role !== 'admin');

  const sendMessage = async () => {
    const content = text.trim();
    if (!content && !editing) return;
    if (editing) {
      try { await api.put(`/chat/messages/${editing.message_id}`, { content }); loadMessages(chat.chat_id); setEditing(null); setText(''); } catch (_) { toast.error('Failed to edit'); }
      return;
    }
    const payload = { content, message_type: 'text' };
    if (replyTo) payload.reply_to_id = replyTo.message_id;
    try { await api.post(`/chat/${chat.chat_id}/messages`, payload); setText(''); setReplyTo(null); loadChats(); } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const ext = file.name.split('.').pop().toLowerCase();
      const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      await api.post(`/chat/${chat.chat_id}/messages`, { content: '', message_type: isImg ? 'image' : 'file', attachments: [{ file_id: res.data.file_id, filename: file.name, file_type: ext, size_bytes: file.size }] });
      loadChats(); successToast('File sent');
    } catch (_) { toast.error('Upload failed'); }
    e.target.value = '';
  };

  const handleReact = async (msgId, emoji) => { try { await api.post(`/chat/messages/${msgId}/react`, { emoji }); } catch (_) {} setContextMsg(null); };
  const handlePin = async (msgId, pinned) => { try { await api.post(`/chat/messages/${msgId}/pin`, { pinned }); loadMessages(chat.chat_id); } catch (_) {} setContextMsg(null); };
  const handleDelete = async (msgId) => { try { await api.delete(`/chat/messages/${msgId}`); loadMessages(chat.chat_id); loadChats(); } catch (_) { toast.error('Failed'); } setContextMsg(null); };
  const handleStar = async (msgId) => { try { await api.post(`/chat/messages/${msgId}/star`); loadMessages(chat.chat_id); } catch (_) {} setContextMsg(null); };
  const handleForward = async (targetChatId) => { if (!forwardMsg) return; try { await api.post(`/chat/messages/${forwardMsg.message_id}/forward`, { chat_id: targetChatId }); successToast('Forwarded'); } catch (_) { toast.error('Failed'); } setForwardMsg(null); };
  const handleCopy = (content) => { navigator.clipboard.writeText(content); successToast('Copied'); setContextMsg(null); };
  const startEdit = (msg) => { setEditing(msg); setText(msg.content); setContextMsg(null); inputRef.current?.focus(); };
  const startReply = (msg) => { setReplyTo(msg); setContextMsg(null); inputRef.current?.focus(); };
  const startForward = (msg) => { setForwardMsg(msg); setContextMsg(null); };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500) return;
        try {
          const fd = new FormData(); fd.append('file', blob, `voice_${Date.now()}.webm`);
          const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          const payload = { content: `Voice note (${recordingTime}s)`, message_type: 'voice', attachments: [{ file_id: res.data.file_id, filename: `voice_${Date.now()}.webm`, file_type: 'webm', size_bytes: blob.size }] };
          if (replyTo) payload.reply_to_id = replyTo.message_id;
          await api.post(`/chat/${chat.chat_id}/messages`, payload);
          setReplyTo(null); loadChats(); successToast('Voice note sent');
        } catch (_) { toast.error('Failed to send voice note'); }
      };
      mediaRecRef.current = mediaRec; mediaRec.start(); setIsRecording(true); setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (_) { toast.error('Microphone access denied'); }
  };
  const stopRecording = () => { if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') mediaRecRef.current.stop(); setIsRecording(false); if (recordTimerRef.current) clearInterval(recordTimerRef.current); };
  const cancelRecording = () => { if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') { mediaRecRef.current.ondataavailable = null; mediaRecRef.current.onstop = null; mediaRecRef.current.stop(); } setIsRecording(false); setRecordingTime(0); if (recordTimerRef.current) clearInterval(recordTimerRef.current); };

  // Scheduled messages
  const loadScheduled = useCallback(async () => { try { const r = await api.get(`/chat/${chat.chat_id}/scheduled-messages`); setScheduledMsgs(r.data); } catch (_) {} }, [chat.chat_id]);
  const sendScheduled = async () => {
    if (!scheduleForm.content.trim() || !scheduleForm.scheduled_for) { toast.error('Message and time required'); return; }
    try {
      await api.post(`/chat/${chat.chat_id}/schedule-message`, { content: scheduleForm.content, scheduled_for: new Date(scheduleForm.scheduled_for).toISOString(), recurrence: scheduleForm.recurrence, recurrence_end: scheduleForm.recurrence_end ? new Date(scheduleForm.recurrence_end).toISOString() : '' });
      successToast('Message scheduled'); setShowSchedule(false); setScheduleForm({ content: '', scheduled_for: '', recurrence: 'none', recurrence_end: '' }); loadScheduled();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };
  const cancelScheduledMsg = async (id) => { try { await api.delete(`/chat/scheduled/${id}`); successToast('Cancelled'); loadScheduled(); } catch (_) {} };
  useEffect(() => { loadScheduled(); }, [loadScheduled]);

  // Video call
  const startVideoCall = async () => {
    try {
      const memberIds = chat.members?.map(m => m.user_id) || [];
      const r = await api.post('/meetings/create', { title: `Call with ${displayName}`, type: chat.type === 'private' ? '1on1' : 'group', participant_ids: memberIds, chat_id: chat.chat_id });
      window.location.href = `/meeting/${r.data.meeting_id}`;
    } catch (_) { toast.error('Failed to start call'); }
  };

  const onContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMsg(msg);
    setContextPos({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 300) });
  };

  useEffect(() => {
    const close = () => setContextMsg(null);
    if (contextMsg) window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMsg]);

  const typingText = typingUsers.length > 0
    ? typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.slice(0, 2).join(', ')} are typing...`
    : null;

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAE2] min-w-0" data-testid="message-area">
      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center gap-3 shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${isChannel ? 'bg-amber-500' : chat.type === 'group' ? 'bg-[#C5A55A]/100' : 'bg-[#2E6CC4]'}`}>
          {isChannel ? <Megaphone className="w-5 h-5" /> : chat.type === 'group' ? <Users className="w-5 h-5" /> : (displayName?.charAt(0) || '?')}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleInfo}>
          <h3 className="text-sm font-bold text-[#1B2A4A] truncate">{displayName}</h3>
          <p className="text-[10px] text-slate-400">{typingText || (isPrivate ? (isOtherOnline ? 'Online' : 'Offline') : `${memberCount} members`)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={startVideoCall} className="p-2 rounded-full hover:bg-slate-100" title="Video call" data-testid="video-call-btn"><Video className="w-4 h-4 text-[#2E6CC4]" /></button>
          <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 rounded-full hover:bg-slate-100" data-testid="msg-search-btn"><Search className="w-4 h-4 text-slate-500" /></button>
          <button onClick={onToggleInfo} className="p-2 rounded-full hover:bg-slate-100" data-testid="chat-info-btn"><Info className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {searchOpen && (
        <div className="bg-white border-b px-4 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search in chat..." className="border-0 bg-transparent text-sm flex-1 h-8" data-testid="in-chat-search" />
          <button onClick={() => { setSearchOpen(false); setSearchQ(''); }}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4" data-testid="messages-scroll">
        {loading ? (
          <AppLoader size="sm" />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400"><p className="text-sm">No messages yet. Start the conversation!</p></div>
        ) : (
          messages.filter(m => !searchQ || (m.content || '').toLowerCase().includes(searchQ.toLowerCase())).map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
            const showSender = chat.type !== 'private' && msg.sender_id !== currentUser?.user_id && msg.message_type !== 'system' && (!prev || prev.sender_id !== msg.sender_id);
            return (
              <React.Fragment key={msg.message_id}>
                {showDate && <DateSeparator date={msg.created_at} />}
                <MessageBubble msg={msg} isOwn={msg.sender_id === currentUser?.user_id} showSender={showSender} currentUserId={currentUser?.user_id} onContextMenu={onContextMenu} onReact={handleReact} onReply={startReply} />
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply / Edit bar */}
      {(replyTo || editing) && (
        <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center gap-2">
          <div className="w-1 h-8 bg-[#2E6CC4] rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#2E6CC4] font-semibold">{editing ? 'Editing message' : `Reply to ${replyTo.sender_name}`}</p>
            <p className="text-xs text-slate-500 truncate">{editing?.content || replyTo?.content}</p>
          </div>
          <button onClick={() => { setReplyTo(null); setEditing(null); setText(''); }}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* Input */}
      {canPost && (
        <div className="bg-white border-t border-slate-200 px-3 py-2 shrink-0" data-testid="message-input-area">
          {isRecording ? (
            <div className="flex items-center gap-3">
              <button onClick={cancelRecording} className="p-2 rounded-full hover:bg-red-50 text-red-500" data-testid="cancel-recording-btn"><X className="w-5 h-5" /></button>
              <div className="flex-1 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-600">Recording... {recordingTime}s</span>
                <div className="flex-1 h-1 bg-red-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full animate-pulse" style={{ width: `${Math.min(recordingTime * 2, 100)}%` }} /></div>
              </div>
              <button onClick={stopRecording} className="p-2.5 bg-[#2E6CC4] text-white rounded-full hover:bg-[#2558A3]" data-testid="stop-recording-btn"><Send className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 rounded-full hover:bg-slate-100" data-testid="emoji-btn"><Smile className="w-5 h-5 text-slate-400" /></button>
                {showEmoji && <div className="absolute bottom-12 left-0 z-50"><EmojiPicker onSelect={e => { setText(prev => prev + e); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} /></div>}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt,.doc,.xls,.ppt,.svg,.zip" />
              <button onClick={() => fileRef.current?.click()} className="p-2 rounded-full hover:bg-slate-100" data-testid="attach-btn"><Paperclip className="w-5 h-5 text-slate-400" /></button>
              <input ref={inputRef} value={text} onChange={e => { setText(e.target.value); onSendTyping(chat.chat_id); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Type a message..." className="flex-1 bg-slate-50 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#2E6CC4]/20 border-0" data-testid="message-input" />
              <button onClick={() => { setShowSchedule(true); setScheduleForm({ content: text || '', scheduled_for: '', recurrence: 'none', recurrence_end: '' }); }} className="p-2 rounded-full hover:bg-slate-100" title="Schedule message" data-testid="schedule-btn"><Clock className="w-5 h-5 text-slate-400" /></button>
              {scheduledMsgs.length > 0 && (
                <button onClick={() => setShowScheduledList(true)} className="relative p-2 rounded-full hover:bg-slate-100" title="Scheduled messages" data-testid="scheduled-list-btn">
                  <Calendar className="w-5 h-5 text-slate-400" /><span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold">{scheduledMsgs.length}</span>
                </button>
              )}
              {text.trim() ? (
                <button onClick={sendMessage} className="p-2.5 bg-[#2E6CC4] text-white rounded-full hover:bg-[#2558A3] transition-colors" data-testid="send-btn"><Send className="w-5 h-5" /></button>
              ) : (
                <button onClick={startRecording} className="p-2.5 bg-[#2E6CC4] text-white rounded-full hover:bg-[#2558A3] transition-colors" data-testid="voice-btn"><Mic className="w-5 h-5" /></button>
              )}
            </div>
          )}
        </div>
      )}
      {!canPost && <div className="bg-slate-100 border-t px-4 py-3 text-center text-xs text-slate-500">You can only read messages in this chat</div>}

      {/* Context Menu */}
      {contextMsg && contextPos && (
        <div className="fixed bg-white rounded-lg shadow-xl border z-[999] py-1 min-w-[180px] animate-fade-in" style={{ left: contextPos.x, top: contextPos.y }} data-testid="context-menu">
          <CtxItem icon={Reply} label="Reply" onClick={() => startReply(contextMsg)} />
          {contextMsg.sender_id === currentUser?.user_id && <CtxItem icon={Pencil} label="Edit" onClick={() => startEdit(contextMsg)} />}
          <CtxItem icon={Forward} label="Forward" onClick={() => startForward(contextMsg)} />
          <CtxItem icon={Copy} label="Copy" onClick={() => handleCopy(contextMsg.content)} />
          <CtxItem icon={Star} label={contextMsg.starred_by?.includes(currentUser?.user_id) ? 'Unstar' : 'Star'} onClick={() => handleStar(contextMsg.message_id)} />
          {(chat.my_role === 'admin' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'CEO') && (
            <CtxItem icon={Pin} label={contextMsg.pinned ? 'Unpin' : 'Pin'} onClick={() => handlePin(contextMsg.message_id, !contextMsg.pinned)} />
          )}
          <div className="border-t border-slate-100 my-1" />
          <div className="flex gap-1 px-2 py-1">
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(e => (
              <button key={e} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded text-base" onClick={() => handleReact(contextMsg.message_id, e)}>{e}</button>
            ))}
          </div>
          <div className="border-t border-slate-100 my-1" />
          {(contextMsg.sender_id === currentUser?.user_id || chat.my_role === 'admin' || currentUser?.role === 'SuperAdmin') && (
            <CtxItem icon={Trash2} label="Delete" className="text-red-500" onClick={() => handleDelete(contextMsg.message_id)} />
          )}
        </div>
      )}

      {/* Forward Dialog */}
      {forwardMsg && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center" onClick={() => setForwardMsg(null)}>
          <div className="bg-white rounded-xl w-[380px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="forward-dialog">
            <div className="p-4 border-b flex items-center justify-between"><h3 className="text-sm font-bold text-[#1B2A4A]">Forward to...</h3><button onClick={() => setForwardMsg(null)}><X className="w-4 h-4" /></button></div>
            <div className="flex-1 overflow-y-auto p-2">
              {chats.map(c => (
                <div key={c.chat_id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-50" onClick={() => handleForward(c.chat_id)}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${c.type === 'group' ? 'bg-[#C5A55A]/100' : c.type === 'channel' ? 'bg-amber-500' : 'bg-[#2E6CC4]'}`}>{(c.display_name || '?').charAt(0)}</div>
                  <span className="text-sm font-medium text-[#1B2A4A] truncate">{c.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Message Dialog */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowSchedule(false)}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#1B2A4A] flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-[#2E6CC4]" /> Schedule Message</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-[#1B2A4A] mb-1 block">Message</label><textarea value={scheduleForm.content} onChange={e => setScheduleForm(p => ({ ...p, content: e.target.value }))} placeholder="Type your message..." className="w-full h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none outline-none" data-testid="schedule-content-input" /></div>
              <div><label className="text-xs font-medium text-[#1B2A4A] mb-1 block">Send at</label><input type="datetime-local" value={scheduleForm.scheduled_for} onChange={e => setScheduleForm(p => ({ ...p, scheduled_for: e.target.value }))} className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none" data-testid="schedule-datetime-input" /></div>
              <div><label className="text-xs font-medium text-[#1B2A4A] mb-1 block">Repeat</label><select value={scheduleForm.recurrence} onChange={e => setScheduleForm(p => ({ ...p, recurrence: e.target.value }))} className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none bg-white" data-testid="recurrence-select"><option value="none">No repeat (one-time)</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
              {scheduleForm.recurrence !== 'none' && <div><label className="text-xs font-medium text-[#1B2A4A] mb-1 block">Repeat until (optional)</label><input type="datetime-local" value={scheduleForm.recurrence_end} onChange={e => setScheduleForm(p => ({ ...p, recurrence_end: e.target.value }))} className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none" data-testid="recurrence-end-input" /></div>}
              <Button className="w-full bg-[#2E6CC4] rounded-lg text-xs" onClick={sendScheduled} data-testid="confirm-schedule-btn"><Clock className="w-3 h-3 mr-1" /> Schedule</Button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Messages List */}
      {showScheduledList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowScheduledList(false)}>
          <div className="bg-white rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#1B2A4A] flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-amber-500" /> Scheduled Messages ({scheduledMsgs.length})</h3>
            <div className="space-y-2">
              {scheduledMsgs.map(m => (
                <div key={m.scheduled_id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <Timer className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#1B2A4A]">{m.content}</p>
                    <p className="text-[10px] text-slate-400 mt-1"><Clock className="w-3 h-3 inline mr-0.5" />{new Date(m.scheduled_for).toLocaleString()}</p>
                    {m.recurrence && m.recurrence !== 'none' && <Badge className="mt-1 bg-amber-50 text-amber-700 text-[9px] border-amber-200">Repeats {m.recurrence}{m.recurrence_end ? ` until ${new Date(m.recurrence_end).toLocaleDateString()}` : ''}</Badge>}
                  </div>
                  <button onClick={() => cancelScheduledMsg(m.scheduled_id)} className="p-1.5 rounded-full hover:bg-red-50 text-red-400" data-testid={`cancel-scheduled-${m.scheduled_id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {scheduledMsgs.length === 0 && <p className="text-center text-slate-400 text-xs py-6">No scheduled messages</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CtxItem({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${className}`} onClick={onClick}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function DateSeparator({ date }) {
  const d = new Date(date);
  const today = new Date();
  let label;
  if (d.toDateString() === today.toDateString()) label = 'Today';
  else if (d.toDateString() === new Date(today - 86400000).toDateString()) label = 'Yesterday';
  else label = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <div className="flex items-center justify-center py-2">
      <span className="bg-white/80 text-[10px] text-slate-500 px-3 py-1 rounded-full shadow-sm font-medium">{label}</span>
    </div>
  );
}
