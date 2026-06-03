import React from 'react';
import { useTelemetryStore } from '../../store/telemetry';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Brain } from 'lucide-react';

export default function ConfidenceGauge() {
  // Read confidence from the throttled Zustand store slice
  const confidence = useTelemetryStore((state) => state.frame?.confidence ?? 0.0);

  // Convert 0-1 to percentage
  const pct = Math.round(confidence * 100);

  // Color mapping: <50% red, 50-80% amber, >80% green
  let color = '#ff3366'; // red
  let statusText = 'CRITICAL / LOW';
  let textColorClass = 'text-accent-red';

  if (confidence >= 0.8) {
    color = '#39ff14'; // green
    statusText = 'OPTIMAL / HIGH';
    textColorClass = 'text-accent-green';
  } else if (confidence >= 0.5) {
    color = '#fbbf24'; // amber
    statusText = 'STABLE / DEGRADED';
    textColorClass = 'text-amber-400';
  }

  // Data format for Recharts RadialBarChart
  const data = [
    {
      name: 'Confidence',
      value: pct,
      fill: color,
    }
  ];

  return (
    <Card id="confidence-gauge-card" className="glass-panel p-4 flex flex-col gap-3 w-full">
      <CardHeader className="flex flex-row items-center justify-between p-0 border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5">
          <Brain size={14} className={textColorClass} />
          <CardTitle className="text-xs">AI PREDICTION CONFIDENCE</CardTitle>
        </div>
        <span className="text-[8px] text-text-muted font-mono uppercase tracking-wider">
          Inference Engine
        </span>
      </CardHeader>

      <CardContent className="p-0 flex flex-col items-center justify-center relative min-h-[220px]">
        
        {/* Radial gauge rendering */}
        <div className="w-full h-[180px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="75%"
              outerRadius="95%"
              barSize={10}
              data={data}
              startAngle={180}
              endAngle={-90}
            >
              {/* Backing grey track */}
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                dataKey="value"
                cornerRadius={5}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Center overlay labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
          <span id="confidence-percentage" className="font-mono text-3xl font-black text-text-primary tracking-tight">
            {pct}%
          </span>
          <span className={`text-[8px] font-mono font-bold uppercase tracking-widest mt-1 ${textColorClass}`}>
            {statusText}
          </span>
        </div>

        {/* Audit footer */}
        <div className="text-[8px] font-mono text-text-muted text-center leading-relaxed max-w-[240px] border-t border-white/5 pt-2 w-full">
          Behavior Cloning MLP output match probability vector delta.
        </div>
      </CardContent>
    </Card>
  );
}
