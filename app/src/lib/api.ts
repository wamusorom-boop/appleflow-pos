/**
 * AppleFlow POS - API Client
 * Axios-based HTTP client with authentication, error handling, and interceptors
 */

import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const REQUEST_TIMEOUT = 30000;

// Custom error types
export class APIError extends Error {
  code: string | undefined;
  status: number | undefined;
  details: any;
  
  constructor(
    message: string,
    code?: string,
    status?: number,
    details?: any
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Token management
class TokenManager {
  private static ACCESS_TOKEN_KEY = 'af_access_token';
  private static REFRESH_TOKEN_KEY = 'af_refresh_token';
  private static TOKEN_EXPIRY_KEY = 'af_token_expiry';

  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    const expiry = Date.now() + (expiresIn * 1000);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiry.toString());
  }

  static clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  static isTokenExpired(): boolean {
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    return Date.now() >= parseInt(expiry) - 60000; // 1 minute buffer
  }

  static getAuthHeader(): { Authorization: string } | Record<string, never> {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = TokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 errors - token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = TokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new APIError('No refresh token available', 'NO_REFRESH_TOKEN');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, expiresIn } = response.data.data;
        TokenManager.setTokens(accessToken, refreshToken, expiresIn);

        onTokenRefreshed(accessToken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        TokenManager.clearTokens();
        window.location.href = '/login?session=expired';
        return Promise.reject(refreshError);
      }
    }

    // Transform error to APIError
    if (error.response) {
      const data = error.response.data as any;
      throw new APIError(
        data.error || 'An error occurred',
        data.code,
        error.response.status,
        data.details
      );
    }

    throw new APIError(error.message || 'Network error', 'NETWORK_ERROR');
  }
);

// ============================================
// API SERVICE METHODS
// ============================================

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
    
    bySku: (sku: string) =>
      apiClient.get(`/products/sku/${sku}`),
    
    adjustStock: (id: string, quantity: number, reason: string) =>
      apiClient.post(`/products/${id}/adjust-stock`, { quantity, reason }),
    
    bulkUpdate: (ids: string[], data: any) =>
      apiClient.post('/products/bulk-update', { ids, data }),
    
    import: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    
    export: (format: 'csv' | 'excel' = 'csv') =>
      apiClient.get('/products/export', { 
        params: { format },
        responseType: 'blob'
      }),
  },

  // Sales
  sales: {
    list: (params?: { 
      page?: number; 
      limit?: number; 
      from?: string; 
      to?: string; 
      status?: string;
      customerId?: string;
    }) =>
      apiClient.get('/sales', { params }),
    
    get: (id: string) =>
      apiClient.get(`/sales/${id}`),
    
    create: (data: any) =>
      apiClient.post('/sales', data),
    
    void: (id: string, reason: string) =>
      apiClient.post(`/sales/${id}/void`, { reason }),
    
    refund: (id: string, items: any[], reason: string) =>
      apiClient.post(`/sales/${id}/refund`, { items, reason }),
    
    reprint: (id: string) =>
      apiClient.post(`/sales/${id}/reprint`),
    
    hold: (data: { name: string; cart: any[]; customerId?: string }) =>
      apiClient.post('/sales/hold', data),
    
    getHeld: () =>
      apiClient.get('/sales/held'),
    
    resumeHeld: (id: string) =>
      apiClient.post(`/sales/held/${id}/resume`),
    
    deleteHeld: (id: string) =>
      apiClient.delete(`/sales/held/${id}`),
    
    getReceipt: (id: string) =>
      apiClient.get(`/sales/${id}/receipt`),
    
    printReceipt: (id: string) =>
      apiClient.post(`/sales/${id}/print-receipt`),
  },

  // Customers
  customers: {
    list: (params?: { page?: number; limit?: number; search?: string; tier?: string }) =>
      apiClient.get('/customers', { params }),
    
    get: (id: string) =>
      apiClient.get(`/customers/${id}`),
    
    create: (data: any) =>
      apiClient.post('/customers', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/customers/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/customers/${id}`),
    
    search: (query: string) =>
      apiClient.get('/customers/search', { params: { q: query } }),
    
    byPhone: (phone: string) =>
      apiClient.get(`/customers/phone/${phone}`),
    
    addPoints: (id: string, points: number, reason: string) =>
      apiClient.post(`/customers/${id}/points`, { points, reason }),
    
    getHistory: (id: string) =>
      apiClient.get(`/customers/${id}/history`),
    
    getCredit: (id: string) =>
      apiClient.get(`/customers/${id}/credit`),
    
    updateCredit: (id: string, creditLimit: number) =>
      apiClient.put(`/customers/${id}/credit`, { creditLimit }),
    
    export: (format: 'csv' | 'excel' = 'csv') =>
      apiClient.get('/customers/export', { 
        params: { format },
        responseType: 'blob'
      }),
  },

  // Shifts
  shifts: {
    current: () =>
      apiClient.get('/shifts/current'),
    
    list: (params?: { page?: number; limit?: number; userId?: string; from?: string; to?: string }) =>
      apiClient.get('/shifts', { params }),
    
    get: (id: string) =>
      apiClient.get(`/shifts/${id}`),
    
    open: (openingCash: number, note?: string) =>
      apiClient.post('/shifts/open', { openingCash, note }),
    
    close: (id: string, data: { closingCash: number; denominations?: any; note?: string }) =>
      apiClient.post(`/shifts/${id}/close`, data),
    
    cashMovement: (id: string, type: 'paid_in' | 'paid_out', amount: number, reason: string) =>
      apiClient.post(`/shifts/${id}/cash-movement`, { type, amount, reason }),
    
    getMovements: (id: string) =>
      apiClient.get(`/shifts/${id}/movements`),
    
    getSummary: (id: string) =>
      apiClient.get(`/shifts/${id}/summary`),
    
    xReport: (id: string) =>
      apiClient.get(`/shifts/${id}/x-report`),
    
    zReport: (id: string) =>
      apiClient.get(`/shifts/${id}/z-report`),
  },

  // Reports
  reports: {
    dashboard: (period?: string) =>
      apiClient.get('/reports/dashboard', { params: { period } }),
    
    sales: (params: { from: string; to: string; groupBy?: 'day' | 'week' | 'month' }) =>
      apiClient.get('/reports/sales', { params }),
    
    products: (params: { from: string; to: string; limit?: number }) =>
      apiClient.get('/reports/products', { params }),
    
    categories: (params: { from: string; to: string }) =>
      apiClient.get('/reports/categories', { params }),
    
    payments: (params: { from: string; to: string }) =>
      apiClient.get('/reports/payments', { params }),
    
    cashierPerformance: (params: { from: string; to: string; userId?: string }) =>
      apiClient.get('/reports/cashier-performance', { params }),
    
    hourly: (date: string) =>
      apiClient.get('/reports/hourly', { params: { date } }),
    
    inventory: () =>
      apiClient.get('/reports/inventory'),
    
    profitLoss: (params: { from: string; to: string }) =>
      apiClient.get('/reports/profit-loss', { params }),
    
    tax: (params: { from: string; to: string }) =>
      apiClient.get('/reports/tax', { params }),
    
    export: (type: string, params: any, format: 'pdf' | 'csv' | 'excel' = 'pdf') =>
      apiClient.get(`/reports/export/${type}`, { 
        params: { ...params, format },
        responseType: 'blob'
      }),
  },

  // Inventory
  inventory: {
    stockLevels: (params?: { lowStock?: boolean; category?: string }) =>
      apiClient.get('/inventory/stock-levels', { params }),
    
    adjustments: (params?: { page?: number; limit?: number; productId?: string }) =>
      apiClient.get('/inventory/adjustments', { params }),
    
    createAdjustment: (data: any) =>
      apiClient.post('/inventory/adjustments', data),
    
    transfers: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get('/inventory/transfers', { params }),
    
    createTransfer: (data: any) =>
      apiClient.post('/inventory/transfers', data),
    
    receiveTransfer: (id: string) =>
      apiClient.post(`/inventory/transfers/${id}/receive`),
    
    purchaseOrders: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get('/inventory/purchase-orders', { params }),
    
    createPurchaseOrder: (data: any) =>
      apiClient.post('/inventory/purchase-orders', data),
    
    receivePO: (id: string, items: any[]) =>
      apiClient.post(`/inventory/purchase-orders/${id}/receive`, { items }),
    
    suppliers: (params?: { page?: number; limit?: number }) =>
      apiClient.get('/inventory/suppliers', { params }),
    
    createSupplier: (data: any) =>
      apiClient.post('/inventory/suppliers', data),
    
    updateSupplier: (id: string, data: any) =>
      apiClient.put(`/inventory/suppliers/${id}`, data),
    
    batches: (productId?: string) =>
      apiClient.get('/inventory/batches', { params: { productId } }),
    
    expiring: (days: number = 30) =>
      apiClient.get('/inventory/expiring', { params: { days } }),
  },

  // Layaway
  layaways: {
    list: (params?: { page?: number; limit?: number; status?: string; customerId?: string }) =>
      apiClient.get('/layaways', { params }),
    
    get: (id: string) =>
      apiClient.get(`/layaways/${id}`),
    
    create: (data: any) =>
      apiClient.post('/layaways', data),
    
    addPayment: (id: string, amount: number, method: string) =>
      apiClient.post(`/layaways/${id}/payments`, { amount, method }),
    
    complete: (id: string) =>
      apiClient.post(`/layaways/${id}/complete`),
    
    cancel: (id: string, reason: string) =>
      apiClient.post(`/layaways/${id}/cancel`, { reason }),
  },

  // Quotes
  quotes: {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get('/quotes', { params }),
    
    get: (id: string) =>
      apiClient.get(`/quotes/${id}`),
    
    create: (data: any) =>
      apiClient.post('/quotes', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/quotes/${id}`, data),
    
    convertToSale: (id: string) =>
      apiClient.post(`/quotes/${id}/convert`),
    
    send: (id: string) =>
      apiClient.post(`/quotes/${id}/send`),
    
    delete: (id: string) =>
      apiClient.delete(`/quotes/${id}`),
  },

  // Gift Cards
  giftCards: {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get('/gift-cards', { params }),
    
    get: (id: string) =>
      apiClient.get(`/gift-cards/${id}`),
    
    getByNumber: (cardNumber: string) =>
      apiClient.get(`/gift-cards/number/${cardNumber}`),
    
    issue: (data: { initialBalance: number; customerId?: string; expiresAt?: string }) =>
      apiClient.post('/gift-cards', data),
    
    load: (id: string, amount: number) =>
      apiClient.post(`/gift-cards/${id}/load`, { amount }),
    
    redeem: (id: string, amount: number, saleId?: string) =>
      apiClient.post(`/gift-cards/${id}/redeem`, { amount, saleId }),
    
    getTransactions: (id: string) =>
      apiClient.get(`/gift-cards/${id}/transactions`),
    
    deactivate: (id: string) =>
      apiClient.post(`/gift-cards/${id}/deactivate`),
  },

  // Expenses
  expenses: {
    list: (params?: { page?: number; limit?: number; from?: string; to?: string; category?: string }) =>
      apiClient.get('/expenses', { params }),
    
    get: (id: string) =>
      apiClient.get(`/expenses/${id}`),
    
    create: (data: any) =>
      apiClient.post('/expenses', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/expenses/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/expenses/${id}`),
    
    categories: () =>
      apiClient.get('/expenses/categories'),
  },

  // Users
  users: {
    list: (params?: { page?: number; limit?: number; role?: string; isActive?: boolean }) =>
      apiClient.get('/users', { params }),
    
    get: (id: string) =>
      apiClient.get(`/users/${id}`),
    
    create: (data: any) =>
      apiClient.post('/users', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/users/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/users/${id}`),
    
    toggleActive: (id: string) =>
      apiClient.post(`/users/${id}/toggle-active`),
    
    resetPin: (id: string, newPin: string) =>
      apiClient.post(`/users/${id}/reset-pin`, { newPin }),
    
    updatePermissions: (id: string, permissions: any) =>
      apiClient.put(`/users/${id}/permissions`, permissions),
  },

  // Settings
  settings: {
    get: () =>
      apiClient.get('/settings'),
    
    update: (data: any) =>
      apiClient.put('/settings', data),
    
    getBusiness: () =>
      apiClient.get('/settings/business'),
    
    updateBusiness: (data: any) =>
      apiClient.put('/settings/business', data),
    
    getReceipt: () =>
      apiClient.get('/settings/receipt'),
    
    updateReceipt: (data: any) =>
      apiClient.put('/settings/receipt', data),
    
    backup: () =>
      apiClient.post('/settings/backup'),
    
    restore: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/settings/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
  },

  // Audit Log
  audit: {
    list: (params?: { page?: number; limit?: number; userId?: string; action?: string; from?: string; to?: string }) =>
      apiClient.get('/audit', { params }),
    
    get: (id: string) =>
      apiClient.get(`/audit/${id}`),
    
    export: (params: any) =>
      apiClient.get('/audit/export', { params, responseType: 'blob' }),
  },

  // Notifications
  notifications: {
    list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
      apiClient.get('/notifications', { params }),
    
    markAsRead: (id: string) =>
      apiClient.post(`/notifications/${id}/read`),
    
    markAllAsRead: () =>
      apiClient.post('/notifications/read-all'),
    
    delete: (id: string) =>
      apiClient.delete(`/notifications/${id}`),
    
    getSettings: () =>
      apiClient.get('/notifications/settings'),
    
    updateSettings: (settings: any) =>
      apiClient.put('/notifications/settings', settings),
  },

  // M-Pesa
  mpesa: {
    stkPush: (phoneNumber: string, amount: number, reference: string) =>
      apiClient.post('/mpesa/stk-push', { phoneNumber, amount, reference }),
    
    checkStatus: (checkoutRequestId: string) =>
      apiClient.get(`/mpesa/status/${checkoutRequestId}`),
    
    validateTransaction: (mpesaCode: string) =>
      apiClient.post('/mpesa/validate', { mpesaCode }),
    
    getTransactions: (params?: { page?: number; limit?: number; from?: string; to?: string }) =>
      apiClient.get('/mpesa/transactions', { params }),
    
    reconcile: (date: string) =>
      apiClient.post('/mpesa/reconcile', { date }),
    
    registerUrl: () =>
      apiClient.post('/mpesa/register-url'),
    
    simulatePayment: (phoneNumber: string, amount: number) =>
      apiClient.post('/mpesa/simulate', { phoneNumber, amount }),
  },

  // KRA eTIMS
  kra: {
    submitInvoice: (saleId: string) =>
      apiClient.post(`/kra/invoices/${saleId}/submit`),
    
    getInvoiceStatus: (saleId: string) =>
      apiClient.get(`/kra/invoices/${saleId}/status`),
    
    getQRCode: (saleId: string) =>
      apiClient.get(`/kra/invoices/${saleId}/qrcode`),
    
    getVatReturn: (params: { from: string; to: string }) =>
      apiClient.get('/kra/vat-return', { params }),
    
    submitVatReturn: (data: any) =>
      apiClient.post('/kra/vat-return', data),
    
    getComplianceStatus: () =>
      apiClient.get('/kra/compliance-status'),
    
    syncInvoices: () =>
      apiClient.post('/kra/sync'),
    
    getUnsubmitted: () =>
      apiClient.get('/kra/unsubmitted'),
  },

  // Dashboard
  dashboard: {
    getStats: () =>
      apiClient.get('/dashboard/stats'),
    
    getRealtime: () =>
      apiClient.get('/dashboard/realtime'),
    
    getAlerts: () =>
      apiClient.get('/dashboard/alerts'),
    
    getActivities: (limit?: number) =>
      apiClient.get('/dashboard/activities', { params: { limit } }),
  },

  // License
  license: {
    activate: (key: string, name: string, email: string, phone?: string, deviceId?: string) =>
      apiClient.post('/license/activate', { key, name, email, phone, deviceId }),
    
    verify: () =>
      apiClient.get('/license/verify'),
    
    getInfo: () =>
      apiClient.get('/license/info'),
    
    // Admin only
    create: (data: { tier?: string; name?: string; email?: string; expiresInDays?: number; maxDevices?: number }) =>
      apiClient.post('/license/create', data),
    
    list: () =>
      apiClient.get('/license/list'),
    
    revoke: (id: string) =>
      apiClient.post(`/license/revoke/${id}`),
  },

  // Hardware
  hardware: {
    getStatus: () =>
      apiClient.get('/hardware/status'),
    
    getDevices: () =>
      apiClient.get('/hardware/devices'),
    
    addDevice: (data: any) =>
      apiClient.post('/hardware/devices', data),
    
    updateDevice: (id: string, data: any) =>
      apiClient.put(`/hardware/devices/${id}`, data),
    
    deleteDevice: (id: string) =>
      apiClient.delete(`/hardware/devices/${id}`),
    
    testPrint: () =>
      apiClient.post('/hardware/print/test'),
    
    printReceipt: (saleId: string) =>
      apiClient.post('/hardware/print/receipt', { saleId }),
    
    openDrawer: () =>
      apiClient.post('/hardware/drawer/open'),
    
    scanBarcode: () =>
      apiClient.get('/hardware/scanner/scan'),
  },

  // Sync (Offline support)
  sync: {
    getStatus: () =>
      apiClient.get('/sync/status'),
    
    queue: (data: { entityType: string; entityId: string; operation: string; payload: any }) =>
      apiClient.post('/sync/queue', data),
    
    process: () =>
      apiClient.post('/sync/process'),
    
    resolveConflict: (queueItemId: string, resolution: 'client_wins' | 'server_wins' | 'merge') =>
      apiClient.post(`/sync/conflict/${queueItemId}/resolve`, { resolution }),
    
    getQueue: (status?: string) =>
      apiClient.get('/sync/queue', { params: { status } }),
    
    clearQueue: () =>
      apiClient.delete('/sync/queue'),
  },

  // Tables (Restaurant)
  tables: {
    list: (params?: { sectionId?: string; status?: string }) =>
      apiClient.get('/tables', { params }),
    
    get: (id: string) =>
      apiClient.get(`/tables/${id}`),
    
    create: (data: any) =>
      apiClient.post('/tables', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/tables/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/tables/${id}`),
    
    updateStatus: (id: string, status: string) =>
      apiClient.patch(`/tables/${id}/status`, { status }),
    
    occupy: (id: string, guests: number) =>
      apiClient.post(`/tables/${id}/occupy`, { guests }),
    
    vacate: (id: string) =>
      apiClient.post(`/tables/${id}/vacate`),
  },

  // Reservations
  reservations: {
    list: (params?: { date?: string; status?: string }) =>
      apiClient.get('/reservations', { params }),
    
    get: (id: string) =>
      apiClient.get(`/reservations/${id}`),
    
    create: (data: any) =>
      apiClient.post('/reservations', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/reservations/${id}`, data),
    
    cancel: (id: string, reason?: string) =>
      apiClient.post(`/reservations/${id}/cancel`, { reason }),
    
    confirm: (id: string) =>
      apiClient.post(`/reservations/${id}/confirm`),
    
    seat: (id: string, tableId: string) =>
      apiClient.post(`/reservations/${id}/seat`, { tableId }),
  },

  // Discounts
  discounts: {
    list: (params?: { isActive?: boolean }) =>
      apiClient.get('/discounts', { params }),
    
    get: (id: string) =>
      apiClient.get(`/discounts/${id}`),
    
    create: (data: any) =>
      apiClient.post('/discounts', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/discounts/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/discounts/${id}`),
    
    validate: (code: string, cartTotal: number) =>
      apiClient.post('/discounts/validate', { code, cartTotal }),
    
    apply: (code: string, saleId: string) =>
      apiClient.post('/discounts/apply', { code, saleId }),
  },

  // Categories
  categories: {
    list: (params?: { parentId?: string | null }) =>
      apiClient.get('/categories', { params }),
    
    get: (id: string) =>
      apiClient.get(`/categories/${id}`),
    
    create: (data: any) =>
      apiClient.post('/categories', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/categories/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/categories/${id}`),
    
    reorder: (ids: string[]) =>
      apiClient.post('/categories/reorder', { ids }),
  },

  // Brands
  brands: {
    list: () =>
      apiClient.get('/brands'),
    
    get: (id: string) =>
      apiClient.get(`/brands/${id}`),
    
    create: (data: any) =>
      apiClient.post('/brands', data),
    
    update: (id: string, data: any) =>
      apiClient.put(`/brands/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete(`/brands/${id}`),
  },
};

export { TokenManager };
export default apiClient;
