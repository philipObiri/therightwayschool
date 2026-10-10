import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Inbox, Send, FileText, Archive, Trash2, PenSquare, Search, Star,
  Flag, Reply, ReplyAll, Forward, Paperclip, X, Circle, Mail,
  Download, Eye, Clock, ChevronDown, ChevronRight, Pin, Users,
  MoreHorizontal, AlertCircle, Bookmark, Settings, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import RichTextEditor from '../../components/RichTextEditor';

const FOLDER_CONFIG = [
  { name: 'Inbox', icon: Inbox },
  { name: 'Drafts', icon: FileText },
  { name: 'Sent', icon: Send },
  { name: 'Archive', icon: Archive },
  { name: 'Trash', icon: Trash2 },
];

export default function OutlookMail() {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('Inbox');
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadDetail, setThreadDetail] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState(null);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState({});
  const [focusedTab, setFocusedTab] = useState('focused');

  const fetchFolders = useCallback(async () => {
    try {
      const [fRes] = await Promise.all([api.get('/mail/folders')]);
      setFolders(fRes.data);
    } catch (err) { console.error("Error:", err); }
  }, []);

  const fetchThreads = useCallback(async (folder, q) => {
    try {
      const params = { folder };
      if (q) params.q = q;
      const res = await api.get('/mail/threads', { params });
      setThreads(res.data);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  }, []);

  const fetchContacts = useCallback(async () => {
    try { const res = await api.get('/mail/contacts'); setContacts(res.data); } catch (err) { console.error("Error:", err); }
  }, []);

  useEffect(() => { fetchFolders(); fetchContacts(); fetchThreads('Inbox', ''); }, [fetchFolders, fetchContacts, fetchThreads]);

  const selectFolder = (name) => { setActiveFolder(name); setSelectedThread(null); setThreadDetail(null); fetchThreads(name, searchQuery); };

  const selectThread = async (thread) => {
    setSelectedThread(thread.thread_id);
    try { const res = await api.get(`/mail/threads/${thread.thread_id}`); setThreadDetail(res.data); fetchFolders(); } catch (err) { console.error("Error:", err); }
  };

  const handleAction = async (messageId, action, body) => {
    try {
      if (action === 'delete') await api.delete(`/mail/messages/${messageId}`);
      else await api.post(`/mail/messages/${messageId}/${action}`, body || {});
      successToast(action === 'delete' ? 'Moved to Trash' : `Done`);
      fetchThreads(activeFolder, searchQuery); fetchFolders();
    } catch (err) { console.error("Error:", err); }
  };

  const openReply = (msg, mode) => { setReplyToMsg(msg); setReplyMode(mode); setComposeOpen(true); };
  const getFolderCount = (name) => { const f = folders.find(f => f.name === name); return f?.unread_count || 0; };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col bg-white rounded-md border border-slate-200 overflow-hidden" data-testid="outlook-mail">
      {/* ─── OUTLOOK TOOLBAR ─── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 bg-[#F3F6FC]">
        <Button size="sm" className="rounded-md bg-[#0078D4] hover:bg-[#106EBE] text-white h-8 px-4 text-xs font-semibold gap-1.5" onClick={() => { setReplyMode(null); setReplyToMsg(null); setComposeOpen(true); }} data-testid="new-email-btn">
          <PenSquare className="w-3.5 h-3.5" /> New email
        </Button>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <ToolBtn icon={Trash2} label="Delete" onClick={() => threadDetail?.messages?.[0] && handleAction(threadDetail.messages[0].message_id, 'delete')} />
        <ToolBtn icon={Archive} label="Archive" onClick={() => threadDetail?.messages?.[0] && handleAction(threadDetail.messages[0].message_id, 'archive')} />
        <ToolBtn icon={FolderOpen} label="Move to" />
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <ToolBtn icon={Mail} label="Read / Unread" onClick={() => threadDetail?.messages?.[0] && handleAction(threadDetail.messages[0].message_id, 'unread')} />
        <ToolBtn icon={Flag} label="Flag" className="text-red-500" onClick={() => threadDetail?.messages?.[0] && handleAction(threadDetail.messages[0].message_id, 'flag')} />
        <ToolBtn icon={Pin} label="Pin" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT SIDEBAR (Folders) ─── */}
        <div className="w-52 flex-shrink-0 border-r border-slate-200 bg-[#FAF9F8] overflow-y-auto">
          {/* Favourites */}
          <div className="pt-2">
            <button onClick={() => setSidebarCollapsed(p => ({...p, fav: !p.fav}))} className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 w-full">
              {sidebarCollapsed.fav ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Favourites
            </button>
            {!sidebarCollapsed.fav && (
              <div className="space-y-0.5 px-1">
                {FOLDER_CONFIG.map(fc => {
                  const count = getFolderCount(fc.name);
                  const isActive = activeFolder === fc.name;
                  const Icon = fc.icon;
                  return (
                    <button key={fc.name} onClick={() => selectFolder(fc.name)} className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[12px] transition-colors ${isActive ? 'bg-[#E1EFFF] text-[#0078D4] font-semibold' : 'text-slate-700 hover:bg-slate-100'}`} data-testid={`folder-${fc.name.toLowerCase()}`}>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0078D4]' : 'text-slate-400'}`} />
                      <span className="flex-1 text-left">{fc.name}</span>
                      {count > 0 && <span className={`text-[10px] font-bold ${isActive ? 'text-[#0078D4]' : 'text-slate-500'}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Account */}
          <div className="mt-3">
            <button onClick={() => setSidebarCollapsed(p => ({...p, acc: !p.acc}))} className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 w-full">
              {sidebarCollapsed.acc ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {user?.email}
            </button>
            {!sidebarCollapsed.acc && (
              <div className="space-y-0.5 px-1">
                {FOLDER_CONFIG.map(fc => {
                  const count = getFolderCount(fc.name);
                  const Icon = fc.icon;
                  return (
                    <button key={`acc-${fc.name}`} onClick={() => selectFolder(fc.name)} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[12px] text-slate-600 hover:bg-slate-100">
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="flex-1 text-left">{fc.name === 'Trash' ? 'Deleted Items' : fc.name}</span>
                      {count > 0 && <span className="text-[10px] text-slate-500">{count}</span>}
                    </button>
                  );
                })}
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[12px] text-slate-600 hover:bg-slate-100"><AlertCircle className="w-3.5 h-3.5 text-slate-400" /><span className="flex-1 text-left">Junk Email</span></button>
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[12px] text-slate-600 hover:bg-slate-100"><Bookmark className="w-3.5 h-3.5 text-slate-400" /><span className="flex-1 text-left">Notes</span></button>
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[12px] text-slate-600 hover:bg-slate-100"><Search className="w-3.5 h-3.5 text-slate-400" /><span className="flex-1 text-left">Search Folders</span></button>
              </div>
            )}
          </div>
        </div>

        {/* ─── MESSAGE LIST ─── */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
          {/* Focused / Other tabs */}
          <div className="flex items-center border-b border-slate-200 px-3">
            <button onClick={() => setFocusedTab('focused')} className={`py-2.5 px-3 text-[12px] font-semibold border-b-2 transition-colors ${focusedTab === 'focused' ? 'border-[#0078D4] text-[#0078D4]' : 'border-transparent text-slate-500 hover:text-slate-700'}`} data-testid="focused-tab">Focused</button>
            <button onClick={() => setFocusedTab('other')} className={`py-2.5 px-3 text-[12px] font-semibold border-b-2 transition-colors ${focusedTab === 'other' ? 'border-[#0078D4] text-[#0078D4]' : 'border-transparent text-slate-500 hover:text-slate-700'}`} data-testid="other-tab">Other</button>
            <div className="flex-1" />
            <div className="flex items-center gap-1 bg-slate-50 rounded px-2 py-1">
              <Search className="w-3 h-3 text-slate-400" />
              <input type="text" placeholder="Filter" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); fetchThreads(activeFolder, e.target.value); }} className="bg-transparent border-none outline-none text-[11px] w-20" data-testid="mail-filter" />
            </div>
          </div>

          {/* Message rows */}
          <div className="flex-1 overflow-y-auto">
            {threads.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Today</div>
            )}
            {threads.map(t => {
              const isSelected = selectedThread === t.thread_id;
              const lastMsg = t.last_message || {};
              const initials = (lastMsg.from_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2);
              const avatarColors = ['bg-blue-500', 'bg-blue-500', 'bg-[#C5A55A]/100', 'bg-blue-500', 'bg-amber-500', 'bg-red-500'];
              const colorIdx = (lastMsg.from_name || '').length % avatarColors.length;

              return (
                <div key={t.thread_id} onClick={() => selectThread(t)} className={`flex gap-2.5 px-3 py-2.5 border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-[#E1EFFF] border-l-2 border-l-[#0078D4]' : 'hover:bg-[#F5F5F5]'} ${!t.is_read ? '' : 'opacity-80'}`} data-testid={`thread-${t.thread_id}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-md ${avatarColors[colorIdx]} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-white text-[10px] font-bold">{initials}</span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-[12px] truncate ${!t.is_read ? 'font-semibold text-[#1B1B1B]' : 'text-slate-600'}`}>{lastMsg.from_name || 'Unknown'}</p>
                      <div className="flex items-center gap-1">
                        {t.has_attachments && <Paperclip className="w-3 h-3 text-slate-400" />}
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{t.last_message_at ? new Date(t.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                    <p className={`text-[11px] truncate ${!t.is_read ? 'font-semibold text-[#0078D4]' : 'text-slate-500'}`}>{t.subject}</p>
                    <p className="text-[11px] text-slate-400 truncate">{t.snippet}</p>
                    {/* Attachment chips */}
                    {t.has_attachments && (
                      <div className="flex gap-1 mt-1">
                        <div className="flex items-center gap-1 bg-slate-100 rounded px-1.5 py-0.5">
                          <FileText className="w-2.5 h-2.5 text-red-500" />
                          <span className="text-[9px] text-slate-500 truncate max-w-[80px]">{t.subject?.slice(0, 15)}...</span>
                        </div>
                        {t.message_count > 1 && <span className="text-[9px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">+{t.message_count - 1}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {threads.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Mail className="w-10 h-10 mb-2 text-slate-200" />
                <p className="text-[12px]">No messages</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── READING PANE ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {threadDetail ? (() => {
            const lastMsg = threadDetail.messages?.[threadDetail.messages.length - 1] || {};
            const firstMsg = threadDetail.messages?.[0] || {};
            const allAttachments = threadDetail.messages?.flatMap(m => m.attachments || []) || [];
            const initials = (firstMsg.from_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2);

            return (
              <>
                {/* Subject header */}
                <div className="px-6 py-3 border-b border-slate-200">
                  <h2 className="text-[15px] font-semibold text-[#1B1B1B]">{threadDetail.subject}</h2>
                </div>

                {/* Message content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {threadDetail.messages?.map((msg, idx) => {
                    const msgInitials = (msg.from_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2);
                    const avatarColors = ['bg-blue-500', 'bg-blue-500', 'bg-[#C5A55A]/100', 'bg-blue-500'];
                    const ci = (msg.from_name || '').length % avatarColors.length;

                    return (
                      <div key={msg.message_id} className={`${idx > 0 ? 'mt-6 pt-6 border-t border-slate-100' : ''}`} data-testid={`msg-${msg.message_id}`}>
                        {/* Sender row */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className={`w-9 h-9 rounded-md ${avatarColors[ci]} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[11px] font-bold">{msgInitials}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[13px] font-semibold text-[#1B1B1B]">{msg.from_name}</span>
                                <span className="text-[11px] text-slate-400 ml-2">{msg.from_role}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span>{new Date(msg.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500">To: {msg.to_names?.join(', ')}{msg.cc_names?.length > 0 ? ` | CC: ${msg.cc_names.join(', ')}` : ''}</p>
                          </div>
                          {/* Reply actions inline */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => openReply(msg, 'reply')} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#0078D4]" title="Reply"><Reply className="w-4 h-4" /></button>
                            <button onClick={() => openReply(msg, 'replyAll')} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#0078D4]" title="Reply all"><ReplyAll className="w-4 h-4" /></button>
                            <button onClick={() => openReply(msg, 'forward')} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-[#0078D4]" title="Forward"><Forward className="w-4 h-4" /></button>
                            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400"><MoreHorizontal className="w-4 h-4" /></button>
                          </div>
                        </div>

                        {/* Attachments */}
                        {(msg.attachments || []).length > 0 && (
                          <div className="mb-4 ml-12">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {msg.attachments.map(att => (
                                <div key={att.file_id} className="flex items-center gap-2 border border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50 transition-colors max-w-[260px]">
                                  <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-red-500" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-[#1B1B1B] truncate">{att.filename}</p>
                                    <p className="text-[10px] text-slate-400">{(att.size_bytes / 1024).toFixed(0)} KB</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button title="Preview" onClick={() => { const token = localStorage.getItem('rw_token'); fetch(`${import.meta.env.VITE_API_URL}/api/files/${att.file_id}/preview`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => window.open(URL.createObjectURL(b), '_blank')).catch(() => toast.error('Cannot preview')); }} className="text-[#0078D4] hover:text-blue-700"><Eye className="w-3.5 h-3.5" /></button>
                                    <button title="Download" onClick={() => { const token = localStorage.getItem('rw_token'); fetch(`${import.meta.env.VITE_API_URL}/api/files/${att.file_id}/download`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = att.filename; a.click(); }); }} className="text-slate-400 hover:text-slate-600"><Download className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="text-[10px] text-slate-400">{msg.attachments.length} attachment(s)</div>
                          </div>
                        )}

                        {/* Body */}
                        <div className="ml-12 prose prose-sm max-w-none text-[13px] text-[#1B1B1B] leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.body_html || msg.body_text?.replace(/\n/g, '<br/>') || '' }} />
                      </div>
                    );
                  })}

                  {/* Inline Chat Reply */}
                  <InlineReply threadId={threadDetail.thread_id} lastMsg={lastMsg} user={user} onSent={() => { selectThread({ thread_id: threadDetail.thread_id }); fetchThreads(activeFolder, searchQuery); fetchFolders(); }} openFullReply={(mode) => openReply(lastMsg, mode)} />
                </div>
              </>
            );
          })() : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <Mail className="w-20 h-20 mb-3" />
              <p className="text-[13px] text-slate-400">Select a message to read</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeDialog open={composeOpen} onClose={() => { setComposeOpen(false); setReplyMode(null); setReplyToMsg(null); }} contacts={contacts} user={user} replyMode={replyMode} replyToMsg={replyToMsg} threadId={threadDetail?.thread_id} onSent={() => { fetchThreads(activeFolder, searchQuery); fetchFolders(); setComposeOpen(false); setReplyMode(null); }} />
    </div>
  );
}

function InlineReply({ threadId, lastMsg, user, onSent, openFullReply }) {
  const [replyText, setReplyText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState([]);
  const [attachmentNames, setAttachmentNames] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const handleQuickSend = async () => {
    if (!replyText.trim() && attachmentIds.length === 0) return;
    setSending(true);
    const quotedHtml = `<p>${replyText.replace(/\n/g, '<br/>')}</p><br/><blockquote style="border-left:3px solid #0078D4;padding-left:12px;margin:8px 0;color:#666;font-size:12px;"><strong>${lastMsg.from_name}</strong> wrote:<br/>${lastMsg.body_text?.substring(0, 500) || lastMsg.body_html?.replace(/<[^>]*>/g, '').substring(0, 500) || ''}</blockquote>`;
    try {
      await api.post(`/mail/messages/${lastMsg.message_id}/reply`, {
        body_html: quotedHtml,
        body_text: replyText + `\n\n> ${lastMsg.from_name} wrote:\n> ${(lastMsg.body_text || '').substring(0, 500)}`,
        importance: 'normal',
        reply_all: false,
        attachment_ids: attachmentIds,
      });
      setReplyText(''); setAttachmentIds([]); setAttachmentNames([]);
      setExpanded(false);
      successToast('Reply sent');
      onSent();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send'); }
    setSending(false);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData(); fd.append('file', file);
      try {
        const r = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setAttachmentIds(p => [...p, r.data.file_id]);
        setAttachmentNames(p => [...p, { id: r.data.file_id, name: file.name }]);
      } catch { toast.error(`Upload failed: ${file.name}`); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickSend();
    }
  };

  if (!expanded) {
    return (
      <div className="mt-6 ml-12">
        <div onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 100); }} className="flex items-center gap-3 px-4 py-3 border border-slate-300 rounded-md cursor-text hover:border-[#0078D4] transition-colors bg-[#FAFAFA]" data-testid="inline-reply-trigger">
          <Reply className="w-4 h-4 text-slate-400" />
          <span className="text-[12px] text-slate-400">Reply to this conversation...</span>
          <div className="flex-1" />
          <button onClick={(e) => { e.stopPropagation(); openFullReply('forward'); }} className="text-[11px] text-slate-400 hover:text-[#0078D4] flex items-center gap-1"><Forward className="w-3 h-3" /> Forward</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 ml-12 border border-[#0078D4] rounded-md overflow-hidden bg-white shadow-sm" data-testid="inline-reply-box">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#F3F6FC] border-b border-slate-200">
        <Reply className="w-3.5 h-3.5 text-[#0078D4]" />
        <span className="text-[11px] font-medium text-slate-600">Replying to {lastMsg.from_name}</span>
        <div className="flex-1" />
        <button onClick={() => openFullReply('replyAll')} className="text-[10px] text-[#0078D4] hover:underline flex items-center gap-0.5"><ReplyAll className="w-3 h-3" /> Reply all</button>
        <button onClick={() => openFullReply('forward')} className="text-[10px] text-[#0078D4] hover:underline flex items-center gap-0.5 ml-2"><Forward className="w-3 h-3" /> Forward</button>
        <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600 ml-2"><X className="w-3.5 h-3.5" /></button>
      </div>
      {/* Quoted message */}
      <div className="mx-4 mt-2 mb-0 bg-[#F3F6FC] border-l-3 border-[#0078D4] rounded-r px-3 py-2" style={{ borderLeft: '3px solid #0078D4' }}>
        <p className="text-[10px] text-[#0078D4] font-semibold mb-0.5">{lastMsg.from_name} wrote:</p>
        <p className="text-[11px] text-slate-500 line-clamp-3">{lastMsg.body_text?.substring(0, 200) || lastMsg.body_html?.replace(/<[^>]*>/g, '').substring(0, 200) || ''}</p>
      </div>
      {/* Input */}
      <div className="px-4 py-3">
        <textarea
          ref={inputRef}
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your reply... (Enter to send, Shift+Enter for new line)"
          className="w-full border-none outline-none resize-none text-[13px] text-[#1B1B1B] placeholder:text-slate-400 min-h-[60px] max-h-[200px]"
          rows={3}
          data-testid="inline-reply-input"
        />
        {attachmentNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">{attachmentNames.map(a => (
            <div key={a.id} className="flex items-center gap-1.5 border border-slate-200 rounded px-2 py-1 bg-slate-50">
              <FileText className="w-3 h-3 text-red-500" /><span className="text-[10px]">{a.name}</span><X className="w-2.5 h-2.5 text-slate-400 cursor-pointer" onClick={() => { setAttachmentIds(p => p.filter(id => id !== a.id)); setAttachmentNames(p => p.filter(f => f.id !== a.id)); }} />
            </div>
          ))}</div>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-slate-400 hover:text-[#0078D4] flex items-center gap-1 text-[11px]" title="Attach file"><Paperclip className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Attach'}</button>
        </div>
        <Button size="sm" className="bg-[#0078D4] hover:bg-[#106EBE] text-white h-7 px-4 text-[11px] rounded-md gap-1" onClick={handleQuickSend} disabled={sending || (!replyText.trim() && attachmentIds.length === 0)} data-testid="inline-send-btn">
          <Send className="w-3 h-3" /> {sending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 hover:bg-white hover:shadow-sm transition-all ${className}`} title={label}>
      <Icon className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function ComposeDialog({ open, onClose, contacts, user, replyMode, replyToMsg, threadId, onSent }) {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [importance, setImportance] = useState('normal');
  const [attachmentIds, setAttachmentIds] = useState([]);
  const [attachmentNames, setAttachmentNames] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toSearch, setToSearch] = useState('');
  const [ccSearch, setCcSearch] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (replyMode && replyToMsg) {
      if (replyMode === 'reply') { setTo([replyToMsg.from_user_id]); setSubject(`Re: ${replyToMsg.subject || ''}`.replace(/^(Re: )+/, 'Re: ')); }
      else if (replyMode === 'replyAll') { setTo([...new Set([replyToMsg.from_user_id, ...(replyToMsg.to || [])].filter(id => id !== user?.user_id))]); setCc((replyToMsg.cc || []).filter(id => id !== user?.user_id)); setShowCc(true); setSubject(`Re: ${replyToMsg.subject || ''}`.replace(/^(Re: )+/, 'Re: ')); }
      else if (replyMode === 'forward') { setTo([]); setSubject(`Fwd: ${replyToMsg.subject || ''}`.replace(/^(Fwd: )+/, 'Fwd: ')); setBodyHtml(`<br/><hr/><p><em>Forwarded message</em></p>${replyToMsg.body_html || ''}`); }
    } else { setTo([]); setCc([]); setSubject(''); setBodyHtml(''); setAttachmentIds([]); setAttachmentNames([]); }
  }, [replyMode, replyToMsg, user]);

  const handleSend = async () => {
    if (to.length === 0) { toast.error('Add at least one recipient'); return; }
    setSending(true);
    try {
      const payload = { to, cc, bcc: [], subject, body_html: bodyHtml, body_text: bodyHtml.replace(/<[^>]*>/g, ''), importance, attachment_ids: attachmentIds, is_draft: false };
      if (replyMode && replyToMsg) {
        if (replyMode === 'forward') await api.post(`/mail/messages/${replyToMsg.message_id}/forward`, payload);
        else await api.post(`/mail/messages/${replyToMsg.message_id}/reply`, { ...payload, reply_all: replyMode === 'replyAll' });
      } else await api.post('/mail/messages', payload);
      successToast('Sent'); onSent();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSending(false);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData(); fd.append('file', file);
      try { const r = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setAttachmentIds(p => [...p, r.data.file_id]); setAttachmentNames(p => [...p, { id: r.data.file_id, name: file.name, size: r.data.size_bytes }]); } catch { toast.error(`Upload failed: ${file.name}`); }
    }
    setUploading(false);
  };

  const filteredTo = contacts.filter(c => c.user_id !== user?.user_id && !to.includes(c.user_id) && (c.name.toLowerCase().includes(toSearch.toLowerCase()) || (c.role || '').toLowerCase().includes(toSearch.toLowerCase()) || (c.department || '').toLowerCase().includes(toSearch.toLowerCase())));
  const filteredCc = contacts.filter(c => c.user_id !== user?.user_id && !cc.includes(c.user_id) && (c.name.toLowerCase().includes(ccSearch.toLowerCase()) || (c.role || '').toLowerCase().includes(ccSearch.toLowerCase())));
  const getContactName = (uid) => { const c = contacts.find(c => c.user_id === uid); return c ? c.name : uid; };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-200 bg-[#F3F6FC]">
          <DialogTitle className="text-[14px] font-semibold text-[#1B1B1B]">{replyMode === 'reply' ? 'Reply' : replyMode === 'replyAll' ? 'Reply All' : replyMode === 'forward' ? 'Forward' : 'New Message'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {/* To */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] w-6 text-slate-500">To</span>
            <div className="flex-1 flex flex-wrap items-center gap-1 bg-white border-b border-slate-300 pb-1 min-h-[32px]">
              {to.map(uid => (<Badge key={uid} className="bg-[#E1EFFF] text-[#0078D4] text-[10px] h-5 gap-1 font-normal">{getContactName(uid)} <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setTo(to.filter(id => id !== uid))} /></Badge>))}
              <input type="text" value={toSearch} onChange={e => setToSearch(e.target.value)} placeholder="Type a name..." className="bg-transparent border-none outline-none text-[12px] flex-1 min-w-[100px]" data-testid="compose-to" />
            </div>
            {!showCc && <button onClick={() => setShowCc(true)} className="text-[11px] text-[#0078D4]">CC</button>}
          </div>
          {toSearch && filteredTo.length > 0 && (
            <div className="ml-8 bg-white border border-slate-200 rounded shadow-lg max-h-40 overflow-y-auto z-50">
              {filteredTo.slice(0, 8).map(c => (
                <div key={c.user_id} onClick={() => { setTo([...to, c.user_id]); setToSearch(''); }} className="px-3 py-2 text-[11px] hover:bg-[#F5F5F5] cursor-pointer flex items-center justify-between">
                  <div><span className="font-medium">{c.name}</span>{c.department && <span className="text-slate-400 ml-1">- {c.department}</span>}</div>
                  <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{c.role}</span>
                </div>
              ))}
            </div>
          )}
          {showCc && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] w-6 text-slate-500">CC</span>
              <div className="flex-1 flex flex-wrap items-center gap-1 bg-white border-b border-slate-300 pb-1 min-h-[32px]">
                {cc.map(uid => (<Badge key={uid} className="bg-[#E1EFFF] text-[#0078D4] text-[10px] h-5 gap-1 font-normal">{getContactName(uid)} <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setCc(cc.filter(id => id !== uid))} /></Badge>))}
                <input type="text" value={ccSearch} onChange={e => setCcSearch(e.target.value)} className="bg-transparent border-none outline-none text-[12px] flex-1 min-w-[100px]" />
              </div>
            </div>
          )}
          {/* Subject */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] w-12 text-slate-500">Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} className="flex-1 bg-transparent border-b border-slate-300 pb-1 outline-none text-[13px]" data-testid="compose-subject" />
          </div>
          {/* Editor */}
          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write your message..." />
          {/* Attachments */}
          {attachmentNames.length > 0 && (
            <div className="flex flex-wrap gap-2">{attachmentNames.map(a => (
              <div key={a.id} className="flex items-center gap-2 border border-slate-200 rounded-md px-2.5 py-1.5">
                <FileText className="w-3.5 h-3.5 text-red-500" /><span className="text-[11px]">{a.name}</span><X className="w-3 h-3 text-slate-400 cursor-pointer" onClick={() => { setAttachmentIds(p => p.filter(id => id !== a.id)); setAttachmentNames(p => p.filter(f => f.id !== a.id)); }} />
              </div>
            ))}</div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-[#F3F6FC]">
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#0078D4]"><Paperclip className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Attach'}</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[11px] text-slate-500 hover:bg-slate-100 rounded">Discard</button>
            <Button size="sm" className="bg-[#0078D4] hover:bg-[#106EBE] text-white h-8 px-5 text-[12px] rounded-md" onClick={handleSend} disabled={sending} data-testid="send-btn">
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
