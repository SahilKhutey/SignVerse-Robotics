import React, { useMemo } from 'react';
import { useSimulationStore, JointGapMetric } from '../../store/simulation';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { GitCompareArrows, Crosshair } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Score ring gauge ─────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const RADIUS = 42;
  const STROKE = 7;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dash = (score / 100) * CIRCUMFERENCE;
  const color = score >= 70 ? '#00f0ff' : score >= 50 ? '#f59e0b' : '#ff3366';
  const label = score >= 70 ? 'PASS' : score >= 50 ? 'FAIR' : 'FAIL';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={108} height={108} viewBox="0 0 108 108">
        {/* Track */}
        <circle
          cx={54} cy={54} r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        {/* Filled arc */}
        <motion.circle
          cx={54} cy={54} r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
          transform="rotate(-90 54 54)"
          initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
          animate={{ strokeDasharray: `${dash} ${CIRCUMFERENCE}` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
        {/* Score text */}
        <text x={54} y={50} textAnchor="middle" fill={color} fontSize={20} fontWeight={800} fontFamily="monospace">
          {score}
        </text>
        <text x={54} y={64} textAnchor="middle" fill={color} fontSize={8} fontFamily="monospace" letterSpacing={2}>
          {label}
        </text>
      </svg>
      <span className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Sim-to-Real Score</span>
    </div>
  );
}

// ─── Custom radar tick ────────────────────────────────────────────────────────
const JOINT_LABELS = ['J0 Base', 'J1 Shldr', 'J2 UAm', 'J3 Elbow', 'J4 FAm', 'J5 Wrist', 'J6 Roll'];

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function GapAnalysisPanel() {
  const gapMetrics = useSimulationStore((s) => s.gapMetrics);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const divergenceReport = useSimulationStore((s) => s.divergenceReport);

  // Radar data — normalize RMSE to 0–100 (higher = more deviation)
  const radarData = useMemo(() => {
    if (!gapMetrics) return [];
    return gapMetrics.joints.map((j, idx) => ({
      joint: JOINT_LABELS[idx],
      rmse: Math.min(100, j.rmse * 2),          // 50° max → 100
      correlation: Math.max(0, j.correlation * 100), // –1..1 → 0..100
    }));
  }, [gapMetrics]);

  // Bar chart data — per-joint RMSE
  const barData = useMemo(() => {
    if (!gapMetrics) return [];
    return gapMetrics.joints.map((j, idx) => ({
      name: `J${idx}`,
      rmse: parseFloat(j.rmse.toFixed(2)),
      corr: parseFloat((j.correlation * 100).toFixed(1)),
    }));
  }, [gapMetrics]);

  if (!gapMetrics && !isRunning) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <GitCompareArrows size={32} className="text-text-muted opacity-40" />
        <p className="text-[10px] text-text-muted text-center leading-relaxed">
          Run a simulation to see the<br />
          sim-to-real gap analysis
        </p>
      </div>
    );
  }

  if (isRunning && !gapMetrics) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
        <p className="text-[9px] text-text-muted animate-pulse font-mono tracking-widest uppercase">
          Computing trajectories...
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <GitCompareArrows size={14} className="text-accent-cyan" />
          <span className="font-display text-[10px] font-bold tracking-widest text-text-primary uppercase">
            SIM-TO-REAL GAP ANALYSIS
          </span>
        </div>
        {gapMetrics && (
          <span className="text-[8px] font-mono text-text-muted">
            {gapMetrics.totalFrames} frames · {(gapMetrics.simDurationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {gapMetrics && (
        <>
          {/* Prominent Divergence Gate Assessment */}
          {divergenceReport && (
            <div className={`p-3.5 rounded-xl border flex flex-col gap-2 select-none shadow-lg ${
              divergenceReport.overallScore < 0.3
                ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-display tracking-wider font-extrabold uppercase">
                  Divergence Gate Assessment
                </span>
                <span className={`text-[9px] font-mono font-black tracking-widest px-2.5 py-0.5 rounded border ${
                  divergenceReport.overallScore < 0.3 
                    ? 'bg-accent-green/20 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/20 border-accent-red/30 text-accent-red'
                }`}>
                  {divergenceReport.overallScore < 0.3 ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div className="flex justify-between items-end mt-1">
                <div className="flex flex-col">
                  <span className="text-[7px] text-text-muted font-mono uppercase tracking-wider">Divergence Score</span>
                  <span className="text-sm font-mono font-extrabold">{divergenceReport.overallScore.toFixed(4)} rad</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[7px] text-text-muted font-mono uppercase tracking-wider">Worst Joint</span>
                  <span className="text-[9px] font-mono font-bold text-text-primary bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    {JOINT_LABELS[divergenceReport.worstJointIndex] || `Joint ${divergenceReport.worstJointIndex}`}
                  </span>
                </div>
              </div>
              <div className="text-[7px] text-text-muted mt-0.5 leading-relaxed font-mono">
                {divergenceReport.overallScore < 0.3 
                  ? '✓ BC policy aligns with physical dynamics constraint (<0.3 rad average error).'
                  : '✗ Exceeds physical divergence threshold. Retraining or parameter tuning suggested.'}
              </div>
            </div>
          )}

          {/* Score + Radar side by side */}
          <div className="flex gap-4 items-center">
            <ScoreGauge score={gapMetrics.overallScore} />

            <div className="flex-1 h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis
                    dataKey="joint"
                    tick={{ fill: '#64748b', fontSize: 7, fontFamily: 'monospace' }}
                  />
                  <Radar
                    name="RMSE"
                    dataKey="rmse"
                    stroke="#ff3366"
                    fill="#ff3366"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                  <Radar
                    name="Correlation"
                    dataKey="correlation"
                    stroke="#00f0ff"
                    fill="#00f0ff"
                    fillOpacity={0.1}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[8px] font-mono select-none">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-accent-red rounded" />
              <span className="text-text-muted">RMSE (lower = better)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-accent-cyan rounded" />
              <span className="text-text-muted">Correlation (higher = better)</span>
            </div>
          </div>

          {/* Per-joint RMSE bar chart */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 select-none">
              <Crosshair size={10} className="text-text-muted" />
              <span className="text-[8px] text-text-muted uppercase font-mono tracking-wider">Per-Joint RMSE (°)</span>
            </div>
            <div className="h-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={14} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10, fontFamily: 'monospace' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(val: number) => [`${val.toFixed(2)}°`, 'RMSE']}
                  />
                  <Bar dataKey="rmse" radius={[3, 3, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.rmse < 5 ? '#00f0ff' : entry.rmse < 15 ? '#f59e0b' : '#ff3366'}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Joint metrics table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-text-muted">
                  <th className="text-left pb-1.5 font-display text-[7px] tracking-widest uppercase">JOINT</th>
                  <th className="text-right pb-1.5 font-display text-[7px] tracking-widest uppercase">RMSE (deg)</th>
                  <th className="text-right pb-1.5 font-display text-[7px] tracking-widest uppercase">RMSE (rad)</th>
                  <th className="text-right pb-1.5 font-display text-[7px] tracking-widest uppercase">MAX DEV</th>
                </tr>
              </thead>
              <tbody>
                {gapMetrics.joints.map((j, idx) => (
                  <tr key={idx} className="border-b border-white/3 hover:bg-white/3 transition-all">
                    <td className="py-1.5 text-text-secondary">{JOINT_LABELS[idx]}</td>
                    <td className={`py-1.5 text-right font-bold ${j.rmse < 5 ? 'text-accent-green' : j.rmse < 15 ? 'text-amber-400' : 'text-accent-red'}`}>
                      {j.rmse.toFixed(2)}°
                    </td>
                    <td className="py-1.5 text-right text-text-secondary">
                      {divergenceReport?.perJointRmse[idx] 
                        ? `${divergenceReport.perJointRmse[idx].toFixed(4)}`
                        : `${(j.rmse * Math.PI / 180.0).toFixed(4)}`
                      }
                    </td>
                    <td className="py-1.5 text-right text-text-muted">{j.maxDeviation.toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary metric chips */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'AVG RMSE', value: `${(gapMetrics.joints.reduce((a, j) => a + j.rmse, 0) / 7).toFixed(1)}°`, color: 'text-amber-400' },
              { 
                label: 'DIV GAP', 
                value: divergenceReport 
                  ? `${divergenceReport.overallScore.toFixed(3)} rad` 
                  : `${(gapMetrics.joints.reduce((a, j) => a + j.rmse, 0) / 7 * Math.PI / 180).toFixed(3)} rad`, 
                color: divergenceReport ? (divergenceReport.overallScore < 0.3 ? 'text-accent-green' : 'text-accent-red') : 'text-accent-cyan' 
              },
              { label: 'FRAMES', value: gapMetrics.totalFrames.toString(), color: 'text-text-secondary' },
            ].map((chip) => (
              <div key={chip.label} className="bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col items-center gap-0.5">
                <span className="text-[7px] text-text-muted font-display tracking-widest uppercase">{chip.label}</span>
                <span className={`text-[11px] font-bold font-mono ${chip.color}`}>{chip.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
