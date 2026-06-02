'use client';

import { useState, useEffect, useRef } from 'react';
import { useSignVerseStore } from '../state/signverse-store';

interface ScenarioState {
  status: 'idle' | 'running' | 'completed';
  progress: number;
  logs: string[];
}

export default function DemoMode() {
  const [pipelineActive, setPipelineActive] = useState(false);
  const [activeScenario, setActiveScenario] = useState<number | null>(null);
  
  // Pipeline scenarios state
  const [s1, setS1] = useState<ScenarioState>({ status: 'idle', progress: 0, logs: [] });
  const [s2, setS2] = useState<ScenarioState>({ status: 'idle', progress: 0, logs: [] });
  const [s3, setS3] = useState<ScenarioState>({ status: 'idle', progress: 0, logs: [] });
  const [s4, setS4] = useState<ScenarioState>({ status: 'idle', progress: 0, logs: [] });
  const [s5, setS5] = useState<ScenarioState>({ status: 'idle', progress: 0, logs: [] });
  const [s6, setS6] = useState<ScenarioState>({ status: 'idle', progress: 0, logs: [] });

  // YouTube URL state
  const [ytUrl, setYtUrl] = useState('https://www.youtube.com/watch?v=robotics-training-data');
  const [ytHumans, setYtHumans] = useState(0);

  // Live skeleton joint ticks
  const [tick, setTick] = useState(0);
  
  // Animate skeleton joints for Scenario 1 and Scenario 6
  useEffect(() => {
    let animId: number;
    const updateTick = () => {
      setTick((t) => (t + 1) % 360);
      animId = requestAnimationFrame(updateTick);
    };
    animId = requestAnimationFrame(updateTick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Run the full demo pipeline sequentially
  const runFullPipeline = async () => {
    if (pipelineActive) return;
    setPipelineActive(true);
    
    // Scenario 1: Webcam
    setActiveScenario(1);
    setS1({ status: 'running', progress: 0, logs: ['Initializing Webcam Ingest...', 'Opening video feed...'] });
    for (let i = 0; i <= 100; i += 10) {
      await delay(200);
      setS1(prev => ({
        status: 'running',
        progress: i,
        logs: [...prev.logs, i === 30 ? 'Detected human actor (ID: 01)' : i === 60 ? 'Skeleton fusion complete (33 pose + hands)' : i === 90 ? 'Segmenting actions: Walk -> Reach -> Grasp' : ''].filter(Boolean)
      }));
    }
    setS1(prev => ({ status: 'completed', progress: 100, logs: [...prev.logs, 'Robot ready dataset created and cached.', 'Exported to local DB successfully.'] }));

    // Scenario 2: YouTube
    setActiveScenario(2);
    setS2({ status: 'running', progress: 0, logs: ['Fetching stream from YouTube URL...', 'Extracting keyframes...'] });
    for (let i = 0; i <= 100; i += 20) {
      await delay(150);
      setS2(prev => {
        if (i === 40) setYtHumans(4);
        return {
          status: 'running',
          progress: i,
          logs: [...prev.logs, i === 40 ? 'Found 4 human track IDs' : i === 80 ? 'Classified actions: Walk, Carry, Lift, Place' : ''].filter(Boolean)
        };
      });
    }
    setS2(prev => ({ status: 'completed', progress: 100, logs: [...prev.logs, 'Stored 4 motion tracks in database.'] }));

    // Scenario 3: Motion Reconstruction
    setActiveScenario(3);
    setS3({ status: 'running', progress: 0, logs: ['Initializing 3D Avatar Reconstruction...', 'Mapping joint configurations to bone lengths...'] });
    for (let i = 0; i <= 100; i += 25) {
      await delay(200);
      setS3(prev => ({
        status: 'running',
        progress: i,
        logs: [...prev.logs, i === 50 ? 'Generated joint rotation quaternions' : i === 75 ? 'Compiling BVH/FBX/GLTF target files' : ''].filter(Boolean)
      }));
    }
    setS3(prev => ({ status: 'completed', progress: 100, logs: [...prev.logs, 'Blender exports generated successfully.'] }));

    // Scenario 4: Robot Retargeting
    setActiveScenario(4);
    setS4({ status: 'running', progress: 0, logs: ['Loading UR5 Robot description...', 'Mapping human skeleton to canonical system...'] });
    for (let i = 0; i <= 100; i += 20) {
      await delay(180);
      setS4(prev => ({
        status: 'running',
        progress: i,
        logs: [...prev.logs, i === 40 ? 'Retargeting Shoulder to UR5 Joint 1' : i === 80 ? 'Solving constraint boundaries & joint limits' : ''].filter(Boolean)
      }));
    }
    setS4(prev => ({ status: 'completed', progress: 100, logs: [...prev.logs, 'Retargeting solver active. Robot commands outputting.'] }));

    // Scenario 5: Universal Motion Dataset Builder
    setActiveScenario(5);
    setS5({ status: 'running', progress: 0, logs: ['Packaging dataset: session_001...', 'Writing joint angles and velocities JSON files...'] });
    for (let i = 0; i <= 100; i += 10) {
      await delay(150);
      setS5(prev => ({
        status: 'running',
        progress: i,
        logs: [...prev.logs, i === 50 ? 'Serializing SVMF (Sign-Verse Motion Format) payload' : i === 80 ? 'Archiving folder session_001/' : ''].filter(Boolean)
      }));
    }
    setS5(prev => ({ status: 'completed', progress: 100, logs: [...prev.logs, 'Universal motion dataset session package finalized.'] }));

    // Scenario 6: Digital Twin
    setActiveScenario(6);
    setS6({ status: 'running', progress: 0, logs: ['Starting Digital Twin coordination...', 'Synchronizing human sensor stream with simulation...'] });
    for (let i = 0; i <= 100; i += 25) {
      await delay(250);
      setS6(prev => ({
        status: 'running',
        progress: i,
        logs: [...prev.logs, i === 50 ? 'Connected physical UR5 simulation client' : i === 75 ? 'Coordinated twin loop active at 60Hz' : ''].filter(Boolean)
      }));
    }
    setS6(prev => ({ status: 'completed', progress: 100, logs: [...prev.logs, 'Digital Twin system fully operational.'] }));
    
    setPipelineActive(false);
    setActiveScenario(null);
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Dynamic values based on sine/cosine wave tick
  const angleJ0 = Math.sin(tick * Math.PI / 180) * 0.4 + 0.5;
  const angleJ1 = Math.cos(tick * Math.PI / 180) * 0.3;
  const angleJ2 = Math.sin(tick * Math.PI / 180 * 2) * 0.5 + 0.8;

  // Joint speeds (derivatives)
  const velJ0 = Math.abs(Math.cos(tick * Math.PI / 180) * 0.4);
  const velJ1 = Math.abs(Math.sin(tick * Math.PI / 180) * 0.3);
  const velJ2 = Math.abs(Math.cos(tick * Math.PI / 180 * 2) * 1.0);

  // Dynamic actions state based on loop progression
  let currentAction = 'Walking';
  if (tick > 90 && tick <= 180) currentAction = 'Reaching';
  else if (tick > 180 && tick <= 270) currentAction = 'Grasping';
  else if (tick > 270) currentAction = 'Placing';

  // SVG joints representation
  const shoulderX = 150;
  const shoulderY = 100;
  const elbowX = shoulderX + Math.sin(angleJ0) * 60;
  const elbowY = shoulderY + Math.cos(angleJ0) * 60;
  const wristX = elbowX + Math.sin(angleJ0 + angleJ1) * 50;
  const wristY = elbowY + Math.cos(angleJ0 + angleJ1) * 50;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Control Bar ────────────────────────────────────────────────── */}
      <div className="glass flex items-center justify-between p-4" style={{ borderRadius: 'var(--radius-md)' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--mode-ai)' }}>❖ Sign-Verse OS — Premium Pipeline Showcase</h2>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Simulate and verify motion intelligence, robot kinematic mapping, and dataset builder workflows.
          </p>
        </div>
        <button
          onClick={runFullPipeline}
          disabled={pipelineActive}
          style={{
            padding: '10px 24px',
            borderRadius: 'var(--radius-md)',
            background: pipelineActive
              ? 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.1) 100%)'
              : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
            color: '#fff',
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            cursor: pipelineActive ? 'not-allowed' : 'pointer',
            boxShadow: pipelineActive ? 'none' : 'var(--shadow-glow)',
            transition: 'all 0.2s var(--ease-spring)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (!pipelineActive) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            if (!pipelineActive) e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {pipelineActive ? (
            <>
              <span className="anim-spin-slow" style={{ display: 'inline-block', fontSize: 13 }}>◌</span>
              Pipeline Running...
            </>
          ) : (
            <>
              <span>⚡</span> Run Full Pipeline
            </>
          )}
        </button>
      </div>

      {/* ── Grid Layout for Scenarios ────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 16
      }}>

        {/* ── Scenario 1: Webcam -> Robot Dataset ──────────────────────── */}
        <div className="card p-5 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: 460 }}>
          <div className="flex justify-between items-center">
            <span className="badge badge-info">Scenario 1</span>
            <span className="label" style={{ color: s1.status === 'completed' ? 'var(--status-ok)' : s1.status === 'running' ? 'var(--status-warn)' : '#64748b' }}>
              {s1.status.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Webcam → Robot Dataset</h3>
          
          <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 220 }}>
            {/* Visualizer Feed */}
            <div style={{
              flex: 1.2,
              background: '#04060b',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 9, color: 'var(--status-ok)', zIndex: 5, fontFamily: 'var(--font-mono)' }}>
                ● RAW WEBCAM FEED (30 FPS)
              </div>
              
              {/* Animated skeleton overlay */}
              <svg width="100%" height="100%" viewBox="0 0 300 240" style={{ pointerEvents: 'none' }}>
                {/* Background grid representation */}
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Torso & Head */}
                <circle cx={shoulderX} cy={shoulderY - 35} r="14" stroke="rgba(168,85,247,0.8)" strokeWidth="2" fill="none" />
                <line x1={shoulderX} y1={shoulderY - 21} x2={shoulderX} y2={shoulderY} stroke="#8b5cf6" strokeWidth="3" />
                <line x1={shoulderX - 25} y1={shoulderY} x2={shoulderX + 25} y2={shoulderY} stroke="#8b5cf6" strokeWidth="4" />
                
                {/* Left Arm (Retargeted angles) */}
                <line x1={shoulderX} y1={shoulderY} x2={elbowX} y2={elbowY} stroke="var(--joint-j0)" strokeWidth="3" />
                <line x1={elbowX} y1={elbowY} x2={wristX} y2={wristY} stroke="var(--joint-j2)" strokeWidth="3" />

                {/* Right Arm */}
                <line x1={shoulderX} y1={shoulderY} x2={shoulderX + 50} y2={shoulderY + 30} stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                
                {/* Joints (Glow markers) */}
                <circle cx={shoulderX} cy={shoulderY} r="5" fill="var(--joint-j0)" />
                <circle cx={elbowX} cy={elbowY} r="5" fill="var(--joint-j2)" />
                <circle cx={wristX} cy={wristY} r="6" fill="#06b6d4" />
              </svg>

              <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 10, color: '#f1f5f9', background: 'rgba(12,15,26,0.8)', padding: '2px 6px', borderRadius: 4 }}>
                Active Segment: <strong style={{ color: 'var(--status-warn)' }}>{currentAction.toUpperCase()}</strong>
              </div>
            </div>

            {/* Live graphs/telemetry */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: 'var(--bg-overlay)', padding: 8, borderRadius: 6, flex: 1 }}>
                <span className="label" style={{ fontSize: 9 }}>Motion Graph (Speeds)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <div>
                    <div className="flex justify-between" style={{ fontSize: 10 }}>
                      <span>Shoulder (J0)</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{velJ0.toFixed(2)} rad/s</span>
                    </div>
                    <div className="progress-track" style={{ height: 3, marginTop: 2 }}>
                      <div className="progress-fill" style={{ width: `${Math.min(100, velJ0 * 150)}%`, background: 'var(--joint-j0)' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between" style={{ fontSize: 10 }}>
                      <span>Shoulder Roll (J1)</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{velJ1.toFixed(2)} rad/s</span>
                    </div>
                    <div className="progress-track" style={{ height: 3, marginTop: 2 }}>
                      <div className="progress-fill" style={{ width: `${Math.min(100, velJ1 * 150)}%`, background: 'var(--joint-j1)' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between" style={{ fontSize: 10 }}>
                      <span>Elbow Flexion (J2)</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{velJ2.toFixed(2)} rad/s</span>
                    </div>
                    <div className="progress-track" style={{ height: 3, marginTop: 2 }}>
                      <div className="progress-fill" style={{ width: `${Math.min(100, velJ2 * 80)}%`, background: 'var(--joint-j2)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Skill Sequence JSON Output */}
              <div style={{ background: 'var(--bg-overlay)', padding: 8, borderRadius: 6 }}>
                <span className="label" style={{ fontSize: 9 }}>Skill Tokenizer Output</span>
                <pre style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--status-info)',
                  margin: '4px 0 0 0',
                  padding: 4,
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 4,
                  overflowX: 'auto'
                }}>
                  {JSON.stringify({
                    skill_sequence: ["walk", "reach", "grasp", "place"].slice(0, currentAction === 'Walking' ? 1 : currentAction === 'Reaching' ? 2 : currentAction === 'Grasping' ? 3 : 4)
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
          
          <ScenarioProgress state={s1} />
        </div>

        {/* ── Scenario 2: YouTube -> Motion Dataset ────────────────────── */}
        <div className="card p-5 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: 460 }}>
          <div className="flex justify-between items-center">
            <span className="badge badge-info">Scenario 2</span>
            <span className="label" style={{ color: s2.status === 'completed' ? 'var(--status-ok)' : s2.status === 'running' ? 'var(--status-warn)' : '#64748b' }}>
              {s2.status.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>YouTube → Motion Dataset</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  color: '#e2e8f0',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '0 12px',
                fontSize: 12,
                cursor: 'pointer'
              }}>🔍</button>
            </div>

            <div style={{
              background: '#04060b',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              padding: 12,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 12
            }}>
              <div className="flex justify-between items-center">
                <span className="label">Detected Humans:</span>
                <span className="value-lg" style={{ color: ytHumans > 0 ? 'var(--status-ok)' : '#64748b' }}>
                  {ytHumans > 0 ? ytHumans : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="label">Extracted Actions:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {s2.status === 'completed' ? (
                    ['Walk', 'Carry', 'Lift', 'Place'].map(a => (
                      <span key={a} className="badge badge-soft" style={{ fontSize: 9 }}>{a}</span>
                    ))
                  ) : (
                    <span style={{ fontSize: 11, color: '#475569' }}>Awaiting ingestion...</span>
                  )}
                </div>
              </div>

              {s2.status === 'completed' && (
                <div style={{
                  border: '1px solid rgba(34,197,94,0.3)',
                  background: 'rgba(34,197,94,0.06)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 11,
                  color: 'var(--status-ok)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span>✓</span> Universal Motion Dataset Generated & Saved to Storage!
                </div>
              )}
            </div>
          </div>

          <ScenarioProgress state={s2} />
        </div>

        {/* ── Scenario 3: Motion Reconstruction ─────────────────────────── */}
        <div className="card p-5 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: 460 }}>
          <div className="flex justify-between items-center">
            <span className="badge badge-info">Scenario 3</span>
            <span className="label" style={{ color: s3.status === 'completed' ? 'var(--status-ok)' : s3.status === 'running' ? 'var(--status-warn)' : '#64748b' }}>
              {s3.status.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Motion Reconstruction (3D Avatar)</h3>

          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            {/* Left: Original Video */}
            <div style={{
              flex: 1,
              background: '#04060b',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <span className="label" style={{ position: 'absolute', top: 6, left: 6, fontSize: 8 }}>Original Video</span>
              {s3.status !== 'idle' ? (
                <div style={{ width: '80%', height: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyItems: 'center', fontSize: 11, color: '#64748b', textAlign: 'center', padding: 8 }}>
                  [Ingested frames: human actor waving]
                </div>
              ) : (
                <span style={{ fontSize: 11, color: '#475569' }}>No Input</span>
              )}
            </div>

            {/* Right: 3D Skeleton Avatar */}
            <div style={{
              flex: 1,
              background: '#05070e',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <span className="label" style={{ position: 'absolute', top: 6, left: 6, fontSize: 8 }}>3D Avatar Skeleton</span>
              {s3.status !== 'idle' ? (
                <svg width="100%" height="80%" viewBox="0 0 100 100">
                  <circle cx="50" cy="25" r="7" stroke="var(--mode-ai)" strokeWidth="1.5" fill="none" />
                  <line x1="50" y1="32" x2="50" y2="60" stroke="var(--mode-ai)" strokeWidth="2" />
                  {/* Waving arm */}
                  <line x1="50" y1="40" x2="25" y2="35" stroke="var(--mode-ai)" strokeWidth="1.5" />
                  <line x1="50" y1="40" x2="70" y2="25" stroke="var(--mode-ai)" strokeWidth="1.5" />
                  <line x1="70" y1="25" x2="80" y2={20 + Math.sin(tick * 0.15) * 8} stroke="var(--mode-ai)" strokeWidth="1.5" />
                  
                  <line x1="50" y1="60" x2="35" y2="85" stroke="var(--mode-ai)" strokeWidth="1.5" />
                  <line x1="50" y1="60" x2="65" y2="85" stroke="var(--mode-ai)" strokeWidth="1.5" />
                </svg>
              ) : (
                <span style={{ fontSize: 11, color: '#475569' }}>No Output</span>
              )}
            </div>
          </div>

          {/* Blender Export Drawer */}
          {s3.status === 'completed' && (
            <div style={{
              background: 'var(--bg-overlay)',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span className="label" style={{ fontSize: 9 }}>Blender Export format:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['BVH', 'FBX', 'GLTF'].map(ext => (
                  <button
                    key={ext}
                    onClick={() => alert(`Downloading converted ${ext} dataset file...`)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: 'var(--bg-hover)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      color: 'var(--mode-ai)',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📥 {ext}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ScenarioProgress state={s3} />
        </div>

        {/* ── Scenario 4: Robot Retargeting ────────────────────────────── */}
        <div className="card p-5 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: 460 }}>
          <div className="flex justify-between items-center">
            <span className="badge badge-info">Scenario 4</span>
            <span className="label" style={{ color: s4.status === 'completed' ? 'var(--status-ok)' : s4.status === 'running' ? 'var(--status-warn)' : '#64748b' }}>
              {s4.status.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Robot Retargeting (Human → UR5)</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{
              background: '#04060b',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              padding: 10,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <span className="label" style={{ fontSize: 9 }}>Joint Mapping Matrix</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--joint-j0)' }}>Human Shoulder (Pitch)</span>
                  <span style={{ color: '#475569' }}>➔</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-ok)' }}>UR5 Joint 1 (Base)</span>
                </div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--joint-j1)' }}>Human Shoulder (Roll)</span>
                  <span style={{ color: '#475569' }}>➔</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-ok)' }}>UR5 Joint 2 (Shoulder)</span>
                </div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--joint-j2)' }}>Human Elbow (Flexion)</span>
                  <span style={{ color: '#475569' }}>➔</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-ok)' }}>UR5 Joint 3 (Elbow)</span>
                </div>
              </div>
            </div>

            {/* Robot Joint Commands Payload */}
            <div style={{
              background: 'var(--bg-overlay)',
              borderRadius: 6,
              padding: 10
            }}>
              <span className="label" style={{ fontSize: 9 }}>Generated Robot Joint Commands</span>
              <pre style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--status-warn)',
                margin: '4px 0 0 0',
                padding: 6,
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 4,
                overflowX: 'auto'
              }}>
                {s4.status !== 'idle' ? (
                  JSON.stringify({
                    robot_joint_commands: [
                      parseFloat(angleJ0.toFixed(4)),
                      parseFloat(angleJ1.toFixed(4)),
                      parseFloat(angleJ2.toFixed(4)),
                      0.0, 0.0, 0.0
                    ]
                  }, null, 2)
                ) : (
                  '{\n  "robot_joint_commands": []\n}'
                )}
              </pre>
            </div>
          </div>

          <ScenarioProgress state={s4} />
        </div>

        {/* ── Scenario 5: Universal Motion Dataset Builder ─────────────────── */}
        <div className="card p-5 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: 460 }}>
          <div className="flex justify-between items-center">
            <span className="badge badge-info">Scenario 5</span>
            <span className="label" style={{ color: s5.status === 'completed' ? 'var(--status-ok)' : s5.status === 'running' ? 'var(--status-warn)' : '#64748b' }}>
              {s5.status.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Universal Motion Dataset Builder</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <span className="label" style={{ fontSize: 9 }}>Generated Dataset Output Tree (SVMF)</span>
            <div style={{
              background: '#04060b',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              padding: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#94a3b8',
              flex: 1,
              overflowY: 'auto'
            }}>
              <div style={{ color: 'var(--mode-ai)', fontWeight: 600 }}>📁 session_001/</div>
              <div style={{ paddingLeft: 12 }}>📄 video.mp4 <span style={{ color: '#475569' }}>(1.4 MB)</span></div>
              <div style={{ paddingLeft: 12, color: 'var(--mode-ai)' }}>📁 frames/</div>
              <div style={{ paddingLeft: 24 }}>📄 frame_0001.jpg</div>
              <div style={{ paddingLeft: 24 }}>📄 frame_0002.jpg</div>
              <div style={{ paddingLeft: 12 }}>📄 poses_2d.json <span style={{ color: 'var(--status-ok)' }}>{s5.status === 'completed' ? '✓' : ''}</span></div>
              <div style={{ paddingLeft: 12 }}>📄 poses_3d.json <span style={{ color: 'var(--status-ok)' }}>{s5.status === 'completed' ? '✓' : ''}</span></div>
              <div style={{ paddingLeft: 12 }}>📄 skeleton_graph.json</div>
              <div style={{ paddingLeft: 12 }}>📄 joint_angles.json</div>
              <div style={{ paddingLeft: 12 }}>📄 bone_vectors.json</div>
              <div style={{ paddingLeft: 12 }}>📄 actions.json <span style={{ color: 'var(--status-info)' }}>{s5.status === 'completed' ? '"grasp", "place"' : ''}</span></div>
              <div style={{ paddingLeft: 12 }}>📄 interactions.json</div>
              <div style={{ paddingLeft: 12 }}>📄 robot_mapping.json</div>
            </div>
          </div>

          <ScenarioProgress state={s5} />
        </div>

        {/* ── Scenario 6: Digital Twin ──────────────────────────────────── */}
        <div className="card p-5 flex flex-col gap-4 relative overflow-hidden" style={{ minHeight: 460 }}>
          <div className="flex justify-between items-center">
            <span className="badge badge-info">Scenario 6</span>
            <span className="label" style={{ color: s6.status === 'completed' ? 'var(--status-ok)' : s6.status === 'running' ? 'var(--status-warn)' : '#64748b' }}>
              {s6.status.toUpperCase()}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Digital Twin Simulation</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, flex: 1 }}>
              
              {/* Twin 1: Human */}
              <div style={{ background: '#04060b', border: '1px solid var(--border-subtle)', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 4, position: 'relative' }}>
                <span className="label" style={{ fontSize: 8, position: 'absolute', top: 4, left: 4 }}>1. Human (Input)</span>
                <svg width="100%" height="80%" viewBox="0 0 100 120">
                  <circle cx="50" cy="30" r="8" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
                  <line x1="50" y1="38" x2="50" y2="70" stroke="#38bdf8" strokeWidth="2" />
                  {/* Moving arm */}
                  <line x1="50" y1="45" x2="20" y2="50" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="50" y1="45" x2="70" y2="55" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="70" y1="55" x2="80" y2={60 + Math.sin(tick * 0.1) * 12} stroke="#38bdf8" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Twin 2: Avatar */}
              <div style={{ background: '#05070f', border: '1px solid var(--border-subtle)', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 4, position: 'relative' }}>
                <span className="label" style={{ fontSize: 8, position: 'absolute', top: 4, left: 4 }}>2. Avatar (Solver)</span>
                <svg width="100%" height="80%" viewBox="0 0 100 120">
                  <circle cx="50" cy="30" r="8" stroke="var(--mode-ai)" strokeWidth="1.5" fill="none" />
                  <line x1="50" y1="38" x2="50" y2="70" stroke="var(--mode-ai)" strokeWidth="2" />
                  {/* Sync arm */}
                  <line x1="50" y1="45" x2="20" y2="50" stroke="var(--mode-ai)" strokeWidth="1.5" />
                  <line x1="50" y1="45" x2="70" y2="55" stroke="var(--mode-ai)" strokeWidth="1.5" />
                  <line x1="70" y1="55" x2="80" y2={60 + Math.sin(tick * 0.1) * 12} stroke="var(--mode-ai)" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Twin 3: Robot */}
              <div style={{ background: '#030509', border: '1px solid var(--border-subtle)', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 4, position: 'relative' }}>
                <span className="label" style={{ fontSize: 8, position: 'absolute', top: 4, left: 4 }}>3. Robot (UR5)</span>
                <svg width="100%" height="80%" viewBox="0 0 100 120">
                  {/* Robot Base */}
                  <rect x="35" y="85" width="30" height="8" rx="2" fill="#475569" />
                  <line x1="50" y1="85" x2="50" y2="70" stroke="#f59e0b" strokeWidth="4" />
                  {/* Robot joint links coordinated */}
                  <circle cx="50" cy="70" r="4" fill="#334155" />
                  
                  {/* UR5 Arm 1 */}
                  {/* Coordinate rotation angle mapping */}
                  <line x1="50" y1="70" x2={50 + Math.sin(angleJ0 - 0.5) * 35} y2={70 - Math.cos(angleJ0 - 0.5) * 35} stroke="#f59e0b" strokeWidth="3" />
                  
                  {/* UR5 Arm 2 */}
                  <line 
                    x1={50 + Math.sin(angleJ0 - 0.5) * 35} 
                    y1={70 - Math.cos(angleJ0 - 0.5) * 35} 
                    x2={50 + Math.sin(angleJ0 - 0.5) * 35 + Math.sin(angleJ0 + angleJ1 - 0.5) * 25} 
                    y2={70 - Math.cos(angleJ0 - 0.5) * 35 - Math.cos(angleJ0 + angleJ1 - 0.5) * 25} 
                    stroke="#e2e8f0" 
                    strokeWidth="2.5" 
                  />
                </svg>
              </div>

            </div>

            {s6.status === 'completed' && (
              <div style={{ fontSize: 10, color: 'var(--status-ok)', textAlign: 'center', fontWeight: 600, background: 'rgba(34,197,94,0.08)', padding: 4, borderRadius: 4 }}>
                ● Realtime Synchronized Loop Running (Active)
              </div>
            )}
          </div>

          <ScenarioProgress state={s6} />
        </div>

      </div>
    </div>
  );
}

function ScenarioProgress({ state }: { state: ScenarioState }) {
  if (state.status === 'idle') return null;

  return (
    <div style={{
      marginTop: 8,
      borderTop: '1px solid var(--border-subtle)',
      paddingTop: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }}>
      <div className="flex justify-between items-center" style={{ fontSize: 11 }}>
        <span style={{ color: state.status === 'completed' ? 'var(--status-ok)' : 'var(--status-info)' }}>
          {state.status === 'completed' ? '✓ Processing Complete' : '⚡ Extracting Features...'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{state.progress}%</span>
      </div>
      
      <div className="progress-track" style={{ height: 4 }}>
        <div
          className="progress-fill"
          style={{
            width: `${state.progress}%`,
            background: state.status === 'completed' ? 'var(--status-ok)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
          }}
        />
      </div>

      {state.logs.length > 0 && (
        <div style={{
          maxHeight: 45,
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 4,
          padding: '4px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: '#64748b',
          lineHeight: 1.3
        }}>
          {state.logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
