import React from 'react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Brain, Cpu, Video, Boxes, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface ModelStatusItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'loaded' | 'error' | 'loading';
}

export default function ModelLoadGrid() {
  const { data: status, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="model-load-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-panel p-4 flex flex-col justify-between gap-3 relative h-[105px]">
            <div className="flex gap-3">
              <div className="p-5 rounded-lg bg-white/5 border border-white/5 shimmer-loader w-10 h-10 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-2/3 rounded bg-white/5 shimmer-loader" />
                <div className="h-3 w-5/6 rounded bg-white/5 shimmer-loader" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
              <div className="h-3.5 w-1/4 rounded bg-white/5 shimmer-loader" />
              <div className="h-3.5 w-1/5 rounded bg-white/5 shimmer-loader" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const getModelStatus = (key: 'behavior_cloning' | 'langchain_agent' | 'mediapipe_detector' | 'mujoco_sim'): 'loaded' | 'error' | 'loading' => {

    if (error) return 'error';
    if (isLoading) return 'loading';
    return status?.models?.[key] ?? 'error';
  };

  const modelsList: ModelStatusItem[] = [
    {
      id: 'behavior_cloning',
      name: 'Behavior Cloning MLP',
      description: 'Pre-trained imitation policy model controlling actuators',
      icon: Brain,
      status: getModelStatus('behavior_cloning'),
    },
    {
      id: 'langchain_agent',
      name: 'LangChain Cognitive Agent',
      description: 'Semantic reasoner translating operator instructions',
      icon: Cpu,
      status: getModelStatus('langchain_agent'),
    },
    {
      id: 'mediapipe_detector',
      name: 'MediaPipe Holistic',
      description: 'Real-time hand and body pose tracking pipeline',
      icon: Video,
      status: getModelStatus('mediapipe_detector'),
    },
    {
      id: 'mujoco_sim',
      name: 'MuJoCo Simulator',
      description: 'Physics engine for digital twin replication',
      icon: Boxes,
      status: getModelStatus('mujoco_sim'),
    },
  ];

  const getBadgeVariant = (s: 'loaded' | 'error' | 'loading') => {
    switch (s) {
      case 'loaded': return 'success';
      case 'error': return 'destructive';
      case 'loading': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (s: 'loaded' | 'error' | 'loading') => {
    switch (s) {
      case 'loaded': return <CheckCircle2 size={12} className="text-accent-green" />;
      case 'error': return <AlertTriangle size={12} className="text-accent-red" />;
      case 'loading': return <Loader2 size={12} className="text-accent-cyan animate-spin" />;
      default: return null;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="model-load-grid">
      {modelsList.map((model) => {
        const Icon = model.icon;
        return (
          <Card key={model.id} className="glass-panel p-4 flex flex-col justify-between gap-3 relative hover:translate-y-[-2px] transition-all">
            <div className="flex gap-3">
              <div className={`p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center h-fit ${
                model.status === 'loaded' ? 'text-accent-green' : model.status === 'error' ? 'text-accent-red' : 'text-accent-cyan'
              }`}>
                <Icon size={18} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-[11px] font-bold text-text-primary uppercase tracking-wider">
                  {model.name}
                </span>
                <span className="text-[9px] text-text-secondary leading-relaxed">
                  {model.description}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
              <span className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
                LOAD METRIC:
              </span>
              <div className="flex items-center gap-1.5">
                {getStatusIcon(model.status)}
                <Badge variant={getBadgeVariant(model.status)} className="text-[8px] uppercase tracking-wider px-2 py-0">
                  {model.status}
                </Badge>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
