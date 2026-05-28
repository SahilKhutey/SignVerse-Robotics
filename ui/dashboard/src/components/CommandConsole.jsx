import React, { useState } from 'react';

export const CommandConsole = ({ onCommandSend, apiError }) => {
  const [command, setCommand] = useState('');
  const [apiKey, setApiKey] = useState('signverse_local_dev_key'); // Default for local dev

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    onCommandSend(command, apiKey);
    setCommand('');
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '600px',
      padding: '16px 24px',
      background: 'rgba(20, 24, 20, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)', fontFamily: 'var(--font-display)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Cognitive NLP Override
        </h3>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          style={{
            padding: '4px 8px',
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-on-surface-variant)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            width: '180px',
            outline: 'none'
          }}
        />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="e.g. 'Raise the arm 90 degrees'"
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--color-on-surface)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
        />
        <button type="submit" className="btn-primary" style={{
          padding: '0 24px',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          letterSpacing: '0.05em'
        }}>
          SEND
        </button>
      </form>
      
      {apiError && (
        <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '-4px' }}>
          Error: {apiError}
        </div>
      )}
    </div>
  );
};
