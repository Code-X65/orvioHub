import { Component, type ReactNode, type ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    if (typeof (window as any).Sentry?.captureException === 'function') {
      (window as any).Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 select-none">
          <div className="max-w-md w-full rounded-2xl border border-[#714B67]/30 bg-[#161214]/80 backdrop-blur-xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Ambient decorative glow */}
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-[#D97706]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-[#714B67]/15 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#714B67]/20 border border-[#714B67]/40 text-[#D97706] mb-5">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              We encountered an unexpected error while rendering this surface. Your data is safe. You can retry or reload the page.
            </p>

            {this.state.error && import.meta.env.DEV && (
              <div className="text-left bg-black/50 border border-neutral-800 rounded-lg p-3 mb-6 text-xs text-red-400 font-mono overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-[#714B67] hover:bg-[#85587a] active:scale-95 transition-all text-sm font-medium text-white shadow-md shadow-[#714B67]/25"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg border border-neutral-700 hover:border-neutral-500 bg-neutral-900/60 hover:bg-neutral-800/80 active:scale-95 transition-all text-sm font-medium text-neutral-300"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
