import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AppLoader } from '../../components/AppLoader';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { Send, Search, User, X, Users, MessageSquare, Radio, Paperclip, Download } from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL;
const getToken = () => localStorage.getItem('rw_token') || '';
const fileUrl = (fileId) => `${BACKEND}/api/files/${fileId}/download?token=${getToken()}`;

export default function ParentCommunication() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedParents, setSelectedParents] = useState([]);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/receptionist/messages').then(r => setMessages(r.data)).finally(() => setLoading(false));
  }, []);

  const searchParents = async (q) => {
    setParentSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const r = await api.get(`/receptionist/parents/search?q=${encodeURIComponent(q)}`);
    setSearchResults(r.data.filter(p => !selectedParents.find(sp => sp.user_id === p.user_id)));
  };

  const addParent = (p) => {
    setSelectedParents([...selectedParents, p]);
    setSearchResults([]);
    setParentSearch('');
  };

  const removeParent = (id) => setSelectedParents(selectedParents.filter(p => p.user_id !== id));

  const handleFileUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    setUploading(true);
    for (const file of fileList) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setFiles(prev => [...prev, { file_id: res.data.file_id, filename: res.data.filename || file.name, size: res.data.size_bytes }]);
      } catch (err) { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!form.subject || !form.body) return toast.error('Subject and message required');
    if (!isBroadcast && selectedParents.length === 0) return toast.error('Select at least one parent or use broadcast');

    setSending(true);
    try {
      await api.post('/receptionist/message', {
        subject: form.subject,
        body: form.body,
        broadcast: isBroadcast,
        recipient_ids: isBroadcast ? [] : selectedParents.map(p => p.user_id),
        attachments: files.map(f => ({ file_id: f.file_id, filename: f.filename })),
      });
      successToast(isBroadcast ? 'Broadcast sent to all parents' : `Message sent to ${selectedParents.length} parent(s)`);
      setShowCompose(false);
      setForm({ subject: '', body: '' });
      setSelectedParents([]);
      setIsBroadcast(false);
      setFiles([]);
      const r = await api.get('/receptionist/messages');
      setMessages(r.data);
    } catch (e) { toast.error('Failed'); }
    finally { setSending(false); }
  };

  if (loading) return <AppLoader />;

  return (
    <div className="space-y-6" data-testid="parent-communication">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>Parent Communication</h1>
          <p className="text-sm text-slate-500 mt-1">{messages.length} messages sent</p>
        </div>
        <Button onClick={() => setShowCompose(true)} className="bg-[#2E6CC4] hover:bg-[#1B2A4A] rounded-lg" data-testid="compose-btn">
          <Send className="w-4 h-4 mr-2" /> Compose Message
        </Button>
      </div>

      {/* Message History */}
      <Card className="rounded-xl">
        <CardContent className="pt-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No messages sent yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.message_id} className="p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`msg-${m.message_id}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.type === 'broadcast' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      {m.type === 'broadcast' ? <Radio className="w-4 h-4 text-amber-600" /> : <MessageSquare className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1B2A4A]">{m.subject}</p>
                      <p className="text-xs text-slate-400">
                        {m.type === 'broadcast' ? 'Broadcast to all parents' : `To ${m.recipient_ids?.length || 0} parent(s)`}
                        &middot; {m.sent_by_name} &middot; {m.sent_at ? new Date(m.sent_at).toLocaleString() : ''}
                      </p>
                    </div>
                    <Badge className={`text-[10px] ${m.type === 'broadcast' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{m.type}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 pl-11">{m.body}</p>
                  {(m.attachments || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-11 mt-2">
                      {m.attachments.map((att, j) => (
                        <a key={j} href={fileUrl(att.file_id)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100" data-testid={`att-${att.file_id}`}>
                          <Download className="w-3 h-3" /> {att.filename || 'File'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Broadcast toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
              <input
                type="checkbox"
                checked={isBroadcast}
                onChange={e => setIsBroadcast(e.target.checked)}
                className="w-4 h-4 rounded"
                data-testid="broadcast-toggle"
              />
              <div>
                <p className="text-sm font-medium text-[#1B2A4A] flex items-center gap-2"><Radio className="w-4 h-4 text-amber-600" /> Broadcast to ALL parents</p>
                <p className="text-xs text-slate-400">Message will be sent to every parent in the system</p>
              </div>
            </div>

            {/* Recipients (if not broadcast) */}
            {!isBroadcast && (
              <div className="space-y-2">
                <Label>Recipients</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search parent by name, phone, or email..." value={parentSearch} onChange={e => searchParents(e.target.value)} className="pl-9" data-testid="parent-search-input" />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-32 overflow-y-auto">
                    {searchResults.map(p => (
                      <div key={p.user_id} onClick={() => addParent(p)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm flex justify-between"
                        data-testid={`parent-result-${p.user_id}`}>
                        <span>{p.name}</span>
                        <span className="text-xs text-slate-400">{p.email}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedParents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedParents.map(p => (
                      <Badge key={p.user_id} className="bg-blue-100 text-blue-700 flex items-center gap-1 pr-1" data-testid={`selected-parent-${p.user_id}`}>
                        <User className="w-3 h-3" /> {p.name}
                        <Button variant="ghost" size="sm" onClick={() => removeParent(p.user_id)} className="h-4 w-4 p-0 ml-1"><X className="w-3 h-3" /></Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Upcoming Parent Visit Day" data-testid="msg-subject-input" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4} placeholder="Type your message..." data-testid="msg-body-input" />
            </div>
            {/* File Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
                  <Paperclip className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Attach Files'}
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} data-testid="file-upload-input" />
                </label>
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <Badge key={i} className="bg-blue-100 text-blue-700 flex items-center gap-1 pr-1">
                      <Paperclip className="w-3 h-3" /> {f.filename}
                      <Button variant="ghost" size="sm" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="h-4 w-4 p-0 ml-1"><X className="w-3 h-3" /></Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full bg-[#2E6CC4]" data-testid="send-message-btn">
              <Send className="w-4 h-4 mr-2" /> {sending ? 'Sending...' : isBroadcast ? 'Send to All Parents' : 'Send Message'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
