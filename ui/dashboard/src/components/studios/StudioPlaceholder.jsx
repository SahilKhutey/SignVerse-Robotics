import React from 'react';

export const StudioPlaceholder = ({ title, description, icon }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: 'var(--color-on-surface)',
      textAlign: 'center',
      padding: '40px'
    }}>
      <div style={{
        fontSize: '64px',
        marginBottom: '24px',
        opacity: 0.8
      }}>
        {icon}
      </div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '32px',
        color: 'var(--color-primary)',
        margin: '0 0 16px 0',
        letterSpacing: '-0.02em'
      }}>
        {title}
      </h2>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '18px',
        color: 'var(--color-on-surface-variant)',
        maxWidth: '600px',
        lineHeight: 1.6
      }}>
        {description}
      </p>
      <div style={{
        marginTop: '40px',
        padding: '12px 24px',
        border: '1px solid rgba(0, 255, 136, 0.2)',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(0, 255, 136, 0.05)',
        color: 'var(--color-primary)',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        Backend Integration Pending
      </div>
    </div>
  );
};
