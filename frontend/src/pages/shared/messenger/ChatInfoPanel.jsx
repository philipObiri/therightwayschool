import React, { useState } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { X, Users, Megaphone, Shield, Crown, UserMinus, MoreVertical, FileText, Pin, Download, Image as ImageIcon, Bell, BellOff, LogOut, Trash2, Search } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

const BACKEND = import.meta.env.VITE_API_URL;

export function ChatInfoPanel({ chat, onClose, currentUser, onlineUsers, loadChatDetail, loadChats }) {
  const [tab, setTab] = useState('members');
  const isAdmin = chat.my_role === 'admin' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'CEO';
  const isPrivate = chat.type === 'private';
  const isChannel = chat.type === 'channel';
  const token = localStorage.getItem('rw_token');

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/chat/${chat.chat_id}/members/${userId}`);
      successToast('Removed');
      loadChatDetail(chat.chat_id);
      loadChats();
    } catch { toast.error('Failed'); }
  };

  const handleChangeRole = async (userId, role) => {
    try {
      await api.put(`/chat/${chat.chat_id}/members/${userId}/role`, { role });
      successToast('Role updated');
      loadChatDetail(chat.chat_id);
    } catch { toast.error('Failed'); }
  };

  const handleMute = async () => {
    try {
      await api.put(`/chat/${chat.chat_id}/mute`, { muted: !chat.muted });
      successToast(chat.muted ? 'Unmuted' : 'Muted');
      loadChatDetail(chat.chat_id);
    } catch { toast.error('Failed'); }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave this chat?')) return;
    try {
      await api.delete(`/chat/${chat.chat_id}/members/${currentUser.user_id}`);
      successToast('Left chat');
      loadChats();
      onClose();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this chat permanently?')) return;
    try {
      await api.delete(`/chat/${chat.chat_id}`);
      successToast('Deleted');
      loadChats();
      onClose();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="w-[320px] border-l border-slate-200 bg-white flex flex-col shrink-0 animate-slide-in" data-testid="chat-info-panel">
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <span className="text-sm font-bold text-[#1B2A4A]">{isPrivate ? 'Contact Info' : 'Chat Info'}</span>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 border-b border-slate-100 text-center">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold ${isChannel ? 'bg-amber-500' : chat.type === 'group' ? 'bg-[#C5A55A]/100' : 'bg-[#2E6CC4]'}`}>
          {isChannel ? <Megaphone className="w-8 h-8" /> : chat.type === 'group' ? <Users className="w-8 h-8" /> : (chat.name?.charAt(0) || '?')}
        </div>
        <h3 className="text-base font-bold text-[#1B2A4A] mt-2">{chat.name || 'Private Chat'}</h3>
        {chat.description && <p className="text-xs text-slate-500 mt-1">{chat.description}</p>}
        <div className="flex items-center justify-center gap-2 mt-2">
          {!isPrivate && <Badge variant="secondary" className="text-[9px]">{chat.type === 'channel' ? 'Channel' : 'Group'}</Badge>}
          <Badge variant="secondary" className="text-[9px]">{chat.members?.length || 0} members</Badge>
        </div>
      </div>

      <div className="flex items-center border-b border-slate-100">
        <button onClick={handleMute} className="flex-1 py-2.5 text-xs text-slate-600 hover:bg-slate-50 flex flex-col items-center gap-1">
          {chat.muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {chat.muted ? 'Unmute' : 'Mute'}
        </button>
        {!isPrivate && (
          <button onClick={handleLeave} className="flex-1 py-2.5 text-xs text-slate-600 hover:bg-slate-50 flex flex-col items-center gap-1">
            <LogOut className="w-4 h-4" />Leave
          </button>
        )}
        {isAdmin && (
          <button onClick={handleDelete} className="flex-1 py-2.5 text-xs text-red-500 hover:bg-red-50 flex flex-col items-center gap-1">
            <Trash2 className="w-4 h-4" />Delete
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-100">
        {['members', 'files', 'pinned'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-xs font-medium ${tab === t ? 'text-[#2E6CC4] border-b-2 border-[#2E6CC4]' : 'text-slate-500'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'members' && (
          <div className="p-2">
            {(chat.members || []).map(m => (
              <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50" data-testid={`member-${m.user_id}`}>
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[#2E6CC4] flex items-center justify-center text-white text-xs font-bold">{(m.name || '?').charAt(0)}</div>
                  {m.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#C5A55A]/100 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate">{m.name}</span>
                    {m.role === 'admin' && <Crown className="w-3 h-3 text-amber-500" />}
                  </div>
                  <p className="text-[10px] text-slate-400">{m.user_role}</p>
                </div>
                {isAdmin && m.user_id !== currentUser?.user_id && (
                  <div className="flex gap-1">
                    <button onClick={() => handleChangeRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')} className="p-1 rounded hover:bg-slate-200" title={m.role === 'admin' ? 'Remove admin' : 'Make admin'}>
                      <Shield className="w-3 h-3 text-slate-400" />
                    </button>
                    <button onClick={() => handleRemoveMember(m.user_id)} className="p-1 rounded hover:bg-red-50" title="Remove">
                      <UserMinus className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'files' && (
          <div className="p-2 space-y-1">
            {(chat.shared_files || []).length === 0 && <p className="text-xs text-slate-400 text-center py-8">No shared files</p>}
            {(chat.shared_files || []).map(m => m.attachments?.map((a, i) => (
              <div key={`${m.message_id}-${i}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center"><FileText className="w-4 h-4 text-slate-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.filename}</p>
                  <p className="text-[10px] text-slate-400">{a.file_type?.toUpperCase()} | {m.sender_name}</p>
                </div>
                <a href={`${BACKEND}/api/files/${a.file_id}/download?token=${token}`} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-slate-200">
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            )))}
          </div>
        )}

        {tab === 'pinned' && (
          <div className="p-2 space-y-1">
            {(chat.pinned_messages || []).length === 0 && <p className="text-xs text-slate-400 text-center py-8">No pinned messages</p>}
            {(chat.pinned_messages || []).map(m => (
              <div key={m.message_id} className="p-2.5 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-1 mb-1">
                  <Pin className="w-3 h-3 text-[#2E6CC4]" />
                  <span className="text-[10px] font-semibold text-[#1B2A4A]">{m.sender_name}</span>
                  <span className="text-[9px] text-slate-400 ml-auto">{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-3">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
