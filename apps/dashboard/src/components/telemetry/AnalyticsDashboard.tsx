import React, { useEffect, useState } from 'react';
import { useNotificationsStore } from '../../store/notifications';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, ShieldAlert, BarChart3, Clock, Flame, Check } from 'lucide-react';

interface SessionItem {
  id: string;
  label: string;
  duration: number;
  frame_count: number;
  date: string;
}

interface ComparedSessionData {
  id: string;
  label: string;
  duration: number;
  avgVelocity: number;
  smoothness: number;
}

export default function AnalyticsDashboard() {
  const addLog = useNotificationsStore((state) => state.addLog);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparedData, setComparedData] = useState<ComparedSessionData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/sessions', {
          headers: { 'X-API-Key': 'signverse_local_dev_key' }
        });
        if (!response.ok) throw new Error('Offline');
        const data = await response.json();
        if (data.status === 'success') {
          setSessions(data.sessions || []);
          // Default select the first 2-3 sessions if available
          if (data.sessions && data.sessions.length > 0) {
            setSelectedIds(data.sessions.slice(0, 3).map((s: any) => s.id));
          }
        }
      } catch (err) {
        // Fallback mock sessions
        const mock = [
          { id: '1', label: 'grasp_red_block_grasp', duration: 12.4, frame_count: 744, date: '2026-06-03 10:14:15' },
          { id: '2', label: 'wave_hand_custom', duration: 8.5, frame_count: 510, date: '2026-06-03 10:10:05' }
        ];
        setSessions(mock);
        setSelectedIds(mock.map(s => s.id));
      }
    };
    fetchSessions();
  }, []);

  // Compute metrics for selected sessions
  useEffect(() => {
    if (selectedIds.length === 0) {
      setComparedData([]);
      return;
    }

    const calculateMetrics = async () => {
      setLoading(true);
      const results: ComparedSessionData[] = [];

      for (const id of selectedIds) {
        const sessionMeta = sessions.find((s) => s.id === id);
        if (!sessionMeta) continue;

        try {
          const response = await fetch(`http://localhost:8000/api/sessions/${id}/frames`, {
            headers: { 'X-API-Key': 'signverse_local_dev_key' }
          });
          const data = await response.json();
          if (data.status === 'success' && data.frames) {
            const frames = data.frames;
            
            // Calculate joint velocities and accelerations
            let totalVel = 0;
            let velCount = 0;
            let accelDiffSum = 0;
            let accelCount = 0;
            let lastV = [0, 0, 0];

            for (let i = 1; i < frames.length; i++) {
              const dt = (frames[i].ts - frames[i - 1].ts) || 0.016;
              const jPrev = frames[i - 1].action;
              const jCurr = frames[i].action;

              if (jPrev && jCurr && jPrev.length >= 3 && jCurr.length >= 3) {
                const v = [
                  Math.abs(jCurr[0] - jPrev[0]) / dt,
                  Math.abs(jCurr[1] - jPrev[1]) / dt,
                  Math.abs(jCurr[2] - jPrev[2]) / dt
                ];
                
                const avgVFrame = (v[0] + v[1] + v[2]) / 3;
                totalVel += avgVFrame;
                velCount++;

                if (i > 1) {
                  const accelDiff = [
                    Math.abs(v[0] - lastV[0]) / dt,
                    Math.abs(v[1] - lastV[1]) / dt,
                    Math.abs(v[2] - lastV[2]) / dt
                  ];
                  accelDiffSum += (accelDiff[0] + accelDiff[1] + accelDiff[2]) / 3;
                  accelCount++;
                }
                lastV = v;
              }
            }

            const avgVelocity = velCount > 0 ? totalVel / velCount : 0;
            // Smoothness: inverse of average acceleration changes, mapped to 0-100 scale
            const avgJerk = accelCount > 0 ? accelDiffSum / accelCount : 0;
            const smoothness = Math.max(20, Math.min(100, Math.round(100 - (avgJerk * 0.05))));

            results.push({
              id,
              label: sessionMeta.label.length > 18 ? sessionMeta.label.substring(0, 15) + '...' : sessionMeta.label,
              duration: sessionMeta.duration,
              avgVelocity: Math.round(avgVelocity * 10) / 10,
              smoothness
            });
          }
        } catch (err) {
          // If offline, yield mock metrics
          const mockSmoothness = id === '1' ? 84 : 92;
          const mockAvgVel = id === '1' ? 32.4 : 22.8;
          results.push({
            id,
            label: sessionMeta.label,
            duration: sessionMeta.duration,
            avgVelocity: mockAvgVel,
            smoothness: mockSmoothness
          });
        }
      }

      setComparedData(results);
      setLoading(false);
    };

    calculateMetrics();
  }, [selectedIds, sessions]);

  const handleCheckboxToggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 5) {
        addLog('⚠️ Max comparison limit reached: select 3–5 sessions.', 'warn');
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-5 border border-white/5 bg-black/20">
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-accent-cyan" />
          <h2 className="font-display text-sm font-semibold tracking-wider text-text-primary uppercase">
            MULTI-SESSION COMPARISON DASHBOARD
          </h2>
        </div>
        <span className="text-[10px] text-text-secondary font-mono">
          Select 3–5 sessions to benchmark
        </span>
      </div>

      {/* Select checklist */}
      <div className="flex flex-wrap gap-2.5 bg-black/40 border border-white/5 p-3 rounded-lg select-none">
        {sessions.map((session) => {
          const checked = selectedIds.includes(session.id);
          return (
            <label
              key={session.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-all ${
                checked
                  ? 'bg-accent-cyan/10 border-accent-cyan/40 text-accent-cyan'
                  : 'bg-white/2 border-white/5 text-text-secondary hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleCheckboxToggle(session.id)}
                className="hidden"
              />
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                checked ? 'border-accent-cyan bg-accent-cyan text-black' : 'border-white/20'
              }`}>
                {checked && <Check size={10} strokeWidth={3} />}
              </div>
              <span className="font-mono">{session.label}.h5 ({session.duration}s)</span>
            </label>
          );
        })}
        {sessions.length === 0 && (
          <span className="text-[9px] text-text-muted font-mono py-1">No recorded telemetry sessions in database.</span>
        )}
      </div>

      {loading ? (
        <div className="h-[200px] flex flex-col gap-2 items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mb-1" />
          <span className="font-mono text-[8px] uppercase tracking-widest text-text-secondary animate-pulse">
            Benchmarking kinematics datasets...
          </span>
        </div>
      ) : comparedData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Trajectory Smoothness */}
          <div className="flex flex-col gap-2 bg-black/30 border border-white/5 p-3.5 rounded-xl h-[230px]">
            <span className="font-display text-[9px] font-bold text-text-primary uppercase tracking-wide">
              Trajectory Smoothness (0-100)
            </span>
            <div className="flex-1 min-h-0 text-[8px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" opacity={0.3} />
                  <XAxis dataKey="label" stroke="#718096" />
                  <YAxis domain={[0, 100]} stroke="#718096" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#07080a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                    labelStyle={{ color: '#00f0ff', fontSize: '9px', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="smoothness" fill="#7822ec" radius={[4, 4, 0, 0]} name="Smoothness" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Average Velocity */}
          <div className="flex flex-col gap-2 bg-black/30 border border-white/5 p-3.5 rounded-xl h-[230px]">
            <span className="font-display text-[9px] font-bold text-text-primary uppercase tracking-wide">
              Average Velocity (deg/s)
            </span>
            <div className="flex-1 min-h-0 text-[8px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" opacity={0.3} />
                  <XAxis dataKey="label" stroke="#718096" />
                  <YAxis stroke="#718096" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#07080a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                    labelStyle={{ color: '#00f0ff', fontSize: '9px', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="avgVelocity" fill="#00f0ff" radius={[4, 4, 0, 0]} name="Avg Velocity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Task Completion Time */}
          <div className="flex flex-col gap-2 bg-black/30 border border-white/5 p-3.5 rounded-xl h-[230px]">
            <span className="font-display text-[9px] font-bold text-text-primary uppercase tracking-wide">
              Task Completion Time (secs)
            </span>
            <div className="flex-1 min-h-0 text-[8px] font-mono">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" opacity={0.3} />
                  <XAxis dataKey="label" stroke="#718096" />
                  <YAxis stroke="#718096" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#07080a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                    labelStyle={{ color: '#00f0ff', fontSize: '9px', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="duration" fill="#10b981" radius={[4, 4, 0, 0]} name="Duration" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-text-muted font-mono bg-black/20 border border-white/5 p-8 rounded-lg text-center leading-relaxed">
          Select at least 1 session to compile trajectory benchmark charts.
        </div>
      )}
    </div>
  );
}
