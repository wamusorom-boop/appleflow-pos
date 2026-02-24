/**
 * AppleFlow POS - Error Boundary
 * Catches React errors and prevents app crashes
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { secureStorage } from '@/lib/security';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
    
    // Log to console for debugging
    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Log to secure storage for later analysis
    this.logError(error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  private logError(error: Error, errorInfo: ErrorInfo): void {
    try {
      const errorLog = {
        id: `err-${Date.now()}`,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      const logs = secureStorage.getItem('appleflow-error-logs') || [];
      logs.unshift(errorLog);
      
      // Keep only last 100 errors
      if (logs.length > 100) logs.pop();
      
      secureStorage.setItem('appleflow-error-logs', logs);
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private handleExportLogs = (): void => {
    try {
      const logs = secureStorage.getItem('appleflow-error-logs') || [];
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appleflow-error-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export logs:', e);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-200 mb-2">
              Something went wrong
            </h2>
            
            <p className="text-slate-400 mb-4">
              We apologize for the inconvenience. The error has been logged and we'll look into it.
            </p>

            {this.state.error && (
              <div className="bg-slate-800/50 rounded-lg p-3 mb-4 text-left">
                <p className="text-xs text-slate-500 mb-1">Error details:</p>
                <p className="text-sm text-red-400 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="border-slate-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              
              <Button
                onClick={this.handleReload}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="border-slate-700"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
              
              <Button
                onClick={this.handleExportLogs}
                variant="outline"
                className="border-slate-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Logs
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================
// ASYNC ERROR HANDLER
// ============================================

export function handleAsyncError(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  console.error(`Async error${context ? ` in ${context}` : ''}:`, error);
  
  // Log to secure storage
  try {
    const errorLog = {
      id: `async-${Date.now()}`,
      message,
      stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    const logs = secureStorage.getItem('appleflow-error-logs') || [];
    logs.unshift(errorLog);
    
    if (logs.length > 100) logs.pop();
    
    secureStorage.setItem('appleflow-error-logs', logs);
  } catch (e) {
    console.error('Failed to log async error:', e);
  }
}

// ============================================
// SAFE DATA LOADING HOOK
// ============================================

import { useState, useEffect, useCallback } from 'react';

interface UseSafeDataOptions<T> {
  key: string;
  defaultValue: T;
  validator?: (data: unknown) => data is T;
}

interface UseSafeDataResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useSafeData<T>({
  key,
  defaultValue,
  validator,
}: UseSafeDataOptions<T>): UseSafeDataResult<T> {
  const [data, setData] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const stored = secureStorage.getItem(key);
      
      if (stored === null) {
        setData(defaultValue);
      } else if (validator && !validator(stored)) {
        console.warn(`Data validation failed for ${key}, using default`);
        setData(defaultValue);
      } else {
        setData(stored as T);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(defaultValue);
      handleAsyncError(error, `useSafeData(${key})`);
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue, validator]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    error,
    reload: loadData,
  };
}

// ============================================
// DATA INTEGRITY CHECKER
// ============================================

export class DataIntegrityChecker {
  /**
   * Check for data corruption and inconsistencies
   */
  static checkIntegrity(): {
    isValid: boolean;
    issues: string[];
    fixes: string[];
  } {
    const issues: string[] = [];
    const fixes: string[] = [];

    // Check sales have valid items
    const sales = secureStorage.getItem('appleflow-sales') || [];
    for (const sale of sales) {
      if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) {
        issues.push(`Sale ${sale.id} has no items`);
      }
      if (typeof sale.total !== 'number' || sale.total < 0) {
        issues.push(`Sale ${sale.id} has invalid total`);
      }
    }

    // Check products have valid quantities
    const products = secureStorage.getItem('appleflow-products') || [];
    for (const product of products) {
      if (typeof product.quantity !== 'number' || product.quantity < 0) {
        issues.push(`Product ${product.id} has invalid quantity`);
      }
      if (typeof product.sellingPrice !== 'number' || product.sellingPrice < 0) {
        issues.push(`Product ${product.id} has invalid price`);
      }
    }

    // Check for orphaned records
    const customers = secureStorage.getItem('appleflow-customers') || [];
    const customerIds = new Set(customers.map((c: any) => c.id));
    
    for (const sale of sales) {
      if (sale.customerId && !customerIds.has(sale.customerId)) {
        issues.push(`Sale ${sale.id} references non-existent customer ${sale.customerId}`);
      }
    }

    // Check for duplicate IDs
    const allIds = new Set<string>();
    for (const product of products) {
      if (allIds.has(product.id)) {
        issues.push(`Duplicate product ID: ${product.id}`);
      }
      allIds.add(product.id);
    }

    return {
      isValid: issues.length === 0,
      issues,
      fixes,
    };
  }

  /**
   * Attempt to fix data integrity issues
   */
  static fixIntegrity(): { fixed: number; failed: number } {
    let fixed = 0;
    let failed = 0;

    // Fix negative quantities
    const products = secureStorage.getItem('appleflow-products') || [];
    for (const product of products) {
      if (product.quantity < 0) {
        product.quantity = 0;
        fixed++;
      }
    }
    secureStorage.setItem('appleflow-products', products);

    // Fix sales with no items
    const sales = secureStorage.getItem('appleflow-sales') || [];
    const validSales = sales.filter((sale: any) => 
      sale.items && Array.isArray(sale.items) && sale.items.length > 0
    );
    if (validSales.length < sales.length) {
      secureStorage.setItem('appleflow-sales', validSales);
      fixed += sales.length - validSales.length;
    }

    return { fixed, failed };
  }
}
