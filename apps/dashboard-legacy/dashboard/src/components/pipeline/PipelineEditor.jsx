import React, { useCallback } from 'react';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom Nodes styling
const nodeStyle = {
  background: 'var(--os-bg-panel)',
  color: 'var(--os-text-primary)',
  border: '1px solid var(--os-border-color)',
  borderRadius: '4px',
  padding: '10px',
  fontFamily: 'var(--os-font-mono)',
  fontSize: '11px',
  width: '150px',
  textAlign: 'center',
};

const initialNodes = [
  { id: '1', type: 'input', position: { x: 50, y: 50 }, data: { label: 'Webcam Capture' }, style: { ...nodeStyle, borderColor: '#3b82f6' } },
  { id: '2', position: { x: 50, y: 150 }, data: { label: 'Pose Detection' }, style: { ...nodeStyle, borderColor: '#10b981' } },
  { id: '3', position: { x: 50, y: 250 }, data: { label: 'Gesture Recognition' }, style: { ...nodeStyle, borderColor: '#f59e0b' } },
  { id: '4', position: { x: 250, y: 250 }, data: { label: 'Kinematic Retarget' }, style: { ...nodeStyle, borderColor: '#8b5cf6' } },
  { id: '5', type: 'output', position: { x: 250, y: 350 }, data: { label: 'Robot Output' }, style: { ...nodeStyle, borderColor: '#ef4444' } },
  { id: '6', type: 'output', position: { x: 50, y: 350 }, data: { label: 'Semantic Output' }, style: { ...nodeStyle, borderColor: '#ef4444' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: 'var(--os-accent-primary)' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: 'var(--os-accent-primary)' } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: 'var(--os-accent-primary)' } },
  { id: 'e4-5', source: '4', target: '5', animated: true, style: { stroke: 'var(--os-accent-primary)' } },
  { id: 'e3-6', source: '3', target: '6', animated: true, style: { stroke: 'var(--os-accent-primary)' } },
];

export function PipelineEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', background: 'var(--os-bg-panel)', borderBottom: '1px solid var(--os-border-color)' }}>
        <h3 style={{ margin: 0, fontSize: '12px', color: 'var(--os-text-primary)' }}>Motion Pipeline Graph</h3>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          colorMode="dark"
        >
          <Controls style={{ background: 'var(--os-bg-panel)' }} />
          <MiniMap style={{ background: 'var(--os-bg-panel)' }} nodeStrokeColor="#10b981" nodeColor="var(--os-bg-base)" />
          <Background variant="dots" gap={12} size={1} color="var(--os-border-color)" />
        </ReactFlow>
      </div>
    </div>
  );
}
