import React, { useEffect, useRef, useState } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { useLandmarksStore } from '../store/landmarks';
import { useNotificationsStore } from '../store/notifications';
import { Camera, Zap, Youtube, Upload, FileVideo, FileImage, RefreshCw, Eye, EyeOff, CameraOff } from 'lucide-react';
import { PoseLandmark } from '@signverse/shared-types';
import { VITE_API_URL } from '../lib/env';

type SourceType = 'webcam' | 'youtube' | 'video' | 'image';

export default function CameraOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const wsState = useTelemetryStore((state) => state.wsState);
  const addLog = useNotificationsStore((state) => state.addLog);

  // Source selection state
  const [source, setSource] = useState<SourceType>('webcam');
  const [webcamActive, setWebcamActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // Ingestion form states
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('Standby — Ingestion pipeline ready.');
  const [jobId, setJobId] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Webcam stream lifecycle
  useEffect(() => {
    if (source === 'webcam' && webcamActive) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [source, webcamActive]);

  const startWebcam = async () => {
    setWebcamError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      addLog('🟢 Started local webcam capture feed.', 'info');
    } catch (err: any) {
      console.error('Error starting webcam:', err);
      setWebcamActive(false);
      setWebcamError(err.message || 'Camera acquisition failed.');
      addLog('❌ Failed to acquire camera access.', 'error');
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Landmark overlay loop
  useEffect(() => {
    let animationFrameId: number;
    
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Fetch latest visual landmarks
      const { landmarks } = useLandmarksStore.getState();
      let landmarksToDraw = (landmarks && landmarks.landmarks) || [];

      // Generate mock overlay joints if webcam is active but no backend stream is running
      if (landmarksToDraw.length === 0 && source === 'webcam' && webcamActive) {
        const time = Date.now() / 1000;
        const noseX = width / 2 + Math.sin(time) * 20;
        const noseY = height / 3 + Math.cos(time * 1.5) * 10;
        
        const lShoulderX = width / 2 - 80;
        const lShoulderY = height / 3 + 50 + Math.sin(time * 0.8) * 8;
        const rShoulderX = width / 2 + 80;
        const rShoulderY = height / 3 + 50 - Math.sin(time * 0.8) * 8;

        const lElbowX = lShoulderX - 50;
        const lElbowY = lShoulderY + 60 + Math.cos(time * 1.1) * 12;
        const rElbowX = rShoulderX + 50;
        const rElbowY = rShoulderY + 60 + Math.sin(time * 1.1) * 12;

        const lWristX = lElbowX - 40;
        const lWristY = lElbowY + 50 + Math.sin(time * 1.8) * 15;
        const rWristX = rElbowX + 40;
        const rWristY = rElbowY + 50 + Math.cos(time * 1.8) * 15;

        landmarksToDraw = [
          { x: noseX / width, y: noseY / height, z: 0, visibility: 1 },
          { x: lShoulderX / width, y: lShoulderY / height, z: 0, visibility: 1 },
          { x: rShoulderX / width, y: rShoulderY / height, z: 0, visibility: 1 },
          { x: lElbowX / width, y: lElbowY / height, z: 0, visibility: 1 },
          { x: rElbowX / width, y: rElbowY / height, z: 0, visibility: 1 },
          { x: lWristX / width, y: lWristY / height, z: 0, visibility: 1 },
          { x: rWristX / width, y: rWristY / height, z: 0, visibility: 1 }
        ];
      }

      if (landmarksToDraw.length > 0) {
        // Draw bones
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(142, 45, 226, 0.6)'; // Violet glow
        
        const drawBone = (p1Idx: number, p2Idx: number) => {
          const p1 = landmarksToDraw[p1Idx];
          const p2 = landmarksToDraw[p2Idx];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.stroke();
          }
        };

        if (landmarksToDraw.length >= 7) {
          drawBone(1, 2);
          drawBone(1, 3);
          drawBone(3, 5);
          drawBone(2, 4);
          drawBone(4, 6);
        }

        // Draw joints
        landmarksToDraw.forEach((pt: PoseLandmark, index: number) => {
          const x = pt.x * width;
          const y = pt.y * height;
          
          ctx.beginPath();
          ctx.arc(x, y, index === 0 ? 6 : 4, 0, 2 * Math.PI);
          ctx.fillStyle = index === 0 ? 'var(--color-accent-red)' : 'var(--color-accent-cyan)';
          ctx.shadowColor = 'var(--color-accent-cyan)';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [source, webcamActive]);

  // YouTube queue submission
  const handleQueueYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = youtubeUrl.trim();
    if (!url) {
      addLog('❌ Please enter a YouTube URL.', 'error');
      return;
    }
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      addLog('❌ URL must be a valid YouTube address.', 'error');
      return;
    }

    setSubmitting(true);
    setStatusText('Sending queue request to Ingestion service...');
    try {
      const response = await fetch(`${VITE_API_URL}/api/ingest/youtube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'signverse_local_dev_key'
        },
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const res = await response.json();
      setJobId(res.pipeline_job_id || res.job_id);
      setStatusText(`✓ YouTube URL queued successfully: ${res.message || 'Queued'}`);
      addLog(`🟢 YouTube Ingestion queued: ${url}`, 'success');
      setYoutubeUrl('');
    } catch (err: any) {
      setStatusText(`❌ Ingestion request failed: ${err.message || err}`);
      addLog(`❌ Failed to queue YouTube ingestion.`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Local Video/Image uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'video' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    setStatusText(`Uploading ${fileType}: ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${VITE_API_URL}/api/ingest/${fileType}`, {
        method: 'POST',
        headers: {
          'X-API-Key': 'signverse_local_dev_key'
        },
        body: formData
      });
      
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const res = await response.json();
      
      setJobId(res.pipeline_job_id || res.job_id);
      setStatusText(`✓ ${fileType} uploaded and queued successfully.`);
      addLog(`🟢 Ingestion file uploaded: ${file.name}`, 'success');
    } catch (err: any) {
      setStatusText(`❌ Upload failed: ${err.message || err}`);
      addLog(`❌ Failed to upload ${fileType} file.`, 'error');
    } finally {
      setSubmitting(false);
      if (e.target) e.target.value = '';
    }
  };

  const frame = useTelemetryStore((state) => state.frame);
  const hasPrediction = frame?.aiPrediction && frame.aiPrediction.length > 0;
  const predictionText = hasPrediction ? 'AI_TRACKING' : 'STANDBY';

  return (
    <div className="glass-panel p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-accent-violet" />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary uppercase">
            AI Perception Ingestion & Overlay
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-mono">
          <Zap size={11} className="text-accent-cyan animate-pulse" />
          Gateway: {wsState}
        </div>
      </div>

      {/* Source Selection Controls */}
      <div className="flex flex-wrap gap-2 items-center bg-black/20 p-2 rounded-lg border border-white/5">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as SourceType)}
          className="bg-[#0b0c10] border border-white/10 rounded px-2 py-1 text-[10px] font-sans text-text-primary focus:outline-none focus:border-accent-cyan cursor-pointer"
        >
          <option value="webcam">USB Camera Feed</option>
          <option value="youtube">YouTube Ingestion</option>
          <option value="video">Video Upload</option>
          <option value="image">Image Upload</option>
        </select>

        {source === 'webcam' && (
          <button
            onClick={() => setWebcamActive(!webcamActive)}
            className={`px-3 py-1 rounded text-[9px] font-display font-bold uppercase transition-all cursor-pointer border ${
              webcamActive 
                ? 'bg-accent-red/10 border-accent-red/35 text-accent-red hover:bg-accent-red/20' 
                : 'bg-accent-cyan/10 border-accent-cyan/35 text-accent-cyan hover:bg-accent-cyan/20 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
            }`}
          >
            {webcamActive ? 'Stop Webcam' : 'Start Webcam'}
          </button>
        )}
      </div>

      {/* Main viewport */}
      <div className="relative w-full aspect-[1.6] bg-[#050608] rounded-lg overflow-hidden border border-white/5 flex items-center justify-center">
        
        {/* Scanline premium overlay */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none z-[10]"
          style={{ 
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
            backgroundSize: '100% 4px, 6px 100%' 
          }} 
        />

        {/* Viewport UI states */}
        {source === 'webcam' && (
          <>
            {webcamActive && !webcamError ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-[1]"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 select-none text-center p-6 z-[2]">
                <CameraOff size={24} className="text-text-muted animate-pulse" />
                <span className="font-mono text-[9px] text-text-muted">
                  {webcamError ? `ERROR: ${webcamError}` : 'CAMERA OFFLINE — CLICK START WEBCAM'}
                </span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={480}
              height={300}
              className="absolute inset-0 w-full h-full z-[2] pointer-events-none"
            />
          </>
        )}

        {source === 'youtube' && (
          <form onSubmit={handleQueueYoutube} className="relative z-10 w-full max-w-sm flex flex-col gap-3 p-4 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md">
            <div className="flex flex-col gap-1 select-none">
              <span className="font-display text-[11px] font-bold text-accent-cyan tracking-wider flex items-center gap-1">
                <Youtube size={12} />
                YOUTUBE URL INGESTION
              </span>
              <span className="text-[8px] text-text-secondary">
                Submit public videos to extract skeletal pose coordinates.
              </span>
            </div>

            <input
              type="url"
              required
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={submitting}
              placeholder="https://www.youtube.com/watch?v=..."
              className="bg-black/80 border border-white/10 rounded px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan disabled:opacity-50 transition-all font-mono"
            />

            <button
              type="submit"
              disabled={submitting}
              className="py-1.5 bg-accent-cyan text-black hover:bg-cyan-400 rounded text-[10px] font-display font-black tracking-widest uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.2)]"
            >
              {submitting ? <RefreshCw size={11} className="animate-spin" /> : 'QUEUE INGESTION'}
            </button>
          </form>
        )}

        {source === 'video' && (
          <div className="relative z-10 w-full max-w-xs flex flex-col gap-3 p-4 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md text-center">
            <span className="font-display text-[11px] font-bold text-accent-cyan tracking-wider flex items-center justify-center gap-1">
              <FileVideo size={12} />
              LOCAL VIDEO UPLOADER
            </span>
            <span className="text-[8px] text-text-secondary select-none">
              Upload raw mp4 files to extract motion sequences.
            </span>
            <input
              type="file"
              ref={videoInputRef}
              onChange={(e) => handleFileUpload(e, 'video')}
              accept="video/*"
              className="hidden"
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={submitting}
              className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-display font-bold tracking-widest text-text-primary rounded uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} className="text-accent-cyan" />}
              Choose Video File
            </button>
          </div>
        )}

        {source === 'image' && (
          <div className="relative z-10 w-full max-w-xs flex flex-col gap-3 p-4 bg-black/60 border border-white/10 rounded-xl backdrop-blur-md text-center">
            <span className="font-display text-[11px] font-bold text-accent-cyan tracking-wider flex items-center justify-center gap-1">
              <FileImage size={12} />
              STATIC IMAGE INGESTION
            </span>
            <span className="text-[8px] text-text-secondary select-none">
              Detect pose coordinates inside a single image feed.
            </span>
            <input
              type="file"
              ref={imageInputRef}
              onChange={(e) => handleFileUpload(e, 'image')}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={submitting}
              className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-display font-bold tracking-widest text-text-primary rounded uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} className="text-accent-cyan" />}
              Choose Image File
            </button>
          </div>
        )}

        {/* Status indicator badge */}
        {source === 'webcam' && webcamActive && (
          <div className="absolute top-3 right-3 bg-accent-cyan/15 border border-accent-cyan/35 text-accent-cyan px-2.5 py-1 rounded font-display text-[9px] font-bold tracking-wider shadow-[0_0_10px_rgba(0,240,255,0.2)] z-10 select-none">
            OVERLAY: {predictionText}
          </div>
        )}

        <div className="scan-line z-[3] pointer-events-none" />
      </div>

      {/* Job status logs panel */}
      <div className="flex flex-col gap-1 bg-[#0b0c10] border border-white/5 rounded-lg p-3 font-mono text-[9px] text-text-secondary select-none">
        <div className="flex justify-between">
          <span>PIPELINE MESSAGE:</span>
          <span className={submitting ? 'text-accent-cyan' : 'text-accent-green'}>{statusText}</span>
        </div>
        {jobId && (
          <div className="flex justify-between mt-1 text-[8px] text-text-muted">
            <span>PIPELINE JOB ID:</span>
            <span>{jobId}</span>
          </div>
        )}
      </div>
    </div>
  );
}
