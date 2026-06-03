import React, { useEffect, useRef } from 'react';
import { useLandmarksStore } from '../../store/landmarks';

interface LiveLandmarkOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

// Landmark connectivity bones
const CONNECTIONS = [
  [11, 12], // Shoulder line
  [11, 13], [13, 15], // Left arm
  [12, 14], [14, 16], // Right arm
  [15, 17], [15, 19], [15, 21], // Left fingers
  [16, 18], [16, 20], [16, 22], // Right fingers
  [11, 23], [12, 24], [23, 24], // Torso outline
];

export default function LiveLandmarkOverlay({ canvasRef }: LiveLandmarkOverlayProps) {
  const animationFrameId = useRef<number>(0);

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId.current = requestAnimationFrame(draw);
        return;
      }

      // Sync canvas dimensions to client bounds
      const parent = canvas.parentElement;
      if (parent) {
        if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        }
      }

      const width = canvas.width;
      const height = canvas.height;

      // Clear previous frames
      ctx.clearRect(0, 0, width, height);

      const landmarkData = useLandmarksStore.getState().landmarks;
      const landmarks = landmarkData?.landmarks;

      if (!landmarks || landmarks.length === 0) {
        animationFrameId.current = requestAnimationFrame(draw);
        return;
      }

      // Draw connective skeleton bones
      ctx.strokeStyle = '#8e2de2';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#8e2de2';

      CONNECTIONS.forEach(([a, b]) => {
        const lA = landmarks[a];
        const lB = landmarks[b];

        if (lA && lB && lA.visibility > 0.5 && lB.visibility > 0.5) {
          // Mirroring horizontally since video is mirrored
          const xA = (1 - lA.x) * width;
          const yA = lA.y * height;
          const xB = (1 - lB.x) * width;
          const yB = lB.y * height;

          ctx.beginPath();
          ctx.moveTo(xA, yA);
          ctx.lineTo(xB, yB);
          ctx.stroke();
        }
      });

      // Draw joint dots
      ctx.shadowBlur = 0; // reset shadow
      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < 33; i++) {
        const lm = landmarks[i];
        if (lm && lm.visibility > 0.5) {
          const x = (1 - lm.x) * width;
          const y = lm.y * height;

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }

      animationFrameId.current = requestAnimationFrame(draw);
    }

    animationFrameId.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}
