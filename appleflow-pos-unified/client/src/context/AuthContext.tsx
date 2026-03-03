/**
 * AppleFlow POS - Authentication Context
 * BULLETPROOF EDITION - No login loops, no silent failures
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';

// Types
export type UserRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'STAFF';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  logout: () => void;
  clearError: () => void;
}

// Storage keys
const STORAGE_KEYS = {
  USER: 'af_user',
  TOKENS: 'af_tokens',
};

// API base URL - uses relative path for unified deployment
const API_BASE_URL = '';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);
    if (tokensStr) {
      try {
        const tokens = JSON.parse(tokensStr);
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
      } catch {
        // Invalid tokens, ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);
        if (!tokensStr) throw new Error('No tokens');
        
        const tokens = JSON.parse(tokensStr);
        
        // Try to refresh
        const response = await axios.post('/api/auth/refresh', {
          refreshToken: tokens.refreshToken,
        });
        
        if (response.data?.success) {
          const newTokens = {
            accessToken: response.data.data.accessToken,
            refreshToken: tokens.refreshToken, // Keep same refresh token
            expiresAt: Date.now() + (response.data.data.expiresIn * 1000),
          };
          
          localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(newTokens));
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // Refresh failed, clear auth
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.TOKENS);
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true, // Start loading until we check auth
    error: null,
  });

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const userStr = localStorage.getItem(STORAGE_KEYS.USER);
        const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);

        if (!userStr || !tokensStr) {
          // No stored auth data
          setState({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return;
        }

        const user: User = JSON.parse(userStr);
        const tokens: AuthTokens = JSON.parse(tokensStr);

        // Check if token is expired
        if (tokens.expiresAt < Date.now()) {
          // Token expired, try to refresh
          try {
            const response = await axios.post('/api/auth/refresh', {
              refreshToken: tokens.refreshToken,
            });

            if (response.data?.success) {
              const newTokens: AuthTokens = {
                accessToken: response.data.data.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: Date.now() + (response.data.data.expiresIn * 1000),
              };

              localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(newTokens));

              setState({
                user,
                tokens: newTokens,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return;
            }
          } catch {
            // Refresh failed, clear auth
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.TOKENS);
          }
        } else {
          // Token still valid
          setState({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }

        // If we get here, auth failed
        setState({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.TOKENS);
        setState({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (email: string, pin: string): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Validate inputs
      if (!email?.trim()) {
        throw new Error('Please enter your email address');
      }
      if (!pin?.trim()) {
        throw new Error('Please enter your PIN');
      }

      const response = await axios.post('/api/auth/login', { email, pin });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Login failed');
      }

      const { user: userData, tokens: tokenData } = response.data.data;

      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };

      const tokens: AuthTokens = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: Date.now() + (tokenData.expiresIn * 1000),
      };

      // Save to storage
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));

      setState({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      toast.success(`Welcome back, ${user.name}!`);
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage = 'Login failed. Please try again.';

      if (error.response) {
        const status = error.response.status;
        const serverMessage = error.response.data?.error;

        switch (status) {
          case 401:
            errorMessage = serverMessage || 'Invalid email or PIN';
            break;
          case 403:
            errorMessage = serverMessage || 'Account is disabled';
            break;
          case 429:
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
          default:
            errorMessage = serverMessage || `Error ${status}: Login failed`;
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
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
  }, []);

  // Logout function
  const logout = useCallback(() => {
    // Notify backend (optional, ignore errors)
    apiClient.post('/api/auth/logout').catch(() => {});

    // Clear storage
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKENS);

    // Reset state
    setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    toast.info('You have been logged out');
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
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

// Export apiClient for use in other components
export { apiClient };
