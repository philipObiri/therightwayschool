import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ChatList } from './messenger/ChatList';
import { MessageArea } from './messenger/MessageArea';
import { ChatInfoPanel } from './messenger/ChatInfoPanel';
import { CreateChatDialog } from './messenger/CreateChatDialog';

const BACKEND = import.meta.env.VITE_API_URL;

export default function TcisMessenger() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeChatDetail, setActiveChatDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [showInfo, setShowInfo] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState('group');
  const [loading, setLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showChatList, setShowChatList] = useState(true);
  const wsRef = useRef(null);
  const typingTimerRef = useRef(null);
  const reconnectRef = useRef(null);

  const loadChats = useCallback(async () => {
    try {
      const r = await api.get('/chat/list');
      setChats(r.data);
    } catch (err) { console.error("Error:", err); }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const r = await api.get('/chat/contacts');
      setContacts(r.data.contacts || []);
      setOnlineUsers(r.data.online_user_ids || []);
    } catch (err) { console.error("Error:", err); }
  }, []);

  const loadMessages = useCallback(async (chatId) => {
    try {
      const r = await api.get(`/chat/${chatId}/messages`);
      setMessages(r.data);
      api.post(`/chat/${chatId}/read`).catch(() => {});
    } catch (err) { console.error("Error:", err); }
  }, []);

  const loadChatDetail = useCallback(async (chatId) => {
    try {
      const r = await api.get(`/chat/${chatId}`);
      setActiveChatDetail(r.data);
    } catch (err) { console.error("Error:", err); }
  }, []);

  const openChat = useCallback(async (chatId) => {
    setActiveChat(chatId);
    setMessages([]);
    setLoading(true);
    setShowChatList(false); // Hide chat list on mobile when a chat is opened
    await Promise.all([loadMessages(chatId), loadChatDetail(chatId)]);
    setLoading(false);
  }, [loadMessages, loadChatDetail]);

  const startPrivateChat = useCallback(async (userId) => {
    try {
      const r = await api.post('/chat/start-private', { user_id: userId });
      await loadChats();
      openChat(r.data.chat_id);
    } catch (err) { console.error("Error:", err); }
  }, [loadChats, openChat]);

  // WebSocket
  useEffect(() => {
    const token = localStorage.getItem('rw_token');
    if (!token) return;

    function connect() {
      const wsUrl = BACKEND.replace(/^http/, 'ws') + `/api/chat/ws?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          handleWsEvent(data);
        } catch (err) { console.error("Error:", err); }
      };
      ws.onclose = () => {
        reconnectRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []);

  const handleWsEvent = useCallback((data) => {
    const event = data.event;
    if (event === 'new_message') {
      const msg = data.message;
      setMessages(prev => {
        if (!prev.length) return prev;
        if (prev[0]?.chat_id === msg.chat_id) {
          if (prev.find(m => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
      setChats(prev => prev.map(c => {
        if (c.chat_id === msg.chat_id) {
          return {
            ...c,
            last_message: { content: msg.content, sender_name: msg.sender_name, message_type: msg.message_type, created_at: msg.created_at },
            last_message_at: msg.created_at,
            unread_count: (c.chat_id === document._activeChatId) ? c.unread_count : (c.unread_count || 0) + 1
          };
        }
        return c;
      }));
    } else if (event === 'message_edited') {
      setMessages(prev => prev.map(m =>
        m.message_id === data.message_id ? { ...m, content: data.content, edited: true, edited_at: data.edited_at } : m
      ));
    } else if (event === 'message_deleted') {
      setMessages(prev => prev.filter(m => m.message_id !== data.message_id));
    } else if (event === 'reaction_update') {
      setMessages(prev => prev.map(m =>
        m.message_id === data.message_id ? { ...m, reactions: data.reactions } : m
      ));
    } else if (event === 'typing') {
      setTypingUsers(prev => ({ ...prev, [data.chat_id]: { ...prev[data.chat_id], [data.user_id]: Date.now() } }));
    } else if (event === 'stop_typing') {
      setTypingUsers(prev => {
        const copy = { ...prev };
        if (copy[data.chat_id]) { delete copy[data.chat_id][data.user_id]; }
        return copy;
      });
    } else if (event === 'user_status') {
      setOnlineUsers(prev => data.online ? [...new Set([...prev, data.user_id])] : prev.filter(id => id !== data.user_id));
      setContacts(prev => prev.map(c => c.user_id === data.user_id ? { ...c, online: data.online } : c));
    } else if (event === 'chat_created' || event === 'added_to_chat') {
      loadChats();
    } else if (event === 'removed_from_chat' || event === 'chat_deleted') {
      if (data.chat_id === activeChat) { setActiveChat(null); setActiveChatDetail(null); setMessages([]); }
      loadChats();
    } else if (event === 'message_pinned') {
      setMessages(prev => prev.map(m =>
        m.message_id === data.message_id ? { ...m, pinned: data.pinned } : m
      ));
    }
  }, [activeChat, loadChats]);

  // Store active chat id on a ref-like mechanism for WS handler
  useEffect(() => { document._activeChatId = activeChat; }, [activeChat]);

  // Mark as read when opening chat
  useEffect(() => {
    if (activeChat) {
      api.post(`/chat/${activeChat}/read`).catch(() => {});
      setChats(prev => prev.map(c => c.chat_id === activeChat ? { ...c, unread_count: 0 } : c));
    }
  }, [activeChat]);

  // Initial load
  useEffect(() => {
    loadChats();
    loadContacts();
    const chatParam = searchParams.get('chat');
    const userParam = searchParams.get('user');
    if (chatParam) openChat(chatParam);
    else if (userParam) startPrivateChat(userParam);
  }, []);

  const sendTyping = (chatId) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'typing', chat_id: chatId }));
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === 1)
          wsRef.current.send(JSON.stringify({ event: 'stop_typing', chat_id: chatId }));
      }, 2000);
    }
  };

  const chatTypers = activeChat && typingUsers[activeChat]
    ? Object.entries(typingUsers[activeChat]).filter(([uid, ts]) => Date.now() - ts < 4000 && uid !== user?.user_id).map(([uid]) => {
        const c = contacts.find(ct => ct.user_id === uid);
        return c?.name?.split(' ')[0] || 'Someone';
      })
    : [];

  return (
    <div className="flex h-[calc(100dvh-140px)] md:h-[calc(100vh-80px)] bg-[#F0F2F5] rounded-xl overflow-hidden border border-slate-200 shadow-sm" data-testid="tcis-messenger">
      {/* Chat List - hidden on mobile when chat is active */}
      <div className={`${showChatList ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] shrink-0 border-r border-slate-200`}>
        <ChatList
          chats={chats}
          activeChat={activeChat}
          onSelect={openChat}
          contacts={contacts}
          onlineUsers={onlineUsers}
          search={chatSearch}
          setSearch={setChatSearch}
          onNewGroup={() => { setCreateType('group'); setShowCreate(true); }}
          onNewChannel={() => { setCreateType('channel'); setShowCreate(true); }}
          onStartPrivate={startPrivateChat}
          currentUserId={user?.user_id}
        />
      </div>

      {activeChat && activeChatDetail ? (
        <div className={`${!showChatList ? 'flex' : 'hidden'} md:flex flex-1 flex-col`}>
          {/* Mobile back button */}
          <div className="md:hidden flex items-center gap-2 p-2 border-b border-slate-200 bg-white">
            <button onClick={() => { setShowChatList(true); setActiveChat(null); }} className="p-2 rounded-lg hover:bg-slate-100" data-testid="chat-back-btn">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-[#1B2A4A] truncate">{activeChatDetail.display_name || 'Chat'}</span>
          </div>
          <MessageArea
          chat={activeChatDetail}
          messages={messages}
          setMessages={setMessages}
          loading={loading}
          currentUser={user}
          onlineUsers={onlineUsers}
          typingUsers={chatTypers}
          onSendTyping={sendTyping}
          onToggleInfo={() => setShowInfo(!showInfo)}
          showInfo={showInfo}
          contacts={contacts}
          loadChats={loadChats}
          loadMessages={loadMessages}
          loadChatDetail={loadChatDetail}
          chats={chats}
        />
        </div>
      ) : (
        <div className={`${!showChatList ? 'flex' : 'hidden'} md:flex flex-1 items-center justify-center bg-[#EFEAE2]`} data-testid="no-chat-selected">
          <div className="text-center">
            <div className="w-20 h-20 bg-[#2E6CC4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#2E6CC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-[#1B2A4A] mb-1">RightWay Messenger</h2>
            <p className="text-sm text-slate-500">Select a conversation or start a new one</p>
          </div>
        </div>
      )}

      {showInfo && activeChatDetail && (
        <ChatInfoPanel
          chat={activeChatDetail}
          onClose={() => setShowInfo(false)}
          currentUser={user}
          onlineUsers={onlineUsers}
          loadChatDetail={loadChatDetail}
          loadChats={loadChats}
        />
      )}

      <CreateChatDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        type={createType}
        contacts={contacts}
        loadChats={loadChats}
        openChat={openChat}
      />
    </div>
  );
}
