import React from 'react';
import { useRlhfStore } from '../../store/rlhf';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Activity, Flame, ShieldAlert } from 'lucide-react';

export default function RMTrainingProgress() {
  const { rmHistory, ratedCount } = useRlhfStore();

  const hasData = rmHistory.length > 0;
  
  // Find the minimum validation loss achieved
  const bestValLoss = hasData 
    ? Math.min(...rmHistory.map(h => h.val_loss)) 
    : 1.0;

  const isBelowTargetThreshold = bestValLoss < 0.3;

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 min-h-[300px] select-none">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-accent-cyan" />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
            REWARD MODEL LOSS CURVE
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-text-muted">
          <span className="bg-white/5 px-2 py-0.5 rounded">
            Dataset: {ratedCount} pairs
          </span>
          <span className={`px-2 py-0.5 rounded border ${
            isBelowTargetThreshold 
              ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' 
              : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
          }`}>
            Target: {isBelowTargetThreshold ? 'MET (<0.3)' : 'NOT MET (>=0.3)'}
          </span>
        </div>
      </div>

      {/* Info Stats */}
      <div className="grid grid-cols-2 gap-3 mb-1">
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
          <span className="text-[7px] font-display text-text-muted uppercase tracking-widest">
            MIN VAL LOSS ACHIEVED
          </span>
          <span className={`text-lg font-bold font-mono mt-0.5 ${
            isBelowTargetThreshold ? 'text-accent-green' : 'text-accent-red'
          }`}>
            {hasData ? bestValLoss.toFixed(4) : '--'}
          </span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
          <span className="text-[7px] font-display text-text-muted uppercase tracking-widest">
            CLASS DISTRIBUTION
          </span>
          <span className="text-lg font-bold font-mono text-accent-violet mt-0.5">
            50/50 <span className="text-[8px] text-text-muted font-sans font-normal uppercase">A vs B</span>
          </span>
        </div>
      </div>

      {/* Recharts Loss Curves */}
      <div className="flex-1 w-full min-h-[200px] relative">
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] rounded-lg">
            <span className="px-3 py-1.5 rounded-lg bg-[#0d1117]/90 border border-white/5 text-text-muted font-display text-[9px] font-bold tracking-widest uppercase animate-pulse">
              WAITING FOR REWARD MODEL TRAINING EPISODES...
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rmHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis 
                dataKey="epoch" 
                stroke="var(--color-text-muted)" 
                style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }} 
              />
              <YAxis 
                stroke="var(--color-text-muted)" 
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
              />
              <Legend 
                wrapperStyle={{ fontSize: '10px', fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', paddingTop: '10px' }}
              />
              <Line
                type="monotone"
                dataKey="train_loss"
                name="Train Loss"
                stroke="var(--color-accent-cyan)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="val_loss"
                name="Val Loss"
                stroke="var(--color-accent-violet)"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Target Loss Alert */}
      {!isBelowTargetThreshold && hasData && (
        <div className="flex items-start gap-2 bg-accent-red/10 border border-accent-red/30 p-3 rounded-lg text-accent-red text-[9px] font-mono leading-relaxed mt-1">
          <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-accent-red" />
          <p>
            <strong>WARNING:</strong> Validation loss is currently above 0.3. Starting PPO optimization at this stage may result in erratic policy updates. Label more preference pairs to improve RM accuracy.
          </p>
        </div>
      )}
    </div>
  );
}
