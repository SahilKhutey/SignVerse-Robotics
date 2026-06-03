import React from 'react';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { Webcam, Usb, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

export default function HardwarePanel() {
  const { data: status, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <Card id="hardware-panel" className="glass-panel overflow-hidden relative p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-white/5 shimmer-loader" />
            <div className="h-4 w-40 rounded bg-white/5 shimmer-loader" />
          </div>
          <div className="h-4 w-16 rounded bg-white/5 shimmer-loader" />
        </div>
        <div className="pt-2 flex flex-col gap-3">
          <div className="h-[58px] rounded bg-white/5 shimmer-loader" />
          <div className="h-[58px] rounded bg-white/5 shimmer-loader" />
        </div>
      </Card>
    );
  }

  const isWebcamConnected = status?.hardware?.webcamConnected ?? false;

  const isArduinoConnected = status?.hardware?.arduinoBridge === 'connected';
  const arduinoPort = status?.hardware?.arduinoDeviceName ?? 'COM3';

  return (
    <Card id="hardware-panel" className="glass-panel overflow-hidden relative">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-accent-cyan animate-spin-slow" />
          <CardTitle>HARDWARE SENSORS & BRIDGES</CardTitle>
        </div>
        <Badge variant="outline" className="text-[8px] tracking-widest text-text-secondary uppercase">
          PERIPHERALS
        </Badge>
      </CardHeader>

      <CardContent className="pt-5 flex flex-col gap-4">
        {/* Webcam connection row */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-all">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded bg-black/40 border border-white/5 ${isWebcamConnected ? 'text-accent-green' : 'text-text-muted'}`}>
              <Webcam size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[10px] font-bold text-text-primary uppercase tracking-wider">
                Pose Input Camera
              </span>
              <span className="text-[9px] text-text-secondary">
                {isWebcamConnected ? 'USB Webcam Video Capture device active' : 'No capture device detected on index:0'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isWebcamConnected ? (
              <>
                <CheckCircle2 size={12} className="text-accent-green" />
                <span id="webcam-status-text" className="font-mono text-[9px] font-bold text-accent-green uppercase">ACTIVE</span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-accent-red" />
                <span id="webcam-status-text" className="font-mono text-[9px] font-bold text-accent-red uppercase">MISSING</span>
              </>
            )}
          </div>
        </div>

        {/* Arduino Bridge connection row */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-all">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded bg-black/40 border border-white/5 ${isArduinoConnected ? 'text-accent-green' : 'text-text-muted'}`}>
              <Usb size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[10px] font-bold text-text-primary uppercase tracking-wider">
                  Microcontroller Bridge
                </span>
                {isArduinoConnected && (
                  <span className="font-mono text-[8px] text-accent-cyan bg-accent-cyan/10 px-1 py-0 rounded">
                    {arduinoPort}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-text-secondary">
                {isArduinoConnected 
                  ? 'Established actuator serial link at 115200 baud' 
                  : 'Serial Bridge offline. Running in simulation mode'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isArduinoConnected ? (
              <>
                <CheckCircle2 size={12} className="text-accent-green" />
                <span id="arduino-status-text" className="font-mono text-[9px] font-bold text-accent-green uppercase">CONNECTED</span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-accent-red animate-pulse" />
                <span id="arduino-status-text" className="font-mono text-[9px] font-bold text-accent-red uppercase">DISCONNECTED</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
