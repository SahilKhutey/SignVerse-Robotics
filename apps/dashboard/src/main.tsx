// 1. Zod Environment Variable Validation (Fail-Fast Boot)
import { VITE_API_URL, VITE_SENTRY_DSN } from './lib/env';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import * as Sentry from '@sentry/react';
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';
import { usePerformanceStore } from './store/performance';

// 2. Initialize Sentry Observability
const placeholderDsn = 'https://00000000000000000000000000000000@o000000.ingest.sentry.io/0000000';
Sentry.init({
  dsn: VITE_SENTRY_DSN || placeholderDsn,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Configure Session and User Scope tags for error telemetry
let sessionId = sessionStorage.getItem('signverse_session_id');
if (!sessionId) {
  sessionId = 'session_' + Math.random().toString(36).substring(2, 11);
  sessionStorage.setItem('signverse_session_id', sessionId);
}
Sentry.setTag('sessionId', sessionId);
Sentry.setTag('userId', 'operator_local_dev');

// 3. Web Vitals Observers (Report to Sentry + Performance Store)
onLCP((metric: Metric) => {
  usePerformanceStore.getState().updateMetric('lcp', metric.value);
  Sentry.captureMessage(`[Web Vitals] LCP: ${metric.value.toFixed(1)}ms`, {
    level: 'info',
    tags: { vital: 'LCP', value: metric.value }
  });
});

onINP((metric: Metric) => {
  usePerformanceStore.getState().updateMetric('fid', metric.value);
  Sentry.captureMessage(`[Web Vitals] INP: ${metric.value.toFixed(1)}ms`, {
    level: 'info',
    tags: { vital: 'INP', value: metric.value }
  });
});

onCLS((metric: Metric) => {
  usePerformanceStore.getState().updateMetric('cls', metric.value);
  Sentry.captureMessage(`[Web Vitals] CLS: ${metric.value.toFixed(3)}`, {
    level: 'info',
    tags: { vital: 'CLS', value: metric.value }
  });
});

// 4. Global FPS Tracker and store feed
if (typeof window !== 'undefined') {
  (window as any).__frameDeltas = [];
  let lastTime = performance.now();
  let lastFpsUpdate = 0;
  let frameCounter = 0;

  const trackFps = () => {
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;

    // Standard frame deltas list for E2E speed checks
    (window as any).__frameDeltas.push(delta);
    if ((window as any).__frameDeltas.length > 5000) {
      (window as any).__frameDeltas.shift();
    }

    frameCounter++;

    // Throttled p50 calculations sent to Zustand store at 2Hz (every 500ms)
    if (now - lastFpsUpdate > 500) {
      const elapsedSecs = (now - lastFpsUpdate) / 1000;
      const currentFps = Math.round(frameCounter / elapsedSecs);
      
      usePerformanceStore.getState().recordFps(currentFps);

      frameCounter = 0;
      lastFpsUpdate = now;
    }

    requestAnimationFrame(trackFps);
  };
  requestAnimationFrame(trackFps);
}

// 5. Mount Application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
