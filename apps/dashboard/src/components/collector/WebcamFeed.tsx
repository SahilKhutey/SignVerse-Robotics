import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, AlertCircle, AlertTriangle, Coffee } from 'lucide-react';
import LiveLandmarkOverlay from './LiveLandmarkOverlay';
import { useFatigueStore } from '../../store/fatigue';
import FatigueScoreHUD from './FatigueScoreHUD';

export default function WebcamFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const { 
    connectFatigueStream, 
    disconnectFatigueStream, 
    state: fatigueState, 
    breakTimerActive, 
    breakTimeRemaining,
    resumeRecordingSession
  } = useFatigueStore();

  useEffect(() => {
    connectFatigueStream();
    return () => {
      disconnectFatigueStream();
    };
  }, [connectFatigueStream, disconnectFatigueStream]);

  useEffect(() => {
    async function initCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1280,
            height: 720,
            facingMode: 'user'
          },
          audio: false
        });
        setStream(mediaStream);
        setPermissionState('granted');
        setError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error('Error accessing webcam:', err);
        setPermissionState('denied');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied. Please allow access to record demos.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera device detected on this system.');
        } else {
          setError(`Camera acquisition error: ${err.message || 'Unknown error'}`);
        }
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/80 border border-white/5 shadow-2xl flex items-center justify-center">
      {/* Video element */}
      {permissionState === 'granted' && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" // mirror effect
        />
      )}

      {/* MediaPipe 2D Pose landmarks overlay canvas */}
      {permissionState === 'granted' && (
        <LiveLandmarkOverlay canvasRef={canvasRef} />
      )}

      {/* Biometric Fatigue HUD Ring Overlay */}
      {permissionState === 'granted' && (
        <FatigueScoreHUD />
      )}

      {/* Caution state amber tint overlay */}
      {permissionState === 'granted' && fatigueState === 'caution' && (
        <div className="pointer-events-none absolute inset-0 bg-amber-500/10 border-2 border-amber-500/30 transition-all duration-300 z-10" />
      )}

      {/* Caution state banner */}
      {permissionState === 'granted' && fatigueState === 'caution' && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-amber-400 font-mono text-[9px] font-bold tracking-wider animate-pulse select-none">
          <AlertTriangle size={12} />
          <span>Signs of fatigue detected — take a break soon</span>
        </div>
      )}

      {/* Fatigued break prompt modal overlay */}
      {permissionState === 'granted' && breakTimerActive && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-5 p-6 z-30 select-none animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-full bg-accent-red/10 border border-accent-red/35 flex items-center justify-center text-accent-red shadow-[0_0_20px_rgba(255,51,102,0.2)]">
            <Coffee size={28} />
          </div>
          
          <div className="flex flex-col gap-1 text-center max-w-sm">
            <span className="font-display text-sm font-black tracking-widest text-text-primary uppercase">
              Operator Fatigue Detected
            </span>
            <p className="text-[10px] text-text-secondary font-mono leading-relaxed max-w-xs mx-auto">
              Active recording has been automatically paused. Please take a 5-minute break to rest. Your session data up to this point is saved.
            </p>
          </div>

          {/* Countdown Clock */}
          <div className="flex flex-col items-center justify-center bg-white/3 border border-white/5 px-6 py-4 rounded-xl font-mono shadow-inner min-w-[140px]">
            <span className="text-[8px] text-text-muted uppercase tracking-widest mb-1">Break Time Remaining</span>
            <span className="text-xl font-black text-accent-cyan tracking-wider">
              {Math.floor(breakTimeRemaining / 60)}:{String(breakTimeRemaining % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => resumeRecordingSession()}
            className="px-5 py-2.5 rounded-lg bg-accent-cyan hover:bg-cyan-400 text-black font-display text-[10px] font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.2)] animate-pulse"
          >
            <span>Resume Teleoperation</span>
          </button>
        </div>
      )}

      {/* Initializing / Permission Prompt overlay */}
      {permissionState === 'prompt' && !error && (
        <div className="flex flex-col items-center gap-2 select-none z-10 text-center p-4">
          <Camera size={28} className="text-accent-cyan animate-pulse" />
          <span className="font-display text-[10px] font-bold tracking-wider text-text-secondary uppercase">
            Requesting Camera Feed Access
          </span>
        </div>
      )}

      {/* Permission Denied / Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 select-none z-10 text-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="h-12 w-12 rounded-full bg-accent-red/10 border border-accent-red/30 flex items-center justify-center text-accent-red mb-1">
            <CameraOff size={24} />
          </div>
          <div className="flex flex-col gap-2 max-w-sm">
            <span className="font-display text-xs font-bold tracking-widest text-text-primary uppercase">
              Webcam Access Denied
            </span>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {error}
            </p>
            {permissionState === 'denied' && (
              <div className="mt-2 text-left bg-white/5 border border-white/5 rounded-lg p-3 text-[10px] text-text-muted leading-relaxed font-sans">
                <p className="font-semibold text-text-primary mb-1 uppercase tracking-wider text-[9px]">How to enable:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Click the <span className="text-accent-cyan font-semibold">camera/lock icon</span> in your browser's address bar.</li>
                  <li>Toggle the Camera permission to <span className="text-accent-green font-semibold">"Allow"</span>.</li>
                  <li>Reload this page to re-initialize camera capture.</li>
                </ol>
                <div className="mt-2.5 pt-2 border-t border-white/5 text-center">
                  <a 
                    href="https://support.google.com/chrome/answer/2693767" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block text-[9px] text-accent-cyan hover:underline font-medium"
                  >
                    Open Browser Camera Settings Documentation
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
