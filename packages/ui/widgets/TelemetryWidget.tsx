import React from 'react';
import { TelemetryValue } from '../index';

export const TelemetryWidget = ({ data }: { data: any }) => {
  return (
    <div style={{ padding: '16px' }}>
       <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#888' }}>System Vitals</h3>
       <TelemetryValue label="FPS" value={data?.fps || "60.0"} />
       <TelemetryValue label="Latency" value={data?.latency || "12ms"} />
       <TelemetryValue label="GPU VRAM" value={data?.vram || "4.2 GB"} />
       <TelemetryValue label="Active Workers" value={data?.workers || "3"} />
       <TelemetryValue label="Robot Status" value={data?.status || "IDLE"} />
    </div>
  );
};
