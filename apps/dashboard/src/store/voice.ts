import { create } from 'zustand';
import { useCommandStore } from './command';

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
  message: string;
};

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface VoiceState {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  isPushToTalk: boolean;
  start: (isPtt?: boolean) => void;
  stop: () => void;
  clearTranscript: () => void;
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

let recognitionInstance: SpeechRecognitionInstance | null = null;

if (SpeechRecognitionAPI) {
  const rec = new SpeechRecognitionAPI();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  recognitionInstance = rec;
}

export const useVoiceStore = create<VoiceState>((set, get) => {
  if (recognitionInstance) {
    recognitionInstance.onstart = () => {
      set({ isListening: true, error: null, interimTranscript: '' });
    };

    recognitionInstance.onend = () => {
      const { isPushToTalk, transcript } = get();
      set({ isListening: false, interimTranscript: '' });
      
      if (isPushToTalk && transcript.trim()) {
        const finalVal = transcript.trim();
        set({ isPushToTalk: false });
        useCommandStore.getState().sendMessage(finalVal);
      }
    };

    recognitionInstance.onerror = (ev: SpeechRecognitionErrorEvent) => {
      set({ isListening: false, interimTranscript: '', isPushToTalk: false });
      
      switch (ev.error) {
        case 'not-allowed':
          set({ error: 'Microphone access denied. Grant permission and try again.' });
          break;
        case 'no-speech':
          set({ error: 'No speech detected. Please try again.' });
          break;
        case 'network':
          set({ error: 'Network error. Check connection and try again.' });
          break;
        case 'aborted':
          break;
        default:
          set({ error: `Speech recognition error: ${ev.error}` });
      }
    };

    recognitionInstance.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text;
          set({ confidence: result[0].confidence ?? 0 });
        } else {
          interim += text;
        }
      }

      if (interim) {
        set({ interimTranscript: interim });
      }
      if (final) {
        set({ transcript: final.trim(), interimTranscript: '' });
      }
    };
  }

  return {
    isSupported: !!SpeechRecognitionAPI,
    isListening: false,
    transcript: '',
    interimTranscript: '',
    confidence: 0,
    error: null,
    isPushToTalk: false,

    start: (isPtt = false) => {
      if (!recognitionInstance) return;
      
      if (get().isListening) {
        try {
          recognitionInstance.abort();
        } catch (e) {
          // ignore abort errors
        }
      }
      
      set({ transcript: '', error: null, isPushToTalk: isPtt, confidence: 0, interimTranscript: '' });
      try {
        recognitionInstance.start();
      } catch (err) {
        // ignore already started
      }
    },

    stop: () => {
      if (!recognitionInstance) return;
      try {
        recognitionInstance.stop();
      } catch (err) {
        // ignore stop errors
      }
    },

    clearTranscript: () => {
      set({ transcript: '', interimTranscript: '', confidence: 0 });
    }
  };
});
