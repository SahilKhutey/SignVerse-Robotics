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

/** Lazy accessor — reads from window at call time, never at module load time.
 *  This ensures Playwright addInitScript mocks installed before JS execution
 *  are visible when the first `start()` call is made.
 */
function getSpeechRecognitionAPI(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

let recognitionInstance: SpeechRecognitionInstance | null = null;

function getOrCreateInstance(): SpeechRecognitionInstance | null {
  if (recognitionInstance) return recognitionInstance;
  const API = getSpeechRecognitionAPI();
  if (!API) return null;

  const rec = new API();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    useVoiceStore.setState({ isListening: true, error: null, interimTranscript: '' });
  };

  rec.onend = () => {
    const { isPushToTalk, transcript } = useVoiceStore.getState();
    useVoiceStore.setState({ isListening: false, interimTranscript: '' });

    if (isPushToTalk && transcript.trim()) {
      const finalVal = transcript.trim();
      useVoiceStore.setState({ isPushToTalk: false });
      useCommandStore.getState().sendMessage(finalVal);
    }
  };

  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    useVoiceStore.setState({ isListening: false, interimTranscript: '', isPushToTalk: false });

    switch (ev.error) {
      case 'not-allowed':
        useVoiceStore.setState({ error: 'Microphone access denied. Grant permission and try again.' });
        break;
      case 'no-speech':
        useVoiceStore.setState({ error: 'No speech detected. Please try again.' });
        break;
      case 'network':
        useVoiceStore.setState({ error: 'Network error. Check connection and try again.' });
        break;
      case 'aborted':
        break;
      default:
        useVoiceStore.setState({ error: `Speech recognition error: ${ev.error}` });
    }
  };

  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';

    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        final += text;
        useVoiceStore.setState({ confidence: result[0].confidence ?? 0 });
      } else {
        interim += text;
      }
    }

    if (interim) {
      useVoiceStore.setState({ interimTranscript: interim });
    }
    if (final) {
      useVoiceStore.setState({ transcript: final.trim(), interimTranscript: '' });
    }
  };

  recognitionInstance = rec;
  return recognitionInstance;
}

export const useVoiceStore = create<VoiceState>()((set, get) => ({
  // isSupported is computed lazily at first render by checking window
  isSupported: typeof window !== 'undefined'
    ? !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    : false,
  isListening: false,
  transcript: '',
  interimTranscript: '',
  confidence: 0,
  error: null,
  isPushToTalk: false,

  start: (isPtt = false) => {
    // Re-check support at call time (allows Playwright addInitScript mocks to work)
    const api = getSpeechRecognitionAPI();
    if (!api) {
      // If window now has the API but isSupported was false at init, update it
      set({ error: 'Speech recognition not supported in this browser.' });
      return;
    }
    // Update isSupported reactively in case it changed since init
    set({ isSupported: true });

    const instance = getOrCreateInstance();
    if (!instance) return;

    if (get().isListening) {
      try {
        instance.abort();
      } catch (e) {
        // ignore abort errors
      }
    }

    set({ transcript: '', error: null, isPushToTalk: isPtt, confidence: 0, interimTranscript: '' });
    try {
      instance.start();
    } catch (err) {
      // ignore already started
    }
  },

  stop: () => {
    const instance = getOrCreateInstance();
    if (!instance) return;
    try {
      instance.stop();
    } catch (err) {
      // ignore stop errors
    }
  },

  clearTranscript: () => {
    set({ transcript: '', interimTranscript: '', confidence: 0 });
  }
}));

// Expose store on window for Playwright test access
if (typeof window !== 'undefined') {
  (window as any).useVoiceStore = useVoiceStore;
}
