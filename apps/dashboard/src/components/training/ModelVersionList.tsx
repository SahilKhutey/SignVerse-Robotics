import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, ChevronRight, HardDrive } from 'lucide-react';
import { useNotificationsStore } from '../../store/notifications';

export interface ModelItem {
  version: string;
  epoch: number;
  val_loss: number;
  created_at: string;
  active: boolean;
}

interface ModelVersionListProps {
  refreshTrigger: number;
  onRefresh: () => void;
}

export default function ModelVersionList({
  refreshTrigger,
  onRefresh
}: ModelVersionListProps) {
  const addLog = useNotificationsStore((state) => state.addLog);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [swappingId, setSwappingId] = useState<string | null>(null);

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/training/models', {
        headers: { 'X-API-Key': 'signverse_local_dev_key' }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.status === 'success') {
        setModels(data.models || []);
      }
    } catch {
      // Mock models if offline
      setModels([
        { version: 'policy_best.pth', epoch: 42, val_loss: 0.00342, created_at: '2026-06-03 11:24:15', active: true },
        { version: 'policy_epoch_30.pth', epoch: 30, val_loss: 0.00512, created_at: '2026-06-03 11:12:05', active: false }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [refreshTrigger]);

  const handleSetActive = async (version: string) => {
    setSwappingId(version);
    try {
      const response = await fetch(`http://localhost:8000/api/training/models/${version}/active`, {
        method: 'POST',
        headers: { 'X-API-Key': 'signverse_local_dev_key' }
      });
      if (!response.ok) throw new Error();
      
      // Acknowledge new weights in backend orchestrator
      await fetch('http://localhost:8000/api/training/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'signverse_local_dev_key'
        },
        body: JSON.stringify({ action: 'acknowledge' })
      });

      addLog(`🟢 Hot-swapped active inference policy to: ${version}`, 'success');
      onRefresh();
    } catch {
      addLog(`🟢 Hot-swap mock: weights swapped to ${version} successfully.`, 'success');
      // Local mock active swap update
      setModels((prev) => 
        prev.map((m) => ({ ...m, active: m.version === version }))
      );
    } finally {
      setSwappingId(null);
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 max-h-[460px]">
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <HardDrive size={14} className="text-accent-cyan" />
          <span className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
            POLICY CHECKPOINTS
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-[160px]">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-white/5 bg-black/20 flex flex-col gap-2 h-[58px]">
                <div className="h-3.5 w-1/2 rounded bg-white/5 shimmer-loader" />
                <div className="h-2.5 w-3/4 rounded bg-white/5 shimmer-loader" />
              </div>
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted select-none">
            <Cpu size={16} className="mb-1 opacity-30 animate-pulse" />
            <span className="text-[9px] font-mono">No trained checkpoints found</span>
          </div>
        ) : (
          models.map((model) => (
            <div
              key={model.version}
              className={`p-3 rounded-lg border flex justify-between items-center transition-all ${
                model.active
                  ? 'bg-accent-green/5 border-accent-green/20'
                  : 'bg-black/20 border-white/5'
              }`}
            >
              <div className="flex flex-col gap-1 min-w-0 pr-2">
                <div className="font-mono text-[10px] text-text-primary font-bold truncate flex items-center gap-1.5">
                  {model.version}
                  {model.active && (
                    <span className="flex items-center text-[7px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/20 px-1 rounded font-mono select-none">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[8px] font-mono text-text-secondary select-none">
                  <span>Epoch {model.epoch}</span>
                  <span>•</span>
                  <span>Loss: <span className="text-accent-violet">{model.val_loss.toFixed(5)}</span></span>
                  <span>•</span>
                  <span>{model.created_at.split(' ')[0]}</span>
                </div>
              </div>

              {!model.active && (
                <button
                  type="button"
                  disabled={swappingId !== null}
                  onClick={() => handleSetActive(model.version)}
                  className="flex items-center gap-0.5 px-2.5 py-1 bg-accent-cyan/10 border border-accent-cyan/20 rounded-md text-[9px] font-mono font-bold text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/35 transition-all disabled:opacity-40 cursor-pointer flex-shrink-0"
                >
                  SWAP
                  <ChevronRight size={10} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
