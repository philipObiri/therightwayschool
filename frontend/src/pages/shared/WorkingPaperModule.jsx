import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  FolderOpen, FileText, Plus, Upload, Clock, Users, Search, ArrowLeft, Trash2,
  ChevronRight, Shield, Send, Check, X, MessageSquare, History, PenSquare,
  Lock, Globe, AlertTriangle, LayoutDashboard, ListTodo, Flag, Archive,
  Eye, ChevronDown, Layers, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { successToast } from '../../lib/successToast';
import { WpDashboard } from './workpaper/WpDashboard';
import { WpTaskBoard } from './workpaper/WpTaskBoard';
import { WpDocumentPanel } from './workpaper/WpDocumentPanel';
import { WpAdvancedSearch } from './workpaper/WpAdvancedSearch';
import { WpFolderTemplates } from './workpaper/WpFolderTemplates';
import { WpTreeNode } from './workpaper/WpTreeNode';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600', under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-[#C5A55A]/15 text-[#C5A55A]', rejected: 'bg-red-100 text-red-700',
  published: 'bg-blue-100 text-blue-700', archived: 'bg-slate-200 text-slate-500'
};
const CLASS_ICONS = { public: Globe, restricted: Lock, confidential: Shield, approval_controlled: AlertTriangle };
const CLASS_COLORS = { public: 'text-[#C5A55A]', restricted: 'text-amber-600', confidential: 'text-red-600', approval_controlled: 'text-[#2E6CC4]' };

const SMART_FOLDERS = [
  { key: 'my_documents', label: 'My Documents', icon: FileText, color: 'text-[#2E6CC4]' },
  { key: 'pending_approval', label: 'Pending Approval', icon: Clock, color: 'text-amber-600' },
  { key: 'shared_with_me', label: 'Shared With Me', icon: Users, color: 'text-[#2E6CC4]' },
  { key: 'recently_edited', label: 'Recently Edited', icon: History, color: 'text-[#C5A55A]' },
  { key: 'flagged', label: 'Flagged', icon: Flag, color: 'text-red-500' },
  { key: 'archived', label: 'Archived', icon: Archive, color: 'text-slate-500' },
];

export default function WorkingPaperModule() {
  const { user } = useAuth();
  const isAdmin = ['SuperAdmin', 'Admin', 'CEO', 'Principal', 'HeadTeacher'].includes(user?.role);

  // Navigation state
  const [view, setView] = useState('dashboard');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [smartFolderType, setSmartFolderType] = useState(null);
  const [smartFolderData, setSmartFolderData] = useState(null);

  // Data state
  const [folders, setFolders] = useState([]);
  const [tree, setTree] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [smartCounts, setSmartCounts] = useState({});
  const [searchResults, setSearchResults] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [folderDialog, setFolderDialog] = useState(false);
  const [docDialog, setDocDialog] = useState(false);
  const [entryDialog, setEntryDialog] = useState(false);
  const [permDialog, setPermDialog] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Forms
  const [folderForm, setFolderForm] = useState({ name: '', description: '', classification: 'public', department: '', workflow_enabled: false, allowed_users: [] });
  const [docForm, setDocForm] = useState({ title: '', description: '', file_id: '', file_type: '', tags: '' });
  const [entryForm, setEntryForm] = useState({ title: '', content: '', entry_type: 'note' });
  const [permForm, setPermForm] = useState({ user_id: '', role: '', permissions: [] });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const activeParentId = currentFolder?.folder_id || '';

  // Loaders
  const loadDashboard = useCallback(() => api.get('/wp/dashboard/premium').then(r => setDashboardData(r.data)).catch(() => {}), []);
  const loadTree = useCallback(() => api.get('/wp/folder-tree').then(r => setTree(r.data)).catch(() => {}), []);
  const loadFolders = useCallback((parentId = '') => api.get('/wp/folders', { params: { parent_id: parentId } }).then(r => setFolders(r.data)).catch(() => {}), []);
  const loadSmartCounts = useCallback(() => api.get('/wp/smart-folder-counts').then(r => setSmartCounts(r.data)).catch(() => {}), []);

  useEffect(() => {
    loadDashboard(); loadTree(); loadFolders(); loadSmartCounts();
    // Load staff directory for permission management
    api.get('/wp/staff-directory').then(r => setStaff(r.data)).catch(() => {});

    // WebSocket: auto-refresh when permissions change
    const token = localStorage.getItem('rw_token');
    if (!token) return;
    const wsUrl = `${BACKEND.replace(/^http/, 'ws')}/api/ws/notifications?token=${token}`;
    let ws, reconnectTimer;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'new_notification' && msg.data?.type === 'wp_permission') {
              loadTree(); loadFolders(); loadSmartCounts(); loadDashboard();
            }
          } catch (err) { console.error("Error:", err); }
        };
        ws.onclose = () => { reconnectTimer = setTimeout(connect, 10000); };
      } catch (err) { console.error("Error:", err); }
    };
    connect();
    return () => { clearTimeout(reconnectTimer); if (ws) try { ws.close(); } catch (err) { console.error("Error:", err); } };
  }, []);

  // Navigation
  const openFolder = async (folderId) => {
    setLoading(true); setSelectedDoc(null); setSmartFolderType(null);
    try { const r = await api.get(`/wp/folders/${folderId}`); setCurrentFolder(r.data); setView('folder'); } catch (err) { toast.error(err.response?.data?.detail || 'Cannot open folder'); }
    setLoading(false);
  };

  const goBack = () => {
    if (selectedDoc) { setSelectedDoc(null); return; }
    if (currentFolder?.parent_id) { openFolder(currentFolder.parent_id); }
    else { setCurrentFolder(null); setView('browse'); loadFolders(); }
  };

  const goHome = () => { setCurrentFolder(null); setSelectedDoc(null); setSmartFolderType(null); setSearchResults(null); setView('dashboard'); loadDashboard(); loadSmartCounts(); };

  const openSmartFolder = async (type) => {
    setLoading(true); setCurrentFolder(null); setSelectedDoc(null);
    try { const r = await api.get(`/wp/smart-folders/${type}`); setSmartFolderData(r.data); setSmartFolderType(type); setView('smart'); } catch { toast.error('Failed to load'); }
    setLoading(false);
  };

  const openDocument = async (docId) => {
    try { const r = await api.get(`/wp/documents/${docId}`); setSelectedDoc(r.data); } catch { toast.error('Cannot open document'); }
  };

  const handleNavigate = (view, param) => {
    if (view === 'smart') openSmartFolder(param);
    else if (view === 'tasks') setView('tasks');
    else if (view === 'browse') { setView('browse'); loadFolders(); }
  };

  // Actions
  const createFolder = async (e) => {
    e.preventDefault();
    try { await api.post('/wp/folders', { ...folderForm, parent_id: activeParentId }); successToast('Folder created'); setFolderDialog(false); setFolderForm({ name: '', description: '', classification: 'public', department: '', workflow_enabled: false, allowed_users: [] }); if (activeParentId) openFolder(activeParentId); else loadFolders(); loadTree(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true);
    try { const fd = new FormData(); fd.append('file', file); const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setDocForm(prev => ({ ...prev, file_id: res.data.file_id, file_type: file.name.split('.').pop(), title: prev.title || file.name })); successToast('File uploaded'); } catch { toast.error('Upload failed'); }
    setUploading(false); e.target.value = '';
  };

  const uploadDocument = async (e) => {
    e.preventDefault();
    if (!docForm.file_id) { toast.error('Upload a file first'); return; }
    try { await api.post('/wp/documents', { ...docForm, folder_id: activeParentId, tags: docForm.tags.split(',').map(t => t.trim()).filter(Boolean) }); successToast('Document uploaded'); setDocDialog(false); setDocForm({ title: '', description: '', file_id: '', file_type: '', tags: '' }); if (activeParentId) openFolder(activeParentId); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const createEntry = async (e) => {
    e.preventDefault();
    try { await api.post('/wp/entries', { ...entryForm, folder_id: activeParentId }); successToast('Entry created'); setEntryDialog(false); setEntryForm({ title: '', content: '', entry_type: 'note' }); if (activeParentId) openFolder(activeParentId); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const deleteDoc = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try { await api.delete(`/wp/documents/${docId}`); successToast('Deleted'); if (currentFolder) openFolder(currentFolder.folder_id); } catch { toast.error('Failed'); }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder and all contents?')) return;
    try { await api.delete(`/wp/folders/${folderId}`); successToast('Deleted'); goBack(); loadTree(); } catch { toast.error('Failed'); }
  };

  const addPermission = async () => {
    try { await api.post(`/wp/folders/${currentFolder.folder_id}/permissions`, permForm); successToast('Permission set'); setPermDialog(false); setPermForm({ user_id: '', role: '', permissions: [] }); openFolder(currentFolder.folder_id); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const changeStatus = async (docId, status) => {
    try { await api.put(`/wp/documents/${docId}/status`, { status }); successToast(`Status: ${status}`); if (currentFolder) openFolder(currentFolder.folder_id); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAdvancedSearch = async (params) => {
    try { const r = await api.get('/wp/search/advanced', { params }); setSearchResults(r.data); setView('search'); } catch { toast.error('Search failed'); }
  };

  // ─── RENDER ───
  const renderSidebar = () => (
    <div className="w-64 shrink-0 space-y-3 hidden lg:block" data-testid="wp-sidebar">
      <Button variant={view === 'dashboard' ? 'secondary' : 'ghost'} size="default" className="w-full justify-start text-base rounded-lg h-11" onClick={goHome}>
        <LayoutDashboard className="w-5 h-5 mr-3" /> Dashboard
      </Button>
      <Button variant={view === 'browse' ? 'secondary' : 'ghost'} size="default" className="w-full justify-start text-base rounded-lg h-11" onClick={() => { setView('browse'); loadFolders(); setCurrentFolder(null); setSelectedDoc(null); }}>
        <FolderOpen className="w-5 h-5 mr-3" /> All Folders
      </Button>
      <Button variant={view === 'tasks' ? 'secondary' : 'ghost'} size="default" className="w-full justify-start text-base rounded-lg h-11" onClick={() => setView('tasks')}>
        <ListTodo className="w-5 h-5 mr-3" /> Task Board
      </Button>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Smart Folders</p>
        {SMART_FOLDERS.map(sf => (
          <Button key={sf.key} variant={smartFolderType === sf.key ? 'secondary' : 'ghost'} size="default" className="w-full justify-start text-base rounded-lg h-11" onClick={() => openSmartFolder(sf.key)} data-testid={`sf-${sf.key}`}>
            <sf.icon className={`w-5 h-5 mr-3 ${sf.color}`} />
            <span className="flex-1 text-left">{sf.label}</span>
            {smartCounts[sf.key] != null && <Badge variant="secondary" className="text-xs h-5 px-2">{smartCounts[sf.key]}</Badge>}
          </Button>
        ))}
      </div>

      {tree.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Folder Tree</p>
          <div className="max-h-[300px] overflow-y-auto space-y-0.5">
            <WpTreeNode tree={tree} onOpen={openFolder} activeId={currentFolder?.folder_id} />
          </div>
        </div>
      )}
    </div>
  );

  const renderMainContent = () => {
    // Document detail view
    if (selectedDoc) {
      return (
        <div>
          <Button variant="ghost" size="sm" className="mb-3 rounded-lg" onClick={() => setSelectedDoc(null)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <WpDocumentPanel doc={selectedDoc} isAdmin={isAdmin} isFolderOwner={currentFolder?.owner_id === user?.user_id} staff={staff} onBack={() => setSelectedDoc(null)}
            onRefresh={async () => { const r = await api.get(`/wp/documents/${selectedDoc.document_id}`); setSelectedDoc(r.data); if (currentFolder) openFolder(currentFolder.folder_id); }} />
        </div>
      );
    }

    // Dashboard
    if (view === 'dashboard') {
      return <WpDashboard data={dashboardData} onNavigate={handleNavigate} onOpenDoc={openDocument} />;
    }

    // Task Board
    if (view === 'tasks') {
      return <WpTaskBoard staff={staff} />;
    }

    // Smart Folder View
    if (view === 'smart' && smartFolderData) {
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div><h2 className="text-2xl font-bold text-[#1B2A4A]">{smartFolderData.name}</h2><p className="text-base text-slate-500">{smartFolderData.count} documents</p></div>
          </div>
          <div className="space-y-2">{renderDocList(smartFolderData.documents || [])}</div>
        </div>
      );
    }

    // Search Results
    if (view === 'search' && searchResults) {
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-[#1B2A4A]">Search Results</h2><Button variant="ghost" size="default" onClick={() => { setSearchResults(null); setView('dashboard'); }}><X className="w-5 h-5" /></Button></div>
          {searchResults.folders?.length > 0 && (
            <div><p className="text-sm font-semibold text-slate-500 uppercase mb-3">Folders ({searchResults.total_folders})</p>
              <div className="grid grid-cols-3 gap-3">{searchResults.folders.map(f => (
                <div key={f.folder_id} className="flex items-center gap-3 bg-white rounded-lg border p-4 cursor-pointer hover:border-[#1B2A4A]" onClick={() => openFolder(f.folder_id)}>
                  <FolderOpen className="w-6 h-6 text-amber-500" /><span className="text-base font-medium">{f.name}</span>
                </div>
              ))}</div>
            </div>
          )}
          {searchResults.documents?.length > 0 && (
            <div><p className="text-sm font-semibold text-slate-500 uppercase mb-3">Documents ({searchResults.total_docs})</p>
              <div className="space-y-2">{renderDocList(searchResults.documents)}</div>
            </div>
          )}
          {!searchResults.folders?.length && !searchResults.documents?.length && <p className="text-center text-slate-400 text-lg py-10">No results found</p>}
        </div>
      );
    }

    // Folder Content
    if (view === 'folder' && currentFolder) {
      if (loading) return <AppLoader />;
      const ClassIcon = CLASS_ICONS[currentFolder.classification] || Globe;
      const isOwner = currentFolder.owner_id === user?.user_id;
      return (
        <div className="space-y-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button onClick={goHome} className="text-[#2E6CC4] hover:underline">Home</button>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <button onClick={() => { setView('browse'); loadFolders(); setCurrentFolder(null); }} className="text-[#2E6CC4] hover:underline">Folders</button>
            {currentFolder.path?.map(p => <React.Fragment key={p.folder_id}><ChevronRight className="w-4 h-4 text-slate-400" /><button onClick={() => openFolder(p.folder_id)} className="text-[#2E6CC4] hover:underline">{p.name}</button></React.Fragment>)}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="default" onClick={goBack}><ArrowLeft className="w-5 h-5" /></Button>
              <div><div className="flex items-center gap-3"><h2 className="text-2xl font-bold text-[#1B2A4A]">{currentFolder.name}</h2><ClassIcon className={`w-5 h-5 ${CLASS_COLORS[currentFolder.classification]}`} /></div>
                {currentFolder.description && <p className="text-base text-slate-500">{currentFolder.description}</p>}</div>
            </div>
            <div className="flex gap-2">
              <Button size="default" variant="outline" className="rounded-lg text-base" onClick={() => setFolderDialog(true)}><FolderOpen className="w-4 h-4 mr-2" /> Subfolder</Button>
              <Button size="default" variant="outline" className="rounded-lg text-base" onClick={() => setDocDialog(true)}><Upload className="w-4 h-4 mr-2" /> Upload</Button>
              <Button size="default" variant="outline" className="rounded-lg text-base" onClick={() => setEntryDialog(true)}><PenSquare className="w-4 h-4 mr-2" /> Entry</Button>
              {(isAdmin || isOwner) && <Button size="default" variant="outline" className="rounded-lg text-base" onClick={() => setPermDialog(true)}><Shield className="w-4 h-4 mr-2" /> Permissions</Button>}
              {(isAdmin || isOwner) && <Button size="default" variant="ghost" className="text-red-500" onClick={() => deleteFolder(currentFolder.folder_id)}><Trash2 className="w-5 h-5" /></Button>}
            </div>
          </div>

          {/* Subfolders */}
          {currentFolder.subfolders?.length > 0 && (
            <div><p className="text-sm font-semibold text-slate-500 uppercase mb-3">Folders ({currentFolder.subfolders.length})</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{currentFolder.subfolders.map(f => {
                const Icon = CLASS_ICONS[f.classification] || Globe;
                return (
                  <div key={f.folder_id} className="flex items-center gap-3 bg-white rounded-lg border p-4 cursor-pointer hover:border-[#1B2A4A] transition-colors" onClick={() => openFolder(f.folder_id)} data-testid={`subfolder-${f.folder_id}`}>
                    <FolderOpen className="w-6 h-6 text-amber-500" /><div className="flex-1 min-w-0"><p className="text-base font-semibold truncate">{f.name}</p></div><Icon className={`w-4 h-4 ${CLASS_COLORS[f.classification]}`} />
                  </div>
                );
              })}</div>
            </div>
          )}

          {/* Documents */}
          {currentFolder.documents?.length > 0 && (
            <div><p className="text-sm font-semibold text-slate-500 uppercase mb-3">Documents ({currentFolder.documents.length})</p>
              {renderDocList(currentFolder.documents)}
            </div>
          )}

          {/* Entries */}
          {currentFolder.entries?.length > 0 && (
            <div><p className="text-sm font-semibold text-slate-500 uppercase mb-3">Entries ({currentFolder.entries.length})</p>
              <div className="space-y-2">{currentFolder.entries.map(e => (
                <div key={e.entry_id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><Badge variant="secondary" className="text-xs">{e.entry_type}</Badge><h4 className="text-base font-semibold">{e.title}</h4></div><span className="text-sm text-slate-400">{e.author_name}</span></div>
                  <p className="text-base text-slate-600 line-clamp-2">{e.content}</p>
                </div>
              ))}</div>
            </div>
          )}

          {/* Permissions */}
          {currentFolder.permissions?.length > 0 && (isAdmin || isOwner) && (
            <Card className="rounded-lg"><CardContent className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Access Control ({currentFolder.permissions.length})</h3>
              <div className="space-y-2">{currentFolder.permissions.map(p => (
                <div key={p.perm_id} className="flex items-center justify-between text-sm py-3 border-b border-slate-50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white text-xs font-bold">{(p.user_name || p.role || '?').charAt(0)}</div>
                    <span className="font-medium">{p.user_name || p.role || p.user_id}</span>{p.inherited && <Badge variant="secondary" className="text-xs">inherited</Badge>}</div>
                  <div className="flex gap-1.5 flex-wrap justify-end">{p.permissions?.map(pm => <Badge key={pm} variant="secondary" className="text-xs">{pm}</Badge>)}</div>
                </div>
              ))}</div>
            </CardContent></Card>
          )}

          {currentFolder.subfolders?.length === 0 && currentFolder.documents?.length === 0 && currentFolder.entries?.length === 0 && (
            <p className="text-lg text-slate-400 text-center py-16">This folder is empty. Upload documents, create entries, or add subfolders.</p>
          )}
        </div>
      );
    }

    // Browse View (root folders)
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold text-[#1B2A4A]">All Folders</h2><p className="text-base text-slate-500">{folders.length} root folders</p></div>
          <div className="flex gap-3">
            <Button variant="outline" size="default" className="rounded-lg text-base" onClick={() => setTemplateDialog(true)} data-testid="template-btn"><Layers className="w-4 h-4 mr-2" /> From Template</Button>
            <Button size="default" className="rounded-lg text-base bg-[#1B2A4A]" onClick={() => setFolderDialog(true)} data-testid="new-folder-btn"><Plus className="w-4 h-4 mr-2" /> New Folder</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map(f => {
            const Icon = CLASS_ICONS[f.classification] || Globe;
            return (
              <Card key={f.folder_id} className="rounded-lg hover:shadow-md cursor-pointer transition-all hover:border-[#1B2A4A]/30" onClick={() => openFolder(f.folder_id)} data-testid={`folder-${f.folder_id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3"><FolderOpen className="w-8 h-8 text-amber-500" /><Icon className={`w-5 h-5 ${CLASS_COLORS[f.classification]}`} /></div>
                  <h3 className="text-base font-semibold text-[#1B2A4A] mb-1">{f.name}</h3>
                  <p className="text-sm text-slate-400">{f.department} | {f.subfolder_count || 0} folders | {f.document_count || 0} docs</p>
                </CardContent>
              </Card>
            );
          })}
          {folders.length === 0 && <p className="col-span-full text-lg text-slate-400 text-center py-16">No folders yet. Create one to get started.</p>}
        </div>
      </div>
    );
  };

  const renderDocList = (docs) => (
    <div className="space-y-2">
      {docs.map(d => (
        <div key={d.document_id} className="flex items-center justify-between bg-white rounded-lg border p-4 hover:border-[#1B2A4A]/30 transition-colors" data-testid={`doc-${d.document_id}`}>
          <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => openDocument(d.document_id)}>
            <FileText className="w-6 h-6 text-[#2E6CC4] shrink-0" />
            <div className="min-w-0">
              <p className="text-base font-medium truncate">{d.title}</p>
              <p className="text-sm text-slate-400">v{d.version} | {d.author_name} | {d.file_type?.toUpperCase()} | {new Date(d.updated_at || d.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {d.flagged && <Flag className="w-4 h-4 text-red-500" />}
            {d.locked && <Lock className="w-4 h-4 text-amber-500" />}
            <Badge className={`text-sm ${STATUS_COLORS[d.status]}`}>{d.status?.replace('_', ' ')}</Badge>
            <Button variant="ghost" size="default" className="h-9 text-base" onClick={() => openDocument(d.document_id)}><Eye className="w-4 h-4" /></Button>
            {(isAdmin || d.author_id === user?.user_id || currentFolder?.owner_id === user?.user_id) && <Button variant="ghost" size="default" className="h-9 text-red-400" onClick={() => deleteDoc(d.document_id)}><Trash2 className="w-4 h-4" /></Button>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div data-testid="working-paper-module">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-4xl font-bold text-[#1B2A4A]">Working Paper</h1><p className="text-lg text-slate-500 mt-1">Institutional document governance & collaboration platform</p></div>
        <div className="flex gap-3">
          <Button variant="outline" size="default" className="rounded-lg text-base" onClick={() => setShowSearch(!showSearch)} data-testid="toggle-search-btn"><Filter className="w-5 h-5 mr-2" /> {showSearch ? 'Hide' : 'Search'}</Button>
          {isAdmin && <Button variant="outline" size="default" className="rounded-lg text-base" onClick={() => api.post('/wp/seed-defaults').then(r => { successToast(r.data.message); loadFolders(); loadTree(); }).catch(() => {})} data-testid="seed-defaults-btn"><Layers className="w-5 h-5 mr-2" /> Seed Defaults</Button>}
        </div>
      </div>

      {/* Advanced Search */}
      {showSearch && <div className="mb-4"><WpAdvancedSearch staff={staff} onSearch={handleAdvancedSearch} onClose={() => setShowSearch(false)} /></div>}

      {/* Main Layout */}
      <div className="flex gap-4">
        {renderSidebar()}
        <div className="flex-1 min-w-0">{renderMainContent()}</div>
      </div>

      {/* ─── DIALOGS ─── */}

      {/* Create Folder */}
      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{currentFolder ? `Create Subfolder in "${currentFolder.name}"` : 'Create Folder'}</DialogTitle></DialogHeader>
          <form onSubmit={createFolder} className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={folderForm.name} onChange={e => setFolderForm({ ...folderForm, name: e.target.value })} required className="h-9" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={folderForm.description} onChange={e => setFolderForm({ ...folderForm, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Classification</Label><Select value={folderForm.classification} onValueChange={v => setFolderForm({ ...folderForm, classification: v })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="restricted">Restricted</SelectItem><SelectItem value="confidential">Confidential</SelectItem><SelectItem value="approval_controlled">Approval Controlled</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Department</Label><Input value={folderForm.department} onChange={e => setFolderForm({ ...folderForm, department: e.target.value })} className="h-9" /></div>
            </div>
            {folderForm.classification !== 'public' && (
              <div className="bg-slate-50 rounded-lg p-3 border space-y-2">
                <Label className="text-xs font-semibold">Access Control</Label>
                <div className="max-h-[150px] overflow-y-auto space-y-1">{staff.map(s => {
                  const checked = folderForm.allowed_users.includes(s.user_id);
                  return (
                    <label key={s.user_id} className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer ${checked ? 'border-[#1B2A4A] bg-blue-50' : 'border-slate-200'}`}>
                      <input type="checkbox" checked={checked} onChange={e => { const u = e.target.checked ? [...folderForm.allowed_users, s.user_id] : folderForm.allowed_users.filter(id => id !== s.user_id); setFolderForm({ ...folderForm, allowed_users: u }); }} className="rounded" />
                      <span className="font-medium">{s.name}</span><span className="text-slate-400">{s.role}</span>
                    </label>
                  );
                })}</div>
              </div>
            )}
            <Button type="submit" className="w-full bg-[#1B2A4A] rounded-lg">Create Folder</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Document */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <form onSubmit={uploadDocument} className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={docForm.title} onChange={e => setDocForm({ ...docForm, title: e.target.value })} required className="h-9" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={docForm.description} onChange={e => setDocForm({ ...docForm, description: e.target.value })} rows={2} /></div>
            <div><Label className="text-xs">Tags (comma separated)</Label><Input value={docForm.tags} onChange={e => setDocForm({ ...docForm, tags: e.target.value })} className="h-9" placeholder="policy, report" /></div>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
            <Button type="button" variant="outline" className="w-full rounded-lg border-dashed border-2" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : docForm.file_id ? 'File ready' : 'Choose file'}</Button>
            <Button type="submit" className="w-full bg-[#1B2A4A] rounded-lg">Save Document</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Entry */}
      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent><DialogHeader><DialogTitle>Create Entry</DialogTitle></DialogHeader>
          <form onSubmit={createEntry} className="space-y-3">
            <div><Label className="text-xs">Type</Label><Select value={entryForm.entry_type} onValueChange={v => setEntryForm({ ...entryForm, entry_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="note">Note</SelectItem><SelectItem value="meeting_minutes">Meeting Minutes</SelectItem><SelectItem value="report">Report</SelectItem><SelectItem value="log">Log</SelectItem><SelectItem value="compliance">Compliance</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Title</Label><Input value={entryForm.title} onChange={e => setEntryForm({ ...entryForm, title: e.target.value })} required className="h-9" /></div>
            <div><Label className="text-xs">Content</Label><Textarea value={entryForm.content} onChange={e => setEntryForm({ ...entryForm, content: e.target.value })} rows={6} /></div>
            <Button type="submit" className="w-full bg-[#1B2A4A] rounded-lg">Create Entry</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions */}
      <Dialog open={permDialog} onOpenChange={setPermDialog}>
        <DialogContent><DialogHeader><DialogTitle>Set Permissions</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">User</Label><Select value={permForm.user_id} onValueChange={v => setPermForm({ ...permForm, user_id: v, role: '' })}><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger><SelectContent>{staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name} ({s.role})</SelectItem>)}</SelectContent></Select></div>
            <p className="text-[10px] text-slate-400 text-center">— or by role —</p>
            <div><Label className="text-xs">Role</Label><Select value={permForm.role} onValueChange={v => setPermForm({ ...permForm, role: v, user_id: '' })}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{['Teacher', 'Admin', 'HeadTeacher', 'FinanceOfficer', 'HR_Officer'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Permissions</Label>
              <div className="grid grid-cols-3 gap-1">{['view', 'access', 'upload', 'edit', 'comment', 'approve', 'download', 'delete', 'create_subfolder', 'manage_permissions'].map(p => (
                <label key={p} className={`flex items-center gap-1 p-1.5 rounded-lg border text-[10px] cursor-pointer ${permForm.permissions.includes(p) ? 'border-[#1B2A4A] bg-blue-50' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={permForm.permissions.includes(p)} onChange={e => { const perms = e.target.checked ? [...permForm.permissions, p] : permForm.permissions.filter(x => x !== p); setPermForm({ ...permForm, permissions: perms }); }} className="rounded" />{p}
                </label>
              ))}</div>
            </div>
            <Button className="w-full bg-[#1B2A4A] rounded-lg" onClick={addPermission}>Set Permission</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder Templates */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Create from Template</DialogTitle></DialogHeader>
          <WpFolderTemplates parentId={activeParentId} onCreated={(folderId) => { openFolder(folderId); loadTree(); }} onClose={() => setTemplateDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
