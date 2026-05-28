import React, { useState, useEffect } from 'react';

export const RetargetingStudio = () => {
  const [robots, setRobots] = useState([]);
  const [activeRobotId, setActiveRobotId] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Mapping State
  const [selectedHumanJoint, setSelectedHumanJoint] = useState('');
  const [selectedRobotJoint, setSelectedRobotJoint] = useState('');
  const [mappings, setMappings] = useState({}); // { humanJoint: robotJoint }
  const [status, setStatus] = useState('');

  const API_KEY = localStorage.getItem('signverse_api_key') || 'admin_secret_42';
  const API_BASE = 'http://localhost:8000/api/retarget';

  const HUMAN_JOINTS = [
    "Pelvis", "Spine_1", "Spine_2", "Spine_3", "Neck", "Head",
    "L_Collar", "L_Shoulder", "L_Elbow", "L_Wrist",
    "R_Collar", "R_Shoulder", "R_Elbow", "R_Wrist",
    "L_Hip", "L_Knee", "L_Ankle", "L_Foot",
    "R_Hip", "R_Knee", "R_Ankle", "R_Foot"
  ];

  useEffect(() => {
    fetchRobots();
  }, []);

  const fetchRobots = async () => {
    try {
      const response = await fetch(`${API_BASE}/robots`, { headers: { 'X-API-Key': API_KEY } });
      const result = await response.json();
      if (response.ok) {
        setRobots(result.robots);
        if (result.robots.length > 0) setActiveRobotId(result.robots[0].id);
      }
    } catch (err) {
      setStatus(`Error loading robots: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const activeRobot = robots.find(r => r.id === activeRobotId);

  const handleMapJoint = () => {
    if (!selectedHumanJoint || !selectedRobotJoint) return;
    setMappings(prev => ({
      ...prev,
      [selectedHumanJoint]: selectedRobotJoint
    }));
    setSelectedHumanJoint('');
    setSelectedRobotJoint('');
    setStatus(`Mapped ${selectedHumanJoint} to ${selectedRobotJoint}`);
  };

  const handleRemoveMap = (humanJoint) => {
    setMappings(prev => {
      const newMap = { ...prev };
      delete newMap[humanJoint];
      return newMap;
    });
  };

  const handleSaveProfile = async () => {
    setStatus('Saving Retargeting Profile...');
    try {
      const response = await fetch(`${API_BASE}/map`, {
        method: 'POST',
        headers: { 
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ robot_id: activeRobotId, mappings })
      });
      const result = await response.json();
      if (response.ok) {
        setStatus(`Success: ${result.message}`);
      } else {
        setStatus(`Error: ${result.detail}`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontSize: '28px', margin: '0 0 8px 0' }}>🤖 Robot Retargeting Studio</h2>
        <p style={{ color: 'var(--color-on-surface-variant)', margin: 0 }}>Map universal human kinematic chains to specific robot morphology.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        <select 
          value={activeRobotId}
          onChange={e => {
            setActiveRobotId(e.target.value);
            setMappings({}); // reset mappings on robot change
          }}
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
          {loading ? <option>Loading URDF Profiles...</option> : null}
          {robots.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
          ))}
        </select>

        <button 
          onClick={handleSaveProfile} 
          className="btn-primary" 
          disabled={Object.keys(mappings).length === 0}
        >
          Save Mapping Profile
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', minHeight: 0 }}>
        
        {/* Human Chain Palette */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontFamily: 'var(--font-data)', color: 'var(--color-primary)' }}>Human Kinematic Chain</h3>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start' }}>
            {HUMAN_JOINTS.map(joint => {
              const isMapped = mappings[joint];
              return (
                <button
                  key={joint}
                  onClick={() => setSelectedHumanJoint(joint)}
                  style={{
                    padding: '8px 12px',
                    background: selectedHumanJoint === joint ? 'rgba(0, 255, 136, 0.2)' : isMapped ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedHumanJoint === joint ? 'var(--color-primary)' : isMapped ? 'var(--color-outline-variant)' : 'rgba(255,255,255,0.1)'}`,
                    color: isMapped ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'var(--font-data)'
                  }}
                >
                  {joint} {isMapped && '✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action / Mapping Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '250px', gap: '16px' }}>
          <div style={{ width: '100%', textAlign: 'center', padding: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>LINKAGE ENGINE</div>
            <div style={{ color: selectedHumanJoint ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', fontFamily: 'var(--font-data)', marginBottom: '8px' }}>
              {selectedHumanJoint || 'Select Human Joint'}
            </div>
            <div style={{ color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>↓ maps to ↓</div>
            <div style={{ color: selectedRobotJoint ? 'var(--color-primary)' : 'var(--color-on-surface-variant)', fontFamily: 'var(--font-data)' }}>
              {selectedRobotJoint || 'Select Robot Joint'}
            </div>
          </div>
          <button 
            onClick={handleMapJoint}
            className="btn-primary"
            disabled={!selectedHumanJoint || !selectedRobotJoint}
            style={{ width: '100%' }}
          >
            Link Joints
          </button>
        </div>

        {/* Robot Target Palette */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontFamily: 'var(--font-data)', color: 'var(--color-primary)' }}>Target Robot: {activeRobot?.name}</h3>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start' }}>
            {activeRobot?.joints.map(joint => {
              const isMapped = Object.values(mappings).includes(joint);
              return (
                <button
                  key={joint}
                  onClick={() => setSelectedRobotJoint(joint)}
                  style={{
                    padding: '8px 12px',
                    background: selectedRobotJoint === joint ? 'rgba(0, 255, 136, 0.2)' : isMapped ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedRobotJoint === joint ? 'var(--color-primary)' : isMapped ? 'var(--color-outline-variant)' : 'rgba(255,255,255,0.1)'}`,
                    color: isMapped ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'var(--font-data)'
                  }}
                >
                  {joint} {isMapped && '✓'}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Active Mappings Table */}
      {Object.keys(mappings).length > 0 && (
        <div className="glass-panel" style={{ marginTop: '24px', height: '200px', overflowY: 'auto', padding: 0 }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-data)', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'rgba(5, 20, 36, 0.95)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Human Joint</th>
                <th style={{ textAlign: 'left', padding: '12px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Robot Joint</th>
                <th style={{ textAlign: 'right', padding: '12px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mappings).map(([hJoint, rJoint]) => (
                <tr key={hJoint} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 20px', color: 'var(--color-on-surface)' }}>{hJoint}</td>
                  <td style={{ padding: '12px 20px', color: 'var(--color-primary)' }}>{rJoint}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleRemoveMap(hJoint)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '18px' }}
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status && (
        <div style={{ 
          marginTop: '24px', 
          padding: '12px', 
          background: 'rgba(255,255,255,0.05)', 
          borderLeft: `4px solid ${status.includes('Error') ? 'var(--color-error)' : 'var(--color-primary)'}`,
          color: 'var(--color-on-surface)',
          fontFamily: 'var(--font-data)'
        }}>
          {status}
        </div>
      )}
    </div>
  );
};
