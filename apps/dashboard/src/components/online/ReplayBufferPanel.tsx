import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useOnlineLearningStore } from '../../store/onlineLearning';
import { BufferFillBar } from './BufferFillBar';
import { Layers } from 'lucide-react';

export function ReplayBufferPanel() {
  const setReplaySnapshot = useOnlineLearningStore((state) => state.setReplaySnapshot);

  // Fetch replay buffer data every 30s
  const { data, isLoading } = useQuery({
    queryKey: ['online_replay_buffer'],
    queryFn: () => apiClient.getOnlineReplayBuffer(1, 100),
    refetchInterval: 30000,
  });

  // Track previously seen times_sampled to determine recently sampled cards
  const prevTimesSampled = useRef<Record<string, number>>({});
  const [sampledInLastUpdate, setSampledInLastUpdate] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data?.entries) {
      setReplaySnapshot(data.entries);

      const newlySampled = new Set<string>();
      data.entries.forEach((entry) => {
        const prev = prevTimesSampled.current[entry.session_id];
        if (prev !== undefined && entry.times_sampled > prev) {
          newlySampled.add(entry.session_id);
        }
        prevTimesSampled.current[entry.session_id] = entry.times_sampled;
      });
      setSampledInLastUpdate(newlySampled);
    }
  }, [data, setReplaySnapshot]);

  const entries = data?.entries || [];
  const totalCount = data?.total_count || entries.length;

  // Sort: most recently added first
  const sortedEntries = [...entries].sort((a, b) => b.added_at - a.added_at);

  const formatDate = (timestamp: number) => {
    const ms = timestamp > 1e11 ? timestamp : timestamp * 1000;
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 w-full">
      <BufferFillBar count={totalCount} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-text-primary border-b border-white/5 pb-2">
          <Layers size={13} className="text-accent-cyan" />
          <span className="font-display text-xs font-semibold tracking-wider uppercase select-none">
            REPLAY MEMORY CATALOG
          </span>
        </div>

        {isLoading ? (
          <div className="h-[120px] flex items-center justify-center text-[10px] text-text-muted font-mono">
            Fetching replay snapshots...
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-[10px] text-text-muted font-mono border border-dashed border-white/5 rounded-xl">
            No demonstrations stored in the replay buffer.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 select-none">
            {sortedEntries.map((entry) => {
              const wasRecentlySampled = sampledInLastUpdate.has(entry.session_id);
              const neverSampled = entry.times_sampled === 0;

              return (
                <div
                  key={entry.session_id}
                  className={`flex-shrink-0 w-52 p-4 rounded-xl border bg-black/20 flex flex-col gap-3 transition-all duration-300 ${
                    wasRecentlySampled
                      ? 'border-accent-yellow shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-accent-yellow/5 recently-sampled'
                      : neverSampled
                      ? 'border-white/5 opacity-40 hover:opacity-70'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-bold text-text-primary truncate font-mono">
                      {entry.label}
                    </span>
                    <span className="text-[8px] text-text-muted font-mono leading-none">
                      ID: {entry.session_id.substring(0, 8)}...
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono leading-none border-t border-white/5 pt-3">
                    <div className="flex flex-col gap-1 text-left">
                      <span className="text-[7px] text-text-muted uppercase">Frames</span>
                      <span className="text-accent-cyan font-bold">
                        {entry.frames ? entry.frames.length : 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                      <span className="text-[7px] text-text-muted uppercase">Samples</span>
                      <span className="text-text-secondary font-bold">
                        {entry.times_sampled}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[8px] font-mono text-text-muted leading-none">
                    <span>Added</span>
                    <span>{formatDate(entry.added_at)}</span>
                  </div>

                  {wasRecentlySampled && (
                    <div className="mt-1 text-[8px] font-mono text-accent-yellow text-center font-semibold bg-accent-yellow/10 py-1 rounded">
                      Sampled in last update
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
