/**
 * AppleFlow POS - Enterprise Authentication Context
 * Fixed: Login loop, session persistence, role routing, token handling
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Types
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'cashier' | 'staff';

export interface UserPermissions {
  canProcessSales: boolean;
  canApplyDiscounts: boolean;
  canRefund: boolean;
  canVoid: boolean;
  canManageInventory: boolean;
  canManageProducts: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canOpenCloseShift: boolean;
  maxDiscountPercent: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: UserPermissions;
  storeId?: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: true,
    canVoid: true,
    canManageInventory: true,
    canManageProducts: true,
    canViewReports: true,
    canManageUsers: true,
    canOpenCloseShift: true,
    maxDiscountPercent: 100,
  },
  manager: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: true,
    canVoid: true,
    canManageInventory: true,
    canManageProducts: true,
    canViewReports: true,
    canManageUsers: true,
    canOpenCloseShift: true,
    maxDiscountPercent: 50,
  },
  supervisor: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: true,
    canVoid: true,
    canManageInventory: true,
    canManageProducts: false,
    canViewReports: true,
    canManageUsers: false,
    canOpenCloseShift: true,
    maxDiscountPercent: 30,
  },
  cashier: {
    canProcessSales: true,
    canApplyDiscounts: true,
    canRefund: false,
    canVoid: false,
    canManageInventory: false,
    canManageProducts: false,
    canViewReports: false,
    canManageUsers: false,
    canOpenCloseShift: false,
    maxDiscountPercent: 10,
  },
  staff: {
    canProcessSales: true,
    canApplyDiscounts: false,
    canRefund: false,
    canVoid: false,
    canManageInventory: false,
    canManageProducts: false,
    canViewReports: false,
    canManageUsers: false,
    canOpenCloseShift: false,
    maxDiscountPercent: 0,
  },
};

// Storage keys
const STORAGE_KEYS = {
  USER: 'af_user',
  TOKENS: 'af_tokens',
  LAST_ACTIVITY: 'af_last_activity',
};

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear error helper
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Check permission helper
  const hasPermission = useCallback((permission: keyof UserPermissions): boolean => {
    if (!state.user) return false;
    const value = state.user.permissions[permission];
    return typeof value === 'boolean' ? value : false;
  }, [state.user]);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
  }, []);

  // Clear all auth data
  const clearAuthData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKENS);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
  }, []);

  // Save auth data to storage
  const saveAuthData = useCallback((user: User, tokens: AuthTokens) => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
      updateActivity();
    } catch (error) {
      console.error('Failed to save auth data:', error);
    }
  }, [updateActivity]);

  // Load auth data from storage
  const loadAuthData = useCallback((): { user: User | null; tokens: AuthTokens | null } => {
    try {
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);
      
      if (!userStr || !tokensStr) return { user: null, tokens: null };

      const user: User = JSON.parse(userStr);
      const tokens: AuthTokens = JSON.parse(tokensStr);

      // Check session timeout
      const lastActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed > SESSION_TIMEOUT) {
          clearAuthData();
          return { user: null, tokens: null };
        }
      }

      // Check token expiration
      if (tokens.expiresAt < Date.now()) {
        return { user, tokens }; // Token expired but we have refresh token
      }

      return { user, tokens };
    } catch (error) {
      console.error('Failed to load auth data:', error);
      clearAuthData();
      return { user: null, tokens: null };
    }
  }, [clearAuthData]);

  // Setup activity monitoring
  const setupActivityMonitoring = useCallback(() => {
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed > SESSION_TIMEOUT) {
          logout();
          toast.info('Session expired due to inactivity');
        }
      }
    };

    activityTimerRef.current = setInterval(checkInactivity, 60000); // Check every minute

    // Update activity on user interaction
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => updateActivity();
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity]);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      
      try {
        const { user, tokens } = loadAuthData();
        
        if (user && tokens) {
          // Validate token with backend
          const isValid = await validateToken(tokens.accessToken);
          
          if (isValid) {
            setState({
              user,
              tokens,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            setupActivityMonitoring();
          } else {
            // Try to refresh token
            const refreshed = await refreshTokenInternal();
            if (!refreshed) {
              clearAuthData();
              setState({
                user: null,
                tokens: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
              });
            }
          }
        } else {
          setState({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearAuthData();
        setState({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Failed to initialize authentication',
        });
      }
    };

    initAuth();
  }, []);

  // Validate token with backend
  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/validate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Internal refresh token function
  const refreshTokenInternal = async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const { tokens } = loadAuthData();
        if (!tokens?.refreshToken) return false;

        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        
        if (data.success && data.data?.tokens) {
          const newTokens: AuthTokens = {
            accessToken: data.data.tokens.accessToken,
            refreshToken: data.data.tokens.refreshToken,
            expiresAt: Date.now() + (data.data.tokens.expiresIn * 1000),
          };

          const { user } = loadAuthData();
          if (user) {
            saveAuthData(user, newTokens);
            setState(prev => ({
              ...prev,
              tokens: newTokens,
              isAuthenticated: true,
            }));
            return true;
          }
        }
        return false;
      } catch (error) {
        console.error('Token refresh error:', error);
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  };

  // Public refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    return refreshTokenInternal();
  }, []);

  // Login function
  const login = useCallback(async (email: string, pin: string): Promise<void> => {
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null 
    }));

    try {
      // Validate inputs
      if (!email?.trim()) {
        throw new Error('Please enter your email address');
      }
      if (!pin?.trim()) {
        throw new Error('Please enter your PIN');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email address');
      }
      if (!/^\d{4,6}$/.test(pin)) {
        throw new Error('PIN must be 4-6 digits');
      }

      const response = await api.auth.login(email, pin);

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Login failed');
      }

      const { user: userData, tokens: tokenData } = response.data.data;

      // Build user object with permissions
      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        permissions: ROLE_PERMISSIONS[userData.role as UserRole] || ROLE_PERMISSIONS.staff,
        storeId: userData.storeId,
        avatar: userData.avatar,
      };

      const tokens: AuthTokens = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: Date.now() + (tokenData.expiresIn * 1000),
      };

      saveAuthData(user, tokens);

      setState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      setupActivityMonitoring();
      toast.success(`Welcome back, ${user.name}!`);

    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle specific error types
      let errorMessage = 'An unexpected error occurred';
      
      if (error.response) {
        // Server responded with error
        const status = error.response.status;
        const serverMessage = error.response.data?.error?.message;
        
        switch (status) {
          case 401:
            errorMessage = serverMessage || 'Invalid email or PIN';
            break;
          case 403:
            errorMessage = serverMessage || 'Account is disabled. Please contact your administrator';
            break;
          case 429:
            errorMessage = 'Too many login attempts. Please try again later';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later';
            break;
          default:
            errorMessage = serverMessage || `Error ${status}: Login failed`;
        }
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error. Please check your connection and try again';
      } else if (error.message) {
        // Client-side validation error
        errorMessage = error.message;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
      }));

      throw new Error(errorMessage);
    }
  }, [saveAuthData, setupActivityMonitoring]);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Notify backend of logout
      if (state.tokens?.accessToken) {
        await api.auth.logout().catch(() => {
          // Ignore logout API errors
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      clearAuthData();
      setState({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      toast.info('You have been logged out');
    }
  }, [state.tokens, clearAuthData]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protected routes - use inside components that need auth check
export function useRequireAuth(redirectTo: string = '/login') {
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  return { isAuthenticated, isLoading };
}
