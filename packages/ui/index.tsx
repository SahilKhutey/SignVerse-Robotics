import * as React from "react";

// Components
export const Card = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#1E1E1E', padding: '1rem', borderRadius: '8px', color: 'white', border: '1px solid #333' }}>
    {children}
  </div>
);

export const TelemetryValue = ({ label, value }: { label: string, value: string | number }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', margin: '4px 0' }}>
    <span style={{ color: '#888' }}>{label}</span>
    <span style={{ color: '#0F0' }}>{value}</span>
  </div>
);

// Layout & Store
export * from './layout/DashboardLayout';

// Widgets
export * from './widgets/TelemetryWidget';
export * from './widgets/TerminalWidget';
