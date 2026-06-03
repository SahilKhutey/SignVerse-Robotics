import React from 'react';
import { useSimulationStore } from '../store/simulation';
import SimulationControls from '../components/simulation/SimulationControls';
import GapAnalysisPanel from '../components/simulation/GapAnalysisPanel';
import SimTrajectoryChart from '../components/simulation/SimTrajectoryChart';
import EpisodeHistoryTracker from '../components/simulation/EpisodeHistoryTracker';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import RobotArm from '../components/twin/RobotArm';
import { FlaskConical, Info } from 'lucide-react';
import { useTelemetryStore } from '../store/telemetry';
import { motion } from 'framer-motion';

// ─── Mini dual-canvas preview: real (cyan) vs sim (orange ghost) ─────────────
function DualTwinPreview() {
  const simFrames = useSimulationStore((s) => s.simFrames);
  const realFrames = useSimulationStore((s) => s.realFrames);
  const hasData = simFrames.length > 0 || realFrames.length > 0;

  // Temporarily inject sim frames into telemetry store comparison slot
  React.useEffect(() => {
    if (simFrames.length > 0) {
      useTelemetryStore.setState({
        comparisonFrames: simFrames,
        activeComparisonSessionId: '__sim__',
        isReplayMode: true,
        replayFrames: realFrames,
        playbackIndex: 0,
      });
    } else {
      // Clean up when no sim data
      useTelemetryStore.setState({
        comparisonFrames: [],
        activeComparisonSessionId: null,
        isReplayMode: false,
      });
    }
  }, [simFrames, realFrames]);

  // Animate playback index
  const playbackRef = React.useRef(0);
  const maxFrames = Math.max(simFrames.length, realFrames.length);

  React.useEffect(() => {
    if (!hasData) return;
    let rafId: number;
    let lastTime = 0;

    const tick = (now: number) => {
      if (now - lastTime > 33) { // ~30fps playback
        playbackRef.current = (playbackRef.current + 1) % Math.max(1, maxFrames);
        useTelemetryStore.setState({ playbackIndex: playbackRef.current });
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hasData, maxFrames]);

  return (
    <div
      className={`relative flex-1 rounded-xl overflow-hidden bg-gradient-to-b from-[#10141f] to-[#07080a] min-h-[300px] border transition-all duration-300 shadow-2xl border-white/5`}
    >
      <Canvas shadows camera={{ position: [2.5, 2.5, 3.5], fov: 45 }}>
        <color attach="background" args={['#08090c']} />
        <ambientLight intensity={0.4} />
        <directionalLight castShadow position={[5, 8, 5]} intensity={1.0} />
        <Environment preset="city" />
        <Grid
          position={[0, -0.6, 0]}
          args={[10.5, 10.5]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1e222b"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#00f0ff"
          fadeDistance={10}
          fadeStrength={1}
          infiniteGrid
        />
        {hasData ? (
          <>
            {/* Real arm — cyan */}
            <RobotArm showReadouts={false} position={[-0.75, -0.6, 0]} />
            {/* Sim arm — purple ghost (comparison arm) */}
            <RobotArm showReadouts={false} isComparisonArm position={[0.75, -0.6, 0]} />
          </>
        ) : (
          <RobotArm showReadouts={false} position={[0, -0.6, 0]} />
        )}
        <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={1.2} maxDistance={8} />
      </Canvas>

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 flex gap-3 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-cyan shadow-[0_0_6px_#00f0ff]" />
          <span className="text-[8px] font-mono text-accent-cyan font-bold">REAL</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-violet shadow-[0_0_6px_#8b5cf6]" />
          <span className="text-[8px] font-mono text-accent-violet font-bold">SIM</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SimulationPage() {
  const gapMetrics = useSimulationStore((s) => s.gapMetrics);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const progress = useSimulationStore((s) => s.progress);

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex flex-col gap-1 select-none">
        <div className="flex items-center gap-3">
          <FlaskConical size={18} className="text-accent-cyan" />
          <div>
            <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
              Sim-to-Real Transfer Dashboard
            </h2>
            <p className="text-[10px] text-text-secondary mt-0.5">
              Run the trained BC policy in MuJoCo simulation, compare trajectories vs real hardware and visualize the gap.
            </p>
          </div>
        </div>

        {/* Info bar */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-accent-cyan/5 border border-accent-cyan/15 rounded-lg px-3.5 py-2 mt-1"
        >
          <Info size={12} className="text-accent-cyan flex-shrink-0" />
          <p className="text-[9px] text-text-secondary leading-relaxed">
            The <span className="text-accent-cyan font-bold">cyan arm</span> replays real teleoperation data.
            The <span className="text-accent-violet font-bold">purple ghost arm</span> runs the policy in MuJoCo physics.
            Gap score indicates transfer quality — scores above <span className="text-accent-green font-bold">75</span> are deployment-ready.
          </p>
        </motion.div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT: Controls + Gap Analysis */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <SimulationControls />
          <GapAnalysisPanel />
        </div>

        {/* CENTER + RIGHT: 3D twin + trajectory chart */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Score summary banner */}
          {gapMetrics && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between rounded-xl px-5 py-3 border ${
                gapMetrics.overallScore >= 75
                  ? 'bg-accent-green/10 border-accent-green/25'
                  : gapMetrics.overallScore >= 50
                  ? 'bg-amber-500/10 border-amber-500/25'
                  : 'bg-accent-red/10 border-accent-red/25'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`font-display text-2xl font-black ${
                  gapMetrics.overallScore >= 75 ? 'text-accent-green' :
                  gapMetrics.overallScore >= 50 ? 'text-amber-400' : 'text-accent-red'
                }`}>
                  {gapMetrics.overallScore}
                  <span className="text-sm font-mono font-normal ml-0.5">/100</span>
                </span>
                <div>
                  <p className="text-[10px] font-bold text-text-primary">
                    {gapMetrics.overallScore >= 75
                      ? '✅ Sim-to-Real Transfer Ready'
                      : gapMetrics.overallScore >= 50
                      ? '⚠️ Moderate Sim-to-Real Gap — Continue Training'
                      : '❌ High Sim-to-Real Gap — Policy Needs Retraining'}
                  </p>
                  <p className="text-[9px] text-text-muted font-mono">
                    {gapMetrics.totalFrames} frames · avg RMSE {(gapMetrics.joints.reduce((a, j) => a + j.rmse, 0) / 7).toFixed(1)}°
                  </p>
                </div>
              </div>
              <span className={`font-display text-[9px] font-bold px-3 py-1.5 rounded-lg border ${
                gapMetrics.overallScore >= 75
                  ? 'text-accent-green border-accent-green/30 bg-accent-green/10'
                  : gapMetrics.overallScore >= 50
                  ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  : 'text-accent-red border-accent-red/30 bg-accent-red/10'
              }`}>
                {gapMetrics.overallScore >= 75 ? 'DEPLOY' : gapMetrics.overallScore >= 50 ? 'TRAIN MORE' : 'RETRAIN'}
              </span>
            </motion.div>
          )}

          {/* Dual 3D Twin Preview */}
          <DualTwinPreview />

          {/* Trajectory comparison chart */}
          <SimTrajectoryChart />
        </div>
      </div>

      {/* BOTTOM: Episode History Tracker */}
      <div className="w-full mt-2">
        <EpisodeHistoryTracker />
      </div>
    </div>
  );
}
