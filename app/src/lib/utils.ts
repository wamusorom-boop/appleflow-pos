/**
 * AppleFlow POS - Utility Functions
 * Enhanced: Better formatting, validation, and helper functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Currency Formatting
// ============================================

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'KES',
  locale: string = 'en-KE'
): string {
  if (amount === null || amount === undefined) return '-';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '-';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numAmount);
  } catch (e) {
    // Fallback if Intl is not supported
    return `${currency} ${numAmount.toFixed(2)}`;
  }
}

/**
 * Format a number without currency symbol
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined) return '-';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '-';
  
  return numValue.toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ============================================
// Date/Time Formatting
// ============================================

/**
 * Format a date string
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '-';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  
  return d.toLocaleDateString('en-KE', defaultOptions);
}

/**
 * Format a date with time
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '-';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  
  return d.toLocaleString('en-KE', defaultOptions);
}

/**
 * Format time only
 */
export function formatTime(
  date: string | Date | null | undefined
): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '-';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return formatDate(d);
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate PIN (4-6 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Validate phone number (basic)
 */
export function isValidPhone(phone: string): boolean {
  return /^[\+]?[\d\s\-\(\)]{10,}$/.test(phone);
}

/**
 * Validate required field
 */
export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

/**
 * Validate minimum length
 */
export function minLength(value: string, min: number): boolean {
  return value.length >= min;
}

/**
 * Validate maximum length
 */
export function maxLength(value: string, max: number): boolean {
  return value.length <= max;
}

/**
 * Validate numeric value
 */
export function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: number | string): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
}

// ============================================
// String Utilities
// ============================================

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalize each word
 */
export function capitalizeWords(str: string): string {
  if (!str) return '';
  return str.split(' ').map(capitalize).join(' ');
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate receipt number
 */
export function generateReceiptNumber(): string {
  const date = new Date();
  const prefix = 'RCP';
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${year}-${random}`;
}

// ============================================
// Number Utilities
// ============================================

/**
 * Round to specified decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return round((value / total) * 100);
}

/**
 * Calculate discount
 */
export function calculateDiscount(amount: number, discountPercent: number): number {
  return round(amount * (discountPercent / 100));
}

/**
 * Calculate tax
 */
export function calculateTax(amount: number, taxRate: number): number {
  return round(amount * (taxRate / 100));
}

/**
 * Calculate total with tax
 */
export function calculateTotalWithTax(amount: number, taxRate: number): number {
  return round(amount + calculateTax(amount, taxRate));
}

// ============================================
// Cart/Sale Calculations
// ============================================

interface CartItem {
  price: number;
  quantity: number;
  discount?: number;
}

interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  itemCount: number;
}

/**
 * Calculate cart totals
 */
export function calculateCartTotals(
  items: CartItem[],
  taxRate: number = 16
): CartTotals {
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const itemDiscount = item.discount ? (itemTotal * item.discount) / 100 : 0;
    return sum + itemTotal - itemDiscount;
  }, 0);
  
  const discount = items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    return sum + (item.discount ? (itemTotal * item.discount) / 100 : 0);
  }, 0);
  
  const tax = calculateTax(subtotal, taxRate);
  const total = subtotal + tax;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return {
    subtotal: round(subtotal),
    discount: round(discount),
    tax: round(tax),
    total: round(total),
    itemCount,
  };
}

// ============================================
// Local Storage Utilities
// ============================================

/**
 * Safely get item from localStorage
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading localStorage key "${key}":`, e);
    return defaultValue;
  }
}

/**
 * Safely set item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error setting localStorage key "${key}":`, e);
  }
}

/**
 * Safely remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Error removing localStorage key "${key}":`, e);
  }
}

// ============================================
// Debounce/Throttle
// ============================================

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// Debug Utilities
// ============================================

/**
 * Log with timestamp
 */
export function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Safe console log (only in development)
 */
export function devLog(message: string, ...args: any[]) {
  // Only log in development - safely check for import.meta.env for Vite
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  if (isDev) {
    console.log(message, ...args);
  }
}
