import React, { useRef, useEffect, useState } from 'react';
import { CaptureSocket } from '../../services/websocket/captureSocket';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useRobotStore } from '../../store/robotStore';

export function CaptureStudio() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null); // For frame extraction
  const [isStreaming, setIsStreaming] = useState(false);
  const [sourceType, setSourceType] = useState('webcam');
  const [socket, setSocket] = useState(null);
  const setLivePose = useRobotStore(state => state.setLivePose);
  
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ingestionStatus, setIngestionStatus] = useState('');
  const [ingestionLoading, setIngestionLoading] = useState(false);

  const handleYoutubeIngest = async (e) => {
    e.preventDefault();
    if (!youtubeUrl) return;
    setIngestionLoading(true);
    setIngestionStatus('');
    try {
      const response = await fetch('http://localhost:8000/api/ingest/youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('signverse_api_key') || 'admin_secret_42'
        },
        body: JSON.stringify({ url: youtubeUrl })
      });
      const result = await response.json();
      if (response.ok) {
        setIngestionStatus(`SUCCESS: Ingestion job queued with ID ${result.job_id}`);
        setYoutubeUrl('');
      } else {
        setIngestionStatus(`FAILED: ${result.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setIngestionStatus(`ERROR: ${err.message}`);
    } finally {
      setIngestionLoading(false);
    }
  };
  const setRobotAngles = useRobotStore(state => state.setRobotAngles);
  const setLiveGesture = useRobotStore(state => state.setLiveGesture);
  
  // Telemetry state
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);

  // Initialize WebSocket
  useEffect(() => {
    const ws = new CaptureSocket('ws://localhost:8000/ws/capture', (msg) => {
      if (msg.type === 'POSE_FRAME') {
        const payload = msg.payload;
        setLatency(payload.latency_ms);
        drawPoseOverlay(payload.pose);
        setLivePose(payload.pose);
        
        if (payload.angles) setRobotAngles(payload.angles);
        if (payload.gesture) setLiveGesture(payload.gesture);
      }
    });
    ws.connect();
    setSocket(ws);
    return () => ws.disconnect();
  }, [setLivePose, setRobotAngles, setLiveGesture]);

  // Frame Rate Calculation
  useEffect(() => {
    let frameCount = 0;
    const interval = setInterval(() => {
      setFps(frameCount * 2); // multiplied by 2 because interval is 500ms
      frameCount = 0;
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const drawPoseOverlay = (poseLandmarks) => {
    const canvas = canvasRef.current;
    if (!canvas || !poseLandmarks || poseLandmarks.length === 0) return;
    const ctx = canvas.getContext('2d');
    
    // Ensure canvas matches video resolution
    if (videoRef.current) {
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw landmarks
    ctx.fillStyle = 'var(--os-accent-primary)';
    poseLandmarks.forEach((lm) => {
      // lm is [x, y, z, visibility]
      const x = lm[0] * canvas.width;
      const y = lm[1] * canvas.height;
      if (lm[3] > 0.5) { // visibility threshold
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Start Webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Could not access webcam. Please check permissions.");
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Capture Frame Loop
  useEffect(() => {
    if (!isStreaming || !socket) return;
    let isActive = true;

    const processFrame = () => {
      if (!isActive) return;
      if (videoRef.current && hiddenCanvasRef.current && socket.isConnected) {
        const video = videoRef.current;
        const canvas = hiddenCanvasRef.current;
        if (video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Downsample slightly to avoid saturating websocket
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          socket.sendFrame(dataUrl);
        }
      }
      // Target roughly ~30fps for processing to save bandwidth
      setTimeout(() => requestAnimationFrame(processFrame), 33);
    };
    
    processFrame();
    return () => { isActive = false; };
  }, [isStreaming, socket]);

  // Rendering Layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', gap: '16px', overflow: 'hidden' }}>
      
      {/* Hidden Canvas for frame extraction */}
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--os-border-color)', paddingBottom: '16px' }}>
        {sourceType !== 'youtube' && (
          <button 
            onClick={isStreaming ? stopWebcam : startWebcam}
            style={{ 
              background: isStreaming ? 'var(--os-status-error)' : 'var(--os-accent-primary)',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--os-font-display)',
              fontWeight: 600
            }}
          >
            {isStreaming ? 'Stop Capture' : 'Start Webcam'}
          </button>
        )}
        <select 
          value={sourceType} 
          onChange={(e) => setSourceType(e.target.value)}
          style={{ background: 'var(--os-bg-panel)', color: 'var(--os-text-primary)', border: '1px solid var(--os-border-color)', borderRadius: '4px', padding: '4px 8px' }}
        >
          <option value="webcam">USB Webcam</option>
          <option value="youtube">YouTube URL Ingestion</option>
          <option value="rtsp">RTSP Stream</option>
          <option value="video">Local Video File</option>
        </select>
      </div>

      {/* Main Viewport Grid */}
      <div style={{ display: 'flex', flex: 1, gap: '16px', minHeight: 0 }}>
        
        {/* Left: Live Video Preview / YouTube Input */}
        <div style={{ flex: 2, background: 'var(--os-bg-panel)', borderRadius: 'var(--os-border-radius)', overflow: 'hidden', position: 'relative', border: '1px solid var(--os-border-color)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', color: 'var(--os-accent-primary)', fontFamily: 'var(--os-font-mono)', zIndex: 10 }}>
            {sourceType === 'youtube' ? 'YOUTUBE PIPELINE INGESTION' : 'RAW CAPTURE FEED'}
          </div>
          
          {sourceType === 'youtube' ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '32px', boxSizing: 'border-box' }}>
              <form onSubmit={handleYoutubeIngest} style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '8px', border: '1px solid var(--os-border-color)', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--os-text-primary)' }}>🔗 YouTube URL Ingestion</div>
                <div style={{ fontSize: '11px', color: 'var(--os-text-muted)' }}>Enter a YouTube video URL containing sign language or human movement to queue it for automatic real-time ingestion, frame extraction, and skeletal perception.</div>
                
                <input 
                  type="text" 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  style={{ background: '#0a192f', border: '1px solid var(--os-border-color)', color: '#fff', padding: '10px 14px', borderRadius: '4px', outline: 'none', fontSize: '12px' }}
                />
                
                <button 
                  type="submit" 
                  disabled={ingestionLoading}
                  style={{ background: 'var(--os-accent-primary)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  {ingestionLoading ? 'Processing & Queuing...' : '🚀 Queue Ingestion'}
                </button>
                
                {ingestionStatus && (
                  <div style={{ padding: '8px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--os-font-mono)', background: ingestionStatus.startsWith('SUCCESS') ? 'rgba(0,255,136,0.1)' : 'rgba(255,0,0,0.1)', color: ingestionStatus.startsWith('SUCCESS') ? 'var(--os-status-success)' : 'var(--os-status-error)', border: `1px solid ${ingestionStatus.startsWith('SUCCESS') ? 'var(--os-status-success)' : 'var(--os-status-error)'}` }}>
                    {ingestionStatus}
                  </div>
                )}
              </form>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
              <canvas 
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              />
            </>
          )}
        </div>

        {/* Right: Telemetry & Pipeline Jobs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--os-bg-panel)', borderRadius: 'var(--os-border-radius)', border: '1px solid var(--os-border-color)', padding: '16px' }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--os-text-muted)', margin: '0 0 16px 0' }}>Pipeline Jobs</h3>
            <div style={{ fontSize: '11px', color: 'var(--os-text-secondary)', fontStyle: 'italic' }}>No active jobs.</div>
          </div>
          <div style={{ background: 'var(--os-bg-panel)', borderRadius: 'var(--os-border-radius)', border: '1px solid var(--os-border-color)', padding: '16px' }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--os-text-muted)', margin: '0 0 16px 0' }}>Inference Telemetry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', fontFamily: 'var(--os-font-mono)' }}>
              <div style={{ color: 'var(--os-text-secondary)' }}>Model:</div><div style={{ color: 'var(--os-accent-primary)' }}>MediaPipe Holistic</div>
              <div style={{ color: 'var(--os-text-secondary)' }}>Status:</div><div style={{ color: isStreaming ? 'var(--os-status-success)' : 'var(--os-status-idle)' }}>{isStreaming ? 'PROCESSING' : 'IDLE'}</div>
              <div style={{ color: 'var(--os-text-secondary)' }}>FPS:</div><div>{fps}</div>
              <div style={{ color: 'var(--os-text-secondary)' }}>Latency:</div><div>{latency}ms</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
