import React, { useState, useRef, useEffect } from 'react';

export const CaptureStudio = () => {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'youtube', 'webcam'
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [status, setStatus] = useState('');
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  const API_KEY = localStorage.getItem('signverse_api_key') || 'admin_secret_42';
  const INGEST_API = 'http://localhost:8000/api/ingest';

  useEffect(() => {
    // Cleanup webcam stream when unmounting or switching tabs
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setStatus('Uploading video...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${INGEST_API}/video`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData
      });

      const result = await response.json();
      if (response.ok) {
        setStatus(`Success: Ingested ${result.filename} to ${result.path}`);
        setFile(null);
      } else {
        setStatus(`Error: ${result.detail || 'Failed to upload'}`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    if (!youtubeUrl) return;

    setStatus('Queuing YouTube URL...');
    try {
      const response = await fetch(`${INGEST_API}/youtube`, {
        method: 'POST',
        headers: { 
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: youtubeUrl })
      });

      const result = await response.json();
      if (response.ok) {
        setStatus(`Success: ${result.message}`);
        setYoutubeUrl('');
      } else {
        setStatus(`Error: ${result.detail || 'Failed to submit URL'}`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const toggleWebcam = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      
      // Notify backend
      fetch(`${INGEST_API}/webcam`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      setStatus('Webcam stopped.');
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(newStream);
        if (videoRef.current) videoRef.current.srcObject = newStream;
        
        // Notify backend
        fetch(`${INGEST_API}/webcam`, {
          method: 'POST',
          headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' })
        });
        setStatus('Webcam active and streaming.');
      } catch (err) {
        setStatus(`Webcam Error: ${err.message}`);
      }
    }
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontSize: '28px', margin: '0 0 8px 0' }}>🎥 Capture Studio</h2>
        <p style={{ color: 'var(--color-on-surface-variant)', margin: 0 }}>Ingest and stream media into the SignVerse Perception Pipeline.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        {['upload', 'youtube', 'webcam'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
              border: `1px solid ${activeTab === tab ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
              color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontFamily: 'var(--font-body)',
              fontWeight: 500
            }}
          >
            {tab === 'upload' ? 'Video Upload' : tab === 'youtube' ? 'YouTube Link' : 'Live Webcam'}
          </button>
        ))}
      </div>

      <div className="glass-panel" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {activeTab === 'upload' && (
          <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '400px' }}>
            <div style={{ border: '2px dashed var(--color-outline-variant)', padding: '40px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <input 
                type="file" 
                accept="video/mp4,video/quicktime"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ color: 'var(--color-on-surface)' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!file}>
              Ingest Video
            </button>
          </form>
        )}

        {activeTab === 'youtube' && (
          <form onSubmit={handleYoutubeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '400px' }}>
            <input 
              type="text" 
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              style={{
                padding: '12px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontFamily: 'var(--font-data)'
              }}
            />
            <button type="submit" className="btn-primary" disabled={!youtubeUrl}>
              Queue URL
            </button>
          </form>
        )}

        {activeTab === 'webcam' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div style={{ 
              width: '100%', 
              maxWidth: '640px', 
              aspectRatio: '16/9', 
              background: '#000', 
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--color-outline-variant)'
            }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <button onClick={toggleWebcam} className="btn-primary" style={{ background: stream ? 'var(--color-error)' : 'var(--color-primary)' }}>
              {stream ? 'Stop Streaming' : 'Start Streaming'}
            </button>
          </div>
        )}
      </div>

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
