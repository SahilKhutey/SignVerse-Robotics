import React from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { Cpu, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function RobotList() {
  const connectedRobots = useTelemetryStore((state) => state.connectedRobots);
  const activeRobotId = useTelemetryStore((state) => state.activeRobotId);
  const setActiveRobot = useTelemetryStore((state) => state.setActiveRobot);
  const wsState = useTelemetryStore((state) => state.wsState);
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);

  return (
    <div className="glass-panel p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Cpu size={18} className="text-accent-cyan" />
        <h2 className="font-display text-sm font-semibold tracking-wider text-text-primary">
          CONNECTED FLEET NODES
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {connectedRobots.map((id) => {
          const isActive = id === activeRobotId;
          return (
            <button
              key={id}
              onClick={() => setActiveRobot(id)}
              className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                isActive
                  ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan'
                  : 'bg-white/2 border-white/5 text-text-secondary hover:bg-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isEstopTriggered
                      ? 'bg-accent-red animate-pulse'
                      : wsState === 'DEAD' || wsState === 'IDLE'
                      ? 'bg-text-muted'
                      : 'bg-accent-green'
                  }`}
                />
                <div>
                  <div className="font-display text-xs font-bold tracking-wide">
                    {id.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono">
                    Type: Anthropomorphic manipulator
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEstopTriggered && isActive ? (
                  <AlertTriangle size={14} className="text-accent-red" />
                ) : (
                  <ShieldCheck size={14} className="text-text-muted" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
