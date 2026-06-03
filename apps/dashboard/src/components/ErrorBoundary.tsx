import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack }
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-lg p-8 border border-accent-red/30 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-red via-red-500 to-accent-red animate-pulse" />
            
            <div className="w-16 h-16 rounded-full bg-accent-red/10 border border-accent-red/30 flex items-center justify-center mb-6 animate-bounce">
              <AlertTriangle className="h-8 w-8 text-accent-red" />
            </div>

            <h2 className="text-2xl font-display font-bold text-text-primary tracking-wider mb-2">
              SYSTEM RUNTIME CRASH
            </h2>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              The interface encountered an unexpected runtime exception. Recovering active process telemetry is recommended.
            </p>

            <div className="w-full bg-bg-dark/80 border border-panel-border rounded-lg p-4 mb-6 text-left font-mono text-xs overflow-x-auto max-h-48 scrollbar-thin">
              <p className="text-accent-red font-semibold mb-1">
                {this.state.error?.name || 'Error'}: {this.state.error?.message}
              </p>
              {this.state.errorInfo && (
                <pre className="text-[10px] text-text-muted leading-relaxed whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent-red hover:bg-accent-red/80 text-white font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-red shadow-lg active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Recovery Console
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
