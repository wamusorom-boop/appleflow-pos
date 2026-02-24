/**
 * AppleFlow POS - Authentication Context
 * Manages user authentication state, login/logout, and permissions
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, TokenManager, APIError } from '@/lib/api';
import type { User, UserRole, UserPermissions } from '@/types';

// Permission definitions by role
const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: true,
    canVoid: true,
    canViewReports: true,
    canManageProducts: true,
    canManageUsers: true,
    canOpenCloseShift: true,
    canViewAnalytics: true,
    maxDiscountPercent: 100,
  },
  manager: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: true,
    canVoid: true,
    canViewReports: true,
    canManageProducts: true,
    canManageUsers: false,
    canOpenCloseShift: true,
    canViewAnalytics: true,
    maxDiscountPercent: 50,
  },
  supervisor: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: true,
    canVoid: true,
    canViewReports: true,
    canManageProducts: false,
    canManageUsers: false,
    canOpenCloseShift: true,
    canViewAnalytics: false,
    maxDiscountPercent: 30,
  },
  cashier: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: false,
    canVoid: false,
    canViewReports: false,
    canManageProducts: false,
    canManageUsers: false,
    canOpenCloseShift: true,
    canViewAnalytics: false,
    maxDiscountPercent: 10,
  },
};

// Auth state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth context interface
interface AuthContextType extends AuthState {
  login: (email: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  canApplyDiscount: (percent: number) => boolean;
  checkPermission: (permission: keyof UserPermissions) => boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;
// Token refresh interval (5 minutes before expiry)
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (tokenRefreshRef.current) {
      clearInterval(tokenRefreshRef.current);
      tokenRefreshRef.current = null;
    }
  }, []);

  // Setup session timeout
  const setupSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    sessionTimeoutRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT);
  }, []);

  // Setup token refresh
  const setupTokenRefresh = useCallback(() => {
    if (tokenRefreshRef.current) {
      clearInterval(tokenRefreshRef.current);
    }
    tokenRefreshRef.current = setInterval(() => {
      if (TokenManager.isTokenExpired()) {
        refreshToken();
      }
    }, TOKEN_REFRESH_INTERVAL);
  }, []);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (state.isAuthenticated) {
      setupSessionTimeout();
    }
  }, [state.isAuthenticated, setupSessionTimeout]);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = TokenManager.getAccessToken();
      
      if (!token) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Token exists, try to get user info
        const response = await api.auth.me();
        const userData = response.data.data;
        
        // Merge with role permissions
        const user: User = {
          ...userData,
          permissions: ROLE_PERMISSIONS[userData.role as UserRole] || ROLE_PERMISSIONS.cashier,
        };

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        setupSessionTimeout();
        setupTokenRefresh();
      } catch (error) {
        // Token invalid or expired
        TokenManager.clearTokens();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    checkAuth();

    return () => {
      clearTimers();
    };
  }, [clearTimers, setupSessionTimeout, setupTokenRefresh]);

  // Activity listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity]);

  // Login function
  const login = async (email: string, pin: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.auth.login(email, pin);
      const { user: userData, tokens } = response.data.data;

      // Store tokens
      TokenManager.setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

      // Merge with role permissions
      const user: User = {
        ...userData,
        permissions: ROLE_PERMISSIONS[userData.role as UserRole] || ROLE_PERMISSIONS.cashier,
      };

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      setupSessionTimeout();
      setupTokenRefresh();
    } catch (error) {
      let errorMessage = 'Login failed';
      
      if (error instanceof APIError) {
        switch (error.code) {
          case 'INVALID_CREDENTIALS':
            errorMessage = 'Invalid email or PIN';
            break;
          case 'ACCOUNT_DISABLED':
            errorMessage = 'Your account has been disabled';
            break;
          case 'VALIDATION_ERROR':
            errorMessage = 'Please check your input';
            break;
          default:
            errorMessage = error.message;
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      TokenManager.clearTokens();
      clearTimers();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    const refreshToken = TokenManager.getRefreshToken();
    
    if (!refreshToken) {
      logout();
      return false;
    }

    try {
      const response = await api.auth.refresh(refreshToken);
      const { accessToken, expiresIn } = response.data.data;
      TokenManager.setTokens(accessToken, refreshToken, expiresIn);
      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  // Clear error
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  // Check if user has a specific permission
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!state.user) return false;
    return state.user.permissions[permission] === true;
  };

  // Check if user can apply a specific discount percentage
  const canApplyDiscount = (percent: number): boolean => {
    if (!state.user) return false;
    return state.user.permissions.canApplyDiscounts && 
           state.user.permissions.maxDiscountPercent >= percent;
  };

  // Alias for hasPermission
  const checkPermission = hasPermission;

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
    hasPermission,
    canApplyDiscount,
    checkPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: keyof UserPermissions
) {
  return function WithAuthComponent(props: P) {
    const { isAuthenticated, isLoading, hasPermission } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Hook for permission-based rendering
export function usePermission(permission: keyof UserPermissions) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

// Hook for role-based rendering
export function useRole() {
  const { user } = useAuth();
  return {
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isSupervisor: user?.role === 'supervisor',
    isCashier: user?.role === 'cashier',
  };
}
