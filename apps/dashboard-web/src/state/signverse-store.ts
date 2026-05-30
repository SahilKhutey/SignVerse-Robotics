'use client';

/**
 * SignVerse OS — Global Zustand Store (Phase 17 — Sync Fixed)
 * ============================================================
 * Fixes applied:
 *   ✓ Exponential backoff reconnect with ±20% jitter (cap 30s)
 *   ✓ Ping/PONG RTT latency measurement (not JSON parse time)
 *   ✓ All violations stored (hard + soft), not just hard
 *   ✓ Proper cleanup on stopWebSocket()
 *   ✓ Stale stream detection (lastFrameTs exported)
 */

import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InferenceMode =
  | 'ai_inference'
  | 'retargeted'
  | 'math_fallback'
  | 'cognitive_override'
  | 'SHUTDOWN'
  | 'ERROR'
  | 'CONNECTING'
  | 'DISCONNECTED';

export interface ViolationRecord {
  joint:     string;
  requested: number;
  clamped:   number;
  severity:  'soft' | 'hard';
  limit_hit: 'lower' | 'upper';
  ts?:       number;
}

export interface RetargetingData {
  violations:    ViolationRecord[];
  source_angles: Record<string, number>;
  smoothed:      boolean;
}

export interface TelemetryFrame {
  status:       string;
  mode:         InferenceMode;
  q_target:     [number, number, number];
  fps:          number;
  gpu_vram_mb:  number;
  last_update:  number;
  retargeting?: RetargetingData;
}

export interface LogEntry {
  id:        number;
  ts:        number;
  mode:      InferenceMode;
  q_target:  [number, number, number];
  fps:       number;
  violation: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const WS_URL          = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/telemetry';
export const API_URL         = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const MAX_LOG_LINES           = 60;
const MAX_VIOLATIONS          = 100;
const BACKOFF_BASE_MS         = 1000;
const BACKOFF_MAX_MS          = 30_000;
const STALE_THRESHOLD_MS      = 5_000;   // mark stream stale after 5s of no frames

export const JOINT_LIMITS: Record<string, [number, number]> = {
  J0: [0,            Math.PI / 2],
  J1: [-Math.PI / 4, Math.PI / 4],
  J2: [0,            (Math.PI * 5) / 6],
};

export const JOINT_LABELS: Record<string, string> = {
  J0: 'Shoulder Abduction',
  J1: 'Shoulder Roll',
  J2: 'Elbow Flexion',
};

// ── Store ─────────────────────────────────────────────────────────────────────

let _logId = 0;

interface SignVerseState {
  // Connection
  wsStatus:    'connecting' | 'connected' | 'disconnected' | 'error';
  wsLatencyMs: number;
  lastFrameTs: number;     // unix ms of last received SYSTEM_METRICS frame

  // Latest telemetry
  frame:      TelemetryFrame | null;
  frameCount: number;

  // History
  log:        LogEntry[];
  violations: ViolationRecord[];

  // Training stats (polled from REST)
  trainingStats: Record<string, unknown> | null;

  // Internal setters
  _setFrame:         (f: TelemetryFrame) => void;
  _setWsStatus:      (s: SignVerseState['wsStatus']) => void;
  _setLatency:       (ms: number) => void;
  _addViolations:    (vs: ViolationRecord[]) => void;
  _setTrainingStats: (s: Record<string, unknown>) => void;
}

export const useSignVerseStore = create<SignVerseState>((set) => ({
  wsStatus:      'disconnected',
  wsLatencyMs:   0,
  lastFrameTs:   0,
  frame:         null,
  frameCount:    0,
  log:           [],
  violations:    [],
  trainingStats: null,

  _setFrame: (f) => set((s) => {
    const entry: LogEntry = {
      id:        ++_logId,
      ts:        Date.now(),
      mode:      f.mode,
      q_target:  f.q_target,
      fps:       f.fps,
      violation: (f.retargeting?.violations?.length ?? 0) > 0,
    };
    return {
      frame:      f,
      frameCount: s.frameCount + 1,
      lastFrameTs: Date.now(),
      log:        [entry, ...s.log].slice(0, MAX_LOG_LINES),
    };
  }),

  _setWsStatus:  (wsStatus)     => set({ wsStatus }),
  _setLatency:   (wsLatencyMs)  => set({ wsLatencyMs }),

  // Fix #8: store ALL violations (hard + soft)
  _addViolations: (vs) => set((s) => ({
    violations: [
      ...vs.map(v => ({ ...v, ts: Date.now() })),
      ...s.violations,
    ].slice(0, MAX_VIOLATIONS),
  })),

  _setTrainingStats: (trainingStats) => set({ trainingStats }),
}));

// ── Stale stream detector (derived selector) ──────────────────────────────────

export function selectIsStale(state: SignVerseState): boolean {
  if (state.wsStatus !== 'connected') return false;
  return state.lastFrameTs > 0 && (Date.now() - state.lastFrameTs) > STALE_THRESHOLD_MS;
}

// ── WebSocket manager ─────────────────────────────────────────────────────────

let _ws:              WebSocket | null = null;
let _reconnectTimer:  ReturnType<typeof setTimeout> | null = null;
let _pingTimer:       ReturnType<typeof setInterval> | null = null;
let _pollTimer:       ReturnType<typeof setInterval> | null = null;
let _attempt:         number = 0;

/**
 * Exponential backoff with ±20% jitter, capped at BACKOFF_MAX_MS.
 */
function _nextBackoffMs(): number {
  const base    = Math.min(BACKOFF_BASE_MS * 2 ** _attempt, BACKOFF_MAX_MS);
  const jitter  = base * 0.2 * (Math.random() * 2 - 1);   // ±20%
  return Math.round(base + jitter);
}

function _connect() {
  if (_ws && _ws.readyState <= WebSocket.OPEN) return;

  const store = useSignVerseStore.getState();
  store._setWsStatus('connecting');
  _ws = new WebSocket(WS_URL);

  _ws.onopen = () => {
    _attempt = 0;    // reset backoff on successful connection
    store._setWsStatus('connected');
    // Send sync handshake
    _ws?.send(JSON.stringify({ action: 'sync', last_received_timestamp: 0 }));
    // Start ping timer for RTT measurement
    _startPing();
  };

  _ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data as string);
      const s   = useSignVerseStore.getState();

      if (msg.type === 'SYSTEM_METRICS' && msg.payload) {
        const f: TelemetryFrame = msg.payload;
        s._setFrame(f);

        // Fix #8: collect ALL violations, not just hard
        const vs = f.retargeting?.violations ?? [];
        if (vs.length > 0) s._addViolations(vs);
      }

      if (msg.type === 'RTT') {
        s._setLatency(msg.rtt_ms ?? 0);
      }

      if (msg.type === 'PING') {
        // Echo PONG so the server can measure RTT
        _ws?.send(JSON.stringify({ action: 'PONG', ts: msg.ts }));
      }

    } catch { /* malformed frame — ignore */ }
  };

  _ws.onerror = () => useSignVerseStore.getState()._setWsStatus('error');

  _ws.onclose = () => {
    _stopPing();
    useSignVerseStore.getState()._setWsStatus('disconnected');
    _scheduleReconnect();
  };
}

function _startPing() {
  _stopPing();
  _pingTimer = setInterval(() => {
    if (_ws?.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ action: 'PONG', ts: Date.now() / 1000 }));
    }
  }, 10_000);   // every 10s — complementary to server's 30s ping
}

function _stopPing() {
  if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
}

function _scheduleReconnect() {
  if (_reconnectTimer) clearTimeout(_reconnectTimer);
  _attempt++;
  const delay = _nextBackoffMs();
  _reconnectTimer = setTimeout(_connect, delay);
}

// ── Training stats poller ─────────────────────────────────────────────────────

async function _pollTrainingStats() {
  try {
    const res = await fetch(`${API_URL}/api/training/status`);
    if (res.ok) {
      const data = await res.json();
      useSignVerseStore.getState()._setTrainingStats(data.stats ?? {});
    }
  } catch { /* gateway not available */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startWebSocket() {
  if (typeof window === 'undefined') return;
  _connect();
  // Poll training stats every 3s
  _pollTimer = setInterval(_pollTrainingStats, 3_000);
}

export function stopWebSocket() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer);  _reconnectTimer = null; }
  if (_pingTimer)      { clearInterval(_pingTimer);       _pingTimer = null; }
  if (_pollTimer)      { clearInterval(_pollTimer);       _pollTimer = null; }
  _ws?.close();
  _ws = null;
  _attempt = 0;
}
