import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { MessagesSquare, Send, Users, ArrowLeft, Smile, Reply, Trash2, Edit3, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';

function RoomList({ rooms, activeRoom, onSelect }) {
  return (
    <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <MessagesSquare className="w-4 h-4 text-indigo-500" /> Department Rooms
        </h2>
        <p className="text-xs text-slate-400 mt-1">Staff collaboration by department</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rooms.map(room => (
          <button key={room.room_id} onClick={() => onSelect(room)} data-testid={`room-${room.room_id}`}
            className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-white transition-colors ${activeRoom?.room_id === room.room_id ? 'bg-white border-l-2 border-l-indigo-500' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-800">{room.name}</span>
              <span className="text-[10px] text-slate-400">{room.member_count} members</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {room.last_message ? `${room.last_message.sender_name}: ${room.last_message.text}` : 'No messages yet'}
            </div>
            {room.is_member && <span className="text-[9px] text-indigo-500 font-semibold mt-0.5 inline-block">Your Department</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatArea({ room, user, onBack }) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editMsg, setEditMsg] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  const loadMessages = async () => {
    try {
      const r = await api.get(`/discussions/rooms/${room.room_id}/messages`);
      setMessages(r.data.messages || []);
    } catch (err) { console.error("Error:", err); }
  };

  const loadMembers = async () => {
    try {
      const r = await api.get(`/discussions/rooms/${room.room_id}`);
      setMembers(r.data.members || []);
    } catch (err) { console.error("Error:", err); }
  };

  useEffect(() => {
    loadMessages();
    loadMembers();
    pollRef.current = setInterval(loadMessages, 4000);
    return () => clearInterval(pollRef.current);
  }, [room.room_id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      if (editMsg) {
        await api.put(`/discussions/messages/${editMsg.message_id}`, { text });
        setEditMsg(null);
      } else {
        await api.post(`/discussions/rooms/${room.room_id}/messages`, { text, reply_to: replyTo?.message_id });
        setReplyTo(null);
      }
      setText('');
      await loadMessages();
    } catch (err) { console.error("Error:", err); }
    setSending(false);
  };

  const handleReact = async (msgId, emoji) => {
    try {
      await api.post(`/discussions/messages/${msgId}/react`, { emoji });
      await loadMessages();
    } catch (err) { console.error("Error:", err); }
  };

  const handleDelete = async (msgId) => {
    try {
      await api.delete(`/discussions/messages/${msgId}`);
      await loadMessages();
    } catch (err) { console.error("Error:", err); }
  };

  const startEdit = (msg) => {
    setEditMsg(msg);
    setText(msg.text);
    setReplyTo(null);
  };

  const replyMsg = messages.find(m => m.message_id === replyTo?.message_id);
  const EMOJIS = ['👍', '❤️', '😄', '🎯', '✅'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <button onClick={onBack} className="lg:hidden p-1 hover:bg-slate-100 rounded"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-sm">{room.name}</h3>
          <span className="text-xs text-slate-400">{room.member_count} members</span>
        </div>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowMembers(!showMembers)} data-testid="toggle-members">
          <Users className="w-3 h-3 mr-1" /> Members
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="messages-area">
            {messages.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">No messages yet. Start the conversation!</div>
            )}
            {messages.map(msg => {
              const isOwn = msg.sender_id === user.user_id;
              if (msg.deleted) return (
                <div key={msg.message_id} className="text-xs text-slate-400 italic py-1">Message deleted</div>
              );
              const replied = msg.reply_to ? messages.find(m => m.message_id === msg.reply_to) : null;
              return (
                <div key={msg.message_id} className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`} data-testid={`msg-${msg.message_id}`}>
                  <div className={`max-w-[75%] rounded-xl px-3.5 py-2 ${isOwn ? 'bg-indigo-500 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                    {!isOwn && <div className="text-[10px] font-bold opacity-70 mb-0.5">{msg.sender_name} <span className="font-normal">({msg.sender_role})</span></div>}
                    {replied && (
                      <div className={`text-[10px] px-2 py-1 rounded mb-1 border-l-2 ${isOwn ? 'bg-indigo-400/40 border-white/40' : 'bg-slate-50 border-indigo-300'}`}>
                        <span className="font-semibold">{replied.sender_name}:</span> {replied.text.slice(0, 60)}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                    <div className={`text-[9px] mt-1 ${isOwn ? 'opacity-60' : 'text-slate-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      {msg.edited && ' (edited)'}
                    </div>
                    {/* Reactions */}
                    {Object.keys(msg.reactions || {}).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button key={emoji} onClick={() => handleReact(msg.message_id, emoji)}
                            className={`text-xs px-1.5 py-0.5 rounded-full border ${users.includes(user.user_id) ? 'bg-indigo-100 border-indigo-300' : 'bg-slate-50 border-slate-200'}`}>
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Actions */}
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-1 transition-opacity">
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => handleReact(msg.message_id, e)} className="text-xs hover:scale-125 transition-transform">{e}</button>
                      ))}
                      <button onClick={() => setReplyTo(msg)} className="text-[10px] ml-1 opacity-60 hover:opacity-100"><Reply className="w-3 h-3" /></button>
                      {isOwn && <button onClick={() => startEdit(msg)} className="text-[10px] opacity-60 hover:opacity-100"><Edit3 className="w-3 h-3" /></button>}
                      {isOwn && <button onClick={() => handleDelete(msg.message_id)} className="text-[10px] opacity-60 hover:opacity-100"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compose */}
          <div className="border-t border-slate-200 bg-white px-4 py-2">
            {replyTo && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 bg-slate-50 rounded px-2 py-1">
                <Reply className="w-3 h-3" /> Replying to <b>{replyTo.sender_name}</b>
                <button onClick={() => setReplyTo(null)} className="ml-auto text-slate-400 hover:text-red-500">&times;</button>
              </div>
            )}
            {editMsg && (
              <div className="flex items-center gap-2 text-xs text-amber-600 mb-1 bg-amber-50 rounded px-2 py-1">
                <Edit3 className="w-3 h-3" /> Editing message
                <button onClick={() => { setEditMsg(null); setText(''); }} className="ml-auto text-slate-400 hover:text-red-500">&times;</button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} data-testid="message-input"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()} data-testid="send-message-btn"
                className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg">
                {editMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Members sidebar */}
        {showMembers && (
          <div className="w-56 border-l border-slate-200 bg-white overflow-y-auto">
            <div className="p-3 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Members ({members.length})</h4>
            </div>
            <div className="divide-y divide-slate-50">
              {members.map(m => (
                <div key={m.user_id} className="px-3 py-2 text-xs">
                  <div className="font-semibold text-slate-800">{m.name}</div>
                  <div className="text-slate-400">{m.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DiscussionRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/discussions/rooms');
        const roomList = r.data.rooms || [];
        setRooms(roomList);
        // Auto-select user's department room
        const myRoom = roomList.find(rm => rm.is_member);
        if (myRoom) setActiveRoom(myRoom);
      } catch (e) { console.error('Failed to load rooms', e); }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400">Loading rooms...</div>;

  return (
    <div className="h-[calc(100vh-64px)] flex bg-slate-50" data-testid="discussion-rooms">
      {/* Room List — always visible on lg, hidden when chat open on mobile */}
      <div className={`w-72 flex-shrink-0 ${activeRoom ? 'hidden lg:flex lg:flex-col' : 'flex flex-col w-full lg:w-72'}`}>
        <RoomList rooms={rooms} activeRoom={activeRoom} onSelect={setActiveRoom} />
      </div>
      {/* Chat Area */}
      <div className={`flex-1 ${!activeRoom ? 'hidden lg:flex' : 'flex'} flex-col`}>
        {activeRoom ? (
          <ChatArea room={activeRoom} user={user} onBack={() => setActiveRoom(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessagesSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Select a department room to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
