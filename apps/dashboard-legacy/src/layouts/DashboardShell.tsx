'use client';
import React from 'react';
import { Activity, ShieldAlert, Cpu } from 'lucide-react';
import { useRealtimeStream } from 'api-contracts';

export function DashboardShell({ children }: { children?: React.ReactNode }) {
  const aiStream = useRealtimeStream('ws://localhost:3000/ws/ai-inference');
  const robStream = useRealtimeStream('ws://localhost:3000/ws/telemetry');

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col">
        <div className="p-6 border-b border-neutral-800">
          <h1 className="text-xl font-black tracking-tighter text-emerald-500">SIGN-VERSE</h1>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Command Center</p>
        </div>
        <div className="p-4 flex-1 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 bg-neutral-800/50 rounded-lg text-emerald-400 border border-emerald-900/50 cursor-pointer">
            <Activity size={18} />
            <span className="text-sm font-semibold">Live Telemetry</span>
          </div>
        </div>
        
        {/* Real-time SDK Status */}
        <div className="p-6 border-t border-neutral-800 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400">AI GATEWAY</span>
            <span className={aiStream.isConnected ? "text-emerald-500" : "text-red-500"}>
              {aiStream.isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400">ROBOT BUS</span>
            <span className={robStream.isConnected ? "text-emerald-500" : "text-red-500"}>
              {robStream.isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-neutral-800 rounded-full text-xs font-mono border border-neutral-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {aiStream.data ? `Gesture: ${aiStream.data.gesture}` : "AWAITING SIGNAL"}
            </div>
          </div>
        </header>
        
        {children ? (
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        ) : (
          <div className="flex-1 p-6 grid grid-cols-12 gap-6">
            <div className="col-span-8 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="px-3 py-1 bg-black/50 backdrop-blur-md rounded border border-neutral-800 text-xs font-mono text-neutral-400">
                  CAM_01 [RGB_DEPTH]
                </div>
              </div>
              
              {/* Real SDK Vision Output */}
              {aiStream.data ? (
                  <div className="w-full h-full flex items-center justify-center border-4 border-emerald-900/30 text-emerald-500 font-mono">
                      [LIVE VISION INGESTION ACTIVE] <br/>
                      BBox: {JSON.stringify(aiStream.data.bounding_boxes)}
                  </div>
              ) : (
                  <div className="text-neutral-600 font-mono tracking-widest flex items-center gap-3">
                    <ShieldAlert size={20} />
                    NO SIGNAL DETECTED
                  </div>
              )}
            </div>
            
            <div className="col-span-4 space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                    <Cpu size={16} className="text-emerald-500" />
                    Robotics Kinematics
                  </h3>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                    <span className="text-neutral-500">JOINT 0 (Base)</span>
                    <span className="text-emerald-400">{robStream.data ? robStream.data.joints.J0.toFixed(2) : "0.00"}°</span>
                  </div>
                  <div className="flex justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                    <span className="text-neutral-500">JOINT 1 (Shoulder)</span>
                    <span className="text-emerald-400">{robStream.data ? robStream.data.joints.J1.toFixed(2) : "0.00"}°</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
