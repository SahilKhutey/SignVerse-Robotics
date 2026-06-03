import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetry';
import { wsClient } from '../../lib/wsClient';
import { WifiOff, ShieldAlert, RotateCw, Copy, Check, Terminal, ExternalLink, HelpCircle } from 'lucide-react';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[8px] font-mono text-accent-cyan hover:text-text-primary tracking-wider transition-all active:scale-95 flex items-center gap-1 cursor-pointer focus:outline-none"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={9} className="text-accent-green" />
          <span>COPIED!</span>
        </>
      ) : (
        <>
          <Copy size={9} />
          <span>COPY</span>
        </>
      )}
    </button>
  );
};

export const OfflineOverlay: React.FC = () => {
  const wsState = useTelemetryStore((state) => state.wsState);
  const [countdown, setCountdown] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [maxAttempts, setMaxAttempts] = useState<number>(6);

  useEffect(() => {
    if (wsState !== 'RECONNECTING' && wsState !== 'DEAD') {
      return;
    }

    const currentAttempts = wsClient.getReconnectAttempts();
    const currentMaxAttempts = wsClient.getMaxReconnectAttempts();
    setAttempts(currentAttempts);
    setMaxAttempts(currentMaxAttempts);

    if (wsState === 'RECONNECTING') {
      const delayMs = wsClient.getNextReconnectDelay();
      const seconds = Math.ceil(delayMs / 1000);
      setCountdown(seconds);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [wsState, wsState === 'RECONNECTING' ? wsClient.getReconnectAttempts() : 0]);

  if (wsState !== 'RECONNECTING' && wsState !== 'DEAD') {
    return null;
  }

  const handleManualReconnect = () => {
    console.log('[UI] Manual connection retry triggered.');
    wsClient.connect();
  };

  const totalDelaySeconds = Math.ceil(wsClient.getNextReconnectDelay() / 1000);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07080a]/90 backdrop-blur-xl transition-all duration-500 overflow-y-auto p-4 md:p-6">
      <div className="absolute inset-0 bg-radial-gradient from-accent-red/5 to-transparent pointer-events-none" />
      
      <div className="glass-panel w-full max-w-4xl p-6 md:p-8 border border-accent-red/20 shadow-2xl relative flex flex-col lg:flex-row gap-8 items-stretch overflow-hidden">
        {/* Animated warning bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-red via-yellow-500 to-accent-red animate-pulse" />
        
        {/* LEFT COLUMN: Connection Status */}
        <div className="flex-1 flex flex-col items-center justify-center text-center pb-6 lg:pb-0 lg:pr-8 lg:border-r border-white/5">
          {/* Status Icon */}
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full bg-accent-red/10 border border-accent-red/30 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-accent-red animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-accent-red"></span>
            </span>
          </div>

          {/* Header */}
          <h1 className="text-2xl font-display font-bold text-text-primary tracking-widest uppercase mb-1">
            GATEWAY OFFLINE
          </h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-accent-red/10 border border-accent-red/20 text-accent-red text-[9px] font-mono mb-4 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-ping" />
            WS_STATE: {wsState}
          </div>

          {/* Details */}
          <p className="text-[11px] text-text-secondary max-w-sm mb-5 leading-relaxed">
            Operator Console lost link connection with FastAPI backend. Real-time digital twin monitoring and actuator primary pipelines are halted.
          </p>

          {/* Retry Module */}
          <div className="w-full bg-black/40 border border-white/5 rounded-xl p-4 mb-4">
            {wsState === 'RECONNECTING' ? (
              <div>
                <p className="text-xs text-text-primary font-medium mb-1.5 select-none">
                  Automatic retry in <span className="text-lg font-display font-bold text-accent-cyan animate-pulse">{countdown}s</span>
                </p>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mb-2 border border-white/5 select-none">
                  <div 
                    className="bg-accent-cyan h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${totalDelaySeconds > 0 ? (countdown / totalDelaySeconds) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[9px] text-text-muted font-mono select-none">
                  Attempt {attempts} of {maxAttempts} (exponential delay)
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-accent-red font-semibold mb-1 select-none">
                  MAX RECONNECT ATTEMPTS EXCEEDED
                </p>
                <p className="text-[9px] text-text-muted mb-2 max-w-xs mx-auto select-none">
                  Automatic retry cycles paused. Ensure the FastAPI system server is initialized.
                </p>
              </div>
            )}

            <button
              onClick={handleManualReconnect}
              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-cyan text-[10px] font-display font-bold tracking-wider text-text-primary hover:text-accent-cyan transition-all active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            >
              <RotateCw className="h-3 w-3 animate-spin-slow" />
              RECONNECT NOW
            </button>
          </div>

          {/* E-Stop Emergency Safety Warning */}
          <div className="w-full bg-accent-red/5 border border-accent-red/20 rounded-xl p-3.5 flex gap-3 text-left">
            <ShieldAlert className="h-5 w-5 text-accent-red flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[10px] uppercase font-bold text-accent-red tracking-wider mb-0.5 select-none">
                Safety Lock Protocol Active
              </h4>
              <p className="text-[9px] text-text-secondary leading-relaxed font-mono">
                Robotic driver edge entered protective safety lock. Motors halted. Maintain physical clearance of the arm.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Onboarding setup wizard */}
        <div className="flex-1 flex flex-col justify-center gap-4">
          <div className="flex items-center gap-2 select-none border-b border-white/5 pb-2">
            <HelpCircle size={16} className="text-accent-cyan" />
            <h2 className="font-display text-xs font-bold tracking-widest text-text-primary uppercase">
              First-Run Onboarding Guide
            </h2>
          </div>

          <p className="text-[10px] text-text-secondary leading-relaxed mb-1 select-none">
            If you are running the platform for the first time, follow these steps to configure the backend robotics API and establish telemetry pipelines:
          </p>

          <div className="flex flex-col gap-3 font-sans">
            {/* Step 1 */}
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-lg hover:border-white/10 transition-all">
              <div className="w-5 h-5 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan flex items-center justify-center font-mono text-[9px] font-bold flex-shrink-0 select-none">
                1
              </div>
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide select-none">
                  Install Python Dependencies
                </span>
                <div className="flex justify-between items-center bg-black/60 px-3 py-1.5 rounded border border-white/5 font-mono text-[9px] text-accent-cyan gap-2">
                  <span className="truncate">pip install -r requirements.txt</span>
                  <CopyButton text="pip install -r requirements.txt" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-lg hover:border-white/10 transition-all">
              <div className="w-5 h-5 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan flex items-center justify-center font-mono text-[9px] font-bold flex-shrink-0 select-none">
                2
              </div>
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide select-none">
                  Start FastAPI OS Kernel
                </span>
                <div className="flex justify-between items-center bg-black/60 px-3 py-1.5 rounded border border-white/5 font-mono text-[9px] text-accent-cyan gap-2">
                  <span className="truncate">python start_system.py</span>
                  <CopyButton text="python start_system.py" />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-lg hover:border-white/10 transition-all">
              <div className="w-5 h-5 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan flex items-center justify-center font-mono text-[9px] font-bold flex-shrink-0 select-none">
                3
              </div>
              <div className="flex-1 flex flex-col gap-0.5 select-none">
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide">
                  Connect Peripheral Hardware
                </span>
                <span className="text-[9px] text-text-secondary leading-relaxed">
                  Verify USB WebCam is connected at index 0 and active. Plug in Arduino/ESP32 serial controller bridge if operating physical chassis.
                </span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-3 bg-white/3 border border-white/5 p-3 rounded-lg hover:border-white/10 transition-all">
              <div className="w-5 h-5 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan flex items-center justify-center font-mono text-[9px] font-bold flex-shrink-0 select-none">
                4
              </div>
              <div className="flex-1 flex flex-col gap-1 select-none">
                <span className="text-[10px] font-bold text-text-primary uppercase tracking-wide">
                  Open Operator Command Deck
                </span>
                <span className="text-[9px] text-text-secondary leading-relaxed">
                  FastAPI runs at port <code className="text-accent-cyan font-bold font-mono">8000</code>. Watch ConnectionIndicator reach <span className="text-accent-green font-bold">LIVE</span>.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default OfflineOverlay;
