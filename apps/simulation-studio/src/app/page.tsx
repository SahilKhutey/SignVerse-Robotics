import DigitalTwinViewport from '../components/DigitalTwinViewport';
import { Activity } from 'lucide-react';

export default function SimulationPage() {
  return (
    <main className="w-screen h-screen flex flex-col overflow-hidden bg-[#050505]">
      <header className="h-14 border-b border-[#222] flex items-center px-6 justify-between bg-black z-10">
        <div className="flex items-center gap-3 text-emerald-500 font-bold tracking-widest text-sm">
          <Activity size={18} /> SIGN-VERSE SIMULATION STUDIO
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
          <span>ENGINE: WebGL / R3F</span>
          <span className="px-2 py-1 bg-[#111] rounded text-emerald-400 border border-emerald-900">60 FPS</span>
        </div>
      </header>
      
      <div className="flex-1 relative">
        <DigitalTwinViewport />
      </div>
    </main>
  );
}
