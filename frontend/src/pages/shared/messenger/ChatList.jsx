import React, { useState } from 'react';
import { Search, Plus, Users, Megaphone, MessageSquare } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';

export function ChatList({ chats, activeChat, onSelect, contacts, onlineUsers, search, setSearch, onNewGroup, onNewChannel, onStartPrivate, currentUserId }) {
  const [tab, setTab] = useState('chats');
  const [showMenu, setShowMenu] = useState(false);

  const filtered = chats.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.display_name || '').toLowerCase().includes(q) || (c.last_message?.content || '').toLowerCase().includes(q);
  });

  const filteredContacts = contacts.filter(c => {
    if (!search) return true;
    return (c.name || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-full md:w-[340px] border-r border-slate-200 bg-white flex flex-col shrink-0" data-testid="chat-list-panel">
      <div className="p-3 border-b border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1B2A4A]">Messenger</h2>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="w-8 h-8 rounded-full bg-[#2E6CC4]/10 flex items-center justify-center hover:bg-[#2E6CC4]/20 transition-colors" data-testid="new-chat-btn">
              <Plus className="w-4 h-4 text-[#2E6CC4]" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white border rounded-lg shadow-lg z-50 w-48 py-1 animate-fade-in" data-testid="new-chat-menu">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onClick={() => { setShowMenu(false); setTab('contacts'); }} data-testid="new-private-btn"><MessageSquare className="w-4 h-4 text-[#2E6CC4]" /> New Chat</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onClick={() => { setShowMenu(false); onNewGroup(); }} data-testid="new-group-btn"><Users className="w-4 h-4 text-[#C5A55A]" /> New Group</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onClick={() => { setShowMenu(false); onNewChannel(); }} data-testid="new-channel-btn"><Megaphone className="w-4 h-4 text-amber-600" /> New Channel</button>
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <Input placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 rounded-lg text-sm bg-slate-50 border-0" data-testid="chat-search-input" />
        </div>
        <div className="flex gap-1">
          <TabBtn active={tab === 'chats'} onClick={() => setTab('chats')} label="Chats" count={chats.filter(c => c.unread_count > 0).length} />
          <TabBtn active={tab === 'contacts'} onClick={() => setTab('contacts')} label="Contacts" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="chat-list-scroll">
        {tab === 'chats' && filtered.map(c => (
          <ChatItem key={c.chat_id} chat={c} active={c.chat_id === activeChat} onClick={() => onSelect(c.chat_id)} onlineUsers={onlineUsers} currentUserId={currentUserId} />
        ))}
        {tab === 'chats' && filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No conversations yet</p>
          </div>
        )}
        {tab === 'contacts' && filteredContacts.map(c => (
          <ContactItem key={c.user_id} contact={c} onClick={() => onStartPrivate(c.user_id)} />
        ))}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }) {
  return (
    <button onClick={onClick} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${active ? 'bg-[#2E6CC4] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
      {label}
      {count > 0 && <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded-full text-[10px]">{count}</span>}
    </button>
  );
}

function ChatItem({ chat, active, onClick, onlineUsers, currentUserId }) {
  const isPrivate = chat.type === 'private';
  const otherOnline = isPrivate && chat.other_user && onlineUsers.includes(chat.other_user.user_id);
  const initial = (chat.display_name || '?').charAt(0).toUpperCase();
  const lastMsg = chat.last_message;
  const timeStr = lastMsg?.created_at ? formatTime(lastMsg.created_at) : '';
  const isGroup = chat.type === 'group';
  const isChannel = chat.type === 'channel';

  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-b border-slate-50 ${active ? 'bg-[#2E6CC4]/8' : 'hover:bg-slate-50'}`} data-testid={`chat-item-${chat.chat_id}`}>
      <div className="relative shrink-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${isChannel ? 'bg-amber-500' : isGroup ? 'bg-[#C5A55A]/100' : 'bg-[#2E6CC4]'}`}>
          {isChannel ? <Megaphone className="w-5 h-5" /> : isGroup ? <Users className="w-5 h-5" /> : initial}
        </div>
        {otherOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#C5A55A]/100 border-2 border-white rounded-full" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${chat.unread_count > 0 ? 'font-bold text-[#1B2A4A]' : 'font-medium text-[#1B2A4A]'}`}>{chat.display_name}</span>
          <span className={`text-[10px] shrink-0 ${chat.unread_count > 0 ? 'text-[#2E6CC4] font-semibold' : 'text-slate-400'}`}>{timeStr}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <p className={`text-xs truncate flex-1 ${chat.unread_count > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
            {lastMsg ? (lastMsg.message_type === 'system' ? lastMsg.content : `${lastMsg.sender_name?.split(' ')[0]}: ${lastMsg.content || 'File'}`) : 'No messages yet'}
          </p>
          {chat.unread_count > 0 && <Badge className="bg-[#2E6CC4] text-white text-[9px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full">{chat.unread_count}</Badge>}
          {chat.muted && <span className="text-slate-300 text-[10px]">&#128264;</span>}
        </div>
      </div>
    </div>
  );
}

function ContactItem({ contact, onClick }) {
  const initial = (contact.name || '?').charAt(0).toUpperCase();
  return (
    <div onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-50" data-testid={`contact-${contact.user_id}`}>
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#2E6CC4] flex items-center justify-center text-white font-bold text-sm">{initial}</div>
        {contact.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#C5A55A]/100 border-2 border-white rounded-full" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1B2A4A] truncate">{contact.name}</p>
        <p className="text-[10px] text-slate-400">{contact.role} {contact.department ? `| ${contact.department}` : ''}</p>
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
