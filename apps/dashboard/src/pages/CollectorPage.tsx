import React, { useState } from 'react';
import WebcamFeed from '../components/collector/WebcamFeed';
import SessionTagger from '../components/collector/SessionTagger';
import RecordingControls from '../components/collector/RecordingControls';
import SessionList, { SessionItem } from '../components/collector/SessionList';
import { Database, ShieldAlert, FileVideo, Download, RefreshCw } from 'lucide-react';
import { useNotificationsStore } from '../store/notifications';
import { useTelemetryStore } from '../store/telemetry';
import { VITE_API_URL } from '../lib/env';

export default function CollectorPage() {
  const addLog = useNotificationsStore((state) => state.addLog);
  const [sessionLabel, setSessionLabel] = useState('teleop_session');
  const [motionType, setMotionType] = useState('reach');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [exportingHdf5, setExportingHdf5] = useState(false);
  const [exportingRlds, setExportingRlds] = useState(false);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleRecordingStop = () => {
    addLog(`🟢 Demo recording successfully tagged and saved.`, 'success');
    handleRefresh();
  };

  const handleExport = async (format: 'hdf5' | 'rlds') => {
    if (!selectedSession) return;
    if (format === 'hdf5') setExportingHdf5(true);
    else setExportingRlds(true);

    try {
      const response = await fetch(`${VITE_API_URL}/api/sessions/${selectedSession.id}/export?format=${format}`, {
        headers: { 'X-API-Key': 'signverse_local_dev_key' }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSession.label}_export.${format === 'hdf5' ? 'h5' : 'rlds.h5'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addLog(`🟢 Exported session as ${format.toUpperCase()} successfully`, 'success');
    } catch (err) {
      addLog(`❌ Failed to export session as ${format.toUpperCase()}`, 'error');
    } finally {
      if (format === 'hdf5') setExportingHdf5(false);
      else setExportingRlds(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex flex-col gap-1 select-none">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-accent-cyan" />
          <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
            Data Collector Studio
          </h2>
        </div>
        <p className="text-[10px] text-text-secondary">
          Record human-guided teleoperation sessions, annotate training sequence phases, and compile high-frequency h5 imitation learning datasets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Pane: Camera & Active Recorder Session Tagger */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Webcam feed */}
          <WebcamFeed />

          {/* Active recorder metadata tags configuration */}
          <div className="glass-panel p-5 flex flex-col gap-5">
            <SessionTagger
              label={sessionLabel}
              setLabel={setSessionLabel}
              motionType={motionType}
              setMotionType={setMotionType}
            />
            
            <RecordingControls
              sessionLabel={sessionLabel}
              motionType={motionType}
              onRecordingStop={handleRecordingStop}
            />
          </div>
        </div>

        {/* Right Pane: Timeline history logs */}
        <div className="flex flex-col gap-6">
          {/* Past sessions database query table */}
          <SessionList
            onSelectSession={setSelectedSession}
            selectedId={selectedSession?.id || null}
            refreshTrigger={refreshTrigger}
            onRefresh={handleRefresh}
            onApplyTags={(label, type) => {
              setSessionLabel(label);
              setMotionType(type);
            }}
          />

          {/* Preview selection card */}
          {selectedSession && (
            <div className="glass-panel p-5 bg-black/40 border-white/5 flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-accent-cyan font-bold">
                <FileVideo size={12} />
                <span>EPISODE METRIC PREVIEW</span>
              </div>
              <div className="flex flex-col gap-1 font-mono text-[9px] text-text-secondary">
                <div>ID: <span className="text-text-primary font-bold">{selectedSession.id}</span></div>
                <div>LABEL: <span className="text-text-primary font-bold">{selectedSession.label}</span></div>
                <div>FRAMES count: <span className="text-text-primary font-bold">{selectedSession.frame_count}</span></div>
                <div>DURATION: <span className="text-text-primary font-bold">{selectedSession.duration}s</span></div>
                <div>DATE: <span className="text-text-primary font-bold">{selectedSession.date}</span></div>
                <div>EST. SIZE: <span className="text-text-primary font-bold">~{
                  Math.round((selectedSession.frame_count * 300) / 1024) > 1024 
                    ? (Math.round((selectedSession.frame_count * 300) / 1024) / 1024).toFixed(1) + ' MB' 
                    : Math.round((selectedSession.frame_count * 300) / 1024) + ' KB'
                }</span></div>
              </div>

              <button
                onClick={() => {
                  useTelemetryStore.getState().loadReplaySession(selectedSession.id);
                  addLog(`📂 Loaded session ${selectedSession.id} into 3D Digital Twin replay environment.`, 'success');
                }}
                className="mt-2 w-full py-1.5 rounded bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/35 hover:border-accent-cyan text-[9px] font-display font-bold tracking-wider text-accent-cyan transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
              >
                LOAD INTO 3D TWIN REPLAY
              </button>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => handleExport('hdf5')}
                  disabled={exportingHdf5 || exportingRlds}
                  className="py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-display font-bold tracking-wider text-text-primary transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {exportingHdf5 ? (
                    <RefreshCw size={10} className="animate-spin text-accent-cyan" />
                  ) : (
                    <Download size={10} className="text-accent-cyan" />
                  )}
                  EXPORT HDF5
                </button>
                <button
                  onClick={() => handleExport('rlds')}
                  disabled={exportingHdf5 || exportingRlds}
                  className="py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-display font-bold tracking-wider text-text-primary transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {exportingRlds ? (
                    <RefreshCw size={10} className="animate-spin text-accent-cyan" />
                  ) : (
                    <Download size={10} className="text-accent-cyan" />
                  )}
                  EXPORT RLDS
                </button>
              </div>
            </div>
          )}

          {/* Storage notification */}
          <div className="glass-panel p-5 border-accent-cyan/15 bg-accent-cyan/5 flex flex-col gap-2.5 select-none">
            <div className="flex items-center gap-2">
              <ShieldAlert size={15} className="text-accent-cyan" />
              <span className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
                LOCAL STORAGE QUOTA
              </span>
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed">
              Dataset compilation buffer saves directly to SQLite database <code className="text-accent-cyan font-bold font-mono">datasets/raw/teleoperation.db</code>. Clean old sequences regularly to preserve local space.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

