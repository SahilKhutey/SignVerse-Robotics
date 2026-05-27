import React from 'react';

export const TelemetryWidget = () => {
  return (
    <div className="p-4 font-mono text-sm">
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">FPS</span>
        <span className="text-green-500">60.0</span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">Latency</span>
        <span className="text-green-500">12ms</span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">GPU VRAM</span>
        <span className="text-green-500">4.2 GB</span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-500">Status</span>
        <span className="text-green-500">ACTIVE</span>
      </div>
    </div>
  );
};
