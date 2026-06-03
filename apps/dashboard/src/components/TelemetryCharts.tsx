import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTelemetryStore } from '../store/telemetry';
import { Sliders } from 'lucide-react';

interface ChartDataPoint {
  time: string;
  J0: number;
  J1: number;
  J2: number;
  confidence: number;
}

export default function TelemetryCharts() {
  const [hasReceivedSignal, setHasReceivedSignal] = useState(false);
  const [data, setData] = useState<ChartDataPoint[]>(() => {
    // Generate 25 flat points initially for "waiting for signal"
    const initialPoints: ChartDataPoint[] = [];
    for (let i = 0; i < 25; i++) {
      initialPoints.push({
        time: '--:--:--',
        J0: 0,
        J1: 0,
        J2: 0,
        confidence: 0
      });
    }
    return initialPoints;
  });
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);

  useEffect(() => {
    const interval = setInterval(() => {
      const { frame } = useTelemetryStore.getState();
      if (!frame || !frame.jointAngles || frame.jointAngles.length < 3) return;

      setHasReceivedSignal(true);

      const j0 = frame.jointAngles[0] || 0;
      const j1 = frame.jointAngles[1] || 0;
      const j2 = frame.jointAngles[2] || 0;
      const conf = frame.confidence ?? 0.95;

      const timeStr = new Date(frame.timestampMs || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setData((prevData) => {
        const cleanPrev = prevData.filter(d => d.time !== '--:--:--');
        const nextData = [
          ...cleanPrev,
          {
            time: timeStr,
            J0: parseFloat(j0.toFixed(2)),
            J1: parseFloat(j1.toFixed(2)),
            J2: parseFloat(j2.toFixed(2)),
            confidence: parseFloat(conf.toFixed(2))
          },
        ];
        if (nextData.length > 50) {
          return nextData.slice(nextData.length - 50);
        }
        return nextData;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 min-h-[300px]">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-accent-cyan" />
          <h2 className="font-display text-sm font-semibold tracking-wider text-text-primary">
            HIGH-FREQUENCY JOINT ANALYSIS
          </h2>
        </div>
        <span className="text-[10px] text-text-muted font-mono">
          Sampled Decimation Rate: 5 Hz (Decoupled)
        </span>
      </div>

      <div 
        className="flex-1 w-full min-h-[200px] relative"
        role="img"
        aria-label="High-Frequency Joint Angle Telemetry Line Chart showing J0, J1, and J2 angle configurations over time."
      >
        {!hasReceivedSignal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1.5px] z-10 rounded-lg select-none">
            <span className="px-3 py-1.5 rounded-lg bg-[#0d1117]/90 border border-white/5 text-accent-cyan font-display text-[9px] font-bold tracking-widest uppercase animate-pulse shadow-[0_0_15px_rgba(0,240,255,0.15)]">
              WAITING FOR SIGNAL...
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">

          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis 
              dataKey="time" 
              stroke="var(--color-text-muted)" 
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }} 
            />
            <YAxis 
              stroke="var(--color-text-muted)" 
              domain={[-180, 180]}
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(7, 8, 10, 0.95)',
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
            />
            <Line
              type="monotone"
              dataKey="J0"
              name="J0 (Base Yaw)"
              stroke="var(--color-accent-cyan)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="J1"
              name="J1 (Shoulder)"
              stroke="var(--color-accent-violet)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="J2"
              name="J2 (Elbow)"
              stroke={isEstopTriggered ? 'var(--color-accent-red)' : 'var(--color-accent-green)'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
