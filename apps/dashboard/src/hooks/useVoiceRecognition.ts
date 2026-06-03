import { useVoiceStore } from '../store/voice';

export interface VoiceRecognitionState {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  start: () => void;
  stop: () => void;
  clearTranscript: () => void;
}

export function useVoiceRecognition(): VoiceRecognitionState {
  const isSupported = useVoiceStore((state) => state.isSupported);
  const isListening = useVoiceStore((state) => state.isListening);
  const transcript = useVoiceStore((state) => state.transcript);
  const interimTranscript = useVoiceStore((state) => state.interimTranscript);
  const confidence = useVoiceStore((state) => state.confidence);
  const error = useVoiceStore((state) => state.error);
  
  const start = useVoiceStore((state) => state.start);
  const stop = useVoiceStore((state) => state.stop);
  const clearTranscript = useVoiceStore((state) => state.clearTranscript);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    confidence,
    error,
    start,
    stop,
    clearTranscript,
  };
}
