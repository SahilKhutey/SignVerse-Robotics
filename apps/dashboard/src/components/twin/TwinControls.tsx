import React from 'react';
import { useTelemetryStore } from '../../store/telemetry';
import { Camera, Play, Pause, Eye, EyeOff, Disc, Activity, Share2 } from 'lucide-react';

interface TwinControlsProps {
  currentPreset: string;
  setPreset: (preset: 'Front' | 'Side' | 'Top' | 'Free') => void;
  showReadouts: boolean;
  setShowReadouts: (show: boolean) => void;
  showSkeleton: boolean;
  setShowSkeleton: (show: boolean) => void;
  onShareClick?: () => void;
}

export default function TwinControls({
  currentPreset,
  setPreset,
  showReadouts,
  setShowReadouts,
  showSkeleton,
  setShowSkeleton,
  onShareClick,
}: TwinControlsProps) {
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);
  const isRecording = useTelemetryStore((state) => state.isRecording);
  const isTwinFrozen = useTelemetryStore((state) => state.isTwinFrozen);
  const setIsTwinFrozen = useTelemetryStore((state) => state.setIsTwinFrozen);
  const heatmapActive = useTelemetryStore((state) => state.heatmapActive);
  const setHeatmapActive = useTelemetryStore((state) => state.setHeatmapActive);
  const anomalyActive = useTelemetryStore((state) => state.anomalyActive);
  const setAnomalyActive = useTelemetryStore((state) => state.setAnomalyActive);
  const wsState = useTelemetryStore((state) => state.wsState);
  const isPlaying = useTelemetryStore((state) => state.isPlaying);

  const getStatusText = () => {
    if (isEstopTriggered) return 'EMERGENCY HALTED';
    return wsState;
  };

  const getStatusClass = () => {
    if (isEstopTriggered) return 'text-accent-red font-bold animate-pulse';
    if (wsState === 'DEAD' || wsState === 'IDLE') return 'text-text-muted';
    if (wsState === 'CONNECTING' || wsState === 'RECONNECTING') return 'text-amber-500 animate-pulse';
    return 'text-accent-green';
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
      
      {/* Top Bar: Recording & Telemetry status */}
      <div className="flex justify-between items-start w-full">
        {/* Connection diagnostics snap */}
        <div className="flex flex-col gap-1 bg-[#07080a]/85 border border-white/5 p-3 rounded-lg pointer-events-auto backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Activity size={12} className={isEstopTriggered ? 'text-accent-red animate-pulse' : 'text-accent-cyan'} />
            <span className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
              Digital Twin {isPlaying ? '(REPLAYING)' : '(LIVE)'}
            </span>
          </div>
          <div className="font-mono text-[8px] text-text-secondary mt-1 flex flex-col gap-0.5">
            <div>NODE STATE: <span className={getStatusClass()}>{getStatusText()}</span></div>
            <div>JOINT ENGINE: <span className={isTwinFrozen ? 'text-amber-500' : 'text-accent-green'}>
              {isTwinFrozen ? 'FROZEN' : 'TRACKING'}
            </span></div>
          </div>
        </div>

        {/* Share Live & Pulsing REC badge */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onShareClick}
            className="flex items-center gap-1.5 bg-[#07080a]/85 border border-white/5 hover:border-accent-cyan px-3 py-1.5 rounded-lg text-[9px] font-display font-bold text-text-secondary hover:text-text-primary transition-all backdrop-blur-md cursor-pointer"
            title="Share session live with remote observers"
          >
            <Share2 size={12} className="text-accent-cyan" />
            SHARE LIVE
          </button>

          {isRecording && (
            <div className="flex items-center gap-1.5 bg-accent-red/10 border border-accent-red/30 px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse">
              <Disc size={12} className="text-accent-red fill-accent-red animate-spin-slow" />
              <span id="recording-badge" className="font-mono text-[9px] font-bold text-accent-red uppercase tracking-widest">
                REC ACTIVE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Action buttons */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-3 w-full mt-auto pointer-events-auto">
        
        {/* Camera Preset Toggles */}
        <div className="flex items-center gap-1 bg-[#07080a]/80 border border-white/5 p-1 rounded-lg backdrop-blur-md">
          <span className="text-[8px] font-display text-text-muted px-2 uppercase tracking-wider">
            CAMERA VIEW:
          </span>
          {(['Front', 'Side', 'Top', 'Free'] as const).map((preset) => (
            <button
              key={preset}
              id={`camera-btn-${preset.toLowerCase()}`}
              onClick={() => setPreset(preset)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                currentPreset === preset 
                  ? 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/35 shadow-[0_0_8px_rgba(0,240,255,0.15)]' 
                  : 'bg-transparent text-text-secondary border-transparent hover:bg-white/5'
              }`}
            >
              <Camera size={10} />
              {preset}
            </button>
          ))}
        </div>

        {/* Twin Controls: Freeze & Overlay Toggles */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          
          {/* Readout toggle */}
          <button
            id="toggle-readouts-btn"
            onClick={() => setShowReadouts(!showReadouts)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold uppercase transition-all backdrop-blur-md cursor-pointer ${
              showReadouts 
                ? 'bg-accent-cyan/10 hover:bg-accent-cyan/20 border-accent-cyan/30 text-accent-cyan' 
                : 'bg-[#07080a]/80 hover:bg-[#07080a] border-white/5 text-text-secondary'
            }`}
          >
            {showReadouts ? <Eye size={12} /> : <EyeOff size={12} />}
            Readouts
          </button>

          {/* Heatmap toggle */}
          <button
            id="toggle-heatmap-btn"
            onClick={() => setHeatmapActive(!heatmapActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold uppercase transition-all backdrop-blur-md cursor-pointer ${
              heatmapActive 
                ? 'bg-accent-cyan/20 hover:bg-accent-cyan/35 border-accent-cyan/40 text-accent-cyan shadow-[0_0_8px_rgba(0,240,255,0.15)] font-extrabold' 
                : 'bg-[#07080a]/80 hover:bg-[#07080a] border-white/5 text-text-secondary'
            }`}
          >
            Heatmap
          </button>

          {/* Anomaly toggle */}
          <button
            id="toggle-anomaly-btn"
            onClick={() => setAnomalyActive(!anomalyActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold uppercase transition-all backdrop-blur-md cursor-pointer ${
              anomalyActive 
                ? 'bg-accent-red/20 hover:bg-accent-red/35 border-accent-red/40 text-accent-red shadow-[0_0_8px_rgba(255,51,102,0.15)] font-extrabold' 
                : 'bg-[#07080a]/80 hover:bg-[#07080a] border-white/5 text-text-secondary'
            }`}
          >
            Anomalies
          </button>

          {/* Skeleton toggle */}
          <button
            id="toggle-skeleton-btn"
            onClick={() => setShowSkeleton(!showSkeleton)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[9px] font-bold uppercase transition-all backdrop-blur-md cursor-pointer ${
              showSkeleton 
                ? 'bg-accent-violet/20 hover:bg-accent-violet/30 border-accent-violet/40 text-accent-violet' 
                : 'bg-[#07080a]/80 hover:bg-[#07080a] border-white/5 text-text-secondary'
            }`}
          >
            {showSkeleton ? <Eye size={12} /> : <EyeOff size={12} />}
            Skeleton
          </button>

          {/* Freeze / Twin play-pause button */}
          <button
            id="twin-freeze-btn"
            onClick={() => setIsTwinFrozen(!isTwinFrozen)}
            className={`flex items-center justify-center h-8 w-8 rounded-lg border transition-all backdrop-blur-md cursor-pointer ${
              isTwinFrozen 
                ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/35 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)] animate-pulse' 
                : 'bg-accent-green/10 hover:bg-accent-green/20 border-accent-green/30 text-accent-green'
            }`}
            title={isTwinFrozen ? 'Re-enable joint tracking' : 'Freeze 3D arm position'}
          >
            {isTwinFrozen ? <Play size={14} className="fill-amber-500/20" /> : <Pause size={14} className="fill-accent-green/20" />}
          </button>

        </div>

      </div>
    </div>
  );
}
