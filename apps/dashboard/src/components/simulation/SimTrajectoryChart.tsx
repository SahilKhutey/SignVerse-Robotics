import React, { useMemo, useRef, useEffect } from 'react';
import { useSimulationStore } from '../../store/simulation';
import { TrendingUp } from 'lucide-react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

// ─── Joint labels for the legend ─────────────────────────────────────────────
const JOINT_COLORS_REAL = ['#00f0ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
const JOINT_COLORS_SIM  = ['#00f0ff60', '#8b5cf660', '#10b98160', '#f59e0b60', '#ef444460', '#ec489960', '#6366f160'];
const JOINT_NAMES = ['J0 Base', 'J1 Shldr', 'J2 UAm', 'J3 Elbow', 'J4 FAm', 'J5 Wrist', 'J6 Roll'];

// The sim series are dashed overlays; real series are solid.
function buildUPlotOptions(containerWidth: number): uPlot.Options {
  const series: uPlot.Series[] = [
    { label: 'Time (s)' }, // x-axis
    // 7 real (solid) + 7 sim (dashed)
    ...JOINT_NAMES.map((name, i) => ({
      label: `${name} Real`,
      stroke: JOINT_COLORS_REAL[i],
      width: 1.5,
      spanGaps: true,
    })),
    ...JOINT_NAMES.map((name, i) => ({
      label: `${name} Sim`,
      stroke: JOINT_COLORS_SIM[i],
      width: 1,
      dash: [4, 4],
      spanGaps: true,
    })),
  ];

  return {
    title: '',
    width: containerWidth,
    height: 220,
    series,
    axes: [
      {
        stroke: '#475569',
        ticks: { stroke: '#334155', width: 1 },
        grid: { stroke: '#1e2535', width: 1 },
        font: '10px monospace',
        labelFont: '10px monospace',
        labelGap: 2,
        values: (_u, vals) => vals.map((v) => `${v.toFixed(1)}s`),
      },
      {
        stroke: '#475569',
        ticks: { stroke: '#334155', width: 1 },
        grid: { stroke: '#1e2535', width: 1 },
        font: '10px monospace',
        values: (_u, vals) => vals.map((v) => `${v.toFixed(0)}°`),
        size: 38,
      },
    ],
    scales: {
      x: { auto: true },
      y: { auto: true },
    },
    cursor: {
      sync: { key: 'sim-trajectory' },
    },
    padding: [8, 8, 0, 0],
  };
}

// ─── Build the data arrays for uPlot ─────────────────────────────────────────
function buildPlotData(
  simFrames: { jointAngles?: number[]; timestampMs: number }[],
  realFrames: { jointAngles?: number[]; timestampMs: number }[]
): uPlot.AlignedData {
  const N = Math.max(simFrames.length, realFrames.length);
  if (N === 0) return [[], ...Array(14).fill([])];

  const tStart = Math.min(
    simFrames[0]?.timestampMs ?? Date.now(),
    realFrames[0]?.timestampMs ?? Date.now()
  );

  const times = Array.from({ length: N }, (_, i) => i * 0.016); // 16ms per frame → seconds
  const realSeries = Array.from({ length: 7 }, (_, j) =>
    Array.from({ length: N }, (_, i) => realFrames[i]?.jointAngles?.[j] ?? null)
  );
  const simSeries = Array.from({ length: 7 }, (_, j) =>
    Array.from({ length: N }, (_, i) => simFrames[i]?.jointAngles?.[j] ?? null)
  );

  return [times, ...realSeries, ...simSeries] as uPlot.AlignedData;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SimTrajectoryChart() {
  const simFrames = useSimulationStore((s) => s.simFrames);
  const realFrames = useSimulationStore((s) => s.realFrames);
  const isRunning = useSimulationStore((s) => s.isRunning);

  const containerRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);

  // Visible joint toggles — default show all
  const [activeJoints, setActiveJoints] = React.useState<boolean[]>(Array(7).fill(true));

  const toggleJoint = (idx: number) => {
    setActiveJoints((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const plotData = useMemo(() => buildPlotData(simFrames, realFrames), [simFrames, realFrames]);

  // Create / destroy uPlot instance
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.offsetWidth || 600;

    uPlotRef.current?.destroy();
    uPlotRef.current = new uPlot(buildUPlotOptions(width), plotData, containerRef.current);

    return () => {
      uPlotRef.current?.destroy();
      uPlotRef.current = null;
    };
  }, []); // only on mount

  // Update data imperatively (no re-mount)
  useEffect(() => {
    if (uPlotRef.current && plotData[0].length > 0) {
      uPlotRef.current.setData(plotData);
    }
  }, [plotData]);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current || !uPlotRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      uPlotRef.current?.setSize({ width: entry.contentRect.width, height: 220 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const hasData = simFrames.length > 0 || realFrames.length > 0;

  return (
    <div className="glass-panel p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-accent-cyan" />
          <span className="font-display text-[10px] font-bold tracking-widest text-text-primary uppercase">
            TRAJECTORY COMPARISON
          </span>
        </div>
        <div className="flex items-center gap-3 text-[8px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-accent-cyan rounded" />
            <span className="text-text-muted">Real</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width={16} height={4}>
              <line x1={0} y1={2} x2={16} y2={2} stroke="#00f0ff60" strokeWidth={1.5} strokeDasharray="4 3" />
            </svg>
            <span className="text-text-muted">Sim</span>
          </div>
        </div>
      </div>

      {/* Joint toggle chips */}
      <div className="flex gap-1.5 flex-wrap select-none">
        {JOINT_NAMES.map((name, idx) => (
          <button
            key={idx}
            onClick={() => toggleJoint(idx)}
            className={`px-2 py-0.5 rounded text-[7px] font-mono font-bold border transition-all ${
              activeJoints[idx]
                ? 'border-transparent text-black'
                : 'bg-transparent border-white/10 text-text-muted'
            }`}
            style={activeJoints[idx] ? { background: JOINT_COLORS_REAL[idx] } : {}}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="relative">
        {!hasData && !isRunning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[9px] text-text-muted font-mono">No trajectory data yet</p>
          </div>
        )}
        {isRunning && !hasData && (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
            <p className="text-[9px] text-text-muted font-mono animate-pulse">COMPUTING...</p>
          </div>
        )}
        <div
          ref={containerRef}
          className={`w-full transition-opacity duration-300 ${!hasData ? 'opacity-0' : 'opacity-100'}`}
          style={{ minHeight: 220 }}
        />
      </div>

      {/* Frame count stat */}
      {hasData && (
        <div className="flex gap-4 text-[8px] font-mono border-t border-white/5 pt-2 select-none">
          <div>
            <span className="text-text-muted">Real frames: </span>
            <span className="text-accent-cyan font-bold">{realFrames.length}</span>
          </div>
          <div>
            <span className="text-text-muted">Sim frames: </span>
            <span className="text-accent-violet font-bold">{simFrames.length}</span>
          </div>
          <div>
            <span className="text-text-muted">Duration: </span>
            <span className="text-text-secondary font-bold">
              {((Math.max(simFrames.length, realFrames.length)) * 0.016).toFixed(1)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
