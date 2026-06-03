import React, { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { telemetryRingBuffer } from '../../lib/RingBuffer';
import { calculateVelocities } from '../../lib/telemetryDerived';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

const JOINT_NAMES = [
  'J0 (Base Yaw)',
  'J1 (Shoulder Pitch)',
  'J2 (Elbow Roll)',
  'J3 (Wrist Pitch)',
  'J4 (Wrist Yaw)',
  'J5 (Wrist Roll)',
  'J6 (Gripper Actuator)'
];

const SERIES_COLORS = [
  '#00f0ff', // cyan
  '#8e2de2', // violet
  '#39ff14', // green
  '#f59e0b', // orange
  '#ec4899', // pink
  '#3b82f6', // blue
  '#ef4444'  // red
];

export default function VelocityChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<boolean[]>(new Array(7).fill(true));

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 400;
    const height = 200;

    const opts: uPlot.Options = {
      width,
      height,
      cursor: {
        show: true
      },
      legend: {
        show: false
      },
      scales: {
        x: { time: true },
        y: { range: [-10, 10] } // rad/s limits
      },
      series: [
        {
          label: 'Time'
        },
        ...JOINT_NAMES.map((name, i) => ({
          label: name,
          stroke: SERIES_COLORS[i],
          width: 1.2,
          show: visibleSeries[i]
        }))
      ],
      axes: [
        {
          stroke: '#53647c',
          grid: { stroke: 'rgba(255, 255, 255, 0.03)' },
          size: 35
        },
        {
          stroke: '#53647c',
          grid: { stroke: 'rgba(255, 255, 255, 0.03)' },
          values: (self, ticks) => ticks.map(t => `${t.toFixed(1)} rad/s`),
          size: 65
        }
      ]
    };

    const initialData: uPlot.AlignedData = [
      [Date.now() / 1000],
      [0], [0], [0], [0], [0], [0], [0]
    ];

    const chart = new uPlot(opts, initialData, containerRef.current);
    chartRef.current = chart;

    let active = true;
    const updateLoop = () => {
      if (!active) return;

      const snapshot = telemetryRingBuffer.getSnapshot();
      if (snapshot.length > 1 && chartRef.current) {
        const xData: number[] = [];
        const seriesData: number[][] = Array.from({ length: 7 }, () => []);

        snapshot.forEach((frame, idx) => {
          xData.push(frame.timestampMs / 1000);
          const prevFrame = idx > 0 ? snapshot[idx - 1] : null;
          const velocities = calculateVelocities(frame, prevFrame);
          
          for (let j = 0; j < 7; j++) {
            seriesData[j].push(velocities[j]);
          }
        });

        chartRef.current.setData([xData, ...seriesData]);
      }

      requestAnimationFrame(updateLoop);
    };

    requestAnimationFrame(updateLoop);

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        if (chartRef.current) {
          chartRef.current.setSize({ width, height: 200 });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      active = false;
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  const toggleSeries = (index: number) => {
    setVisibleSeries((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      if (chartRef.current) {
        chartRef.current.setSeries(index + 1, { show: next[index] });
      }
      return next;
    });
  };

  return (
    <Card className="glass-panel p-4 flex flex-col gap-3 w-full">
      <CardHeader className="flex flex-row items-center justify-between p-0">
        <CardTitle className="text-xs">JOINT ANGULAR VELOCITIES (RAD/S)</CardTitle>
        <span className="text-[8px] text-text-muted font-mono bg-white/5 px-2 py-0.5 rounded">
          uPlot Engine: 200 Hz
        </span>
      </CardHeader>

      <CardContent className="p-0 flex flex-col gap-3">
        <div ref={containerRef} className="w-full h-[200px]" />

        {/* Legend buttons */}
        <div className="flex flex-wrap gap-1.5 justify-center mt-1 border-t border-white/5 pt-2">
          {JOINT_NAMES.map((name, i) => {
            const isVisible = visibleSeries[i];
            return (
              <button
                key={i}
                onClick={() => toggleSeries(i)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all cursor-pointer ${
                  isVisible 
                    ? 'bg-white/5 hover:bg-white/10' 
                    : 'bg-black/40 text-text-muted border-white/5 opacity-50'
                }`}
                style={{
                  borderColor: isVisible ? `${SERIES_COLORS[i]}40` : undefined,
                }}
              >
                <div 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: isVisible ? SERIES_COLORS[i] : '#53647c',
                  }}
                />
                <span>J{i}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
