import React, { useState, useEffect, useRef } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { useNotificationsStore } from '../store/notifications';
import { useWebSocket } from '../hooks/useWebSocket';
import RobotList from '../components/RobotList';
import RobotCanvas from '../components/twin/RobotCanvas';
import PlaybackDeck from '../components/PlaybackDeck';
import DataCollectionDeck from '../components/DataCollectionDeck';
import TelemetryCharts from '../components/TelemetryCharts';
import CommandUI from '../components/CommandUI';
import CameraOverlay from '../components/CameraOverlay';
import { FileText } from 'lucide-react';
import ShareModal from '../components/twin/ShareModal';
import { VITE_API_URL } from '../lib/env';

export default function TwinPage() {
  const { triggerEstop, clearEstopTrigger } = useWebSocket();
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);
  const logs = useNotificationsStore((state) => state.logs);
  const addLog = useNotificationsStore((state) => state.addLog);
  const clearLogs = useNotificationsStore((state) => state.clearLogs);

  // Live Sharing States
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [observers, setObservers] = useState<string[]>([]);
  const observersRef = useRef<string[]>([]);

  useEffect(() => {
    observersRef.current = observers;
  }, [observers]);

  const operatorSocketRef = useRef<WebSocket | null>(null);
  const pcsRef = useRef<Map<string, { pc: RTCPeerConnection; channel: RTCDataChannel; wsFallback: boolean }>>(new Map());

  const handleGenerateShare = async () => {
    try {
      const response = await fetch(`${VITE_API_URL}/api/share/start`, {
        method: 'POST',
        headers: { 'X-API-Key': 'signverse_local_dev_key' }
      });
      if (!response.ok) throw new Error('Failed to start sharing');
      const data = await response.json();
      if (data.status === 'success') {
        setShareToken(data.token);
        connectOperatorSocket(data.token);
        addLog('🟢 Live sharing session started. Observers can now connect.', 'success');
      }
    } catch (err) {
      addLog('❌ Failed to start live sharing', 'error');
    }
  };

  const connectOperatorSocket = (token: string) => {
    const defaultWsUrl = 'ws://localhost:3000';
    const envWsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') 
      : defaultWsUrl);
    const wsUrl = `${envWsUrl}/ws/observe?token=${token}&role=operator`;

    const ws = new WebSocket(wsUrl);
    operatorSocketRef.current = ws;

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, observer_id } = msg;

        if (type === 'observer_connected') {
          setObservers((prev) => [...prev, observer_id]);
          setupWebRTCPeer(observer_id, ws);
        } else if (type === 'observer_disconnected') {
          setObservers((prev) => prev.filter((id) => id !== observer_id));
          cleanupPeer(observer_id);
        } else if (type === 'answer') {
          const peer = pcsRef.current.get(observer_id);
          if (peer) {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          }
        } else if (type === 'ice_candidate') {
          const peer = pcsRef.current.get(observer_id);
          if (peer) {
            await peer.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        }
      } catch (err) {
        console.error('Error handling operator WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Operator sharing WebSocket closed');
      // Clean up all peers
      observersRef.current.forEach((id) => cleanupPeer(id));
      setObservers([]);
      setShareToken(null);
    };
  };

  const setupWebRTCPeer = async (observerId: string, ws: WebSocket) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const channel = pc.createDataChannel('telemetry', {
      ordered: false,
      maxRetransmits: 0
    });

    pcsRef.current.set(observerId, { pc, channel, wsFallback: true });

    channel.onopen = () => {
      console.log(`WebRTC DataChannel opened for observer ${observerId}`);
      const peer = pcsRef.current.get(observerId);
      if (peer) peer.wsFallback = false;
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: e.candidate,
          observer_id: observerId
        }));
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'offer',
          sdp: offer,
          observer_id: observerId
        }));
      }
    } catch (err) {
      console.error('Failed to create offer for observer:', observerId, err);
    }
  };

  const cleanupPeer = (observerId: string) => {
    const peer = pcsRef.current.get(observerId);
    if (peer) {
      peer.channel.close();
      peer.pc.close();
      pcsRef.current.delete(observerId);
    }
  };

  // Broadcast telemetry frames at 60Hz
  useEffect(() => {
    if (!shareToken) return;

    const unsubscribe = useTelemetryStore.subscribe(
      (state) => state.frame,
      (frame) => {
        if (!frame || !frame.jointAngles) return;
        
        pcsRef.current.forEach((peer, observerId) => {
          if (peer.channel.readyState === 'open') {
            peer.channel.send(JSON.stringify(frame.jointAngles));
          } else if (peer.wsFallback && operatorSocketRef.current?.readyState === WebSocket.OPEN) {
            operatorSocketRef.current.send(JSON.stringify({
              type: 'telemetry_relay',
              observer_id: observerId,
              frame: frame.jointAngles
            }));
          }
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [shareToken]);

  // Broadcast pause/freeze state changes
  useEffect(() => {
    if (!shareToken) return;

    const unsubscribe = useTelemetryStore.subscribe(
      (state) => state.isTwinFrozen,
      (isTwinFrozen) => {
        pcsRef.current.forEach((peer, observerId) => {
          const payload = { type: 'pause_state', paused: isTwinFrozen };
          if (peer.channel.readyState === 'open') {
            peer.channel.send(JSON.stringify(payload));
          } else if (peer.wsFallback && operatorSocketRef.current?.readyState === WebSocket.OPEN) {
            operatorSocketRef.current.send(JSON.stringify({
              type: 'telemetry_relay',
              observer_id: observerId,
              frame: payload
            }));
          }
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [shareToken]);

  // Clean up all resources when component unmounts
  useEffect(() => {
    return () => {
      if (operatorSocketRef.current) {
        operatorSocketRef.current.close();
      }
      pcsRef.current.forEach((peer) => {
        peer.channel.close();
        peer.pc.close();
      });
      pcsRef.current.clear();
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Col 1: Robot list, recorders, playbacks */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <RobotList />
          <PlaybackDeck />
          <DataCollectionDeck />
        </div>

        {/* Col 2: 3D Twin & Camera */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <RobotCanvas onShareClick={() => setShareModalOpen(true)} />
          <CameraOverlay />
        </div>

        {/* Col 3: NLP deck, Telemetry charts, event logs */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <CommandUI />
          <TelemetryCharts />

          {/* OS Console event stream log panel */}
          <div className="glass-panel p-4 flex flex-col gap-3 min-h-[220px]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-accent-cyan" />
                <h3 className="font-display text-[10px] font-bold tracking-wider text-text-primary">
                  SYSTEM STATUS LOGS
                </h3>
              </div>
              <button 
                onClick={clearLogs}
                className="text-[9px] text-text-muted hover:text-text-secondary font-display font-medium cursor-pointer"
              >
                CLEAR
              </button>
            </div>

            <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-3 overflow-y-auto max-h-[160px] font-mono text-[9px] flex flex-col gap-2">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-2 leading-relaxed">
                  <span className="text-text-muted flex-shrink-0">[{log.timestamp}]</span>
                  <span className={
                    log.type === 'error' ? 'text-accent-red' :
                    log.type === 'warn' ? 'text-yellow-400' :
                    log.type === 'success' ? 'text-accent-green' :
                    'text-text-secondary'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal Dialog overlay */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        token={shareToken}
        onGenerate={handleGenerateShare}
        observerCount={observers.length}
      />
    </div>
  );
}

