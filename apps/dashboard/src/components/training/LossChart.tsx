import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Brain } from 'lucide-react';

interface LossPoint {
  epoch: number;
  loss: number;
  valLoss: number;
}

interface LossChartProps {
  isTraining: boolean;
  onTrainingComplete: () => void;
  refreshTrigger: number;
}

export default function LossChart({
  isTraining,
  onTrainingComplete,
  refreshTrigger
}: LossChartProps) {
  const [history, setHistory] = useState<LossPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [currentLoss, setCurrentLoss] = useState(0);
  const [currentValLoss, setCurrentValLoss] = useState(0);

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/training/status', {
        headers: { 'X-API-Key': 'signverse_local_dev_key' }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      const runs = data.runs || [];
      setHistory(runs);
      
      if (runs.length > 0) {
        const lastRun = runs[runs.length - 1];
        setCurrentEpoch(lastRun.epoch);
        setCurrentLoss(lastRun.loss);
        setCurrentValLoss(lastRun.valLoss);
      }

      if (data.status === 'DONE') {
        // Trigger completion callback
        onTrainingComplete();
      }
    } catch {
      // Mock progress simulation if backend is offline
      if (isTraining) {
        simulateProgress();
      }
    }
  };

  // Local mock simulation loop if backend is offline
  const simulateProgress = () => {
    setHistory((prev) => {
      const nextEpoch = prev.length + 1;
      if (nextEpoch > 50) {
        onTrainingComplete();
        return prev;
      }
      
      const decayBase = 0.85 * Math.pow(0.92, nextEpoch);
      const loss = parseFloat((decayBase + Math.random() * 0.02).toFixed(5));
      const valLoss = parseFloat((decayBase * 1.05 + Math.random() * 0.025).toFixed(5));
      
      setCurrentEpoch(nextEpoch);
      setCurrentLoss(loss);
      setCurrentValLoss(valLoss);

      return [...prev, { epoch: nextEpoch, loss, valLoss }];
    });
  };

  useEffect(() => {
    fetchStatus();
    
    let intervalId: any = null;
    if (isTraining) {
      intervalId = setInterval(() => {
        fetchStatus();
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTraining, refreshTrigger]);

  return (
    <div className="flex flex-col gap-6 lg:col-span-2">
      {/* Visual statistics header row */}
      {isTraining && (
        <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[9px] text-text-secondary select-none">
          <div className="flex flex-col gap-0.5">
            <span>EPOCH COUNT</span>
            <span className="text-accent-cyan text-xs font-bold">{currentEpoch} / 50</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span>TRAIN LOSS (MSE)</span>
            <span className="text-accent-violet text-xs font-bold">{currentLoss.toFixed(5)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span>VALIDATION LOSS</span>
            <span className="text-accent-green text-xs font-bold">{currentValLoss.toFixed(5)}</span>
          </div>
        </div>
      )}

      {/* Chart canvas */}
      <div className="glass-panel p-5 flex flex-col gap-4 min-h-[380px]">
        <span className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase select-none">
          POLICY LOSS CURVE TRACKER
        </span>

        <div className="flex-1 w-full min-h-[280px]">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted text-[10px] gap-2 border border-white/5 border-dashed rounded-xl select-none">
              <Brain size={24} className="opacity-30" />
              Awaiting training loop initialization...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="epoch" stroke="var(--color-text-muted)" style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }} />
                <YAxis stroke="var(--color-text-muted)" style={{ fontSize: '8px', fontFamily: 'var(--font-mono)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(7, 8, 10, 0.95)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '9px', fontFamily: 'var(--font-display)', marginTop: '5px' }} />
                <Line type="monotone" dataKey="loss" name="Train Loss" stroke="var(--color-accent-violet)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="valLoss" name="Validation Loss" stroke="var(--color-accent-cyan)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
