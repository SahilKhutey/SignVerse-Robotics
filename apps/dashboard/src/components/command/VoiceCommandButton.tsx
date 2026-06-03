import React, { useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceCommandButtonProps {
  isListening: boolean;
  isSupported: boolean;
  confidence: number;
  error: string | null;
  interimTranscript: string;
  onStart: () => void;
  onStop: () => void;
}

// ─── Real-time audio waveform via Web Audio API ───────────────────────────────
function AudioWaveform({ isListening }: { isListening: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isListening) {
      // Cleanup audio pipeline when not listening
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      analyserRef.current = null;

      // Clear canvas to flat line
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1.5;
          ctx.moveTo(0, canvas.height / 2);
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      }
      return;
    }

    // Start audio pipeline
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        streamRef.current = stream;
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        drawWaveform();
      })
      .catch(() => {
        // Permission already handled by SpeechRecognition onerror
      });

    function drawWaveform() {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 4;
        ctx.stroke();
      };

      draw();
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={28}
      className="rounded"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ─── Main Button Component ────────────────────────────────────────────────────
export default function VoiceCommandButton({
  isListening,
  isSupported,
  confidence,
  error,
  interimTranscript,
  onStart,
  onStop,
}: VoiceCommandButtonProps) {
  if (!isSupported) {
    return (
      <button
        disabled
        title="Voice input not supported in this browser"
        className="relative flex items-center justify-center w-[38px] h-[38px] rounded-lg bg-white/5 border border-white/10 text-text-muted opacity-40 cursor-not-allowed"
      >
        <MicOff size={14} />
      </button>
    );
  }

  const confidencePct = Math.round(confidence * 100);
  const confidenceColor =
    confidence > 0.85 ? '#10b981' : confidence > 0.65 ? '#f59e0b' : '#ff3366';

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {/* Pulsing ring when listening */}
      <AnimatePresence>
        {isListening && (
          <>
            <motion.div
              key="ring1"
              className="absolute inset-0 rounded-lg border border-accent-red/60"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              key="ring2"
              className="absolute inset-0 rounded-lg border border-accent-red/40"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.9, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Mic Button */}
      <button
        onClick={isListening ? onStop : onStart}
        title={isListening ? 'Stop voice input' : 'Start voice input (hands-free)'}
        className={`relative z-10 flex items-center justify-center w-[38px] h-[38px] rounded-lg border transition-all cursor-pointer active:scale-95 ${
          isListening
            ? 'bg-accent-red/25 border-accent-red/60 text-accent-red shadow-[0_0_16px_rgba(255,51,102,0.35)]'
            : 'bg-white/5 border-white/10 text-text-secondary hover:bg-accent-cyan/10 hover:border-accent-cyan/30 hover:text-accent-cyan hover:shadow-[0_0_12px_rgba(0,240,255,0.15)]'
        }`}
      >
        <motion.div
          animate={isListening ? { scale: [1, 1.15, 1] } : { scale: 1 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {isListening ? <Mic size={14} /> : <Mic size={14} />}
        </motion.div>
      </button>

      {/* Inline waveform + confidence popup */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 bg-[#0d1117]/95 border border-accent-red/25 rounded-xl px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md min-w-[160px] z-50"
          >
            {/* LIVE label */}
            <div className="flex items-center gap-1.5 self-start w-full">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
              <span className="text-[8px] font-display font-bold tracking-widest text-accent-red uppercase">
                VOICE ACTIVE
              </span>
            </div>

            {/* Waveform canvas */}
            <AudioWaveform isListening={isListening} />

            {/* Interim transcript preview */}
            {interimTranscript && (
              <p className="text-[8px] font-mono text-text-secondary italic text-center max-w-[140px] truncate">
                "{interimTranscript}"
              </p>
            )}

            {/* Confidence */}
            {confidence > 0 && (
              <div className="flex items-center gap-1 text-[7px] font-mono self-end">
                <span className="text-text-muted">conf:</span>
                <span className="font-bold" style={{ color: confidenceColor }}>
                  {confidencePct}%
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error tooltip */}
      <AnimatePresence>
        {error && !isListening && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-accent-red/15 border border-accent-red/30 rounded-lg px-2.5 py-1.5 min-w-[180px] z-50"
          >
            <AlertCircle size={10} className="text-accent-red flex-shrink-0" />
            <span className="text-[8px] font-sans text-accent-red leading-tight">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
