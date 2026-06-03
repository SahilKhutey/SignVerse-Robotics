import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, AlertTriangle, Circle } from 'lucide-react';
import { useTelemetryStore } from '../../store/telemetry';
import { useNotificationsStore } from '../../store/notifications';

interface RecordingControlsProps {
  sessionLabel: string;
  motionType: string;
  onRecordingStop: () => void;
}

export default function RecordingControls({
  sessionLabel,
  motionType,
  onRecordingStop
}: RecordingControlsProps) {
  const isRecording = useTelemetryStore((state) => state.isRecording);
  const recordedFrames = useTelemetryStore((state) => state.recordedFrames);
  const startRecordingStore = useTelemetryStore((state) => state.startRecording);
  const stopRecordingStore = useTelemetryStore((state) => state.stopRecording);
  const addLog = useNotificationsStore((state) => state.addLog);
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);

  const [isPending, setIsPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);

  // Manage elapsed timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const handleStart = async () => {
    if (isEstopTriggered) {
      addLog('❌ Cannot record: E-Stop is active!', 'error');
      return;
    }
    if (!sessionLabel.trim()) {
      addLog('⚠️ Set a session label before recording.', 'warn');
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch('http://localhost:8000/api/record/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'signverse_local_dev_key'
        },
        body: JSON.stringify({ session_label: sessionLabel })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const res = await response.json();
      if (res.status === 'success') {
        // Start Zustand store recording
        startRecordingStore(sessionLabel);
      } else {
        throw new Error('API failed to initiate');
      }
    } catch (err: any) {
      addLog(`⚠️ Backend recording API offline. Using local-only session buffer.`, 'warn');
      startRecordingStore(sessionLabel);
    } finally {
      setIsPending(false);
    }
  };

  const handleStop = async () => {
    setIsPending(true);
    try {
      const response = await fetch('http://localhost:8000/api/record/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'signverse_local_dev_key'
        },
        body: JSON.stringify({
          session_label: sessionLabel,
          motion_type: motionType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      stopRecordingStore();
      onRecordingStop();
    } catch (err: any) {
      addLog(`💾 Offline save: demo session cataloged locally.`, 'success');
      stopRecordingStore();
      onRecordingStop();
    } finally {
      setIsPending(false);
    }
  };

  const formatTime = (secs: number) => {
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
      {/* Session directory details */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] text-text-muted uppercase select-none font-mono">
          ACTIVE DECK RECORDER TARGET
        </span>
        {isRecording ? (
          <div className="flex items-center gap-1.5 font-mono text-xs text-accent-red font-bold animate-pulse">
            <Circle size={8} className="fill-accent-red" />
            <span>RECORDING: {sessionLabel}_{motionType}</span>
          </div>
        ) : (
          <span className="font-mono text-xs text-text-secondary select-none">
            Awaiting session capture initialization...
          </span>
        )}
      </div>

      {/* Frame counters */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-text-muted select-none font-mono">FRAMES ENQUEUED</span>
          <span className="font-mono text-xs text-text-primary font-bold">
            {recordedFrames.length}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[8px] text-text-muted select-none font-mono">RECORDED DURATION</span>
          <span className="font-mono text-xs text-text-primary font-bold">
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* Dispatch buttons */}
      <div className="flex items-center gap-2">
        {isRecording ? (
          <button
            onClick={handleStop}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red text-white hover:bg-red-600 disabled:opacity-40 transition-all font-display text-[10px] font-bold rounded-lg cursor-pointer shadow-[0_0_12px_rgba(255,51,102,0.15)]"
          >
            <Square size={10} className="fill-white" />
            STOP & TAG SESSION
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={isPending || isEstopTriggered || !sessionLabel.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green text-black hover:bg-emerald-500 disabled:opacity-40 transition-all font-display text-[10px] font-bold rounded-lg cursor-pointer"
          >
            <Play size={10} className="fill-black stroke-none" />
            RECORD DEMO
          </button>
        )}
      </div>
    </div>
  );
}
