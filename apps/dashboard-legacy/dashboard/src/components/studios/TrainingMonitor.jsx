import React, { useState, useEffect } from 'react';

export const TrainingMonitor = () => {
  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  const API_KEY = localStorage.getItem('signverse_api_key') || 'admin_secret_42';
  const API_BASE = 'http://localhost:8000/api/training';

  const fetchRuns = async () => {
    try {
      const response = await fetch(`${API_BASE}/runs`, { headers: { 'X-API-Key': API_KEY } });
      const result = await response.json();
      if (response.ok) {
        setRuns(result.runs);
        if (result.runs.length > 0 && !activeRunId) {
          setActiveRunId(result.runs[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for live telemetry
  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 2000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRun = runs.find(r => r.id === activeRunId);

  const handleControl = async (action) => {
    if (!activeRun) return;
    setStatusMsg(`Sending ${action} command...`);
    try {
      const response = await fetch(`${API_BASE}/runs/${activeRun.id}/control`, {
        method: 'POST',
        headers: { 
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });
      const result = await response.json();
      setStatusMsg(result.message || result.detail);
      fetchRuns(); // refresh state instantly
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  const MetricCard = ({ label, value, unit, isLoss }) => (
    <div style={{ 
      background: 'rgba(255,255,255,0.03)', 
      border: '1px solid var(--color-outline-variant)', 
      borderRadius: 'var(--radius-md)', 
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', fontFamily: 'var(--font-data)' }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '32px', 
        fontFamily: 'var(--font-data)', 
        color: isLoss ? 'var(--color-error)' : 'var(--color-primary)',
        fontWeight: 'bold'
      }}>
        {value} <span style={{ fontSize: '16px', color: 'var(--color-on-surface-variant)', fontWeight: 'normal' }}>{unit}</span>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontSize: '28px', margin: '0 0 8px 0' }}>📈 Training Monitor</h2>
        <p style={{ color: 'var(--color-on-surface-variant)', margin: 0 }}>Command center for tracking IL/RL robotic policy engines.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexShrink: 0 }}>
        <select 
          value={activeRunId}
          onChange={e => setActiveRunId(e.target.value)}
          style={{
            padding: '10px 16px',
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-surface)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            width: '300px'
          }}
        >
          {loading ? <option>Loading Runs...</option> : null}
          {runs.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.status})</option>
          ))}
        </select>
        
        {activeRun?.status === 'Running' && (
          <button onClick={() => handleControl('stop')} style={{ background: 'var(--color-error)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            ■ Stop Training
          </button>
        )}
        {['Running', 'Stopped', 'Completed'].includes(activeRun?.status) && (
          <button onClick={() => handleControl('checkpoint')} className="btn-primary" style={{ padding: '10px 24px' }}>
            Save Checkpoint
          </button>
        )}
      </div>

      {activeRun ? (
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-on-surface)', fontFamily: 'var(--font-display)', fontSize: '24px' }}>
                {activeRun.name}
              </h3>
              <div style={{ display: 'flex', gap: '16px', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-data)', fontSize: '12px' }}>
                <span>Algorithm: <strong>{activeRun.algorithm}</strong></span>
                <span>Status: <strong style={{ color: activeRun.status === 'Running' ? 'var(--color-primary)' : 'var(--color-on-surface)' }}>{activeRun.status}</strong></span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'var(--font-data)', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Training Progress</span>
              <span style={{ color: 'var(--color-primary)' }}>{Math.round((activeRun.epoch / activeRun.total_epochs) * 100)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${(activeRun.epoch / activeRun.total_epochs) * 100}%`, 
                height: '100%', 
                background: 'var(--color-primary)',
                transition: 'width 0.5s ease-in-out'
              }} />
            </div>
          </div>

          {/* Metric Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <MetricCard label="Current Epoch" value={activeRun.epoch} unit={`/ ${activeRun.total_epochs}`} />
            <MetricCard label="Avg Reward" value={activeRun.reward.toFixed(2)} unit="pts" />
            <MetricCard label="Actor Loss" value={activeRun.actor_loss.toFixed(4)} unit="L" isLoss={true} />
            <MetricCard label="Critic Loss" value={activeRun.critic_loss.toFixed(4)} unit="L" isLoss={true} />
          </div>

          {statusMsg && (
            <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(0, 255, 136, 0.1)', color: 'var(--color-primary)', borderRadius: '4px', fontFamily: 'var(--font-data)' }}>
              &gt; {statusMsg}
            </div>
          )}

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-on-surface-variant)' }}>
          {loading ? 'Initializing Telemetry...' : 'No active training sessions found.'}
        </div>
      )}
    </div>
  );
};
