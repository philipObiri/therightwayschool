import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import { Textarea } from '../../../components/ui/textarea';
import { toast } from 'sonner';
import { successToast } from '../../../lib/successToast';
import api from '../../../lib/api';
import {
  Users, Save, Wifi, WifiOff, Circle, Loader2, History, ChevronDown, ChevronUp
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_API_URL;

function getWsUrl() {
  return BACKEND.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

export function CollabEditor({ doc, onRefresh }) {
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState(doc?.content || '');
  const [version, setVersion] = useState(doc?.version || 1);
  const [editors, setEditors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const wsRef = useRef(null);
  const contentRef = useRef(content);
  const reconnectRef = useRef(null);

  contentRef.current = content;

  const connectWs = useCallback(() => {
    if (!doc?.document_id) return;
    const token = localStorage.getItem('rw_token');
    if (!token) return;

    const wsUrl = `${getWsUrl()}/api/wp/collab/ws/${doc.document_id}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'init') {
            setContent(data.content || '');
            setVersion(data.version || 1);
          } else if (data.type === 'presence') {
            setEditors(data.users || []);
          } else if (data.type === 'content_update') {
            setContent(data.content || '');
            setVersion(data.version || version);
          } else if (data.type === 'saved') {
            setVersion(data.version);
            setLastSaved(new Date().toLocaleTimeString());
            successToast(`Saved by ${data.saved_by} (v${data.version})`);
          } else if (data.type === 'cursor_update') {
            setEditors(prev => prev.map(e =>
              e.user_id === data.user_id ? { ...e, cursor: data.cursor } : e
            ));
          }
        } catch (err) { console.error("Error:", err); }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        reconnectRef.current = setTimeout(() => connectWs(), 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) { console.error("Error:", err); }
  }, [doc?.document_id]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, [connectWs]);

  // Keep-alive ping
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleContentChange = (newContent) => {
    setContent(newContent);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'content_update', content: newContent }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/wp/collab/save/${doc.document_id}`, { content: contentRef.current });
      setVersion(res.data.version);
      setLastSaved(new Date().toLocaleTimeString());
      successToast(`Document saved (v${res.data.version})`);
      onRefresh?.();
    } catch (e) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const loadVersions = async () => {
    try {
      const res = await api.get(`/wp/collab/versions/${doc.document_id}`);
      setVersions(res.data);
      setShowVersions(!showVersions);
    } catch (err) { console.error("Error:", err); }
  };

  const restoreVersion = (versionContent) => {
    setContent(versionContent);
    handleContentChange(versionContent);
    setShowVersions(false);
    toast.success('Version restored — save to persist');
  };

  return (
    <div className="space-y-4" data-testid="collab-editor">
      {/* Toolbar */}
      <Card className="rounded-lg border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                {connected ? (
                  <Badge className="bg-[#C5A55A]/15 text-[#C5A55A] text-sm gap-1.5" data-testid="collab-connected">
                    <Wifi className="w-4 h-4" /> Live
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 text-sm gap-1.5" data-testid="collab-disconnected">
                    <WifiOff className="w-4 h-4" /> Reconnecting...
                  </Badge>
                )}
              </div>

              {/* Active editors */}
              <div className="flex items-center gap-2" data-testid="active-editors">
                <Users className="w-5 h-5 text-slate-400" />
                <div className="flex -space-x-2">
                  {editors.map(e => (
                    <div key={e.user_id} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white"
                      style={{ backgroundColor: e.color }} title={`${e.name} (${e.role})`}>
                      {e.name?.charAt(0)}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-slate-500">
                  {editors.length} editor{editors.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Version indicator */}
              <Badge variant="outline" className="text-sm text-slate-500 border-slate-200">
                v{version}
              </Badge>

              {lastSaved && (
                <span className="text-sm text-slate-400">
                  Saved at {lastSaved}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="default" className="text-base h-11" onClick={loadVersions} data-testid="version-history-btn">
                <History className="w-5 h-5 mr-2" /> History
                {showVersions ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>
              <Button className="bg-[#C5A55A] hover:bg-[#b8963e] text-base h-11 px-6" onClick={handleSave} disabled={saving} data-testid="collab-save-btn">
                {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                Save Document
              </Button>
            </div>
          </div>

          {/* Editor list below toolbar */}
          {editors.length > 0 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
              {editors.map(e => (
                <div key={e.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: e.color + '15', border: `1px solid ${e.color}40` }}>
                  <Circle className="w-2.5 h-2.5 fill-current" style={{ color: e.color }} />
                  <span className="text-sm font-medium" style={{ color: e.color }}>{e.name}</span>
                  <span className="text-xs text-slate-400">{e.role}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History Panel */}
      {showVersions && (
        <Card className="rounded-lg border-amber-200 bg-amber-50/30 animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 max-h-[300px] overflow-y-auto">
            <h3 className="text-base font-semibold text-[#1B2A4A] mb-3">Version History</h3>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-400">No version history yet</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.version_id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200">
                    <div>
                      <span className="text-sm font-semibold text-[#1B2A4A]">Version {v.version}</span>
                      <span className="text-sm text-slate-400 ml-3">{v.edited_by_name} - {new Date(v.saved_at).toLocaleString()}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => restoreVersion(v.content)} data-testid={`restore-v${v.version}`}>
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Editor Area */}
      <Card className="rounded-lg border-slate-200">
        <CardContent className="p-0">
          <Textarea
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            className="min-h-[500px] border-0 focus-visible:ring-0 text-base leading-relaxed p-6 resize-y font-mono"
            placeholder="Start writing or paste content here... All changes sync in real-time with other editors."
            data-testid="collab-editor-textarea"
          />
        </CardContent>
      </Card>
    </div>
  );
}
