/**
 * AppleFlow POS - Error Boundary Component
 * Catches JavaScript errors and displays a fallback UI
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log to error tracking service in production
    const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;
    if (isProd) {
      // TODO: Send to error tracking service
      // Example: Sentry.captureException(error);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Something went wrong
              </h1>
              
              <p className="text-slate-500 mb-6">
                We&apos;re sorry, but an unexpected error occurred. Please try refreshing the page.
              </p>

              {typeof import.meta !== 'undefined' && import.meta.env?.DEV && this.state.error && (
                <div className="mb-6 p-4 bg-slate-100 rounded-lg text-left overflow-auto max-h-48">
                  <p className="text-sm font-mono text-red-600 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={this.handleReload}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={this.handleGoHome}
                >
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
