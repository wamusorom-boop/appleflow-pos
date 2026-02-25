/**
 * AppleFlow POS - API Client
 * Fixed: Better error handling, request/response interceptors, token refresh
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { toast } from 'sonner';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Storage keys
const STORAGE_KEYS = {
  USER: 'af_user',
  TOKENS: 'af_tokens',
};

// Custom error class
export class ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  
  constructor(
    message: string,
    statusCode?: number,
    code?: string,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from storage
    const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);
    if (tokensStr) {
      try {
        const tokens = JSON.parse(tokensStr);
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
      } catch (e) {
        console.error('Failed to parse tokens:', e);
      }
    }
    
    // Add request timestamp for debugging
    config.headers['X-Request-Time'] = new Date().toISOString();
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    
    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const tokensStr = localStorage.getItem(STORAGE_KEYS.TOKENS);
        if (!tokensStr) {
          throw new Error('No refresh token available');
        }
        
        const tokens = JSON.parse(tokensStr);
        
        // Try to refresh token
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: tokens.refreshToken,
        });
        
        if (refreshResponse.data?.success && refreshResponse.data?.data?.tokens) {
          const newTokens = refreshResponse.data.data.tokens;
          
          // Update stored tokens
          localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt: Date.now() + (newTokens.expiresIn * 1000),
          }));
          
          // Retry original request with new token
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - clear auth and redirect to login
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.TOKENS);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other errors
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data as any;
      
      let errorMessage = 'An unexpected error occurred';
      
      switch (status) {
        case 400:
          errorMessage = data?.error?.message || 'Invalid request';
          break;
        case 403:
          errorMessage = data?.error?.message || 'You do not have permission to perform this action';
          break;
        case 404:
          errorMessage = data?.error?.message || 'Resource not found';
          break;
        case 422:
          errorMessage = data?.error?.message || 'Validation failed';
          break;
        case 429:
          errorMessage = 'Too many requests. Please try again later';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later';
          break;
        default:
          errorMessage = data?.error?.message || `Error ${status}`;
      }
      
      // Show toast for server errors (except 401 which is handled above)
      if (status >= 500) {
        toast.error(errorMessage);
      }
      
      throw new ApiError(errorMessage, status, data?.error?.code, data?.error?.details);
    } else if (error.request) {
      // Network error - no response received
      const networkError = new ApiError(
        'Network error. Please check your connection and try again.',
        0,
        'NETWORK_ERROR'
      );
      toast.error(networkError.message);
      throw networkError;
    } else {
      // Something else happened
      const unknownError = new ApiError(
        error.message || 'An unexpected error occurred',
        0,
        'UNKNOWN_ERROR'
      );
      throw unknownError;
    }
  }
);

// API Methods
export const api = {
  // Auth
  auth: {
    login: (email: string, pin: string) => 
      apiClient.post('/auth/login', { email, pin }),
    
    logout: () => 
      apiClient.post('/auth/logout'),
    
    refresh: (refreshToken: string) => 
      apiClient.post('/auth/refresh', { refreshToken }),
    
    me: () => 
      apiClient.get('/auth/me'),
    
    changePin: (currentPin: string, newPin: string) =>
      apiClient.post('/auth/change-pin', { currentPin, newPin }),
  },

  // Products
  products: {
    list: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
      apiClient.get('/products', { params }),
    
    get: (id: string) =>
      apiClient.get(`/products/${id}`),
    
    create: (data: any) =>
      apiClient.post('/products', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/products/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/products/${id}`),
    
    search: (query: string) =>
      apiClient.get('/products/search', { params: { q: query } }),
    
    byBarcode: (barcode: string) =>
      apiClient.get(`/products/barcode/${barcode}`),
  },

  // Sales
  sales: {
    list: (params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string; status?: string }) =>
      apiClient.get('/sales', { params }),
    
    get: (id: string) =>
      apiClient.get(`/sales/${id}`),
    
    create: (data: any) =>
      apiClient.post('/sales', data),
    
    void: (id: string, reason: string) =>
      apiClient.post(`/sales/${id}/void`, { reason }),
    
    refund: (id: string, data: any) =>
      apiClient.post(`/sales/${id}/refund`, data),
    
    receipt: (id: string) =>
      apiClient.get(`/sales/${id}/receipt`),
    
    hold: (data: any) =>
      apiClient.post('/sales/hold', data),
    
    getHeld: () =>
      apiClient.get('/sales/hold'),
  },

  // Customers
  customers: {
    list: (params?: { page?: number; limit?: number; search?: string }) =>
      apiClient.get('/customers', { params }),
    
    get: (id: string) =>
      apiClient.get(`/customers/${id}`),
    
    create: (data: any) =>
      apiClient.post('/customers', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/customers/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/customers/${id}`),
    
    history: (id: string) =>
      apiClient.get(`/customers/${id}/history`),
  },

  // Categories
  categories: {
    list: () =>
      apiClient.get('/categories'),
    
    create: (data: any) =>
      apiClient.post('/categories', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/categories/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/categories/${id}`),
  },

  // Inventory
  inventory: {
    get: (params?: { storeId?: string; lowStock?: boolean }) =>
      apiClient.get('/inventory', { params }),
    
    adjust: (data: { productId: string; quantity: number; reason: string }) =>
      apiClient.post('/inventory/adjust', data),
    
    movements: (productId: string) =>
      apiClient.get(`/inventory/movements?productId=${productId}`),
  },

  // Shifts
  shifts: {
    current: () =>
      apiClient.get('/shifts/current'),
    
    open: (data: { openingCash: number; notes?: string }) =>
      apiClient.post('/shifts/open', data),
    
    close: (data: { closingCash: number; notes?: string }) =>
      apiClient.post('/shifts/close', data),
    
    history: (params?: { page?: number; limit?: number }) =>
      apiClient.get('/shifts', { params }),
  },

  // Reports
  reports: {
    dashboard: () =>
      apiClient.get('/reports/dashboard'),
    
    sales: (params?: { dateFrom?: string; dateTo?: string; groupBy?: string }) =>
      apiClient.get('/reports/sales', { params }),
    
    products: (params?: { dateFrom?: string; dateTo?: string }) =>
      apiClient.get('/reports/products', { params }),
    
    inventory: () =>
      apiClient.get('/reports/inventory'),
    
    payments: (params?: { dateFrom?: string; dateTo?: string }) =>
      apiClient.get('/reports/payments', { params }),
  },

  // Users
  users: {
    list: () =>
      apiClient.get('/users'),
    
    get: (id: string) =>
      apiClient.get(`/users/${id}`),
    
    create: (data: any) =>
      apiClient.post('/users', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/users/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/users/${id}`),
  },

  // Settings
  settings: {
    get: () =>
      apiClient.get('/settings'),
    
    update: (data: any) =>
      apiClient.put('/settings', data),
  },

  // License
  license: {
    activate: (key: string, name: string, email: string, phone?: string, deviceId?: string) =>
      apiClient.post('/license/activate', { key, name, email, phone, deviceId }),
    
    verify: () =>
      apiClient.get('/license/verify'),
    
    info: () =>
      apiClient.get('/license/info'),
  },
};

export default apiClient;
