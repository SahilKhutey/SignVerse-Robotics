import React from 'react';
import { useLearningStore } from '../../store/learning';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Brain, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TASK_COLORS = [
  'var(--color-accent-cyan)',
  'var(--color-accent-violet)',
  'var(--color-accent-green)',
  '#f59e0b', // orange
  '#ec4899', // pink
  '#3b82f6', // blue
  'var(--color-accent-red)'
];

export default function ForgettingMonitor() {
  const { taskAccuracies, forgettingAlerts } = useLearningStore();

  // Extract all task names (e.g. 'reach_left', 'wave_hand')
  const tasks = Object.keys(taskAccuracies);

  // Build a map of step -> data object for Recharts
  const stepMap = new Map<number, Record<string, number>>();

  tasks.forEach((task) => {
    const history = taskAccuracies[task] || [];
    history.forEach(([step, accuracy]) => {
      if (!stepMap.has(step)) {
        stepMap.set(step, {});
      }
      // Store accuracy as percentage for easier reading (0-100%)
      stepMap.get(step)![task] = parseFloat((accuracy * 100).toFixed(1));
    });
  });

  const sortedSteps = Array.from(stepMap.keys()).sort((a, b) => a - b);
  const chartData = sortedSteps.map((step) => ({
    step,
    ...stepMap.get(step)
  }));

  const hasData = chartData.length > 0;

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 min-h-[300px]">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-accent-violet" />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
            FORGETTING MONITOR (PER-TASK ACCURACY)
          </h2>
        </div>
        <span className="text-[9px] text-text-muted font-mono bg-white/5 px-2 py-0.5 rounded">
          Forgetting Threshold: &gt;5% Drop
        </span>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {forgettingAlerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {forgettingAlerts.map((alert, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 px-3 py-2 rounded-lg text-accent-red text-[10px] font-mono leading-relaxed"
              >
                <AlertTriangle size={12} className="flex-shrink-0 animate-pulse text-accent-red" />
                <span className="font-bold uppercase tracking-wider">ALERT:</span>
                <span>{alert}</span>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Chart container */}
      <div className="flex-1 w-full min-h-[220px] relative mt-1">
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] rounded-lg select-none">
            <span className="px-3 py-1.5 rounded-lg bg-[#0d1117]/90 border border-white/5 text-text-muted font-display text-[9px] font-bold tracking-widest uppercase">
              NO ONLINE UPDATES RECORDED YET
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="step"
                stroke="var(--color-text-muted)"
                style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(7, 8, 10, 0.95)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                }}
                formatter={(value: any) => [`${value}%`, 'Accuracy']}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  paddingTop: '10px'
                }}
              />
              {tasks.map((task, idx) => (
                <Line
                  key={task}
                  type="monotone"
                  dataKey={task}
                  name={task}
                  stroke={TASK_COLORS[idx % TASK_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                  connectNulls={true}
                  isAnimationActive={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
