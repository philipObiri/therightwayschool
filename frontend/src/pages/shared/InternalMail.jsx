import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Mail, Send, Inbox, ArrowRight, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLoader } from '../../components/AppLoader';

export default function InternalMail() {
  const { user } = useAuth();
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [form, setForm] = useState({ to_user_ids: [], subject: '', body: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [inboxRes, sentRes, usersRes] = await Promise.all([
        api.get('/mail/inbox'),
        api.get('/mail/sent'),
        api.get('/auth/users'),
      ]);
      setInbox(inboxRes.data);
      setSent(sentRes.data);
      setUsers(usersRes.data);
    } catch {
      // Users endpoint may fail for non-admin
      try {
        const [inboxRes, sentRes] = await Promise.all([
          api.get('/mail/inbox'),
          api.get('/mail/sent'),
        ]);
        setInbox(inboxRes.data);
        setSent(sentRes.data);
      } catch (err) { console.error("Error:", err); }
    }
    setLoading(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    try {
      await api.post('/mail/send', form);
      toast.success('Message sent');
      setComposeOpen(false);
      setForm({ to_user_ids: [], subject: '', body: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send'); }
  };

  const openMessage = async (msg) => {
    setSelectedMsg(msg);
    if (!msg.is_read) {
      try { await api.post(`/mail/${msg.message_id}/read`); } catch (err) { console.error("Error:", err); }
    }
  };

  if (loading) return <AppLoader />;

  const unreadCount = inbox.filter(m => !m.is_read).length;

  return (
    <div className="space-y-6" data-testid="internal-mail">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Internal Mail</h1>
          <p className="text-slate-500 mt-1">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-md bg-[#2E6CC4]" data-testid="compose-mail-btn"><Send className="w-4 h-4 mr-2" /> Compose</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-2">
                <Label>To</Label>
                <Select onValueChange={v => setForm({...form, to_user_ids: [v]})}>
                  <SelectTrigger data-testid="mail-to-select"><SelectValue placeholder="Select recipient" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.user_id !== user?.user_id).map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required data-testid="mail-subject-input" />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} rows={5} required data-testid="mail-body-input" />
              </div>
              <Button type="submit" className="w-full rounded-md bg-[#2E6CC4]" data-testid="send-mail-btn">
                <Send className="w-4 h-4 mr-2" /> Send
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="inbox">
        <TabsList className="bg-white border" data-testid="mail-tabs">
          <TabsTrigger value="inbox" data-testid="inbox-tab">
            <Inbox className="w-4 h-4 mr-1" /> Inbox ({inbox.length})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="sent-tab">
            <ArrowRight className="w-4 h-4 mr-1" /> Sent ({sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <div className="bg-white rounded-md border border-slate-100 divide-y divide-slate-50">
            {inbox.map(msg => (
              <div
                key={msg.message_id}
                onClick={() => openMessage(msg)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors ${!msg.is_read ? 'bg-blue-50/30' : ''}`}
                data-testid={`inbox-msg-${msg.message_id}`}
              >
                {!msg.is_read && <Circle className="w-2 h-2 fill-[#2E6CC4] text-[#2E6CC4] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${!msg.is_read ? 'font-semibold text-[#1B2A4A]' : 'text-slate-700'}`}>{msg.from_name}</p>
                    <span className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className={`text-sm ${!msg.is_read ? 'font-medium' : 'text-slate-500'} truncate`}>{msg.subject}</p>
                  <p className="text-xs text-slate-400 truncate">{msg.body}</p>
                </div>
              </div>
            ))}
            {inbox.length === 0 && <p className="text-center py-8 text-slate-400">No messages</p>}
          </div>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <div className="bg-white rounded-md border border-slate-100 divide-y divide-slate-50">
            {sent.map(msg => (
              <div key={msg.message_id} onClick={() => setSelectedMsg(msg)} className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50" data-testid={`sent-msg-${msg.message_id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-700">To: {msg.to_names?.join(', ')}</p>
                    <span className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium truncate">{msg.subject}</p>
                </div>
              </div>
            ))}
            {sent.length === 0 && <p className="text-center py-8 text-slate-400">No sent messages</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Message view dialog */}
      <Dialog open={!!selectedMsg} onOpenChange={() => setSelectedMsg(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{selectedMsg?.subject}</DialogTitle></DialogHeader>
          {selectedMsg && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">From: <strong>{selectedMsg.from_name || 'You'}</strong></span>
                <span className="text-xs text-slate-400">{new Date(selectedMsg.created_at).toLocaleString()}</span>
              </div>
              {selectedMsg.to_names && <p className="text-sm text-slate-500">To: {selectedMsg.to_names.join(', ')}</p>}
              <div className="bg-slate-50 rounded-md p-4 whitespace-pre-wrap text-sm text-slate-700">
                {selectedMsg.body}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
