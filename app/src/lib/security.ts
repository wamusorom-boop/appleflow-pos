/**
 * AppleFlow POS - Security Layer
 * Enterprise-grade security utilities
 */

import DOMPurify from 'dompurify';

// ============================================
// ENCRYPTION UTILITIES
// ============================================

const ENCRYPTION_KEY_NAME = 'appleflow-encryption-key';

/**
 * Generate or retrieve encryption key
 * In production, this should come from a secure key management service
 */
export function getEncryptionKey(): string {
  let key = localStorage.getItem(ENCRYPTION_KEY_NAME);
  if (!key) {
    // Generate a random key for this session
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(ENCRYPTION_KEY_NAME, key);
  }
  return key;
}

/**
 * Simple XOR encryption for localStorage data
 * NOTE: For production, use Web Crypto API with AES-GCM
 */
export function encrypt(data: string): string {
  try {
    const key = getEncryptionKey();
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(encrypted);
  } catch (error) {
    console.error('Encryption failed:', error);
    return data;
  }
}

/**
 * Decrypt data from localStorage
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const data = atob(encryptedData);
    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData;
  }
}

/**
 * Secure storage wrapper for localStorage
 */
export const secureStorage = {
  getItem(key: string): any {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      const decrypted = decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      // Fallback to unencrypted for backward compatibility
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
  },

  setItem(key: string, value: any): void {
    try {
      const json = JSON.stringify(value);
      const encrypted = encrypt(json);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Secure storage failed:', error);
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
  },

  clear(): void {
    localStorage.clear();
  },
};

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize user input for display
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Kenyan format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+254|0)[17]\d{8}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate KRA PIN format
 */
export function isValidKRAPin(pin: string): boolean {
  const pinRegex = /^[A-Z]\d{9}[A-Z]$/;
  return pinRegex.test(pin);
}

/**
 * Validate M-Pesa code format
 */
export function isValidMpesaCode(code: string): boolean {
  const codeRegex = /^[A-Z0-9]{10}$/;
  return codeRegex.test(code.toUpperCase());
}

/**
 * Validate barcode format
 */
export function isValidBarcode(barcode: string): boolean {
  // EAN-13 or UPC-A format
  const barcodeRegex = /^\d{8,13}$/;
  return barcodeRegex.test(barcode);
}

// ============================================
// PASSWORD SECURITY
// ============================================

/**
 * Hash password using SHA-256
 * NOTE: In production, use bcrypt or Argon2 on the server
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Check password strength
 */
export function checkPasswordStrength(password: string): {
  score: number;
  isStrong: boolean;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Password must be at least 8 characters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');

  if (/\d/.test(password)) score++;
  else feedback.push('Add numbers');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('Add special characters');

  return {
    score,
    isStrong: score >= 4,
    feedback,
  };
}

// ============================================
// SESSION SECURITY
// ============================================

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_KEY = 'appleflow-session';
const LAST_ACTIVITY_KEY = 'appleflow-last-activity';

/**
 * Check if session is valid
 */
export function isSessionValid(): boolean {
  const session = secureStorage.getItem(SESSION_KEY);
  if (!session) return false;

  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!lastActivity) return false;

  const inactiveTime = Date.now() - parseInt(lastActivity);
  if (inactiveTime > SESSION_TIMEOUT) {
    // Session expired
    logout();
    return false;
  }

  return true;
}

/**
 * Update last activity timestamp
 */
export function updateActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

/**
 * Secure logout - clear all sensitive data
 */
export function logout(): void {
  secureStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(ENCRYPTION_KEY_NAME);
  // Don't clear all data - just session info
}

/**
 * Get current user from secure session
 */
export function getCurrentUser(): any {
  if (!isSessionValid()) return null;
  return secureStorage.getItem(SESSION_KEY);
}

/**
 * Set user session securely
 */
export function setSession(user: any): void {
  secureStorage.setItem(SESSION_KEY, user);
  updateActivity();
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Check if action is rate limited
 */
export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimits.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return false;
  }

  if (entry.count >= maxAttempts) {
    return true;
  }

  entry.count++;
  return false;
}

/**
 * Clear rate limit for a key
 */
export function clearRateLimit(key: string): void {
  rateLimits.delete(key);
}

// ============================================
// CSRF PROTECTION
// ============================================

const CSRF_TOKEN_KEY = 'appleflow-csrf-token';

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string): boolean {
  const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
  return stored === token;
}

// ============================================
// AUDIT LOGGING
// ============================================

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  details: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
): void {
  const entry = {
    id: `sec-${Date.now()}`,
    event,
    details,
    severity,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  // Store in secure storage
  const logs = secureStorage.getItem('appleflow-security-logs') || [];
  logs.unshift(entry);
  
  // Keep only last 1000 security logs
  if (logs.length > 1000) logs.pop();
  
  secureStorage.setItem('appleflow-security-logs', logs);

  // Log critical events to console for monitoring
  if (severity === 'critical' || severity === 'high') {
    console.error('Security Event:', entry);
  }
}

// ============================================
// CURRENCY HANDLING (Prevent floating point errors)
// ============================================

/**
 * Convert amount to cents (integer) for accurate calculations
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert cents back to decimal
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Safely add currency amounts
 */
export function addCurrency(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Safely subtract currency amounts
 */
export function subtractCurrency(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Safely multiply currency
 */
export function multiplyCurrency(amount: number, factor: number): number {
  return fromCents(Math.round(toCents(amount) * factor));
}

// ============================================
// DATA VALIDATION SCHEMAS
// ============================================

export const ValidationSchemas = {
  product: {
    name: (val: string) => val.length >= 2 && val.length <= 100,
    sku: (val: string) => /^[A-Z0-9\-]{3,20}$/i.test(val),
    price: (val: number) => val >= 0 && val <= 999999,
    quantity: (val: number) => val >= 0 && val <= 999999,
  },
  customer: {
    name: (val: string) => val.length >= 2 && val.length <= 100,
    email: isValidEmail,
    phone: isValidPhone,
  },
  sale: {
    items: (val: any[]) => val.length > 0 && val.length <= 100,
    total: (val: number) => val >= 0 && val <= 9999999,
  },
  user: {
    name: (val: string) => val.length >= 2 && val.length <= 50,
    pin: (val: string) => /^\d{4,6}$/.test(val),
  },
};

/**
 * Validate data against schema
 */
export function validateData<T extends Record<string, any>>(
  data: T,
  schema: Record<string, (val: any) => boolean>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [field, validator] of Object.entries(schema)) {
    if (!validator(data[field])) {
      errors.push(`Invalid ${field}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
