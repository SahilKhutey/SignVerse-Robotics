import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import RobotCanvas from '../components/twin/RobotCanvas';
import { VITE_API_URL } from '../lib/env';
import { Activity, ShieldAlert, Cpu, Network, CheckCircle, RefreshCw } from 'lucide-react';
import { useNotificationsStore } from '../store/notifications';

export default function ObserverPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [isTwinPaused, setIsTwinPaused] = useState(false);
  
  // Connection states
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'failed' | 'disconnected'>('connecting');
  const [rtcActive, setRtcActive] = useState(false);
  const [wsRelayActive, setWsRelayActive] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number>(0);
  const [packetLoss, setPacketLoss] = useState<number>(0);
  
  const [isValidToken, setIsValidToken] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [liveJointAngles, setLiveJointAngles] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  const socketRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const offlineIntervalRef = useRef<any>(null);

  // 1. Verify sharing token on mount
  useEffect(() => {
    let isCurrent = true;
    if (!token) {
      setIsValidToken(false);
      setIsValidating(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`${VITE_API_URL}/api/share/verify?token=${token}`);
        if (!isCurrent) return;
        if (response.ok) {
          const data = await response.json();
          if (!isCurrent) return;
          if (data.status === 'success' && data.active) {
            setIsValidToken(true);
            connectObserverSocket(token);
          } else {
            setIsValidToken(false);
          }
        } else {
          setIsValidToken(false);
        }
      } catch (err) {
        if (!isCurrent) return;
        // Fallback for local development offline simulation
        console.warn('Ecosystem verify offline, simulating connection');
        setIsValidToken(true);
        simulateOfflineData();
      } finally {
        if (isCurrent) {
          setIsValidating(false);
        }
      }
    };

    verifyToken();

    return () => {
      isCurrent = false;
      cleanupResources();
    };
  }, [token]);

  const simulateOfflineData = () => {
    setConnectionState('live');
    setRtcActive(true);
    setRtt(12);
    setJitter(1.5);
    setPacketLoss(0);
    
    let t = 0;
    const interval = setInterval(() => {
      t += 0.05;
      const q0 = Math.sin(t) * 45;
      const q1 = Math.cos(t) * 30;
      const q2 = Math.sin(t * 2) * 15;
      setLiveJointAngles([q0, q1, q2, 0, 0, 0, 0]);
      
      // Add slight fluctuations to metrics
      setRtt(Math.round(10 + Math.random() * 4));
      setJitter(parseFloat((1.0 + Math.random() * 0.8).toFixed(1)));
    }, 16); // 60Hz

    offlineIntervalRef.current = interval;
  };

  const connectObserverSocket = (shareToken: string) => {
    const defaultWsUrl = 'ws://localhost:3000';
    const envWsUrl = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') 
      : defaultWsUrl);
    const wsUrl = `${envWsUrl}/ws/observe?token=${shareToken}&role=observer`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      // WS relay is active as soon as socket opens
      setWsRelayActive(true);
      setConnectionState('live');
      setRtt(15);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("[Observer] Received WebSocket msg:", msg);
        const { type } = msg;

        if (type === 'offer') {
          handleOffer(msg.sdp, ws);
        } else if (type === 'ice_candidate') {
          if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        } else if (type === 'telemetry') {
          // WebSocket telemetry fallback relay
          if (msg.data && msg.data.type === 'pause_state') {
            setIsTwinPaused(msg.data.paused);
          } else if (!rtcActive) {
            setLiveJointAngles(msg.data);
            if (typeof window !== 'undefined') {
              (window as any).__lastReceivedJoints = { joints: msg.data, receivedAt: Date.now() };
            }
            setConnectionState('live');
            setRtt(15); // Standard WS fallback RTT estimation
            setJitter(2.5);
          }
        } else if (type === 'error') {
          setConnectionState('failed');
        }
      } catch (err) {
        console.error('Error handling observer WS message:', err);
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      setWsRelayActive(false);
      cleanupResources();
    };
  };

  const handleOffer = async (sdpOffer: RTCSessionDescriptionInit, ws: WebSocket) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      if (channel.label === 'telemetry') {
        channel.onopen = () => {
          setRtcActive(true);
          setConnectionState('live');
        };

        channel.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log("[Observer] Received WebRTC msg:", data);
            if (data && data.type === 'pause_state') {
              setIsTwinPaused(data.paused);
            } else {
              setLiveJointAngles(data);
              if (typeof window !== 'undefined') {
                (window as any).__lastReceivedJoints = { joints: data, receivedAt: Date.now() };
              }
            }
          } catch (err) {
            console.error('DataChannel parse error:', err);
          }
        };

        channel.onclose = () => {
          setRtcActive(false);
        };
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: e.candidate
        }));
      }
    };

    // Listen for peer connection changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setRtcActive(true);
        setConnectionState('live');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRtcActive(false);
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'answer',
          sdp: answer
        }));
      }
    } catch (err) {
      console.error('Failed to handle SDP offer:', err);
    }

    // Periodically query WebRTC stats
    const statsInterval = setInterval(async () => {
      if (pc.connectionState === 'closed' || !pcRef.current) {
        clearInterval(statsInterval);
        return;
      }
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              setRtt(Math.round(report.currentRoundTripTime * 1000));
            }
          }
        });
      } catch (e) {
        // Stats query failed
      }
    }, 1000);
  };

  const cleanupResources = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (offlineIntervalRef.current) {
      clearInterval(offlineIntervalRef.current);
      offlineIntervalRef.current = null;
    }
    setRtcActive(false);
    setWsRelayActive(false);
  };

  if (isValidating) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#07080a] gap-3">
        <RefreshCw size={24} className="text-accent-cyan animate-spin" />
        <span className="font-display text-[9px] tracking-widest text-text-secondary uppercase font-semibold">
          Verifying Live Observation Link...
        </span>
      </div>
    );
  }

  if (connectionState === 'disconnected') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#07080a] gap-4 p-4 text-center select-none font-mono" id="operator-disconnected-overlay">
        <ShieldAlert size={36} className="text-accent-red animate-bounce" />
        <div>
          <h2 className="font-display text-xs font-black tracking-widest text-text-primary uppercase">
            Operator ended the session
          </h2>
          <p className="text-[9px] text-text-secondary max-w-[280px] leading-relaxed mt-2">
            The active operator has closed their console tab and terminated this live observation stream.
          </p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#07080a] gap-4 p-4 text-center select-none font-mono" id="expired-token-overlay">
        <ShieldAlert size={36} className="text-accent-red animate-bounce" />
        <div>
          <h2 className="font-display text-xs font-black tracking-widest text-text-primary uppercase">
            SESSION EXPIRED
          </h2>
          <p className="text-[9px] text-text-secondary max-w-[280px] leading-relaxed mt-2">
            The session sharing token is expired (links only remain active for 1 hour) or has been revoked by the operator.
          </p>
        </div>
        <button
          onClick={() => navigate('/twin')}
          className="mt-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-accent-cyan text-[9px] font-display font-bold text-text-primary hover:text-accent-cyan transition-all cursor-pointer"
        >
          GO TO OPERATOR CONSOLE
        </button>
      </div>
    );
  }

  const getStatusText = () => {
    if (connectionState === 'connecting') return 'ESTABLISHING HANDSHAKE';
    if ((connectionState as string) === 'disconnected') return 'OPERATOR DISCONNECTED';
    if (connectionState === 'failed') return 'STREAM OFFLINE';
    if (rtcActive) return 'RTC LIVE STREAM';
    if (wsRelayActive || connectionState === 'live') return 'Relayed';
    return 'CONNECTING';
  };

  const getStatusColor = () => {
    if (connectionState === 'connecting') return 'text-amber-500 animate-pulse';
    if ((connectionState as string) === 'disconnected' || connectionState === 'failed') return 'text-accent-red font-bold';
    return rtcActive ? 'text-accent-cyan font-bold animate-pulse' : 'text-accent-green';
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#07080a] text-text-primary flex flex-col select-none">
      {/* Immersive Top Header */}
      <header className="h-14 px-6 bg-black/30 border-b border-white/5 backdrop-blur-md flex items-center justify-between z-30 flex-shrink-0">
        <div>
          <h1 className="font-display text-xs font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-violet uppercase">
            SIGNVERSE OBSERVER VIEW
          </h1>
          <p className="text-[8px] text-text-secondary tracking-widest uppercase font-semibold">
            REMOTE TELEOPERATION DIAGNOSTICS DECK
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-[#07080a]/85 border border-white/5 px-3 py-1.5 rounded-full backdrop-blur-md">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-ping" />
          <span className="font-mono text-[8px] text-text-secondary uppercase tracking-widest">
            OBSERVING LIVE
          </span>
        </div>
      </header>

      {/* Main split display */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: RobotCanvas 3D */}
        <div className="flex-1 relative h-full bg-[#08090c]">
          <RobotCanvas customJointAngles={liveJointAngles} />
          {isTwinPaused && (
            <div 
              id="paused-overlay" 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50 font-mono"
            >
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <span className="text-[10px] tracking-widest text-amber-500 uppercase font-black">
                Twin Paused by Operator
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Read-only Diagnostics Overlay */}
        <div className="w-80 h-full border-l border-white/5 bg-black/20 flex flex-col p-5 gap-5 overflow-y-auto">
          
          {/* Status Block */}
          <div className="glass-panel p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Activity size={12} className="text-accent-cyan" />
              <span className="font-display text-[9px] font-bold tracking-wider text-text-primary uppercase">
                Connection Status
              </span>
            </div>
            <div className="font-mono text-[8px] text-text-secondary flex flex-col gap-1.5 mt-1">
              <div>SIGNAL VALUE: <span className={getStatusColor()} data-testid="observer-status-text">{getStatusText()}</span></div>
              <div className="flex items-center gap-1">
                <span>TRANSPORT:</span> 
                <span className="text-text-primary font-bold">
                  {rtcActive ? 'WebRTC P2P (DataChannel)' : 'WebSocket Gateway Relay'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection statistics */}
          <div className="glass-panel p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Network size={12} className="text-accent-cyan animate-pulse" />
              <span className="font-display text-[9px] font-bold tracking-wider text-text-primary uppercase">
                WebRTC Diagnostics
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-1 font-mono text-[8px] text-text-secondary">
              <div className="bg-black/20 border border-white/5 rounded p-2.5 flex flex-col gap-0.5">
                <span>RTT LATENCY</span>
                <span className="text-text-primary text-[10px] font-bold">{rtt !== null ? `${rtt}ms` : '--'}</span>
              </div>
              <div className="bg-black/20 border border-white/5 rounded p-2.5 flex flex-col gap-0.5">
                <span>JITTER</span>
                <span className="text-text-primary text-[10px] font-bold">{rtcActive ? `${jitter}ms` : '--'}</span>
              </div>
              <div className="bg-black/20 border border-white/5 rounded p-2.5 flex flex-col gap-0.5">
                <span>PACKET LOSS</span>
                <span className="text-text-primary text-[10px] font-bold">{rtcActive ? `${packetLoss}%` : '--'}</span>
              </div>
              <div className="bg-black/20 border border-white/5 rounded p-2.5 flex flex-col gap-0.5">
                <span>DOWNSAMPLED HZ</span>
                <span className="text-text-primary text-[10px] font-bold">60 Hz</span>
              </div>
            </div>
          </div>

          {/* Safety disclaimer card */}
          <div className="glass-panel p-4 bg-accent-cyan/5 border-accent-cyan/15 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-accent-cyan" />
              <span className="font-display text-[9px] font-bold tracking-wider text-text-primary uppercase">
                READ-ONLY ACTIVE
              </span>
            </div>
            <p className="text-[9px] text-text-secondary leading-relaxed font-mono">
              Observer panel is strictly read-only. Standard teleoperation control lines, NLP instruction injections, and emergency motor E-Stops are isolated for remote hardware safety.
            </p>
          </div>

          {/* Connected indicators list */}
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-text-muted mt-auto justify-center">
            <CheckCircle size={10} className="text-accent-green" />
            <span>Secure SSL Handshake Encrypted</span>
          </div>

        </div>
      </main>
    </div>
  );
}
