/**
 * AppleFlow POS - Database Abstraction Layer
 * Provides unified interface for data storage with migration path to real DB
 */

import { secureStorage } from './security';

// ============================================
// DATABASE INTERFACE
// ============================================

export interface DatabaseAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  getAll<T>(key: string): T[];
  setAll<T>(key: string, value: T[]): void;
  query<T>(key: string, predicate: (item: T) => boolean): T[];
  transaction<T>(operations: () => T): T;
}

// ============================================
// LOCALSTORAGE ADAPTER (Current)
// ============================================

class LocalStorageAdapter implements DatabaseAdapter {
  get<T>(key: string): T | null {
    return secureStorage.getItem(key);
  }

  set<T>(key: string, value: T): void {
    secureStorage.setItem(key, value);
  }

  remove(key: string): void {
    secureStorage.removeItem(key);
  }

  getAll<T>(key: string): T[] {
    return secureStorage.getItem(key) || [];
  }

  setAll<T>(key: string, value: T[]): void {
    secureStorage.setItem(key, value);
  }

  query<T>(key: string, predicate: (item: T) => boolean): T[] {
    const items = this.getAll<T>(key);
    return items.filter(predicate);
  }

  transaction<T>(operations: () => T): T {
    // In localStorage, we don't have true transactions
    // This is a placeholder for when we migrate to IndexedDB or real DB
    try {
      return operations();
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }
}

// ============================================
// INDEXEDDB ADAPTER (Future - for larger data)
// ============================================

const DB_NAME = 'AppleFlowPOS';
const DB_VERSION = 1;

class IndexedDBAdapter implements DatabaseAdapter {
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sales')) {
          db.createObjectStore('sales', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync')) {
          db.createObjectStore('sync', { keyPath: 'id' });
        }
      };
    });
  }

  get<T>(key: string): T | null {
    // Fallback to localStorage for now
    return secureStorage.getItem(key);
  }

  set<T>(key: string, value: T): void {
    secureStorage.setItem(key, value);
  }

  remove(key: string): void {
    secureStorage.removeItem(key);
  }

  getAll<T>(key: string): T[] {
    return secureStorage.getItem(key) || [];
  }

  setAll<T>(key: string, value: T[]): void {
    secureStorage.setItem(key, value);
  }

  query<T>(key: string, predicate: (item: T) => boolean): T[] {
    const items = this.getAll<T>(key);
    return items.filter(predicate);
  }

  transaction<T>(operations: () => T): T {
    return operations();
  }
}

// ============================================
// DATABASE FACTORY
// ============================================

export class Database {
  static #instance: Database;
  #adapter: DatabaseAdapter;
  #useIndexedDB: boolean = false;

  private constructor() {
    this.#adapter = new LocalStorageAdapter();
    this.tryInitIndexedDB();
  }

  static getInstance(): Database {
    if (!Database.#instance) {
      Database.#instance = new Database();
    }
    return Database.#instance;
  }

  private async tryInitIndexedDB(): Promise<void> {
    try {
      if ('indexedDB' in window) {
        const idbAdapter = new IndexedDBAdapter();
        await idbAdapter.init();
        this.#adapter = idbAdapter;
        this.#useIndexedDB = true;
        console.log('Using IndexedDB for storage');
      }
    } catch (error) {
      console.warn('IndexedDB not available, using localStorage');
    }
  }

  get<T>(key: string): T | null {
    return this.#adapter.get<T>(key);
  }

  set<T>(key: string, value: T): void {
    this.#adapter.set(key, value);
  }

  remove(key: string): void {
    this.#adapter.remove(key);
  }

  getAll<T>(key: string): T[] {
    return this.#adapter.getAll<T>(key);
  }

  setAll<T>(key: string, value: T[]): void {
    this.#adapter.setAll(key, value);
  }

  query<T>(key: string, predicate: (item: T) => boolean): T[] {
    return this.#adapter.query(key, predicate);
  }

  transaction<T>(operations: () => T): T {
    return this.#adapter.transaction(operations);
  }

  isUsingIndexedDB(): boolean {
    return this.#useIndexedDB;
  }
}

// Export singleton instance
export const db = Database.getInstance();

// ============================================
// ENTITY-SPECIFIC REPOSITORIES
// ============================================

export class Repository<T extends { id: string }> {
  #key: string;
  
  constructor(key: string) {
    this.#key = key;
  }

  getAll(): T[] {
    return db.getAll<T>(this.#key);
  }

  getById(id: string): T | null {
    const items = this.getAll();
    return items.find(item => item.id === id) || null;
  }

  find(predicate: (item: T) => boolean): T[] {
    return db.query(this.#key, predicate);
  }

  findOne(predicate: (item: T) => boolean): T | null {
    const items = this.find(predicate);
    return items[0] || null;
  }

  create(item: Omit<T, 'id'> & { id?: string }): T {
    const items = this.getAll();
    const newItem = {
      ...item,
      id: item.id || `${this.#key.slice(0, 3)}-${Date.now()}`,
    } as T;
    
    items.unshift(newItem);
    db.setAll(this.#key, items);
    
    return newItem;
  }

  update(id: string, updates: Partial<T>): T | null {
    const items = this.getAll();
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) return null;
    
    items[index] = { ...items[index], ...updates };
    db.setAll(this.#key, items);
    
    return items[index];
  }

  delete(id: string): boolean {
    const items = this.getAll();
    const filtered = items.filter(item => item.id !== id);
    
    if (filtered.length === items.length) return false;
    
    db.setAll(this.#key, filtered);
    return true;
  }

  count(): number {
    return this.getAll().length;
  }

  clear(): void {
    db.setAll(this.#key, []);
  }
}

// Pre-defined repositories
export const repositories = {
  products: new Repository<any>('appleflow-products'),
  customers: new Repository<any>('appleflow-customers'),
  sales: new Repository<any>('appleflow-sales'),
  suppliers: new Repository<any>('appleflow-suppliers'),
  shifts: new Repository<any>('appleflow-shifts'),
  purchaseOrders: new Repository<any>('appleflow-purchase-orders'),
  expenses: new Repository<any>('appleflow-expenses'),
  quotes: new Repository<any>('appleflow-quotes'),
  layaways: new Repository<any>('appleflow-layaways'),
  notifications: new Repository<any>('appleflow-notifications'),
};

// ============================================
// SYNC QUEUE (for offline-first architecture)
// ============================================

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: string;
  retryCount: number;
}

export class SyncQueue {
  private static KEY = 'appleflow-sync-queue';

  static getQueue(): SyncOperation[] {
    return db.getAll<SyncOperation>(this.KEY);
  }

  static add(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): void {
    const queue = this.getQueue();
    queue.push({
      ...operation,
      id: `sync-${Date.now()}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
    db.setAll(this.KEY, queue);
  }

  static remove(id: string): void {
    const queue = this.getQueue().filter(op => op.id !== id);
    db.setAll(this.KEY, queue);
  }

  static incrementRetry(id: string): void {
    const queue = this.getQueue();
    const op = queue.find(o => o.id === id);
    if (op) {
      op.retryCount++;
      db.setAll(this.KEY, queue);
    }
  }

  static clear(): void {
    db.setAll(this.KEY, []);
  }

  static getPendingCount(): number {
    return this.getQueue().length;
  }
}

// ============================================
// CACHE LAYER
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class Cache {
  private static cache = new Map<string, CacheEntry<any>>();

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  static set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  static invalidate(key: string): void {
    this.cache.delete(key);
  }

  static invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  static clear(): void {
    this.cache.clear();
  }
}

// ============================================
// DATA MIGRATION UTILITIES
// ============================================

export class DataMigration {
  /**
   * Migrate from unencrypted localStorage to encrypted storage
   */
  static migrateToEncrypted(): { migrated: number; failed: number } {
    const keys = Object.keys(localStorage);
    let migrated = 0;
    let failed = 0;

    for (const key of keys) {
      if (key.startsWith('appleflow-')) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            secureStorage.setItem(key, parsed);
            migrated++;
          }
        } catch (error) {
          console.warn(`Failed to migrate ${key}:`, error);
          failed++;
        }
      }
    }

    return { migrated, failed };
  }

  /**
   * Export all data for backup
   */
  static exportAll(): Record<string, any> {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('appleflow-'));
    const data: Record<string, any> = {};

    for (const key of keys) {
      try {
        data[key] = secureStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to export ${key}:`, error);
      }
    }

    return data;
  }

  /**
   * Import data from backup
   */
  static importAll(data: Record<string, any>): { imported: number; failed: number } {
    let imported = 0;
    let failed = 0;

    for (const [key, value] of Object.entries(data)) {
      try {
        secureStorage.setItem(key, value);
        imported++;
      } catch (error) {
        console.warn(`Failed to import ${key}:`, error);
        failed++;
      }
    }

    return { imported, failed };
  }
}
