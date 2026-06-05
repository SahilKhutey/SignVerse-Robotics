import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useOnlineLearningStore } from '../../store/onlineLearning';

export default function LiveAccuracySparkline() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<uPlot | null>(null);
  const accuracyHistory = useOnlineLearningStore((state) => state.accuracyHistory);

  useEffect(() => {
    if (!containerRef.current) return;

    let strokeColor = '#39ff14';
    if (accuracyHistory.length >= 2) {
      const first = accuracyHistory[0].overall;
      const last = accuracyHistory[accuracyHistory.length - 1].overall;
      if (last > first) {
        strokeColor = '#39ff14';
      } else if (last < first) {
        strokeColor = '#ff3366';
      } else {
        strokeColor = '#00f0ff';
      }
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
        y: { range: [0, 1] }
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
    const yData = accuracyHistory.length > 0 ? accuracyHistory.map(h => h.overall) : [0.85];
    const data: uPlot.AlignedData = [xData, yData];

    const chart = new uPlot(opts, data, containerRef.current);
    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || accuracyHistory.length === 0) return;

    const first = accuracyHistory[0].overall;
    const last = accuracyHistory[accuracyHistory.length - 1].overall;

    let strokeColor = '#39ff14';
    if (last > first) {
      strokeColor = '#39ff14';
    } else if (last < first) {
      strokeColor = '#ff3366';
    } else {
      strokeColor = '#00f0ff';
    }

    const xData = accuracyHistory.map(h => h.step);
    const yData = accuracyHistory.map(h => h.overall);

    const series = chartRef.current.series[1] as any;
    if (series) {
      series.stroke = strokeColor;
    }

    chartRef.current.setData([xData, yData]);
  }, [accuracyHistory]);

  const latestAccuracy = accuracyHistory.length > 0
    ? (accuracyHistory[accuracyHistory.length - 1].overall * 100).toFixed(1)
    : '0.0';

  const isUptrend = accuracyHistory.length >= 2
    ? accuracyHistory[accuracyHistory.length - 1].overall >= accuracyHistory[0].overall
    : true;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-lg h-[32px] select-none">
      <div className="flex flex-col justify-center leading-none text-left">
        <span className="text-[7px] font-display tracking-widest text-text-muted uppercase">ONLINE ACC</span>
        <span className={`text-[10px] font-mono font-bold ${isUptrend ? 'text-accent-green' : 'text-accent-red'}`}>
          {latestAccuracy}%
        </span>
      </div>
      <div ref={containerRef} className="w-[120px] h-[24px]" />
    </div>
  );
}
