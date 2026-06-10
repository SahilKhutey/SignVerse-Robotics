import { vi } from 'vitest';
import React from 'react';

// Setup mock env vars before any modules import env.ts
import.meta.env.VITE_API_URL = 'http://localhost:8000';
import.meta.env.VITE_WS_URL = 'ws://localhost:8000';

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

const suppressedReactThreeMessages = [
  'is using incorrect casing',
  'is unrecognized in this browser',
  'React does not recognize the `%s` prop',
  'React does not recognize the `castShadow` prop',
  'React does not recognize the `receiveShadow` prop',
  'React does not recognize the `emissiveIntensity` prop',
  'React does not recognize the `enableDamping` prop',
  'React does not recognize the `dampingFactor` prop',
  'React does not recognize the `maxPolarAngle` prop',
  'React does not recognize the `minDistance` prop',
  'React does not recognize the `maxDistance` prop',
  'Received `%s` for a non-boolean attribute `%s`',
  'Function components cannot be given refs',
  'Received `true` for a non-boolean attribute `shadows`',
];

const shouldSuppressReactThreeWarning = (args: unknown[]) => {
  const message = String(args[0] ?? '');
  return suppressedReactThreeMessages.some((pattern) => message.includes(pattern));
};

console.error = (...args: unknown[]) => {
  if (shouldSuppressReactThreeWarning(args)) return;
  originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
  if (shouldSuppressReactThreeWarning(args)) return;
  originalConsoleWarn(...args);
};

// Mock recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => React.createElement('div', null, children),
    LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
    Line: ({ stroke, name, dataKey }: any) =>
      React.createElement('div', {
        'data-testid': 'chart-line',
        'data-stroke': stroke,
        'data-name': name,
        'data-key': dataKey,
      }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

// Mock ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock HTMLElement prototype to include rotation for R3F group refs in jsdom
Object.defineProperty(globalThis.HTMLElement.prototype, 'rotation', {
  get() {
    if (!(this as any)._rotation) {
      (this as any)._rotation = { x: 0, y: 0, z: 0 };
    }
    return (this as any)._rotation;
  },
  set(val) {
    (this as any)._rotation = val;
  },
  configurable: true,
});

// Define three.js properties on HTMLElement prototype for DOM elements that act as mocked material refs
Object.defineProperty(globalThis.HTMLElement.prototype, 'color', {
  get() {
    if (!this._color) {
      this._color = {
        setStyle: vi.fn(),
        setHSL: vi.fn(),
      };
    }
    return this._color;
  },
  configurable: true,
});

Object.defineProperty(globalThis.HTMLElement.prototype, 'emissive', {
  get() {
    if (!this._emissive) {
      this._emissive = {
        setStyle: vi.fn(),
        setHSL: vi.fn(),
      };
    }
    return this._emissive;
  },
  configurable: true,
});

const materialProps = ['emissiveIntensity', 'transparent', 'opacity'];
materialProps.forEach((prop) => {
  Object.defineProperty(globalThis.HTMLElement.prototype, prop, {
    get() {
      return this[`_${prop}`] !== undefined ? this[`_${prop}`] : (prop === 'emissiveIntensity' ? 0.8 : prop === 'transparent' ? false : 1.0);
    },
    set(val) {
      this[`_${prop}`] = val;
    },
    configurable: true,
  });
});

// Mock RTCPeerConnection and related APIs for WebRTC testing
class MockRTCPeerConnection {
  connectionState = 'new';
  onicecandidate = null;
  ondatachannel = null;
  onconnectionstatechange = null;
  
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' });
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  getStats = vi.fn().mockResolvedValue(new Map());
  close = vi.fn();
}
globalThis.RTCPeerConnection = MockRTCPeerConnection as any;
globalThis.RTCIceCandidate = class {} as any;
globalThis.RTCSessionDescription = class {
  type: string; sdp: string;
  constructor({ type, sdp }: any) {
    this.type = type; this.sdp = sdp;
  }
} as any;

// Mock three.js
vi.mock('three', () => {
  const THREE = {
    Vector3: class {
      x: number; y: number; z: number;
      constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
      }
      clone() { return new THREE.Vector3(this.x, this.y, this.z); }
      lerp(target: any, alpha: number) {
        this.x += (target.x - this.x) * alpha;
        this.y += (target.y - this.y) * alpha;
        this.z += (target.z - this.z) * alpha;
        return this;
      }
      distanceTo(target: any) {
        return Math.sqrt(
          Math.pow(this.x - target.x, 2) +
          Math.pow(this.y - target.y, 2) +
          Math.pow(this.z - target.z, 2)
        );
      }
      set(x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z;
        return this;
      }
    },
    MathUtils: {
      lerp: (a: number, b: number, t: number) => a + (b - a) * t,
    },
    Group: class {
      rotation = { x: 0, y: 0, z: 0 };
    },
    MeshStandardMaterial: class {
      color = {
        setStyle: vi.fn(),
        setHSL: vi.fn(),
      };
      emissive = {
        setStyle: vi.fn(),
        setHSL: vi.fn(),
      };
      emissiveIntensity = 0;
      transparent = false;
      opacity = 1;
    },
  };
  return THREE;
});

// Mock react-three-fiber
vi.mock('@react-three/fiber', () => {
  return {
    Canvas: ({ children, role, 'aria-label': ariaLabel }: any) =>
      React.createElement('div', { 'data-testid': 'mock-canvas', role, 'aria-label': ariaLabel }, children),
    useFrame: (callback: any) => {
      // Store callbacks globally for lerp test triggering
      (globalThis as any).__useFrameCallbacks = (globalThis as any).__useFrameCallbacks || [];
      (globalThis as any).__useFrameCallbacks.push(callback);
    },
    useThree: () => ({
      camera: {
        position: new (require('three').Vector3)(),
      },
    }),
  };
});

// Mock react-three-drei
vi.mock('@react-three/drei', () => {
  const OrbitControls = React.forwardRef<HTMLDivElement, any>(({ children }: any, ref) =>
    React.createElement('div', { ref, 'data-testid': 'mock-orbit-controls' }, children)
  );

  return {
    OrbitControls,
    Grid: () => null,
    Environment: () => null,
    Html: ({ children }: any) => React.createElement('div', { 'data-testid': 'mock-html' }, children),
  };
});
