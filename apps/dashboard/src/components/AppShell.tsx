import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTelemetryStore } from '../store/telemetry';
import { useWebSocket } from '../hooks/useWebSocket';
import NavItem from './nav/NavItem';
import ConnectionIndicator from './ConnectionIndicator';
import { ErrorBoundary } from './ErrorBoundary';
import LiveAccuracySparkline from './learning/LiveAccuracySparkline';
import { OfflineOverlay } from './ui/OfflineOverlay';
import { ToastContainer } from './ui/ToastContainer';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ShortcutsModal from './ui/ShortcutsModal';
import { useVoiceStore } from '../store/voice';
import VoiceWaveform from './command/VoiceWaveform';
import { 
  Layers, 
  Activity, 
  Terminal, 
  Database, 
  Brain, 
  Settings,
  Cpu,
  PowerOff,
  RefreshCw,
  ChevronDown,
  Zap,
  FlaskConical,
  Heart,
  Mic
} from 'lucide-react';

export default function AppShell() {
  const { triggerEstop, clearEstopTrigger } = useWebSocket();
  const isEstopTriggered = useTelemetryStore((state) => state.isEstopTriggered);
  const activeRobotId = useTelemetryStore((state) => state.activeRobotId);
  const connectedRobots = useTelemetryStore((state) => state.connectedRobots);
  const setActiveRobot = useTelemetryStore((state) => state.setActiveRobot);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  
  const isRecording = useTelemetryStore((state) => state.isRecording);
  const startRecording = useTelemetryStore((state) => state.startRecording);
  const stopRecording = useTelemetryStore((state) => state.stopRecording);
  const isPlaying = useTelemetryStore((state) => state.isPlaying);
  const setIsPlaying = useTelemetryStore((state) => state.setIsPlaying);

  // Global PTT Voice state
  const voiceListening = useVoiceStore((state) => state.isListening);
  const voiceIsPtt = useVoiceStore((state) => state.isPushToTalk);
  const voiceInterimTranscript = useVoiceStore((state) => state.interimTranscript);
  const voiceError = useVoiceStore((state) => state.error);
  const voiceStart = useVoiceStore((state) => state.start);
  const voiceStop = useVoiceStore((state) => state.stop);

  const spacePressedAtRef = useRef<number>(0);
  const isSpacePressedRef = useRef<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.getAttribute('contenteditable') === 'true'
      );

      if (isInput) return;

      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      const hasMeta = isMac ? e.metaKey : e.ctrlKey;

      if (hasMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/command');
        return;
      }

      if (hasMeta && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording('teleop_session_' + Date.now().toString().slice(-6));
        }
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true;
          spacePressedAtRef.current = Date.now();
          voiceStart(true);
        }
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        if (isSpacePressedRef.current) {
          isSpacePressedRef.current = false;
          const elapsed = Date.now() - spacePressedAtRef.current;
          if (elapsed < 150) {
            voiceStop();
            useVoiceStore.setState({ isPushToTalk: false, transcript: '' });
            setIsPlaying(!isPlaying);
          } else {
            voiceStop();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isPlaying, startRecording, stopRecording, setIsPlaying, navigate, voiceStart, voiceStop]);

  const navItems = [
    { to: '/twin', icon: Layers, label: 'Digital Twin' },
    { to: '/telemetry', icon: Activity, label: 'Telemetry' },
    { to: '/command', icon: Terminal, label: 'Command API' },
    { to: '/collector', icon: Database, label: 'Data Collector' },
    { to: '/training', icon: Brain, label: 'Policy Training' },
    { to: '/rlhf', icon: Heart, label: 'RLHF Studio' },
    { to: '/simulation', icon: FlaskConical, label: 'Sim-to-Real' },
    { to: '/system', icon: Settings, label: 'System Health' },
    { to: '/performance', icon: Zap, label: 'Performance' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-dark text-text-primary select-none">
      {/* ─── LEFT SIDEBAR NAV ─── */}
      <aside className="w-14 xl:w-56 h-full flex flex-col items-center xl:items-stretch py-4 px-2 xl:px-4 gap-4 bg-black/40 border-r border-white/5 backdrop-blur-md z-40 flex-shrink-0 transition-all duration-300">
        {/* Console Hub Logo */}
        <div className="flex items-center gap-3 mb-2 px-1 xl:px-0 select-none">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)] flex-shrink-0 animate-pulse"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-violet))', animationDuration: '4s' }}
          >
            <Cpu size={18} className="text-black animate-spin-slow" />
          </div>
          <div className="hidden xl:flex flex-col gap-0.5 min-w-0">
            <span className="font-display text-[9px] font-black tracking-widest text-text-primary">
              SIGNVERSE
            </span>
            <span className="text-[7px] text-accent-cyan font-mono font-bold tracking-wider leading-none">
              OS_CORE_V1
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-6 xl:w-full h-[1px] bg-white/10" />

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col gap-3 xl:w-full">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>

        {/* Bottom Operator indicator */}
        <div className="flex items-center gap-2.5 px-1 xl:px-0 w-8 xl:w-full mt-auto">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-mono font-bold text-accent-cyan flex-shrink-0">
            OP
          </div>
          <div className="hidden xl:flex flex-col min-w-0">
            <span className="text-[9px] text-text-primary font-bold leading-tight font-sans">
              Console Operator
            </span>
            <span className="text-[7px] text-text-muted font-mono leading-none">
              Local Session
            </span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* ─── TOPBAR HEADER ─── */}
        <header className="h-14 px-6 bg-black/30 border-b border-white/5 backdrop-blur-md flex items-center justify-between z-30 flex-shrink-0">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-xs font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-violet uppercase">
                SIGNVERSE OPERATOR
              </h1>
              <p className="text-[8px] text-text-secondary tracking-widest uppercase font-semibold">
                ROBOTICS PLATFORM
              </p>
            </div>
          </div>

          {/* Controls and Indicators */}
          <div className="flex items-center gap-3">
            {/* Active Robot Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-mono text-[9px] text-text-secondary hover:text-text-primary"
              >
                <span>NODE: <span className="text-accent-cyan font-bold">{activeRobotId.split('-').pop()}</span></span>
                <ChevronDown size={10} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-45" 
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#0d1117]/95 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[8px] text-text-muted font-display font-semibold tracking-wider border-b border-white/5">
                      SELECT ACTIVE ROBOT
                    </div>
                    {connectedRobots.map((robotId) => (
                      <button
                        key={robotId}
                        onClick={() => {
                          setActiveRobot(robotId);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-mono transition-all hover:bg-white/5 ${
                          activeRobotId === robotId 
                            ? 'text-accent-cyan font-bold bg-accent-cyan/5' 
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {robotId}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Live Online Learning Accuracy Sparkline */}
            <LiveAccuracySparkline />

            {/* Connection Indicator */}
            <ConnectionIndicator />

            {/* Global E-Stop Action Button */}
            <div className="flex items-center">
              {isEstopTriggered ? (
                <button
                  onClick={clearEstopTrigger}
                  className="flex items-center gap-1 bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/30 text-accent-cyan font-display text-[9px] font-bold px-2.5 py-1.5 rounded-lg tracking-wider transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
                >
                  <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
                  RESET ESTOP
                </button>
              ) : (
                <button
                  onClick={triggerEstop}
                  className="flex items-center gap-1 bg-accent-red/20 hover:bg-accent-red/35 border border-accent-red/40 text-accent-red font-display text-[9px] font-black px-2.5 py-1.5 rounded-lg tracking-wider transition-all hover:shadow-[0_0_12px_rgba(255,51,102,0.3)]"
                >
                  <PowerOff size={10} />
                  HALT MOTORS
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ─── MAIN OUTLET VIEW ─── */}
        <main className="flex-1 overflow-hidden relative bg-[#07080a]" id="main-view-outlet">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.12, ease: 'easeInOut' }}
              className="h-full w-full overflow-hidden"
            >
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <OfflineOverlay />
      <ToastContainer />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Global Push-To-Talk HUD */}
      <AnimatePresence>
        {voiceListening && voiceIsPtt && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 bg-[#0d1117]/95 border border-accent-cyan/25 rounded-2xl p-5 shadow-[0_12px_48px_rgba(0,0,0,0.85)] backdrop-blur-lg min-w-[280px]"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full border border-accent-red/60"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                />
                <div className="w-8 h-8 rounded-full bg-accent-red/20 border border-accent-red/50 flex items-center justify-center text-accent-red">
                  <Mic size={14} className="animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-display font-bold tracking-widest text-accent-red uppercase">
                  PUSH-TO-TALK ACTIVE
                </span>
                <span className="text-[7px] font-mono text-text-muted">
                  HOLD SPACE TO TALK, RELEASE TO SEND
                </span>
              </div>
            </div>

            <VoiceWaveform isListening={voiceListening} width={180} height={24} />

            {voiceInterimTranscript ? (
              <p className="text-[9px] font-mono text-text-primary italic text-center max-w-[240px] leading-relaxed break-words bg-black/35 px-3 py-1.5 rounded-lg border border-white/5">
                &ldquo;{voiceInterimTranscript}&rdquo;
              </p>
            ) : (
              <p className="text-[8px] font-sans text-text-muted text-center animate-pulse">
                Speak your command...
              </p>
            )}

            {voiceError && (
              <span className="text-[8px] font-sans text-accent-red font-semibold bg-accent-red/10 border border-accent-red/20 rounded px-2 py-1">
                {voiceError}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
