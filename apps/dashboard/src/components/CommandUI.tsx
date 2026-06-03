import React, { useState, useRef, useEffect } from 'react';
import { useCommandStore, ChatMessage } from '../store/command';
import { useTelemetryStore } from '../store/telemetry';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import VoiceCommandButton from './command/VoiceCommandButton';
import VoiceWaveform from './command/VoiceWaveform';
import { Send, Terminal, User, Bot, Trash2, Cpu, Clock, Sliders, MicOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const SUGGESTIONS = [
  'Move shoulder to 90 degrees',
  'Move elbow to 45 degrees',
  'Extend fully',
  'Pick up the block',
  'Do what you did last time but slower',
  'Clear history & Reset to Home'
];

export default function CommandUI() {
  const [input, setInput] = useState('');
  const messages = useCommandStore((state) => state.messages);
  const pending = useCommandStore((state) => state.pending);
  const sendMessage = useCommandStore((state) => state.sendMessage);
  const clearMessages = useCommandStore((state) => state.clearMessages);
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);

  const voice = useVoiceRecognition();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  // Pipe voice final transcript → input field, then auto-submit after brief pause
  useEffect(() => {
    if (!voice.transcript) return;
    setInput(voice.transcript);
    voice.clearTranscript();
    // Short delay so user sees the text before it fires
    const timer = setTimeout(() => {
      handleSubmit();
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.transcript]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || pending || isEstopTriggered) return;

    const text = input.trim();
    setInput('');
    try {
      await sendMessage(text);
    } catch (err) {
      // Handled in store
    }
  };

  const handleSuggestionClick = (sug: string) => {
    if (sug === 'Clear history & Reset to Home') {
      clearMessages();
      sendMessage('Move arm to home position');
    } else {
      setInput(sug);
    }
  };

  const IntentViz = ({ msg }: { msg: ChatMessage }) => {
    if (!msg.intent && !msg.primitive) return null;
    return (
      <div className="mt-2.5 bg-black/40 border border-white/5 rounded-lg p-2.5 flex flex-col gap-2 font-mono text-[8px] text-text-secondary select-none animate-in fade-in duration-200">
        <div className="flex justify-between items-center border-b border-white/5 pb-1">
          <div className="flex items-center gap-1 font-bold text-accent-cyan">
            <Cpu size={10} />
            <span>VLA INTENT DIAGRAM</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan text-[7px] font-bold font-sans">
            {msg.intent}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[8px]">
          <div>
            PRIMITIVE: <span className="text-text-primary font-bold">{msg.primitive}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={8} />
            EST_DURATION: <span className="text-text-primary font-bold">{msg.duration?.toFixed(1)}s</span>
          </div>
        </div>

        {msg.params && (
          <div className="bg-black/50 p-1.5 rounded border border-white/5 text-[7px] overflow-x-auto text-accent-green leading-relaxed max-w-full">
            PARAMS: {JSON.stringify(msg.params)}
          </div>
        )}

        {msg.targetAngles && msg.affectedJoints && (
          <div className="flex flex-col gap-1 pt-1.5 border-t border-white/5">
            <span className="text-[7px] text-text-muted uppercase tracking-wider">Joint Traces (delta shifts)</span>
            <div className="flex gap-1 items-end h-8 pt-2">
              {msg.targetAngles.map((ang, idx) => {
                const isAffected = msg.affectedJoints?.includes(idx);
                // Map range -180..180 to height percentage
                const normalizedHeight = Math.min(100, Math.max(10, Math.abs(ang) / 1.8));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        isAffected ? 'bg-accent-cyan' : 'bg-white/10'
                      }`}
                      style={{ height: `${normalizedHeight}%` }}
                    />
                    <span className={`text-[6px] mt-1 ${isAffected ? 'text-accent-cyan font-bold' : 'text-text-muted'}`}>
                      J{idx}
                    </span>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black border border-white/10 px-1 rounded text-[6px] text-text-primary opacity-0 group-hover:opacity-100 pointer-events-none transition-all font-sans whitespace-nowrap z-20 shadow-md">
                      {ang}°
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-4 h-[440px] relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-accent-cyan animate-pulse" />
          <h2 className="font-display text-sm font-semibold tracking-wider text-text-primary uppercase">
            NLP COMMAND CENTER
          </h2>
        </div>
        <button
          onClick={clearMessages}
          className="p-1 rounded bg-white/5 border border-white/5 hover:bg-accent-red/15 hover:border-accent-red/25 hover:text-accent-red text-text-secondary transition-all cursor-pointer"
          title="Clear Chat Logs"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Chat messages viewport */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col-reverse gap-4 min-h-0 py-2">
        <div ref={chatEndRef} />
        
        {pending && (
          <div className="flex gap-2.5 max-w-[85%] self-start animate-pulse">
            <div className="w-6 h-6 rounded-full bg-accent-cyan/15 border border-accent-cyan/35 text-accent-cyan flex items-center justify-center flex-shrink-0">
              <Bot size={12} />
            </div>
            <div className="glass-panel p-3 bg-black/30 border-white/5 rounded-2xl rounded-tl-sm text-[10px] text-accent-cyan flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="font-mono text-[8px] uppercase tracking-widest pl-1">VLA REASONING...</span>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div 
              key={msg.id} 
              className={`flex gap-2.5 max-w-[85%] ${
                isUser ? 'self-end flex-row-reverse' : 'self-start'
              }`}
            >
              {/* Avatar */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                isUser 
                  ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan' 
                  : 'bg-white/5 border border-white/10 text-text-secondary'
              }`}>
                {isUser ? <User size={12} /> : <Bot size={12} />}
              </div>

              {/* Bubble content */}
              <div className="flex flex-col gap-1 max-w-full">
                <div className={`p-3.5 rounded-2xl text-[10px] leading-relaxed shadow-sm font-sans border transition-all ${
                  isUser 
                    ? 'bg-[#152332]/50 border-accent-cyan/25 rounded-tr-sm text-text-primary' 
                    : 'bg-[#0f1118]/80 border-white/5 rounded-tl-sm text-text-secondary'
                }`}>
                  {msg.text}

                  {/* Robot intent visuals inside bot bubble */}
                  {!isUser && <IntentViz msg={msg} />}
                </div>
                
                {/* Timestamp */}
                <span className={`text-[7px] font-mono text-text-muted ${
                  isUser ? 'self-end' : 'self-start'
                }`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3">
        <span className="text-[8px] font-display font-bold tracking-wider text-text-muted uppercase select-none">
          OPERATIONAL PROMPTS CHIPS:
        </span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar select-none">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              className="text-[8px] bg-white/3 border border-white/5 rounded-md px-2.5 py-1 cursor-pointer text-text-secondary hover:text-text-primary hover:border-accent-cyan transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
              disabled={isEstopTriggered || pending}
              onClick={() => handleSuggestionClick(sug)}
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Voice active indicator strip */}
      <AnimatePresence>
        {voice.isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 bg-accent-cyan/10 border border-accent-cyan/25 rounded-lg px-3 py-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                <span className="text-[8px] font-display font-bold tracking-widest text-accent-cyan uppercase">
                  Voice Equalizer Active
                </span>
              </div>
              <VoiceWaveform isListening={voice.isListening} width={100} height={18} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browser compatibility badge */}
      {!voice.isSupported && (
        <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/20 rounded-md px-3 py-1.5 mb-2 text-[8px] text-accent-red select-none">
          <MicOff size={10} className="animate-pulse" />
          <span className="font-sans font-medium">Voice commands require Chrome or Edge.</span>
        </div>
      )}

      {/* Input bar form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-1 select-none">
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            className={`w-full bg-black/40 border border-white/5 rounded-lg px-3.5 py-2.5 font-mono text-[10px] focus:outline-none focus:border-accent-cyan focus:shadow-[0_0_12px_rgba(0,240,255,0.15)] focus:bg-black/60 transition-all disabled:opacity-50 ${
              voice.isListening && voice.interimTranscript ? 'text-transparent selection:bg-accent-cyan/30' : 'text-text-primary'
            }`}
            placeholder={
              isEstopTriggered
                ? 'EMERGENCY HALTED - E-STOP ACTIVE'
                : voice.isListening
                ? 'Listening for voice command...'
                : 'Enter natural language command... (e.g. "Do what you did last time but slower")'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending || isEstopTriggered}
          />
          {voice.isListening && voice.interimTranscript && (
            <div className="absolute inset-0 flex items-center px-3.5 py-2.5 pointer-events-none font-mono text-[10px] overflow-hidden select-none whitespace-pre">
              <span className="text-text-primary">{input}</span>
              {input && <span className="text-text-muted"> </span>}
              <span className="text-text-muted italic animate-pulse">{voice.interimTranscript}</span>
            </div>
          )}
        </div>
        {/* Voice input button */}
        <VoiceCommandButton
          isListening={voice.isListening}
          isSupported={voice.isSupported}
          confidence={voice.confidence}
          error={voice.error}
          interimTranscript={voice.interimTranscript}
          onStart={voice.start}
          onStop={voice.stop}
        />
        <button
          type="submit"
          className="btn btn-cyan h-[38px] px-3.5 flex items-center justify-center cursor-pointer select-none active:scale-95 disabled:opacity-50"
          disabled={pending || !input.trim() || isEstopTriggered}
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
