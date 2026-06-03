import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetry';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Activity } from 'lucide-react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

export default function FrameRateDisplay() {
  const hz = useTelemetryStore((state) => state.hz);
  const wsState = useTelemetryStore((state) => state.wsState);
  const [hzHistory, setHzHistory] = useState<number[]>(new Array(30).fill(0));
  
  const liveHz = wsState === 'LIVE' ? hz : 0;
  const animatedHz = useAnimatedNumber(liveHz, 300);

  useEffect(() => {
    if (wsState !== 'LIVE') {
      setHzHistory(new Array(30).fill(0));
      return;
    }

    setHzHistory((prev) => {
      const next = [...prev, hz];
      if (next.length > 30) next.shift(); // maintain last 30 seconds
      return next;
    });
  }, [hz, wsState]);

  // SVG dimensions for the sparkline
  const width = 120;
  const height = 30;
  const padding = 2;

  // Compute points for SVG path
  const maxVal = Math.max(...hzHistory, 1000); // scale chart to target 1000Hz or higher
  const minVal = 0;
  
  const points = hzHistory.map((val, idx) => {
    const x = (idx / (hzHistory.length - 1)) * (width - padding * 2) + padding;
    // Map value to Y axis (flipped coordinate system in SVG)
    const range = maxVal - minVal;
    const y = range > 0 
      ? (height - padding * 2) - ((val - minVal) / range) * (height - padding * 2) + padding
      : height / 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Color code based on Hz speed relative to target 1000Hz
  let hzColor = 'text-accent-red';
  let sparklineColor = '#ff3366';
  if (hz >= 950) {
    hzColor = 'text-accent-green';
    sparklineColor = '#39ff14';
  } else if (hz >= 500) {
    hzColor = 'text-amber-400';
    sparklineColor = '#fbbf24';
  }

  return (
    <Card id="framerate-display-card" className="glass-panel p-4 flex flex-col gap-2">
      <CardHeader className="flex flex-row items-center justify-between p-0">
        <span className="font-display text-[9px] font-bold tracking-wider text-text-secondary uppercase">
          TELEMETRY RATE
        </span>
        <Activity size={14} className={wsState === 'LIVE' ? hzColor : 'text-text-muted'} />
      </CardHeader>
      
      <CardContent className="p-0 flex items-center justify-between mt-1">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span id="framerate-hz-value" className={`font-mono text-2xl font-black tracking-tight ${wsState === 'LIVE' ? hzColor : 'text-text-muted'}`}>
              {animatedHz}
            </span>
            <span className="text-xs font-semibold text-text-secondary">Hz</span>
          </div>
          <span className="text-[8px] text-text-muted font-mono leading-none">
            Target: 1000 Hz
          </span>
        </div>

        {/* Rolling SVG Sparkline */}
        <div className="flex flex-col items-end gap-1">
          <svg width={width} height={height} className="overflow-visible">
            {/* Sparkline background area fill */}
            {points && (
              <path
                d={`M ${padding},${height} L ${points} L ${width - padding},${height} Z`}
                fill={`${sparklineColor}15`}
              />
            )}
            {/* Sparkline stroke path */}
            <polyline
              fill="none"
              stroke={wsState === 'LIVE' ? sparklineColor : '#53647c'}
              strokeWidth="1.5"
              points={points}
            />
            {/* Target 1000Hz dotted threshold line */}
            <line
              x1={0}
              y1={padding + (height - padding * 2) * (1 - 1000 / maxVal)}
              x2={width}
              y2={padding + (height - padding * 2) * (1 - 1000 / maxVal)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="2,2"
            />
          </svg>
          <span className="text-[7px] text-text-muted font-mono uppercase tracking-widest leading-none">
            30s History Window
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
