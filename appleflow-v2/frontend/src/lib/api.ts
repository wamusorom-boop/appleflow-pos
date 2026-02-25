/**
 * AppleFlow POS - API Client
 * Axios-based HTTP client with interceptors
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = useAuthStore.getState().refreshToken;
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken } = response.data.data;
          useAuthStore.getState().setTokens(accessToken, refreshToken);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, logout user
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    // Handle other errors
    if (error.response) {
      const data = error.response.data as any;
      const message = data?.error || 'An error occurred';
      
      // Don't show toast for 404s on certain endpoints
      if (error.response.status !== 404 || !originalRequest.url?.includes('/search')) {
        toast.error(message);
      }
    }

    return Promise.reject(error);
  }
);

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Auth API
export const authApi = {
  login: (email: string, pin: string) =>
    api.post<ApiResponse<{ user: any; tokens: any }>>('/auth/login', { email, pin }),
  
  logout: () =>
    api.post<ApiResponse<void>>('/auth/logout'),
  
  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; expiresIn: number }>>('/auth/refresh', { refreshToken }),
  
  me: () =>
    api.get<ApiResponse<{ user: any }>>('/auth/me'),
  
  changePin: (currentPin: string, newPin: string) =>
    api.post<ApiResponse<void>>('/auth/change-pin', { currentPin, newPin }),
};

// Products API
export const productsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; categoryId?: string }) =>
    api.get<ApiResponse<{ products: any[]; pagination: any }>>('/products', { params }),
  
  get: (id: string) =>
    api.get<ApiResponse<{ product: any }>>(`/products/${id}`),
  
  create: (data: any) =>
    api.post<ApiResponse<{ product: any }>>('/products', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse<{ product: any }>>(`/products/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/products/${id}`),
  
  updateInventory: (id: string, data: any) =>
    api.post<ApiResponse<{ inventory: any }>>(`/products/${id}/inventory`, data),
};

// Sales API
export const salesApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<ApiResponse<{ sales: any[]; pagination: any }>>('/sales', { params }),
  
  get: (id: string) =>
    api.get<ApiResponse<{ sale: any }>>(`/sales/${id}`),
  
  create: (data: any) =>
    api.post<ApiResponse<{ sale: any }>>('/sales', data),
  
  void: (id: string, reason: string) =>
    api.post<ApiResponse<void>>(`/sales/${id}/void`, { reason }),
  
  getByReceipt: (receiptNumber: string) =>
    api.get<ApiResponse<{ sale: any }>>(`/sales/receipt/${receiptNumber}`),
};

// Customers API
export const customersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<ApiResponse<{ customers: any[]; pagination: any }>>('/customers', { params }),
  
  get: (id: string) =>
    api.get<ApiResponse<{ customer: any; loyaltyHistory: any[] }>>(`/customers/${id}`),
  
  create: (data: any) =>
    api.post<ApiResponse<{ customer: any }>>('/customers', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse<{ customer: any }>>(`/customers/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/customers/${id}`),
  
  adjustLoyalty: (id: string, data: any) =>
    api.post<ApiResponse<any>>(`/customers/${id}/loyalty`, data),
};

// Categories API
export const categoriesApi = {
  list: () =>
    api.get<ApiResponse<{ categories: any[] }>>('/categories'),
  
  create: (data: any) =>
    api.post<ApiResponse<{ category: any }>>('/categories', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse<{ category: any }>>(`/categories/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/categories/${id}`),
};

// Inventory API
export const inventoryApi = {
  list: (params?: { page?: number; limit?: number; lowStock?: boolean }) =>
    api.get<ApiResponse<{ inventory: any[]; pagination: any }>>('/inventory', { params }),
  
  getLowStock: () =>
    api.get<ApiResponse<{ lowStock: any[] }>>('/inventory/low-stock'),
  
  adjust: (data: any) =>
    api.post<ApiResponse<{ inventory: any }>>('/inventory/adjust', data),
  
  getMovements: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ movements: any[]; pagination: any }>>('/inventory/movements', { params }),
};

// Shifts API
export const shiftsApi = {
  list: (params?: { page?: number; limit?: number; isClosed?: boolean }) =>
    api.get<ApiResponse<{ shifts: any[]; pagination: any }>>('/shifts', { params }),
  
  getCurrent: () =>
    api.get<ApiResponse<{ shift: any }>>('/shifts/current'),
  
  open: (data: { storeId: string; openingCash: number }) =>
    api.post<ApiResponse<{ shift: any }>>('/shifts/open', data),
  
  close: (id: string, data: { closingCash: number }) =>
    api.post<ApiResponse<{ shift: any }>>(`/shifts/${id}/close`, data),
  
  addMovement: (id: string, data: any) =>
    api.post<ApiResponse<{ movement: any }>>(`/shifts/${id}/movement`, data),
};

// Reports API
export const reportsApi = {
  getDashboard: () =>
    api.get<ApiResponse<any>>('/reports/dashboard'),
  
  getSales: (params?: { from?: string; to?: string; storeId?: string }) =>
    api.get<ApiResponse<any>>('/reports/sales', { params }),
  
  getProducts: (params?: { from?: string; to?: string }) =>
    api.get<ApiResponse<any>>('/reports/products', { params }),
  
  getInventory: () =>
    api.get<ApiResponse<any>>('/reports/inventory'),
};

// Users API
export const usersApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<{ users: any[]; pagination: any }>>('/users', { params }),
  
  create: (data: any) =>
    api.post<ApiResponse<{ user: any }>>('/users', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse<{ user: any }>>(`/users/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/users/${id}`),
};

export default api;
