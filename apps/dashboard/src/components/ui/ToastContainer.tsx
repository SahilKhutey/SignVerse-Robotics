import React, { useEffect } from 'react';
import { useToastStore, Toast } from '../../store/toast';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-full max-w-sm"
      role="live"
      aria-label="System Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 6000); // 6 seconds auto-dismiss
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-accent-green" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-accent-red" />;
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-accent-cyan" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-accent-green/30 hover:border-accent-green/60';
      case 'error':
        return 'border-accent-red/30 hover:border-accent-red/60';
      case 'warn':
        return 'border-yellow-500/30 hover:border-yellow-500/60';
      default:
        return 'border-accent-cyan/30 hover:border-accent-cyan/60';
    }
  };

  return (
    <div
      className={`glass-card flex gap-3 items-start border p-4 shadow-lg backdrop-blur-md rounded-xl transition-all duration-300 relative ${getBorderColor()}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-semibold text-text-primary mb-1">
          {toast.type.charAt(0).toUpperCase() + toast.type.slice(1)} Notification
        </p>
        <p className="text-xs text-text-secondary leading-relaxed break-words">{toast.message}</p>
        
        {toast.code && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-bg-dark border border-panel-border text-text-secondary">
              Code: {toast.code}
            </span>
          </div>
        )}
        
        {toast.action && (
          <p className="mt-2 text-xs text-accent-cyan font-medium flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></span>
            Action: {toast.action}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute top-3 right-3 text-text-muted hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan rounded-md p-1 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
