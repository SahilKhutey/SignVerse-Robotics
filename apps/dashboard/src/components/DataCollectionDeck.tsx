import React, { useState } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { useNotificationsStore } from '../store/notifications';
import { Circle, Square, Tag, Upload, Database } from 'lucide-react';

export default function DataCollectionDeck() {
  const isRecording = useTelemetryStore((state) => state.isRecording);
  const startRecording = useTelemetryStore((state) => state.startRecording);
  const stopRecording = useTelemetryStore((state) => state.stopRecording);
  const recordedFrames = useTelemetryStore((state) => state.recordedFrames);
  const sessionLabel = useTelemetryStore((state) => state.sessionLabel);
  const annotateFrame = useTelemetryStore((state) => state.annotateFrame);
  const addLog = useNotificationsStore((state) => state.addLog);

  const [label, setLabel] = useState(sessionLabel);
  const [annotation, setAnnotation] = useState('');

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(label || 'teleop_session_01');
    }
  };

  const handleAnnotate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotation.trim()) return;
    annotateFrame(annotation.trim());
    setAnnotation('');
  };

  const handleUpload = () => {
    if (recordedFrames.length === 0) return;
    addLog(`📤 Uploading behavior cloning sequence [${sessionLabel}] to SQLite perception database...`, 'info');
    
    // Simulate API pipeline call
    setTimeout(() => {
      addLog(`✨ Dataset segment [${sessionLabel}] successfully index registers in SQLite. Policy training buffer updated.`, 'success');
    }, 1200);
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Database size={18} className="text-accent-violet" />
        <h2 className="font-display text-sm font-semibold tracking-wider text-text-primary">
          TELEOPERATION DATA COLLECTOR
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {/* Session Name input */}
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-text-muted font-display tracking-wider w-24">
            SESSION ID:
          </span>
          <input
            type="text"
            className="flex-1 bg-black/40 border border-white/5 rounded px-3 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-violet"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isRecording}
          />
        </div>

        {/* Start / Stop Record */}
        <div className="flex gap-2">
          <button
            onClick={handleRecordToggle}
            className={`flex-1 btn ${
              isRecording ? 'btn-red' : 'btn-cyan'
            } text-xs py-2.5 flex justify-center gap-2`}
          >
            {isRecording ? <Square size={14} /> : <Circle size={14} className="fill-current" />}
            {isRecording ? 'STOP RECORDING' : 'START DATA COLLECTION'}
          </button>
          
          <button
            onClick={handleUpload}
            disabled={isRecording || recordedFrames.length === 0}
            className="btn bg-white/5 border border-white/10 hover:bg-white/10 text-xs py-2.5 px-4 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={14} />
            COMPILE
          </button>
        </div>

        {/* Annotation tag */}
        <form onSubmit={handleAnnotate} className="flex gap-2 border-t border-white/5 pt-3">
          <input
            type="text"
            className="flex-1 bg-black/40 border border-white/5 rounded px-3 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-violet"
            placeholder="Add gesture annotation tag (e.g. 'fist')..."
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            disabled={!isRecording}
          />
          <button
            type="submit"
            disabled={!isRecording || !annotation.trim()}
            className="btn bg-accent-violet/20 hover:bg-accent-violet/30 border border-accent-violet/30 text-accent-violet text-xs py-1 px-3 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Tag size={12} />
            TAG
          </button>
        </form>
      </div>
    </div>
  );
}
