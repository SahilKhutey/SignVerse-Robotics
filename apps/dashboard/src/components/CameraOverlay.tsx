import React, { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../store/telemetry';
import { useLandmarksStore } from '../store/landmarks';
import { Camera, Zap } from 'lucide-react';
import { PoseLandmark } from '@signverse/shared-types';


export default function CameraOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const wsState = useTelemetryStore((state) => state.wsState);

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

      // Draw background grid lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j < height; j += 30) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }

      // Fetch latest visual landmarks non-reactively
      const { landmarks } = useLandmarksStore.getState();

      let landmarksToDraw = (landmarks && landmarks.landmarks) || [];

      // Generate bobs if empty
      if (landmarksToDraw.length === 0) {
        const time = Date.now() / 1000;
        const noseX = width / 2 + Math.sin(time) * 20;
        const noseY = height / 3 + Math.cos(time * 1.5) * 10;
        
        const lShoulderX = width / 2 - 60;
        const lShoulderY = height / 3 + 40 + Math.sin(time * 0.8) * 10;
        const rShoulderX = width / 2 + 60;
        const rShoulderY = height / 3 + 40 - Math.sin(time * 0.8) * 10;

        const lElbowX = lShoulderX - 40;
        const lElbowY = lShoulderY + 50 + Math.cos(time * 1.1) * 15;
        const rElbowX = rShoulderX + 40;
        const rElbowY = rShoulderY + 50 + Math.sin(time * 1.1) * 15;

        const lWristX = lElbowX - 30;
        const lWristY = lElbowY + 40 + Math.sin(time * 1.8) * 20;
        const rWristX = rElbowX + 30;
        const rWristY = rElbowY + 40 + Math.cos(time * 1.8) * 20;

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

      // Draw lines
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(142, 45, 226, 0.4)'; // Violet
      
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

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const frame = useTelemetryStore((state) => state.frame);
  // Temporary map prediction value (array output) to a label indicator
  const hasPrediction = frame?.aiPrediction && frame.aiPrediction.length > 0;
  const predictionText = hasPrediction ? 'AI_TRACKING' : 'STANDBY';

  return (
    <div className="glass-panel p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-accent-violet" />
          <h2 className="font-display text-xs font-semibold tracking-wider text-text-primary">
            AI PERCEPTION OVERLAY (MEDIAPIPE)
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-mono">
          <Zap size={11} className="text-accent-cyan" />
          Stream: {wsState}
        </div>
      </div>

      <div className="relative w-full aspect-[1.6] bg-[#050608] rounded-lg overflow-hidden border border-white/5">
        <div 
          className="absolute inset-0 opacity-15"
          style={{ 
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
            backgroundSize: '100% 4px, 6px 100%' 
          }} 
        />

        <div className="absolute top-3 right-3 bg-accent-cyan/10 border border-accent-cyan text-accent-cyan px-2.5 py-1 rounded font-display text-[10px] font-bold tracking-wider shadow-[0_0_12px_rgba(0,240,255,0.4)] z-10">
          GESTURE: {predictionText}
        </div>

        <canvas
          ref={canvasRef}
          width={480}
          height={300}
          className="absolute inset-0 w-full h-full z-[2]"
        />

        <div className="scan-line z-[3]" />
      </div>
    </div>
  );
}
