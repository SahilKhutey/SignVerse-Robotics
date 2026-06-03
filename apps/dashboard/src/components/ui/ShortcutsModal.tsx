import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutsList = [
    { keys: ['Ctrl', 'K'], desc: 'Navigate to NLP Command Center' },
    { keys: ['Ctrl', 'R'], desc: 'Toggle Teleop Recording (Start / Stop)' },
    { keys: ['Space'], desc: 'Toggle Digital Twin Playback Play / Pause' },
    { keys: ['?'], desc: 'Toggle Keyboard Shortcuts Help Modal' },
  ];

  const isMac = navigator.userAgent.toLowerCase().includes('mac');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="glass-panel w-full max-w-md p-6 border border-white/10 shadow-2xl relative flex flex-col gap-4 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-cyan" />

        <div className="flex justify-between items-center pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-accent-cyan" />
            <h3 className="font-display text-xs font-bold tracking-wider text-text-primary uppercase">
              Keyboard Shortcuts
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded bg-white/5 border border-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            <X size={12} />
          </button>
        </div>

        <div className="flex flex-col gap-3 font-mono text-[10px]">
          {shortcutsList.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
              <span className="text-text-secondary select-none">{item.desc}</span>
              <div className="flex gap-1 select-none">
                {item.keys.map((k, kIdx) => {
                  const keyLabel = k === 'Ctrl' && isMac ? '⌘' : k;
                  return (
                    <kbd 
                      key={kIdx} 
                      className="px-2 py-0.5 rounded bg-white/10 border border-white/10 text-accent-cyan font-bold"
                    >
                      {keyLabel}
                    </kbd>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-[9px] text-text-muted font-sans select-none leading-relaxed">
          Shortcuts are disabled inside text fields or code input consoles to prevent interference. Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-text-secondary border border-white/5 font-mono">Esc</kbd> to close.
        </div>
      </div>
    </div>
  );
}
