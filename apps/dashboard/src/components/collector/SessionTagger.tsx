import React from 'react';
import { Tag } from 'lucide-react';
import { useTelemetryStore } from '../../store/telemetry';

interface SessionTaggerProps {
  label: string;
  setLabel: (val: string) => void;
  motionType: string;
  setMotionType: (val: string) => void;
}

const MOTION_CATEGORIES = [
  { value: 'reach', label: 'Reach Forward' },
  { value: 'grasp', label: 'Object Grasp' },
  { value: 'place', label: 'Deposit/Place' },
  { value: 'home', label: 'Homing Sequence' },
  { value: 'custom', label: 'Custom Freeform' }
];

export default function SessionTagger({
  label,
  setLabel,
  motionType,
  setMotionType
}: SessionTaggerProps) {
  const isRecording = useTelemetryStore((state) => state.isRecording);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-1.5 text-text-primary">
        <Tag size={12} className="text-accent-cyan" />
        <span className="font-display text-[10px] font-bold tracking-wider uppercase select-none">
          SESSION DIRECTORY TAGGING
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Session directory text label */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[8px] text-text-muted uppercase select-none font-mono">
            Session File Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            disabled={isRecording}
            placeholder="e.g. reach_left_block"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-sans text-text-primary focus:outline-none focus:border-accent-cyan disabled:text-text-muted transition-all"
          />
        </div>

        {/* Dropdown primitive type selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[8px] text-text-muted uppercase select-none font-mono">
            Motion Primitive Category
          </label>
          <select
            value={motionType}
            onChange={(e) => setMotionType(e.target.value)}
            disabled={isRecording}
            className="bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-xs font-sans text-text-primary focus:outline-none focus:border-accent-cyan w-full cursor-pointer disabled:text-text-muted transition-all"
          >
            {MOTION_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
