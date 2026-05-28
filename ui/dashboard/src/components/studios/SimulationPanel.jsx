import React from 'react';
import { TelemetryPanel } from '../TelemetryPanel';
import { StagePanel } from '../StagePanel';
import { SystemLogs } from '../SystemLogs';
import { CommandConsole } from '../CommandConsole';

export const SimulationPanel = ({ telemetry, logs, onCommandSend, apiError }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div className="layout-grid" style={{ flex: 1 }}>
        <TelemetryPanel telemetry={telemetry} />
        <StagePanel telemetry={telemetry} />
        <SystemLogs logs={logs} />
      </div>

      {/* Floating Command Overlay */}
      <CommandConsole onCommandSend={onCommandSend} apiError={apiError} />
    </div>
  );
};
