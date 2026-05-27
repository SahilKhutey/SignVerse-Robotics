import { DigitalTwinViewport } from '@/components/DigitalTwinViewport';

export default function SimulationStudioPage() {
  return (
    <main className="w-full h-screen relative">
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-4 py-2 rounded font-mono text-sm border border-[#333]">
        DIGITAL TWIN: SYNCING...
      </div>
      <DigitalTwinViewport />
    </main>
  );
}
