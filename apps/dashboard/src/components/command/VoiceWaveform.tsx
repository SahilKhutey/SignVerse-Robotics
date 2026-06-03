import React, { useRef, useEffect } from 'react';

interface VoiceWaveformProps {
  isListening: boolean;
  width?: number;
  height?: number;
  barsCount?: number;
}

export default function VoiceWaveform({
  isListening,
  width = 160,
  height = 32,
  barsCount = 10,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const barHeightsRef = useRef<number[]>(new Array(barsCount).fill(0));

  useEffect(() => {
    if (!isListening) {
      cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      analyserRef.current = null;

      drawFlat();
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      drawFlat();
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        streamRef.current = stream;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // Small size provides appropriate bands for 10-bar visualizer
        source.connect(analyser);
        analyserRef.current = analyser;
        
        drawEqualizer();
      })
      .catch((err) => {
        console.warn('Microphone access denied or error starting AudioContext:', err);
        drawFlat();
      });

    function drawFlat() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gap = 3;
      const totalSpacing = gap * (barsCount - 1);
      const barWidth = (canvas.width - totalSpacing) / barsCount;

      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      for (let i = 0; i < barsCount; i++) {
        const x = i * (barWidth + gap);
        const y = canvas.height - 2;
        ctx.fillRect(x, y, barWidth, 2);
      }
      barHeightsRef.current.fill(2);
    }

    function drawEqualizer() {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gap = 3;
        const totalSpacing = gap * (barsCount - 1);
        const barWidth = (canvas.width - totalSpacing) / barsCount;

        const binsPerBar = Math.max(1, Math.floor(bufferLength / barsCount));

        for (let i = 0; i < barsCount; i++) {
          let sum = 0;
          const startBin = i * binsPerBar;
          const endBin = Math.min(bufferLength, startBin + binsPerBar);

          for (let b = startBin; b < endBin; b++) {
            sum += dataArray[b];
          }

          const avgValue = sum / (endBin - startBin || 1);
          // Scale amplitude to fit canvas height
          const targetHeight = (avgValue / 255) * (canvas.height - 4);
          
          // Decelerating interpolation (Lerp)
          const currentHeight = barHeightsRef.current[i] || 0;
          const smoothHeight = currentHeight + (targetHeight - currentHeight) * 0.45;
          barHeightsRef.current[i] = smoothHeight;

          const h = Math.max(2, smoothHeight);
          const x = i * (barWidth + gap);
          const y = canvas.height - h;

          // Gradient fill
          const gradient = ctx.createLinearGradient(x, y, x, canvas.height);
          gradient.addColorStop(0, '#00f0ff');
          gradient.addColorStop(1, 'rgba(0, 240, 255, 0.15)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth, h);

          // Top highlight line for neon glow effect
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, barWidth, 1.5);
        }
      };

      draw();
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening, barsCount, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="max-w-full block"
      style={{ imageRendering: 'auto' }}
    />
  );
}
