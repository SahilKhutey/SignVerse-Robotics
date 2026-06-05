import React, { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { telemetryRingBuffer } from '../../lib/RingBuffer';
import { degToRad } from '../../lib/telemetryDerived';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

const JOINT_NAMES = [
  'Shoulder 1 (Base Yaw)',
  'Shoulder 2 (Shoulder Pitch)',
  'Elbow (Elbow Roll)',
  'Wrist 1 (Wrist Pitch)',
  'Wrist 2 (Wrist Yaw)',
  'Wrist 3 (Wrist Roll)',
  'Gripper (Actuator)'
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

export default function JointAngleChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  
  // Track joint series visibility in React state for the custom legend
  const [visibleSeries, setVisibleSeries] = useState<boolean[]>(new Array(7).fill(true));

  useEffect(() => {
    if (!containerRef.current) return;

    // Calculate dimensions
    const width = containerRef.current.clientWidth || 800;
    const height = 280;

    const opts: uPlot.Options = {
      width,
      height,
      cursor: {
        show: true
      },
      legend: {
        show: false // use our custom React legend below
      },
      scales: {
        x: { time: true },
        y: { range: [-Math.PI, Math.PI] } // -pi to +pi rad
      },
      series: [
        {
          label: 'Time'
        },
        ...JOINT_NAMES.map((name, i) => ({
          label: name,
          stroke: SERIES_COLORS[i],
          width: 1.5,
          show: visibleSeries[i]
        }))
      ],
      axes: [
        {
          stroke: '#53647c', // text-muted color
          grid: { stroke: 'rgba(255, 255, 255, 0.03)' },
          size: 35
        },
        {
          stroke: '#53647c',
          grid: { stroke: 'rgba(255, 255, 255, 0.03)' },
          values: (self, ticks) => ticks.map(t => `${t.toFixed(2)} rad`),
          size: 55
        }
      ]
    };

    // Create initial empty data structured correctly
    const initialData: uPlot.AlignedData = [
      [Date.now() / 1000],
      [0], [0], [0], [0], [0], [0], [0]
    ];

    const chart = new uPlot(opts, initialData, containerRef.current);
    chartRef.current = chart;

    // Fast polling loop using requestAnimationFrame (60Hz visual updates)
    let active = true;
    const updateLoop = () => {
      if (!active) return;

      const snapshot = telemetryRingBuffer.getSnapshot();
      if (snapshot.length > 0 && chartRef.current) {
        const xData: number[] = [];
        const seriesData: number[][] = Array.from({ length: 7 }, () => []);

        snapshot.forEach((frame) => {
          xData.push(frame.timestampMs / 1000);
          const angles = frame.jointAngles || [];
          for (let j = 0; j < 7; j++) {
            const angleDeg = angles[j] ?? 0;
            seriesData[j].push(degToRad(angleDeg));
          }
        });

        // Set the new data
        chartRef.current.setData([xData, ...seriesData]);
      }

      requestAnimationFrame(updateLoop);
    };

    requestAnimationFrame(updateLoop);

    // Responsive chart resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        if (chartRef.current) {
          chartRef.current.setSize({ width, height: 280 });
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

  // Update series visibility on uPlot when React legend state changes
  const toggleSeries = (index: number) => {
    setVisibleSeries((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      
      // Update uPlot series show state imperatively
      if (chartRef.current) {
        // uPlot series index is 1-based (index 0 is x/Time series)
        chartRef.current.setSeries(index + 1, { show: next[index] });
      }
      
      return next;
    });
  };

  return (
    <Card className="glass-panel p-5 flex flex-col gap-4 w-full">
      <CardHeader className="flex flex-row items-center justify-between p-0">
        <CardTitle className="text-xs">7-DOF JOINT STATE SCROLL (RAD)</CardTitle>
        <span className="text-[9px] text-text-muted font-mono bg-white/5 px-2 py-0.5 rounded">
          uPlot Engine: 200 Hz
        </span>
      </CardHeader>

      <CardContent className="p-0 flex flex-col gap-4">
        {/* Canvas container for uPlot chart */}
        <div id="joint-angle-chart-container" ref={containerRef} className="w-full h-[280px]" />

        {/* Custom interactive legend */}
        <div className="flex flex-wrap gap-2.5 justify-center mt-2 border-t border-white/5 pt-3">
          {JOINT_NAMES.map((name, i) => {
            const isVisible = visibleSeries[i];
            return (
              <button
                key={i}
                onClick={() => toggleSeries(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                  isVisible 
                    ? 'bg-white/5 hover:bg-white/10' 
                    : 'bg-black/40 text-text-muted border-white/5 opacity-50'
                }`}
                style={{
                  borderColor: isVisible ? `${SERIES_COLORS[i]}40` : undefined,
                }}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isVisible ? SERIES_COLORS[i] : '#53647c',
                  }}
                />
                <span className={isVisible ? 'text-text-primary' : 'text-text-muted'}>
                  J{i}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
