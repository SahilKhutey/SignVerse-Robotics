import React from 'react';
import { useLayoutStore } from '@signverse/state';

export const DashboardLayout = ({ children, renderWidget }: { children?: React.ReactNode, renderWidget: (id: string) => React.ReactNode }) => {
  const panels = useLayoutStore(state => state.panels);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0A0A0A', color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ padding: '12px 24px', backgroundColor: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '1px' }}>Sign-Verse OS // Mission Control</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {panels.map(p => (
            <button key={p.id} onClick={() => useLayoutStore.getState().togglePanel(p.id)}
              style={{ background: p.isOpen ? '#007ACC' : '#333', color: '#FFF', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              {p.title}
            </button>
          ))}
        </div>
      </header>
      
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '16px', padding: '16px' }}>
        {panels.filter(p => p.isOpen).map(p => (
          <div key={p.id} style={{ 
            gridColumn: `span ${p.w}`, 
            gridRow: `span ${p.h}`,
            backgroundColor: '#1E1E1E', 
            borderRadius: '8px', 
            border: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ backgroundColor: '#252526', padding: '8px 12px', fontSize: '12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ fontWeight: 600, color: '#AAA' }}>{p.title}</span>
               <button onClick={() => useLayoutStore.getState().togglePanel(p.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer'}}>âœ•</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
               {renderWidget(p.id)}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};
