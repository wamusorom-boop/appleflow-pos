/**
 * AppleFlow POS - API Hooks
 * React Query-style hooks for all API operations
 */

import { useState, useEffect, useCallback } from 'react';
import { api, APIError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface UseQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: APIError) => void;
  initialData?: T;
}

interface UseMutationOptions<T, V> {
  onSuccess?: (data: T, variables: V) => void;
  onError?: (error: APIError, variables: V) => void;
}

interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: APIError | null;
  refetch: () => Promise<void>;
}

interface MutationState<T, V> {
  mutate: (variables: V) => void;
  mutateAsync: (variables: V) => Promise<T>;
  isLoading: boolean;
  isError: boolean;
  error: APIError | null;
  data: T | undefined;
  reset: () => void;
}

// ============================================
// BASE HOOKS
// ============================================

// Generic query hook
function useQuery<T>(
  _queryKey: string,
  fetcher: () => Promise<{ data: { data: T } }>,
  options: UseQueryOptions<T> = {}
): QueryState<T> {
  const { enabled = true, refetchInterval, onSuccess, onError, initialData } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<APIError | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;

    const isInitial = !data;
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    setIsError(false);
    setError(null);

    try {
      const response = await fetcher();
      setData(response.data.data);
      onSuccess?.(response.data.data);
    } catch (err) {
      const apiError = err instanceof APIError ? err : new APIError('Unknown error');
      setIsError(true);
      setError(apiError);
      onError?.(apiError);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [enabled, fetcher, onSuccess, onError, data]);

  useEffect(() => {
    fetch();

    if (refetchInterval) {
      const interval = setInterval(fetch, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetch, refetchInterval]);

  return {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: fetch,
  };
}

// Generic mutation hook
function useMutation<T, V>(
  mutator: (variables: V) => Promise<{ data: { data: T } }>,
  options: UseMutationOptions<T, V> = {}
): MutationState<T, V> {
  const { onSuccess, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<APIError | null>(null);
  const [data, setData] = useState<T | undefined>(undefined);

  const mutateAsync = useCallback(async (variables: V): Promise<T> => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const response = await mutator(variables);
      const result = response.data.data;
      setData(result);
      onSuccess?.(result, variables);
      return result;
    } catch (err) {
      const apiError = err instanceof APIError ? err : new APIError('Unknown error');
      setIsError(true);
      setError(apiError);
      onError?.(apiError, variables);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [mutator, onSuccess, onError]);

  const mutate = useCallback((variables: V) => {
    mutateAsync(variables).catch(() => {
      // Error already handled
    });
  }, [mutateAsync]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsError(false);
    setError(null);
    setData(undefined);
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    isError,
    error,
    data,
    reset,
  };
}

// ============================================
// PRODUCT HOOKS
// ============================================

export function useProducts(options?: { page?: number; limit?: number; search?: string; category?: string }) {
  return useQuery(
    'products',
    () => api.products.list(options),
    { enabled: true }
  );
}

export function useProduct(id: string) {
  return useQuery(
    'product-' + id,
    () => api.products.get(id),
    { enabled: !!id }
  );
}

export function useCreateProduct() {
  return useMutation<any, any>((data) => api.products.create(data));
}

export function useUpdateProduct() {
  return useMutation<any, { id: string; data: any }>(
    ({ id, data }) => api.products.update(id, data)
  );
}

export function useDeleteProduct() {
  return useMutation<void, string>((id) => api.products.delete(id));
}

// ============================================
// SALE HOOKS
// ============================================

export function useSales(options?: { 
  page?: number; 
  limit?: number; 
  from?: string; 
  to?: string; 
  status?: string;
  customerId?: string;
}) {
  return useQuery(
    'sales',
    () => api.sales.list(options),
    { enabled: true }
  );
}

export function useSale(id: string) {
  return useQuery(
    'sale-' + id,
    () => api.sales.get(id),
    { enabled: !!id }
  );
}

export function useCreateSale() {
  return useMutation<any, any>((data) => api.sales.create(data));
}

export function useVoidSale() {
  return useMutation<any, { id: string; reason: string }>(
    ({ id, reason }) => api.sales.void(id, reason)
  );
}

export function useRefundSale() {
  return useMutation<any, { id: string; items: any[]; reason: string }>(
    ({ id, items, reason }) => api.sales.refund(id, items, reason)
  );
}

// ============================================
// CUSTOMER HOOKS
// ============================================

export function useCustomers(options?: { page?: number; limit?: number; search?: string; tier?: string }) {
  return useQuery(
    'customers',
    () => api.customers.list(options),
    { enabled: true }
  );
}

export function useCustomer(id: string) {
  return useQuery(
    'customer-' + id,
    () => api.customers.get(id),
    { enabled: !!id }
  );
}

export function useCreateCustomer() {
  return useMutation<any, any>((data) => api.customers.create(data));
}

export function useUpdateCustomer() {
  return useMutation<any, { id: string; data: any }>(
    ({ id, data }) => api.customers.update(id, data)
  );
}

// ============================================
// SHIFT HOOKS
// ============================================

export function useCurrentShift() {
  return useQuery(
    'current-shift',
    () => api.shifts.current(),
    { enabled: true, refetchInterval: 60000 }
  );
}

export function useShifts(options?: { page?: number; limit?: number; userId?: string }) {
  return useQuery(
    'shifts',
    () => api.shifts.list(options),
    { enabled: true }
  );
}

export function useOpenShift() {
  return useMutation<any, { openingCash: number; note?: string }>(
    ({ openingCash, note }) => api.shifts.open(openingCash, note)
  );
}

export function useCloseShift() {
  return useMutation<any, { 
    id: string; 
    closingCash: number; 
    denominations?: any; 
    note?: string 
  }>(
    ({ id, closingCash, denominations, note }) => 
      api.shifts.close(id, { closingCash, denominations, note })
  );
}

export function useCashMovement() {
  return useMutation<any, { 
    shiftId: string; 
    type: 'paid_in' | 'paid_out'; 
    amount: number; 
    reason: string 
  }>(
    ({ shiftId, type, amount, reason }) => 
      api.shifts.cashMovement(shiftId, type, amount, reason)
  );
}

// ============================================
// REPORT HOOKS
// ============================================

export function useDashboardStats() {
  return useQuery(
    'dashboard-stats',
    () => api.reports.dashboard(),
    { enabled: true, refetchInterval: 300000 }
  );
}

export function useSalesReport(params: { from: string; to: string; groupBy?: 'day' | 'week' | 'month' }) {
  return useQuery(
    'sales-report',
    () => api.reports.sales(params),
    { enabled: !!params.from && !!params.to }
  );
}

export function useInventoryReport() {
  return useQuery(
    'inventory-report',
    () => api.reports.inventory(),
    { enabled: true }
  );
}

// ============================================
// INVENTORY HOOKS
// ============================================

export function useStockLevels(options?: { lowStock?: boolean; category?: string }) {
  return useQuery(
    'stock-levels',
    () => api.inventory.stockLevels(options),
    { enabled: true }
  );
}

export function usePurchaseOrders(options?: { page?: number; limit?: number; status?: string }) {
  return useQuery(
    'purchase-orders',
    () => api.inventory.purchaseOrders(options),
    { enabled: true }
  );
}

export function useSuppliers(options?: { page?: number; limit?: number }) {
  return useQuery(
    'suppliers',
    () => api.inventory.suppliers(options),
    { enabled: true }
  );
}

// ============================================
// M-PESA HOOKS
// ============================================

export function useMpesaSTKPush() {
  return useMutation<any, { phoneNumber: string; amount: number; reference: string }>(
    ({ phoneNumber, amount, reference }) => 
      api.mpesa.stkPush(phoneNumber, amount, reference)
  );
}

export function useMpesaStatus() {
  return useMutation<any, string>(
    (checkoutRequestId) => api.mpesa.checkStatus(checkoutRequestId)
  );
}

export function useValidateMpesaTransaction() {
  return useMutation<any, string>(
    (mpesaCode) => api.mpesa.validateTransaction(mpesaCode)
  );
}

// ============================================
// KRA eTIMS HOOKS
// ============================================

export function useKraSubmitInvoice() {
  return useMutation<any, string>((saleId) => api.kra.submitInvoice(saleId));
}

export function useKraComplianceStatus() {
  return useQuery(
    'kra-compliance',
    () => api.kra.getComplianceStatus(),
    { enabled: true, refetchInterval: 300000 }
  );
}

// ============================================
// UTILITY HOOKS
// ============================================

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useQuery;
