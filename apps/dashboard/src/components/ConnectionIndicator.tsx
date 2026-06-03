import React from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { RefreshCw, Radio, PowerOff, AlertOctagon } from 'lucide-react';

export default function ConnectionIndicator() {
  const wsState = useTelemetryStore((state) => state.wsState);
  const hz = useTelemetryStore((state) => state.hz);
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);

  const getStatusConfig = () => {
    if (isEstopTriggered) {
      return {
        dotClass: 'bg-accent-red shadow-[0_0_10px_rgba(255,51,102,0.8)] animate-pulse',
        text: 'EMERGENCY HALT',
        textClass: 'text-accent-red font-bold',
        icon: <AlertOctagon size={14} className="text-accent-red animate-bounce" />,
      };
    }

    switch (wsState) {
      case 'CONNECTING':
        return {
          dotClass: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse',
          text: 'CONNECTING',
          textClass: 'text-amber-500',
          icon: <RefreshCw size={14} className="text-amber-500 animate-spin" />,
        };
      case 'RECONNECTING':
        return {
          dotClass: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-ping',
          text: 'RECONNECTING',
          textClass: 'text-amber-500 font-semibold',
          icon: <RefreshCw size={14} className="text-amber-500 animate-spin" />,
        };
      case 'LIVE':
        return {
          dotClass: 'bg-accent-green shadow-[0_0_12px_rgba(57,255,20,0.8)]',
          text: 'LIVE',
          textClass: 'text-accent-green font-bold tracking-wider',
          icon: <Radio size={14} className="text-accent-green animate-pulse" />,
        };
      case 'DEAD':
        return {
          dotClass: 'bg-red-700 shadow-[0_0_10px_rgba(185,28,28,0.6)]',
          text: 'CONN DEAD',
          textClass: 'text-red-600 font-bold',
          icon: <PowerOff size={14} className="text-red-600" />,
        };
      case 'IDLE':
      default:
        return {
          dotClass: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]',
          text: 'OFFLINE',
          textClass: 'text-text-muted',
          icon: <PowerOff size={14} className="text-text-muted" />,
        };
    }
  };

  const config = getStatusConfig();

  const renderDot = () => {
    if (isEstopTriggered) {
      return <span className="w-2 h-2 rounded-full bg-accent-red shadow-[0_0_10px_rgba(255,51,102,0.8)] animate-pulse" />;
    }

    switch (wsState) {
      case 'CONNECTING':
        return (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
          </span>
        );
      case 'RECONNECTING':
        return <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse-fast" />;
      case 'LIVE':
        return <span className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_12px_rgba(57,255,20,0.8)] animate-breathe" />;
      case 'DEAD':
        return <span className="w-2 h-2 rounded-full bg-red-700 shadow-[0_0_10px_rgba(185,28,28,0.6)]" />;
      case 'IDLE':
      default:
        return <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]" />;
    }
  };

  return (
    <div 
      className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={`Connection Status: ${config.text} ${wsState === 'LIVE' ? `${hz} Hertz` : ''}`}
    >
      <div className="flex items-center gap-2">
        {renderDot()}
        <span className={`font-display text-[10px] uppercase tracking-wider ${config.textClass}`}>
          {config.text}
        </span>
      </div>

      {wsState === 'LIVE' && !isEstopTriggered && (
        <>
          <span className="w-[1px] h-3 bg-white/10" />
          <span className="font-mono text-[10px] text-accent-cyan font-bold tracking-wide">
            {hz} Hz
          </span>
        </>
      )}
      
      <span className="flex-shrink-0 ml-1 flex items-center">{config.icon}</span>
    </div>
  );
}

