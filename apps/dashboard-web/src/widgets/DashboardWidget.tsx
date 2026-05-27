import React from 'react';
import { TelemetryWidget } from './TelemetryWidget';
import { TerminalWidget } from './TerminalWidget';

export const DashboardWidget = ({ id, type, title }: { id: string, type: string, title: string }) => {
  const renderWidgetContent = () => {
    switch(type) {
      case 'telemetry': return <TelemetryWidget />;
      case 'terminal': return <TerminalWidget />;
      case 'viewport': return <div className="p-4 text-gray-500 h-full flex items-center justify-center">[ 3D VIEWPORT ]</div>;
      default: return <div className="text-red-500">Unknown Widget</div>;
    }
  };

  return (
    <>
      <div className="widget-drag-handle bg-[#252526] px-3 py-1.5 border-b border-[#333] flex justify-between items-center cursor-move">
        <span className="text-xs font-semibold text-gray-400">{title}</span>
        <button className="text-gray-600 hover:text-white text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-auto relative">
        {renderWidgetContent()}
      </div>
    </>
  );
};
