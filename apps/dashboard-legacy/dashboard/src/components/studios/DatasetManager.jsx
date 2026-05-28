import React, { useState, useEffect } from 'react';

export const DatasetManager = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('raw'); // 'raw', 'processed'

  const API_KEY = localStorage.getItem('signverse_api_key') || 'admin_secret_42';
  const API_BASE = 'http://localhost:8000/api/datasets';

  const fetchDatasets = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = activeTab === 'raw' ? `${API_BASE}/raw` : `${API_BASE}/processed`;
      const response = await fetch(endpoint, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      const result = await response.json();
      if (response.ok) {
        setDatasets(result.datasets || []);
      } else {
        setError(result.detail || 'Failed to fetch datasets');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [activeTab]);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
      // Currently only raw delete is fully supported in backend
      if (activeTab !== 'raw') {
        alert("Deleting processed datasets is not yet implemented.");
        return;
      }
      
      const response = await fetch(`${API_BASE}/raw/${filename}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY }
      });
      
      if (response.ok) {
        fetchDatasets();
      } else {
        const result = await response.json();
        alert(`Error: ${result.detail}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleExport = (filename) => {
    alert(`Exporting ${filename} to BVH/URDF format pipeline. (To be implemented in Phase 25)`);
  };

  return (
    <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontSize: '28px', margin: '0 0 8px 0' }}>🗄️ Dataset Manager</h2>
        <p style={{ color: 'var(--color-on-surface-variant)', margin: 0 }}>Browse, filter, and export Universal Motion Datasets.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        <button 
          onClick={() => setActiveTab('raw')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'raw' ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
            border: `1px solid ${activeTab === 'raw' ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
            color: activeTab === 'raw' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontWeight: 500
          }}
        >
          Raw Uploads
        </button>
        <button 
          onClick={() => setActiveTab('processed')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'processed' ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
            border: `1px solid ${activeTab === 'processed' ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
            color: activeTab === 'processed' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontWeight: 500
          }}
        >
          Processed Motion
        </button>
      </div>

      <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-on-surface)' }}>
            {activeTab === 'raw' ? 'Ingested Media Buffer' : 'Universal Motion Library'}
          </h3>
          <button onClick={fetchDatasets} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 20px', background: 'rgba(255,0,0,0.1)', color: 'var(--color-error)' }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-data)', fontSize: '14px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'rgba(5, 20, 36, 0.95)', zIndex: 1 }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Filename</th>
                <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Size</th>
                <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-on-surface-variant)' }}>
                    Loading storage blocks...
                  </td>
                </tr>
              ) : datasets.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-on-surface-variant)' }}>
                    No files found in this layer.
                  </td>
                </tr>
              ) : (
                datasets.map(ds => (
                  <tr key={ds.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px 20px', color: 'var(--color-on-surface)' }}>{ds.name}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--color-on-surface-variant)' }}>{ds.type}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--color-on-surface-variant)' }}>{ds.size}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--color-on-surface-variant)' }}>{ds.created_at}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        background: ds.status === 'Exported' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                        color: ds.status === 'Exported' ? 'var(--color-primary)' : 'var(--color-on-surface)',
                        fontSize: '12px'
                      }}>
                        {ds.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleExport(ds.name)}
                        style={{ background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
                      >
                        Export
                      </button>
                      <button 
                        onClick={() => handleDelete(ds.name)}
                        style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
