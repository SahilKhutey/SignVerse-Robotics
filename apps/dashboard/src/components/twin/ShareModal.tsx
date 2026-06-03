import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ShieldAlert, Users, Clock } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onGenerate: () => Promise<void>;
  observerCount: number;
}

export default function ShareModal({
  isOpen,
  onClose,
  token,
  onGenerate,
  observerCount
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(3600);

  useEffect(() => {
    if (!token) return;
    setTimeLeft(3600);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [token]);

  if (!isOpen) return null;

  const shareUrl = token ? `${window.location.origin}/observe?token=${token}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleGenerateClick = async () => {
    setLoading(true);
    try {
      await onGenerate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#0d1117]/95 border border-white/10 rounded-xl p-5 shadow-[0_12px_48px_rgba(0,0,0,0.85)] backdrop-blur-lg animate-in fade-in zoom-in-95 duration-200 select-none">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-accent-cyan animate-pulse" />
            <h3 className="font-display text-[10px] font-bold tracking-wider text-text-primary uppercase">
              Share Session Live
            </h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-all cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-[10px] text-text-secondary leading-relaxed font-mono">
            Generate a secure one-time link to let remote team members view the 3D twin live. Telemetry streams peer-to-peer over low-latency RTC data channels.
          </p>

          {!token ? (
            <button
              onClick={handleGenerateClick}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent-cyan/15 hover:bg-accent-cyan/25 border border-accent-cyan/35 hover:border-accent-cyan text-[10px] font-display font-bold tracking-wider text-accent-cyan transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'GENERATING...' : 'GENERATE LIVE SHARE LINK'}
            </button>
          ) : (
            <div className="flex flex-col gap-3 font-mono text-[9px] animate-in fade-in duration-200">
              
              {/* Share URL Input copy block */}
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[9px] font-mono text-text-primary focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-cyan transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-accent-green" />
                      <span className="text-accent-green font-bold">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="text-text-secondary" />
                      <span>COPY</span>
                    </>
                  )}
                </button>
              </div>

              {/* Share details grid */}
              <div className="grid grid-cols-2 gap-3 mt-1 bg-black/25 border border-white/5 rounded-lg p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-text-secondary uppercase">Connected Observers</span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-accent-green">
                    <Users size={11} />
                    <span>{observerCount} ACTIVE</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] text-text-secondary uppercase">Link Expiration</span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                    <Clock size={11} />
                    <span>{formatTime(timeLeft)} LEFT</span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="flex gap-2 items-start border border-accent-cyan/15 bg-accent-cyan/5 rounded-lg p-3">
                <ShieldAlert size={12} className="text-accent-cyan flex-shrink-0 mt-0.5" />
                <p className="text-[8px] text-text-secondary leading-normal">
                  Link automatically expires in 1 hour. Active observers will automatically lose connection when the link expires or the operator tab is closed.
                </p>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
