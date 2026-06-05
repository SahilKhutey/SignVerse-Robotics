import React, { useState } from 'react';
import { useOnlineLearningStore } from '../../store/onlineLearning';
import { useOnlineConfig } from '../../hooks/useOnlineConfig';
import { getStableColor } from '../../lib/colorByHash';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Brain, AlertTriangle, ShieldAlert, Sparkles, Trash2, ArrowDownRight } from 'lucide-react';

export function ForgettingMonitor() {
  const accuracyHistory = useOnlineLearningStore((state) => state.accuracyHistory);
  const forgettingAlerts = useOnlineLearningStore((state) => state.forgettingAlerts);
  const resetAlerts = useOnlineLearningStore((state) => state.resetAlerts);
  const learnerState = useOnlineLearningStore((state) => state.learnerState);

  const { updateConfig, isPending } = useOnlineConfig();
  const [hiddenTasks, setHiddenTasks] = useState<Set<string>>(new Set());

  const currentLr = learnerState?.current_lr ?? 1e-4;

  // Format data for Recharts
  const chartData = accuracyHistory.map((h) => ({
    step: h.step,
    overall: h.overall,
    ...h.perTask,
  }));

  // Identify all unique task labels
  const taskKeys = Array.from(
    new Set(accuracyHistory.flatMap((h) => Object.keys(h.perTask)))
  );

  const toggleTask = (key: string) => {
    const next = new Set(hiddenTasks);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setHiddenTasks(next);
  };

  // Sort forgetting alerts by step descending (most recent first)
  const sortedAlerts = [...forgettingAlerts].sort((a, b) => b.step - a.step);
  const displayedAlerts = sortedAlerts.slice(0, 10);

  // Check for persistent forgetting: same task in 3 most recent alerts
  let persistentTask: string | null = null;
  if (sortedAlerts.length >= 3) {
    const t0 = sortedAlerts[0].task_label;
    const t1 = sortedAlerts[1].task_label;
    const t2 = sortedAlerts[2].task_label;
    if (t0 === t1 && t1 === t2) {
      persistentTask = t0;
    }
  }

  const handleReduceLr = () => {
    updateConfig({ learning_rate: currentLr * 0.5 });
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 w-full select-none">
      {/* Panel Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-text-primary">
          <Brain size={14} className="text-accent-cyan" />
          <span className="font-display text-xs font-semibold tracking-wider uppercase">
            CATASTROPHIC FORGETTING MONITOR
          </span>
        </div>
      </div>

      {/* Recharts Chart */}
      <div className="h-[260px] w-full border border-white/5 bg-black/10 rounded-xl p-4">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] text-text-muted font-mono">
            Waiting for training optimization steps to graph forgetting...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis
                dataKey="step"
                stroke="#64748b"
                fontSize={9}
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={9}
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(13, 17, 23, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                }}
              />
              {/* Overall validation accuracy line */}
              {!hiddenTasks.has('overall') && (
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="#ffffff"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  dot={false}
                  name="Overall Accuracy"
                />
              )}
              {/* Dynamic Task lines */}
              {taskKeys.map((key) => {
                if (hiddenTasks.has(key)) return null;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={getStableColor(key)}
                    strokeWidth={1.5}
                    dot={false}
                    name={key}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend Toggles */}
      {taskKeys.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[8px] font-mono text-text-muted uppercase mr-1">
            Toggle Tasks:
          </span>
          <button
            onClick={() => toggleTask('overall')}
            className={`px-2.5 py-1 rounded-md text-[9px] font-mono border transition-all duration-200 cursor-pointer ${
              !hiddenTasks.has('overall')
                ? 'bg-white/10 text-text-primary border-white/20'
                : 'bg-transparent text-text-muted border-white/5'
            }`}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white border border-black/40 mr-1.5" />
            Overall
          </button>
          {taskKeys.map((key) => (
            <button
              key={key}
              onClick={() => toggleTask(key)}
              className={`px-2.5 py-1 rounded-md text-[9px] font-mono border transition-all duration-200 cursor-pointer ${
                !hiddenTasks.has(key)
                  ? 'bg-white/10 text-text-primary border-white/20'
                  : 'bg-transparent text-text-muted border-white/5'
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                style={{ backgroundColor: getStableColor(key) }}
              />
              {key}
            </button>
          ))}
        </div>
      )}

      {/* Persistent Forgetting Amber Suggestion Banner */}
      {persistentTask && (
        <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-accent-yellow mt-0.5 flex-shrink-0" size={14} />
            <div className="flex flex-col gap-0.5 text-left leading-tight">
              <span className="text-[10px] font-bold text-accent-yellow font-display uppercase tracking-wider">
                Persistent Forgetting Detected
              </span>
              <span className="text-[9px] text-text-secondary">
                Task <code className="text-text-primary font-bold font-mono">{persistentTask}</code> has triggered 3 consecutive accuracy drops. We recommend scaling down the online fine-tuning learning rate.
              </span>
            </div>
          </div>
          <button
            onClick={handleReduceLr}
            disabled={isPending}
            className="flex-shrink-0 flex items-center gap-1.5 bg-accent-yellow/15 hover:bg-accent-yellow/25 border border-accent-yellow/30 text-accent-yellow text-[9px] font-mono font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer hover:shadow-[0_0_10px_rgba(245,158,11,0.15)] disabled:opacity-50"
          >
            <ArrowDownRight size={10} />
            Reduce LR by 50%
          </button>
        </div>
      )}

      {/* Alert Badge Monitor Logs */}
      <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-text-primary">
            <ShieldAlert size={12} className="text-accent-red" />
            <span className="font-display text-[9px] font-bold tracking-widest uppercase">
              FORGETTING MONITOR EVENT LOG
            </span>
            {forgettingAlerts.length > 0 && (
              <span className="bg-accent-red/10 text-accent-red font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-accent-red/20 leading-none">
                {forgettingAlerts.length}
              </span>
            )}
          </div>

          {forgettingAlerts.length > 0 && (
            <button
              onClick={resetAlerts}
              className="flex items-center gap-1 text-[9px] font-mono font-semibold text-text-muted hover:text-text-primary transition-all cursor-pointer bg-white/5 border border-white/5 hover:border-white/10 rounded px-2.5 py-1"
            >
              <Trash2 size={10} />
              Clear Alerts
            </button>
          )}
        </div>

        {forgettingAlerts.length === 0 ? (
          <div className="py-4 text-center border border-dashed border-white/5 rounded-xl text-[9px] text-text-muted font-mono leading-none select-none">
            <Sparkles size={11} className="inline-block text-accent-green mr-1.5 animate-pulse" />
            No task performance drops flagged. Learning stability is optimal.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
            {displayedAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-accent-red/5 border border-accent-red/10 rounded-lg px-3 py-1.5 text-[9px] font-mono text-accent-red leading-none animate-in fade-in zoom-in-95 duration-200"
              >
                <AlertTriangle size={9} />
                <span>
                  <strong className="text-text-primary">{alert.task_label}</strong>: dropped{' '}
                  <strong className="text-text-primary">{alert.drop_percent}%</strong> at step{' '}
                  <strong className="text-text-primary">{alert.step}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
