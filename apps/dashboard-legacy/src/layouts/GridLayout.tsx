'use client';
import React from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { DashboardWidget } from '@/widgets/DashboardWidget';

const ReactGridLayout = WidthProvider(RGL);

export const GridLayout = () => {
  const { widgets, layout, setLayout } = useWorkspaceStore();

  return (
    <ReactGridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={100}
      width={1200}
      onLayoutChange={setLayout}
      draggableHandle=".widget-drag-handle"
      margin={[16, 16]}
    >
      {widgets.map(w => (
        <div key={w.id} className="bg-[#1e1e1e] border border-[#333] rounded-md overflow-hidden flex flex-col shadow-xl">
          <DashboardWidget id={w.id} type={w.type} title={w.title} />
        </div>
      ))}
    </ReactGridLayout>
  );
};
