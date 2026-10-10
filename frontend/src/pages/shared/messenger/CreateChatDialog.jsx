import React, { useState } from 'react';
import api from '../../../lib/api';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { Search, Check, X, Users, Megaphone } from 'lucide-react';

export function CreateChatDialog({ open, onClose, type, contacts, loadChats, openChat }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyAdmins, setOnlyAdmins] = useState(false);
  const [creating, setCreating] = useState(false);

  const filtered = contacts.filter(c => {
    if (!search) return true;
    return (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.role || '').toLowerCase().includes(search.toLowerCase());
  });

  const toggle = (userId) => {
    setSelected(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    if (selected.length === 0) { toast.error('Select at least one member'); return; }
    setCreating(true);
    try {
      const endpoint = type === 'channel' ? '/chat/create-channel' : '/chat/create-group';
      const r = await api.post(endpoint, {
        name: name.trim(),
        description,
        member_ids: selected,
        only_admins_post: onlyAdmins,
        category: type === 'channel' ? 'announcement' : 'general'
      });
      successToast(`${type === 'channel' ? 'Channel' : 'Group'} created`);
      loadChats();
      openChat(r.data.chat_id);
      reset();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
    setCreating(false);
  };

  const reset = () => { setName(''); setDescription(''); setSelected([]); setSearch(''); setOnlyAdmins(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'channel' ? <Megaphone className="w-5 h-5 text-amber-500" /> : <Users className="w-5 h-5 text-[#C5A55A]" />}
            Create {type === 'channel' ? 'Channel' : 'Group'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={type === 'channel' ? 'e.g. Leadership Announcements' : 'e.g. Academic Staff'} data-testid="chat-name-input" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional description..." />
          </div>

          {type === 'channel' && (
            <label className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer">
              <input type="checkbox" checked={onlyAdmins} onChange={e => setOnlyAdmins(e.target.checked)} />
              <span className="text-xs text-amber-800">Only admins can post (broadcast mode)</span>
            </label>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Members ({selected.length})</Label>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="pl-8 h-9 text-sm" data-testid="member-search" />
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map(id => {
                const c = contacts.find(ct => ct.user_id === id);
                return c ? (
                  <span key={id} className="flex items-center gap-1 bg-[#2E6CC4]/10 text-[#2E6CC4] text-[10px] px-2 py-1 rounded-full">
                    {c.name?.split(' ')[0]}
                    <button onClick={() => toggle(id)}><X className="w-3 h-3" /></button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          <div className="max-h-[200px] overflow-y-auto border rounded-lg" data-testid="member-list">
            {filtered.map(c => {
              const sel = selected.includes(c.user_id);
              return (
                <div key={c.user_id} onClick={() => toggle(c.user_id)} className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${sel ? 'bg-[#2E6CC4]/5' : 'hover:bg-slate-50'}`} data-testid={`member-option-${c.user_id}`}>
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${sel ? 'bg-[#2E6CC4] border-[#2E6CC4]' : 'border-slate-300'}`}>
                    {sel && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#2E6CC4] flex items-center justify-center text-white text-xs font-bold shrink-0">{(c.name || '?').charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Button className="w-full bg-[#2E6CC4] rounded-lg mt-2" onClick={handleCreate} disabled={creating} data-testid="create-chat-submit">
          {creating ? 'Creating...' : `Create ${type === 'channel' ? 'Channel' : 'Group'}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
