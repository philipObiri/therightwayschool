import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import {
  Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Monitor,
  Users, Settings, Maximize, Minimize, MessageSquare, Copy
} from 'lucide-react';
import { AppLoader } from '../../components/AppLoader';

const BACKEND = import.meta.env.VITE_API_URL;
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function VideoMeeting() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [joined, setJoined] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [peers, setPeers] = useState({});
  const [peerMediaState, setPeerMediaState] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const containerRef = useRef(null);

  useEffect(() => {
    api.get(`/meetings/${meetingId}`).then(r => { setMeeting(r.data); setLoading(false); }).catch(() => { toast.error('Meeting not found'); setLoading(false); });
  }, [meetingId]);

  const createPeerConnection = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current[peerId] = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'ice_candidate', to: peerId, candidate: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      setPeers(prev => ({ ...prev, [peerId]: e.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeers(prev => { const n = { ...prev }; delete n[peerId]; return n; });
        delete peerConnectionsRef.current[peerId];
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }
    return pc;
  }, []);

  const joinMeeting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const token = localStorage.getItem('rw_token');
      const wsUrl = BACKEND.replace(/^http/, 'ws') + `/api/meetings/ws/${meetingId}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = async (ev) => {
        const data = JSON.parse(ev.data);

        if (data.type === 'room_peers') {
          for (const peerId of data.peers) {
            const pc = createPeerConnection(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', to: peerId, sdp: offer.sdp }));
          }
        } else if (data.type === 'peer_joined') {
          createPeerConnection(data.peer_id);
        } else if (data.type === 'peer_left') {
          if (peerConnectionsRef.current[data.peer_id]) {
            peerConnectionsRef.current[data.peer_id].close();
            delete peerConnectionsRef.current[data.peer_id];
          }
          setPeers(prev => { const n = { ...prev }; delete n[data.peer_id]; return n; });
          setPeerMediaState(prev => { const n = { ...prev }; delete n[data.peer_id]; return n; });
        } else if (data.type === 'offer') {
          let pc = peerConnectionsRef.current[data.from] || createPeerConnection(data.from);
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', to: data.from, sdp: answer.sdp }));
        } else if (data.type === 'answer') {
          const pc = peerConnectionsRef.current[data.from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        } else if (data.type === 'ice_candidate') {
          const pc = peerConnectionsRef.current[data.from];
          if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else if (data.type === 'media_toggle') {
          setPeerMediaState(prev => ({
            ...prev,
            [data.from]: { ...prev[data.from], [data.media]: data.enabled }
          }));
        }
      };

      ws.onclose = () => { /* cleanup handled in leave */ };
      setJoined(true);
    } catch (err) {
      toast.error('Camera/microphone access denied');
    }
  };

  const leaveMeeting = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    wsRef.current?.close();
    setPeers({});
    setJoined(false);
    navigate(-1);
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
      wsRef.current?.send(JSON.stringify({ type: 'toggle_media', media: 'video', enabled: track.enabled }));
    }
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
      wsRef.current?.send(JSON.stringify({ type: 'toggle_media', media: 'audio', enabled: track.enabled }));
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
      }
      setScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => {
          const videoTrack = localStreamRef.current?.getVideoTracks()[0];
          if (videoTrack) {
            Object.values(peerConnectionsRef.current).forEach(pc => {
              const sender = pc.getSenders().find(s => s.track?.kind === 'video');
              if (sender) sender.replaceTrack(videoTrack);
            });
          }
          setScreenSharing(false);
        };
        setScreenSharing(true);
      } catch { toast.error('Screen share cancelled'); }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${meetingId}`);
    toast.success('Meeting link copied');
  };

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      wsRef.current?.close();
    };
  }, []);

  if (loading) return <AppLoader fullPage />;

  const peerCount = Object.keys(peers).length;
  const gridCols = peerCount <= 1 ? 'grid-cols-1' : peerCount <= 3 ? 'grid-cols-2' : 'grid-cols-3';

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center" data-testid="meeting-lobby">
        <div className="bg-[#1B2A4A] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-[#2E6CC4] rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">{meeting?.title || 'Video Meeting'}</h1>
          <p className="text-sm text-slate-400 mb-2">Created by {meeting?.created_by_name}</p>
          {meeting?.active_participants?.length > 0 && (
            <p className="text-xs text-[#2E6CC4] mb-4">
              <Users className="w-3 h-3 inline mr-1" />{meeting.active_participants.length} participant(s) in call
            </p>
          )}
          <div className="flex justify-center gap-3 mb-6">
            <button onClick={() => setVideoEnabled(!videoEnabled)} className={`w-12 h-12 rounded-full flex items-center justify-center ${videoEnabled ? 'bg-[#2E6CC4]' : 'bg-red-500'} text-white`} data-testid="lobby-video-toggle">
              {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button onClick={() => setAudioEnabled(!audioEnabled)} className={`w-12 h-12 rounded-full flex items-center justify-center ${audioEnabled ? 'bg-[#2E6CC4]' : 'bg-red-500'} text-white`} data-testid="lobby-audio-toggle">
              {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          </div>
          <Button onClick={joinMeeting} className="w-full bg-[#2E6CC4] rounded-xl h-12 text-base font-semibold" data-testid="join-meeting-btn">
            <Phone className="w-5 h-5 mr-2" /> Join Meeting
          </Button>
          <button onClick={copyMeetingLink} className="mt-3 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto" data-testid="copy-link-btn">
            <Copy className="w-3 h-3" /> Copy meeting link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-screen bg-[#0F1419] flex flex-col" data-testid="meeting-room">
      {/* Header */}
      <div className="h-12 bg-[#1B2A4A] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500 text-white text-[10px] animate-pulse">LIVE</Badge>
          <span className="text-sm font-medium text-white">{meeting?.title || 'Meeting'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#2E6CC4]/20 text-[#2E6CC4] text-xs"><Users className="w-3 h-3 mr-1 inline" />{peerCount + 1}</Badge>
          <button onClick={copyMeetingLink} className="p-1.5 rounded hover:bg-white/10"><Copy className="w-4 h-4 text-slate-400" /></button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/10">
            {isFullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className={`flex-1 p-3 grid ${gridCols} gap-3 auto-rows-fr`}>
        {/* Local video */}
        <div className="relative bg-[#1B2A4A] rounded-xl overflow-hidden" data-testid="local-video-container">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1B2A4A]">
              <div className="w-16 h-16 rounded-full bg-[#2E6CC4] flex items-center justify-center text-white text-2xl font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">You</span>
            {!audioEnabled && <MicOff className="w-3.5 h-3.5 text-red-400" />}
          </div>
          {screenSharing && <Badge className="absolute top-2 right-2 bg-[#C5A55A]/100 text-white text-[9px]">Sharing Screen</Badge>}
        </div>

        {/* Remote peers */}
        {Object.entries(peers).map(([peerId, stream]) => (
          <PeerVideo key={peerId} peerId={peerId} stream={stream} mediaState={peerMediaState[peerId]} />
        ))}
      </div>

      {/* Controls */}
      <div className="h-16 bg-[#1B2A4A] flex items-center justify-center gap-3 px-4 shrink-0" data-testid="meeting-controls">
        <ControlBtn icon={audioEnabled ? Mic : MicOff} active={audioEnabled} onClick={toggleAudio} testId="toggle-audio" label={audioEnabled ? 'Mute' : 'Unmute'} />
        <ControlBtn icon={videoEnabled ? Video : VideoOff} active={videoEnabled} onClick={toggleVideo} testId="toggle-video" label={videoEnabled ? 'Stop Video' : 'Start Video'} />
        <ControlBtn icon={Monitor} active={screenSharing} onClick={toggleScreenShare} testId="toggle-screen" label="Share Screen" activeColor="bg-[#C5A55A]/100" />
        <button onClick={leaveMeeting} className="w-14 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors" data-testid="leave-meeting-btn">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function PeerVideo({ peerId, stream, mediaState }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  const videoOff = mediaState?.video === false;
  const audioOff = mediaState?.audio === false;
  return (
    <div className="relative bg-[#1B2A4A] rounded-xl overflow-hidden" data-testid={`peer-video-${peerId}`}>
      <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${videoOff ? 'hidden' : ''}`} />
      {videoOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1B2A4A]">
          <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-white text-2xl font-bold">
            {peerId.charAt(peerId.length - 1).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">{peerId.slice(0, 8)}</span>
        {audioOff && <MicOff className="w-3.5 h-3.5 text-red-400" />}
      </div>
    </div>
  );
}

function ControlBtn({ icon: Icon, active, onClick, testId, label, activeColor = 'bg-[#2E6CC4]' }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${active ? `${activeColor} text-white` : 'bg-slate-600 text-white hover:bg-slate-500'}`}
      title={label}
      data-testid={testId}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
