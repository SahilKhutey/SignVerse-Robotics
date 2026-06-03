import React from 'react';
import CommandUI from '../components/CommandUI';
import { Terminal, AlertTriangle } from 'lucide-react';

export default function CommandPage() {
  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6 bg-[#07080a]">
      {/* Page Header */}
      <div className="flex flex-col gap-1 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-accent-cyan" />
          <h2 className="font-display text-sm font-bold tracking-wider text-text-primary uppercase">
            NLP Command Interface
          </h2>
        </div>
        <p className="text-[10px] text-text-secondary">
          Translate operator natural language voice/text commands into parameter-mapped robotic motion primitives.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Col: Conversational Chat Control Thread */}
        <div className="lg:col-span-2">
          <CommandUI />
        </div>

        {/* Right Col: System parameters */}
        <div className="flex flex-col gap-6">
          {/* Model Status parameters */}
          <div className="glass-panel p-5 flex flex-col gap-4 select-none">
            <span className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
              NLP PARSING PIPELINE
            </span>

            <div className="flex flex-col gap-3 font-mono text-[10px]">
              <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-text-secondary">MODEL ON-DISK:</span>
                <span className="text-accent-cyan font-bold">BERT-Mini-Robot-v2</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-text-secondary">INFERENCE DEVICE:</span>
                <span className="text-accent-violet font-bold">CUDA / RTX 4070</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-text-secondary">AVERAGE LATENCY:</span>
                <span className="text-accent-green font-bold">14.2ms</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-text-secondary">CONFIDENCE THRESHOLD:</span>
                <span className="text-text-primary">85%</span>
              </div>
            </div>
          </div>

          {/* Safety disclaimer */}
          <div className="glass-panel p-5 border-amber-500/25 bg-amber-500/5 flex flex-col gap-2.5 select-none">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <span className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
                PRIMITIVE CONFLICT CHECKER
              </span>
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed">
              If an incoming command attempts a movement outside the active robot node safety bounds, the trajectory interpreter will block execution and issue a safety exception log.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
