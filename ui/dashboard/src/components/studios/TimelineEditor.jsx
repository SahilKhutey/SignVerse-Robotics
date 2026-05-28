import React, { useState, useEffect, useRef } from 'react';

export const TimelineEditor = () => {
  const [sequences, setSequences] = useState([]);
  const [activeSeq, setActiveSeq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Annotation form state
  const [startFrame, setStartFrame] = useState('');
  const [endFrame, setEndFrame] = useState('');
  const [intent, setIntent] = useState('');

  const API_KEY = localStorage.getItem('signverse_api_key') || 'admin_secret_42';
  const API_BASE = 'http://localhost:8000/api/timeline';

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sequences`, { headers: { 'X-API-Key': API_KEY } });
      const result = await response.json();
      if (response.ok) {
        setSequences(result.sequences || []);
        if (result.sequences.length > 0 && !activeSeq) {
          fetchSequenceDetails(result.sequences[0].id);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSequenceDetails = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/sequences/${id}`, { headers: { 'X-API-Key': API_KEY } });
      const result = await response.json();
      if (response.ok) {
        setActiveSeq(result.sequence);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, []);

  const handleAddSegment = async (e) => {
    e.preventDefault();
    if (!activeSeq) return;
    
    const payload = {
      start_frame: parseInt(startFrame),
      end_frame: parseInt(endFrame),
      intent
    };

    try {
      const response = await fetch(`${API_BASE}/sequences/${activeSeq.id}/segments`, {
        method: 'POST',
        headers: { 
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // Refresh details
        fetchSequenceDetails(activeSeq.id);
        setStartFrame('');
        setEndFrame('');
        setIntent('');
      } else {
        const result = await response.json();
        alert(`Error: ${result.detail}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontSize: '28px', margin: '0 0 8px 0' }}>⏱️ Motion Timeline Editor</h2>
        <p style={{ color: 'var(--color-on-surface-variant)', margin: 0 }}>Scrub extracted sequences and assign intent labels.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        <select 
          onChange={(e) => fetchSequenceDetails(e.target.value)}
          value={activeSeq?.id || ''}
          style={{
            padding: '10px 16px',
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            color: 'var(--color-on-surface)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-body)',
            outline: 'none'
          }}
        >
          <option value="" disabled>Select a sequence...</option>
          {sequences.map(seq => (
            <option key={seq.id} value={seq.id}>{seq.name}</option>
          ))}
        </select>
      </div>

      {activeSeq ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Viewer Area (Mocked for now) */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <div style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-data)' }}>
              [ Motion Playback Proxy for {activeSeq.name} ]
            </div>
          </div>

          {/* Timeline UI */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontFamily: 'var(--font-data)', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
              Annotation Tracks
            </h3>
            
            {/* The Scrubber Bar Container */}
            <div style={{ 
              position: 'relative', 
              height: '60px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-outline-variant)',
              marginBottom: '24px',
              overflow: 'hidden'
            }}>
              {/* Ruler Ticks */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', padding: '0 8px', fontSize: '10px', color: 'var(--color-on-surface-variant)' }}>
                <span>0</span>
                <span>{Math.floor(activeSeq.total_frames / 2)}</span>
                <span>{activeSeq.total_frames}</span>
              </div>
              
              {/* Segments */}
              {activeSeq.segments.map((seg, idx) => {
                const leftPercent = (seg.start_frame / activeSeq.total_frames) * 100;
                const widthPercent = ((seg.end_frame - seg.start_frame) / activeSeq.total_frames) * 100;
                return (
                  <div 
                    key={seg.id}
                    title={seg.intent}
                    style={{
                      position: 'absolute',
                      top: '25px',
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      height: '24px',
                      background: 'rgba(0, 255, 136, 0.4)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      fontSize: '11px',
                      fontFamily: 'var(--font-data)',
                      color: 'var(--color-on-primary-container)',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {seg.intent}
                  </div>
                );
              })}
            </div>

            {/* Add Segment Form */}
            <form onSubmit={handleAddSegment} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Start Frame</label>
                <input 
                  type="number" 
                  value={startFrame} 
                  onChange={e => setStartFrame(e.target.value)} 
                  required 
                  min="0"
                  max={activeSeq.total_frames}
                  style={{ width: '100px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-outline-variant)', color: 'white', borderRadius: '4px' }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>End Frame</label>
                <input 
                  type="number" 
                  value={endFrame} 
                  onChange={e => setEndFrame(e.target.value)} 
                  required 
                  min="0"
                  max={activeSeq.total_frames}
                  style={{ width: '100px', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-outline-variant)', color: 'white', borderRadius: '4px' }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>Intent Label (e.g., "Grasping Cup")</label>
                <input 
                  type="text" 
                  value={intent} 
                  onChange={e => setIntent(e.target.value)} 
                  required 
                  style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-outline-variant)', color: 'white', borderRadius: '4px', width: '100%' }} 
                />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '8px 24px', height: '40px' }}>
                Add Segment
              </button>
            </form>

          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-on-surface-variant)' }}>
          {loading ? 'Loading sequences...' : 'No sequences available.'}
        </div>
      )}
    </div>
  );
};
