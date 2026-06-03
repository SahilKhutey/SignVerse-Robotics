import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useLearningStore } from '../../store/learning';

export default function LiveAccuracySparkline() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  const accuracyHistory = useLearningStore((state) => state.accuracyHistory);

  useEffect(() => {
    // Connect to WebSocket events and load initial data
    const store = useLearningStore.getState();
    store.connectLearningEvents();
    store.fetchStatus();
    store.fetchReplayBuffer();
    store.fetchForgettingMonitor();

    if (!containerRef.current) return;

    // Determine current color based on trend
    let strokeColor = '#39ff14'; // default green
    if (accuracyHistory.length >= 2) {
      const first = accuracyHistory[0].accuracy;
      const last = accuracyHistory[accuracyHistory.length - 1].accuracy;
      strokeColor = last >= first ? '#39ff14' : '#ff3366';
    }

    const opts: uPlot.Options = {
      width: 120,
      height: 24,
      legend: { show: false },
      cursor: { show: false },
      axes: [],
      padding: [0, 0, 0, 0],
      scales: {
        x: { time: false },
        y: { range: [0.0, 1.0] } // Validation accuracy ranges from 0 to 1
      },
      series: [
        {},
        {
          stroke: strokeColor,
          width: 1.5,
          points: { show: false }
        }
      ]
    };

    const xData = accuracyHistory.length > 0 ? accuracyHistory.map(h => h.step) : [0];
    const yData = accuracyHistory.length > 0 ? accuracyHistory.map(h => h.accuracy) : [0.85]; // center baseline
    const data: uPlot.AlignedData = [xData, yData];

    const chart = new uPlot(opts, data, containerRef.current);
    chartRef.current = chart;

    return () => {
      const currentStore = useLearningStore.getState();
      currentStore.disconnectLearningEvents();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  // Update chart data and series stroke color when history updates
  useEffect(() => {
    if (!chartRef.current || accuracyHistory.length === 0) return;

    const first = accuracyHistory[0].accuracy;
    const last = accuracyHistory[accuracyHistory.length - 1].accuracy;
    const strokeColor = last >= first ? '#39ff14' : '#ff3366';

    const xData = accuracyHistory.map(h => h.step);
    const yData = accuracyHistory.map(h => h.accuracy);

    // Update series stroke color and redraw
    const series = chartRef.current.series[1] as any;
    if (series) {
      series.stroke = strokeColor;
    }
    chartRef.current.setData([xData, yData]);
  }, [accuracyHistory]);

  const latestAccuracy = accuracyHistory.length > 0 
    ? (accuracyHistory[accuracyHistory.length - 1].accuracy * 100).toFixed(1) 
    : '0.0';

  const isUptrend = accuracyHistory.length >= 2
    ? accuracyHistory[accuracyHistory.length - 1].accuracy >= accuracyHistory[0].accuracy
    : true;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-lg h-[32px]">
      <div className="flex flex-col justify-center select-none leading-none">
        <span className="text-[7px] font-display tracking-widest text-text-muted uppercase">ONLINE ACC</span>
        <span className={`text-[10px] font-mono font-bold ${isUptrend ? 'text-accent-green' : 'text-accent-red'}`}>
          {latestAccuracy}%
        </span>
      </div>
      <div ref={containerRef} className="w-[120px] h-[24px]" />
    </div>
  );
}
