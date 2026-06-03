import React from 'react';
import { useRlhfStore } from '../../store/rlhf';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Activity, ShieldAlert, Award } from 'lucide-react';

export default function PPORewardChart() {
  const { ppoHistory } = useRlhfStore();

  const hasData = ppoHistory.length > 0;
  
  // Get latest metrics
  const latestMetric = hasData ? ppoHistory[ppoHistory.length - 1] : null;
  const currentReward = latestMetric ? latestMetric.ppo_reward : 0.0;
  const currentKl = latestMetric ? latestMetric.kl_divergence : 0.0;

  const isKlCritical = currentKl > 0.4;

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 min-h-[360px] select-none">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-accent-violet" />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
            PPO FINE-TUNING STATS
          </h2>
        </div>
        <span className="text-[9px] text-text-muted font-mono bg-white/5 px-2 py-0.5 rounded">
          Hard-stop limit: KL &gt; 0.5
        </span>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
          <span className="text-[7px] font-display text-text-muted uppercase tracking-widest">
            MEAN EPISODE REWARD
          </span>
          <span className="text-lg font-bold font-mono text-accent-green mt-0.5">
            {hasData ? currentReward.toFixed(4) : '--'}
          </span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
          <span className="text-[7px] font-display text-text-muted uppercase tracking-widest">
            KL DIVERGENCE (DRIFT)
          </span>
          <span className={`text-lg font-bold font-mono mt-0.5 ${
            isKlCritical ? 'text-accent-red animate-pulse' : 'text-accent-cyan'
          }`}>
            {hasData ? currentKl.toFixed(4) : '--'}
          </span>
        </div>
      </div>

      {/* Two-panel Layout charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[220px]">
        {/* Panel 1: Reward Curve */}
        <div className="relative border border-white/5 rounded-xl p-3 bg-black/10 flex flex-col gap-2">
          <span className="text-[8px] font-display text-text-secondary uppercase tracking-wider font-semibold">
            Mean Reward Trajectory
          </span>
          <div className="flex-1 w-full min-h-[140px]">
            {!hasData ? (
              <div className="h-full w-full flex items-center justify-center text-[9px] font-mono text-text-muted uppercase">
                Awaiting PPO Steps...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ppoHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="step" stroke="var(--color-text-muted)" style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }} />
                  <YAxis stroke="var(--color-text-muted)" style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(7, 8, 10, 0.95)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                    }}
                  />
                  <Line type="monotone" dataKey="ppo_reward" name="Reward" stroke="var(--color-accent-green)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Panel 2: KL Divergence Curve */}
        <div className="relative border border-white/5 rounded-xl p-3 bg-black/10 flex flex-col gap-2">
          <span className="text-[8px] font-display text-text-secondary uppercase tracking-wider font-semibold">
            KL Divergence Drift
          </span>
          <div className="flex-1 w-full min-h-[140px]">
            {!hasData ? (
              <div className="h-full w-full flex items-center justify-center text-[9px] font-mono text-text-muted uppercase">
                Awaiting PPO Steps...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ppoHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="step" stroke="var(--color-text-muted)" style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }} />
                  <YAxis stroke="var(--color-text-muted)" domain={[0, 0.6]} style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(7, 8, 10, 0.95)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                    }}
                  />
                  <Line type="monotone" dataKey="kl_divergence" name="KL Div" stroke="var(--color-accent-cyan)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* KL divergence warning */}
      {isKlCritical && (
        <div className="flex items-start gap-2 bg-accent-red/10 border border-accent-red/30 p-3 rounded-lg text-accent-red text-[9px] font-mono leading-relaxed">
          <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-accent-red animate-pulse" />
          <p>
            <strong>CRITICAL WARNING:</strong> Policy is drifting close to the safety abort threshold (KL: {currentKl.toFixed(3)} &gt; 0.4). Actuator commands may become erratic and unsafe for hardware.
          </p>
        </div>
      )}
    </div>
  );
}
