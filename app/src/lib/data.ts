/**
 * AppleFlow POS - Enhanced Data Layer
 * Enterprise-grade data management
 */

import { secureStorage } from './security';
import type { 
  Product, ProductCategory, Customer, Sale, User, Business, Shift, 
  HeldTransaction, Refund, Promotion, CashMovement, AuditLog, 
  Supplier, PurchaseOrder, StockAlert, AppSettings, UserPermissions,
  GiftCard, GiftCardTransaction, ProductBundle, ManagerOverride,
  CustomerNote, TimeBasedPrice, QuickKey, StoreCredit, ReceiptReprint,
  NoReceiptReturn, CashDrawerReconciliation, CashDenomination,
  XReport, ZReport, EndOfDaySummary, PaymentSummary, SaleItem
} from '@/types';

// Default Permissions by Role
export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
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
    canVoid: false,
    canViewReports: true,
    canManageProducts: false,
    canManageUsers: false,
    canOpenCloseShift: true,
    canViewAnalytics: false,
    maxDiscountPercent: 30,
  },
  cashier: {
    canProcessSales: true,
    canApplyDiscounts: false,
    canRefund: false,
    canVoid: false,
    canViewReports: false,
    canManageProducts: false,
    canManageUsers: false,
    canOpenCloseShift: false,
    canViewAnalytics: false,
    maxDiscountPercent: 0,
  },
};

// Demo Users with Permissions
export const DEMO_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin User',
    email: 'admin@appleflow.co.ke',
    pin: '1234',
    role: 'admin',
    permissions: DEFAULT_PERMISSIONS.admin,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u2',
    name: 'Manager User',
    email: 'manager@appleflow.co.ke',
    pin: '1234',
    role: 'manager',
    permissions: DEFAULT_PERMISSIONS.manager,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u3',
    name: 'Cashier User',
    email: 'cashier@appleflow.co.ke',
    pin: '1234',
    role: 'cashier',
    permissions: DEFAULT_PERMISSIONS.cashier,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u4',
    name: 'Supervisor User',
    email: 'supervisor@appleflow.co.ke',
    pin: '1234',
    role: 'supervisor',
    permissions: DEFAULT_PERMISSIONS.supervisor,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Demo Categories
export const DEMO_CATEGORIES: ProductCategory[] = [
  { id: 'c1', name: 'Beverages', color: '#3b82f6' },
  { id: 'c2', name: 'Food', color: '#f97316' },
  { id: 'c3', name: 'Groceries', color: '#22c55e' },
  { id: 'c4', name: 'Electronics', color: '#8b5cf6' },
  { id: 'c5', name: 'Household', color: '#06b6d4' },
  { id: 'c6', name: 'Personal Care', color: '#ec4899' },
  { id: 'c7', name: 'Fresh Produce', color: '#84cc16' },
  { id: 'c8', name: 'Meat & Fish', color: '#ef4444' },
];

// Demo Products with various types
export const DEMO_PRODUCTS: Product[] = [
  // Standard products
  {
    id: 'p1',
    sku: 'BEV-001',
    name: 'Coca-Cola 500ml',
    description: 'Refreshing soft drink',
    barcode: '5449000000996',
    category: DEMO_CATEGORIES[0],
    unit: 'bottle',
    productType: 'standard',
    costPrice: 45,
    sellingPrice: 60,
    wholesalePrice: 55,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 150,
    minStockLevel: 20,
    reorderPoint: 30,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    sku: 'BEV-002',
    name: 'Sprite 500ml',
    description: 'Lemon-lime soft drink',
    barcode: '5449000001009',
    category: DEMO_CATEGORIES[0],
    unit: 'bottle',
    productType: 'standard',
    costPrice: 45,
    sellingPrice: 60,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 120,
    minStockLevel: 20,
    reorderPoint: 30,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Weight-based product
  {
    id: 'p3',
    sku: 'FRESH-001',
    name: 'Bananas',
    description: 'Fresh ripe bananas',
    barcode: '200000000001',
    category: DEMO_CATEGORIES[6],
    unit: 'kg',
    productType: 'weighted',
    weightUnit: 'kg',
    costPrice: 80,
    sellingPrice: 120,
    vatRate: 0,
    isVatInclusive: true,
    quantity: 50,
    minStockLevel: 5,
    reorderPoint: 10,
    isActive: true,
    allowBackorders: true,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Serialized product
  {
    id: 'p4',
    sku: 'ELEC-001',
    name: 'Samsung Galaxy A14',
    description: 'Smartphone with 64GB storage',
    barcode: '8806095046821',
    category: DEMO_CATEGORIES[3],
    unit: 'piece',
    productType: 'serialized',
    costPrice: 15000,
    sellingPrice: 18999,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 8,
    minStockLevel: 2,
    reorderPoint: 3,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    serialNumbers: ['SN001234', 'SN001235', 'SN001236', 'SN001237', 'SN001238', 'SN001239', 'SN001240', 'SN001241'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p5',
    sku: 'GROC-001',
    name: 'Sugar 1kg',
    description: 'White granulated sugar',
    barcode: '6001007004001',
    category: DEMO_CATEGORIES[2],
    unit: 'packet',
    productType: 'standard',
    costPrice: 120,
    sellingPrice: 150,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 100,
    minStockLevel: 20,
    reorderPoint: 30,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p6',
    sku: 'GROC-002',
    name: 'Rice 2kg',
    description: 'Premium basmati rice',
    barcode: '6001007005008',
    category: DEMO_CATEGORIES[2],
    unit: 'packet',
    productType: 'standard',
    costPrice: 280,
    sellingPrice: 350,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 75,
    minStockLevel: 15,
    reorderPoint: 25,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Weight-based meat
  {
    id: 'p7',
    sku: 'MEAT-001',
    name: 'Beef Steak',
    description: 'Fresh beef steak',
    barcode: '300000000001',
    category: DEMO_CATEGORIES[7],
    unit: 'kg',
    productType: 'weighted',
    weightUnit: 'kg',
    costPrice: 450,
    sellingPrice: 650,
    vatRate: 0,
    isVatInclusive: true,
    quantity: 25,
    minStockLevel: 3,
    reorderPoint: 5,
    isActive: true,
    allowBackorders: true,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p8',
    sku: 'HOUSE-001',
    name: 'Detergent 1kg',
    description: 'Laundry detergent powder',
    barcode: '6001007009006',
    category: DEMO_CATEGORIES[4],
    unit: 'packet',
    productType: 'standard',
    costPrice: 150,
    sellingPrice: 200,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 70,
    minStockLevel: 15,
    reorderPoint: 20,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p9',
    sku: 'PC-001',
    name: 'Toothpaste 100g',
    description: 'Mint fresh toothpaste',
    barcode: '6001007010003',
    category: DEMO_CATEGORIES[5],
    unit: 'tube',
    productType: 'standard',
    costPrice: 80,
    sellingPrice: 120,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 90,
    minStockLevel: 20,
    reorderPoint: 30,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Low stock product (for alerts demo)
  {
    id: 'p10',
    sku: 'ELEC-002',
    name: 'Phone Charger USB-C',
    description: 'Fast charging USB-C cable',
    barcode: '6001007007002',
    category: DEMO_CATEGORIES[3],
    unit: 'piece',
    productType: 'standard',
    costPrice: 350,
    sellingPrice: 500,
    vatRate: 16,
    isVatInclusive: true,
    quantity: 2,
    minStockLevel: 5,
    reorderPoint: 8,
    isActive: true,
    allowBackorders: false,
    trackInventory: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Demo Suppliers
export const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: 'sup1',
    name: 'Coca-Cola Kenya',
    contactPerson: 'John Doe',
    phone: '0712345678',
    email: 'orders@cocacola.co.ke',
    address: 'Nairobi Industrial Area',
    kraPin: 'P001234567A',
    paymentTerms: 'Net 30',
    isActive: true,
  },
  {
    id: 'sup2',
    name: 'Unilever Kenya',
    contactPerson: 'Jane Smith',
    phone: '0723456789',
    email: 'orders@unilever.co.ke',
    address: 'Mombasa Road, Nairobi',
    kraPin: 'P002345678B',
    paymentTerms: 'Net 15',
    isActive: true,
  },
  {
    id: 'sup3',
    name: 'Samsung East Africa',
    contactPerson: 'Mike Johnson',
    phone: '0734567890',
    email: 'b2b@samsung.co.ke',
    address: 'Westlands, Nairobi',
    kraPin: 'P003456789C',
    paymentTerms: 'Prepaid',
    isActive: true,
  },
];

// Demo Customers
export const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cust1',
    name: 'John Kamau',
    phone: '0712345678',
    email: 'john@email.com',
    address: '123 Kimathi St, Nairobi',
    tier: 'gold',
    points: 1250,
    totalSpent: 45000,
    creditLimit: 10000,
    creditBalance: 0,
    isActive: true,
    discountPercent: 5,
    notes: 'Regular customer, prefers M-Pesa payments',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cust2',
    name: 'Mary Wanjiku',
    phone: '0723456789',
    email: 'mary@email.com',
    address: '456 Moi Ave, Nairobi',
    tier: 'silver',
    points: 650,
    totalSpent: 28000,
    creditBalance: 0,
    isActive: true,
    discountPercent: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cust3',
    name: 'Peter Ochieng',
    phone: '0734567890',
    tier: 'bronze',
    points: 150,
    totalSpent: 8500,
    creditBalance: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cust4',
    name: 'Grace Achieng',
    phone: '0745678901',
    email: 'grace@business.co.ke',
    address: '789 Tom Mboya St, Nairobi',
    tier: 'platinum',
    points: 3200,
    totalSpent: 89000,
    creditLimit: 50000,
    creditBalance: 5000,
    isActive: true,
    discountPercent: 10,
    notes: 'Business account, credit approved',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cust5',
    name: 'James Mwangi',
    phone: '0756789012',
    tier: 'silver',
    points: 480,
    totalSpent: 22000,
    creditBalance: 0,
    isActive: true,
    discountPercent: 2,
    createdAt: new Date().toISOString(),
  },
];

// Demo Business
export const DEMO_BUSINESS: Business = {
  name: 'AppleFlow Store',
  legalName: 'AppleFlow Retail Limited',
  kraPin: 'P051234567X',
  phone: '+254 712 345 678',
  email: 'info@appleflow.co.ke',
  address: '123 Kimathi Street, Nairobi',
  city: 'Nairobi',
  receiptFooter: 'Thank you for shopping with us!\nGoods once sold cannot be returned.\nVAT Reg: P051234567X',
  receiptHeader: '',
  showVatOnReceipt: true,
  printCustomerInfo: true,
  autoPrintReceipt: false,
  currency: 'KES',
  taxRate: 16,
};

// Demo Promotions
export const DEMO_PROMOTIONS: Promotion[] = [
  {
    id: 'promo1',
    name: 'Weekend Special - 10% Off',
    type: 'percentage',
    value: 10,
    minPurchase: 500,
    maxDiscount: 500,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    appliesTo: 'all',
    usageCount: 0,
  },
  {
    id: 'promo2',
    name: 'Buy 2 Get 1 Free - Beverages',
    type: 'buy_x_get_y',
    value: 1,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    appliesTo: 'category',
    categoryId: 'c1',
    usageCount: 0,
  },
];

// Demo App Settings
export const DEFAULT_SETTINGS: AppSettings = {
  requireShiftToSell: true,
  allowNegativeInventory: false,
  autoPrintReceipt: false,
  barcodeScannerEnabled: true,
  weightScaleEnabled: true,
  backupEnabled: true,
  backupFrequency: 'daily',
  // New advanced settings
  enableGiftCards: true,
  enableStoreCredit: true,
  enableBundles: true,
  enableHappyHour: true,
  enableManagerOverride: true,
  blindCloseEnabled: false,
  requireAgeVerification: true,
  defaultAgeRestriction: 18,
};

// Demo Gift Cards
export const DEMO_GIFT_CARDS: GiftCard[] = [
  {
    id: 'gc1',
    cardNumber: 'GC-100001',
    initialBalance: 5000,
    currentBalance: 3500,
    status: 'active',
    issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    issuedBy: 'u1',
    expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
    customerId: 'cust1',
    customerName: 'John Kamau',
    lastUsedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'gc2',
    cardNumber: 'GC-100002',
    initialBalance: 2000,
    currentBalance: 2000,
    status: 'active',
    issuedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    issuedBy: 'u2',
    expiresAt: new Date(Date.now() + 358 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo Product Bundles
export const DEMO_BUNDLES: ProductBundle[] = [
  {
    id: 'bundle1',
    name: 'Weekend BBQ Pack',
    description: 'Perfect for your weekend barbecue',
    sku: 'BUNDLE-BBQ-001',
    barcode: '999000000001',
    components: [
      { productId: 'p7', productName: 'Beef Steak', sku: 'MEAT-001', quantity: 2, unitPrice: 650 },
      { productId: 'p1', productName: 'Coca-Cola 500ml', sku: 'BEV-001', quantity: 6, unitPrice: 60 },
    ],
    bundlePrice: 1500,
    originalTotalPrice: 1660,
    savingsAmount: 160,
    savingsPercent: 9.6,
    isActive: true,
    categoryId: 'c7',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bundle2',
    name: 'Breakfast Combo',
    description: 'Start your day right',
    sku: 'BUNDLE-BRK-001',
    barcode: '999000000002',
    components: [
      { productId: 'p3', productName: 'Bananas', sku: 'FRESH-001', quantity: 0.5, unitPrice: 120 },
      { productId: 'p5', productName: 'Sugar 1kg', sku: 'GROC-001', quantity: 1, unitPrice: 150 },
    ],
    bundlePrice: 100,
    originalTotalPrice: 210,
    savingsAmount: 110,
    savingsPercent: 52.4,
    isActive: true,
    categoryId: 'c2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Demo Time-Based Prices (Happy Hour)
export const DEMO_TIME_BASED_PRICES: TimeBasedPrice[] = [
  {
    id: 'tbp1',
    name: 'Happy Hour - Beverages',
    description: '20% off all beverages 4-6 PM weekdays',
    productIds: ['p1', 'p2'],
    regularPrice: 60,
    specialPrice: 48,
    discountPercent: 20,
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '16:00',
    endTime: '18:00',
    isActive: true,
    priority: 1,
  },
  {
    id: 'tbp2',
    name: 'Weekend Fresh Produce',
    description: '15% off fresh produce on weekends',
    productIds: ['p3'],
    regularPrice: 120,
    specialPrice: 102,
    discountPercent: 15,
    daysOfWeek: [0, 6], // Sat-Sun
    startTime: '08:00',
    endTime: '20:00',
    isActive: true,
    priority: 2,
  },
];

// Demo Quick Keys
export const DEMO_QUICK_KEYS: QuickKey[] = [
  { id: 'qk1', productId: 'p1', productName: 'Coca-Cola 500ml', position: 1, color: '#ef4444', shortcutKey: 'F1', isActive: true, category: 'beverages' },
  { id: 'qk2', productId: 'p2', productName: 'Sprite 500ml', position: 2, color: '#22c55e', shortcutKey: 'F2', isActive: true, category: 'beverages' },
  { id: 'qk3', productId: 'p5', productName: 'Sugar 1kg', position: 3, color: '#f8fafc', shortcutKey: 'F3', isActive: true, category: 'groceries' },
  { id: 'qk4', productId: 'p6', productName: 'Rice 2kg', position: 4, color: '#f97316', shortcutKey: 'F4', isActive: true, category: 'groceries' },
  { id: 'qk5', productId: 'p9', productName: 'Toothpaste', position: 5, color: '#3b82f6', shortcutKey: 'F5', isActive: true, category: 'personal' },
];

// Demo Customer Notes
export const DEMO_CUSTOMER_NOTES: CustomerNote[] = [
  {
    id: 'cn1',
    customerId: 'cust1',
    type: 'preference',
    title: 'Payment Preference',
    content: 'Customer prefers M-Pesa payments. Always confirm before processing.',
    isActive: true,
    showAtCheckout: true,
    createdBy: 'u2',
    createdByName: 'Manager User',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cn2',
    customerId: 'cust4',
    type: 'vip',
    title: 'VIP Customer',
    content: 'Platinum tier - offer complimentary gift wrapping and priority service.',
    isActive: true,
    showAtCheckout: true,
    createdBy: 'u1',
    createdByName: 'Admin User',
    createdAt: new Date().toISOString(),
  },
];

// Demo Store Credits
export const DEMO_STORE_CREDITS: StoreCredit[] = [
  {
    id: 'sc1',
    customerId: 'cust2',
    customerName: 'Mary Wanjiku',
    amount: 500,
    balance: 350,
    reason: 'Refund for damaged item - Receipt RCP-240101-0001',
    issuedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    issuedBy: 'u2',
    isActive: true,
  },
];

// Initialize Demo Data
export function initializeDemoData() {
  secureStorage.setItem('appleflow-users', JSON.stringify(DEMO_USERS));
  secureStorage.setItem('appleflow-products', JSON.stringify(DEMO_PRODUCTS));
  secureStorage.setItem('appleflow-categories', JSON.stringify(DEMO_CATEGORIES));
  secureStorage.setItem('appleflow-customers', JSON.stringify(DEMO_CUSTOMERS));
  secureStorage.setItem('appleflow-suppliers', JSON.stringify(DEMO_SUPPLIERS));
  secureStorage.setItem('appleflow-business', JSON.stringify(DEMO_BUSINESS));
  secureStorage.setItem('appleflow-promotions', JSON.stringify(DEMO_PROMOTIONS));
  secureStorage.setItem('appleflow-settings', JSON.stringify(DEFAULT_SETTINGS));
  secureStorage.setItem('appleflow-sales', JSON.stringify([]));
  secureStorage.setItem('appleflow-shifts', JSON.stringify([]));
  secureStorage.setItem('appleflow-held', JSON.stringify([]));
  secureStorage.setItem('appleflow-refunds', JSON.stringify([]));
  secureStorage.setItem('appleflow-purchase-orders', JSON.stringify([]));
  secureStorage.setItem('appleflow-stock-alerts', JSON.stringify([]));
  secureStorage.setItem('appleflow-audit-logs', JSON.stringify([]));
  secureStorage.setItem('appleflow-cart', JSON.stringify([]));
  secureStorage.setItem('appleflow-cash-movements', JSON.stringify([]));
  // Advanced features data
  secureStorage.setItem('appleflow-gift-cards', JSON.stringify(DEMO_GIFT_CARDS));
  secureStorage.setItem('appleflow-gift-card-transactions', JSON.stringify([]));
  secureStorage.setItem('appleflow-bundles', JSON.stringify(DEMO_BUNDLES));
  secureStorage.setItem('appleflow-time-based-prices', JSON.stringify(DEMO_TIME_BASED_PRICES));
  secureStorage.setItem('appleflow-quick-keys', JSON.stringify(DEMO_QUICK_KEYS));
  secureStorage.setItem('appleflow-customer-notes', JSON.stringify(DEMO_CUSTOMER_NOTES));
  secureStorage.setItem('appleflow-store-credits', JSON.stringify(DEMO_STORE_CREDITS));
  secureStorage.setItem('appleflow-manager-overrides', JSON.stringify([]));
  secureStorage.setItem('appleflow-receipt-reprints', JSON.stringify([]));
  secureStorage.setItem('appleflow-no-receipt-returns', JSON.stringify([]));
  secureStorage.setItem('appleflow-age-verifications', JSON.stringify([]));
}

// Getters
export function getUsers(): User[] {
  return JSON.parse(secureStorage.getItem('appleflow-users') || '[]');
}

export function getProducts(): Product[] {
  return JSON.parse(secureStorage.getItem('appleflow-products') || '[]');
}

export function getCategories(): ProductCategory[] {
  return JSON.parse(secureStorage.getItem('appleflow-categories') || '[]');
}

export function getCustomers(): Customer[] {
  return JSON.parse(secureStorage.getItem('appleflow-customers') || '[]');
}

export function getSuppliers(): Supplier[] {
  return JSON.parse(secureStorage.getItem('appleflow-suppliers') || '[]');
}

export function getBusiness(): Business {
  return JSON.parse(secureStorage.getItem('appleflow-business') || JSON.stringify(DEMO_BUSINESS));
}

export function getSettings(): AppSettings {
  return JSON.parse(secureStorage.getItem('appleflow-settings') || JSON.stringify(DEFAULT_SETTINGS));
}

export function getSales(): Sale[] {
  return JSON.parse(secureStorage.getItem('appleflow-sales') || '[]');
}

export function getShifts(): Shift[] {
  return JSON.parse(secureStorage.getItem('appleflow-shifts') || '[]');
}

export function getHeldTransactions(): HeldTransaction[] {
  return JSON.parse(secureStorage.getItem('appleflow-held') || '[]');
}

export function getRefunds(): Refund[] {
  return JSON.parse(secureStorage.getItem('appleflow-refunds') || '[]');
}

export function getPromotions(): Promotion[] {
  return JSON.parse(secureStorage.getItem('appleflow-promotions') || '[]');
}

export function getPurchaseOrders(): PurchaseOrder[] {
  return JSON.parse(secureStorage.getItem('appleflow-purchase-orders') || '[]');
}

export function getStockAlerts(): StockAlert[] {
  return JSON.parse(secureStorage.getItem('appleflow-stock-alerts') || '[]');
}

export function getAuditLogs(): AuditLog[] {
  return JSON.parse(secureStorage.getItem('appleflow-audit-logs') || '[]');
}

export function getCart(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-cart') || '[]');
}

export function getCashMovements(): CashMovement[] {
  return JSON.parse(secureStorage.getItem('appleflow-cash-movements') || '[]');
}

// Advanced Features Getters
export function getGiftCards(): GiftCard[] {
  return JSON.parse(secureStorage.getItem('appleflow-gift-cards') || '[]');
}

export function getGiftCardTransactions(): GiftCardTransaction[] {
  return JSON.parse(secureStorage.getItem('appleflow-gift-card-transactions') || '[]');
}

export function getBundles(): ProductBundle[] {
  return JSON.parse(secureStorage.getItem('appleflow-bundles') || '[]');
}

export function getTimeBasedPrices(): TimeBasedPrice[] {
  return JSON.parse(secureStorage.getItem('appleflow-time-based-prices') || '[]');
}

export function getQuickKeys(): QuickKey[] {
  return JSON.parse(secureStorage.getItem('appleflow-quick-keys') || '[]');
}

export function getCustomerNotes(): CustomerNote[] {
  return JSON.parse(secureStorage.getItem('appleflow-customer-notes') || '[]');
}

export function getStoreCredits(): StoreCredit[] {
  return JSON.parse(secureStorage.getItem('appleflow-store-credits') || '[]');
}

export function getManagerOverrides(): ManagerOverride[] {
  return JSON.parse(secureStorage.getItem('appleflow-manager-overrides') || '[]');
}

export function getReceiptReprints(): ReceiptReprint[] {
  return JSON.parse(secureStorage.getItem('appleflow-receipt-reprints') || '[]');
}

export function getNoReceiptReturns(): NoReceiptReturn[] {
  return JSON.parse(secureStorage.getItem('appleflow-no-receipt-returns') || '[]');
}

// Setters
export function saveProducts(products: Product[]) {
  secureStorage.setItem('appleflow-products', JSON.stringify(products));
}

export function saveCustomers(customers: Customer[]) {
  secureStorage.setItem('appleflow-customers', JSON.stringify(customers));
}

export function saveSuppliers(suppliers: Supplier[]) {
  secureStorage.setItem('appleflow-suppliers', JSON.stringify(suppliers));
}

export function saveSettings(settings: AppSettings) {
  secureStorage.setItem('appleflow-settings', JSON.stringify(settings));
}

export function saveSales(sales: Sale[]) {
  secureStorage.setItem('appleflow-sales', JSON.stringify(sales));
}

export function saveShifts(shifts: Shift[]) {
  secureStorage.setItem('appleflow-shifts', JSON.stringify(shifts));
}

export function saveHeldTransactions(held: HeldTransaction[]) {
  secureStorage.setItem('appleflow-held', JSON.stringify(held));
}

export function saveRefunds(refunds: Refund[]) {
  secureStorage.setItem('appleflow-refunds', JSON.stringify(refunds));
}

export function saveCart(cart: any[]) {
  secureStorage.setItem('appleflow-cart', JSON.stringify(cart));
}

export function saveCashMovements(movements: CashMovement[]) {
  secureStorage.setItem('appleflow-cash-movements', JSON.stringify(movements));
}

// Advanced Features Setters
export function saveGiftCards(giftCards: GiftCard[]) {
  secureStorage.setItem('appleflow-gift-cards', JSON.stringify(giftCards));
}

export function saveGiftCardTransactions(transactions: GiftCardTransaction[]) {
  secureStorage.setItem('appleflow-gift-card-transactions', JSON.stringify(transactions));
}

export function saveBundles(bundles: ProductBundle[]) {
  secureStorage.setItem('appleflow-bundles', JSON.stringify(bundles));
}

export function saveTimeBasedPrices(prices: TimeBasedPrice[]) {
  secureStorage.setItem('appleflow-time-based-prices', JSON.stringify(prices));
}

export function saveQuickKeys(quickKeys: QuickKey[]) {
  secureStorage.setItem('appleflow-quick-keys', JSON.stringify(quickKeys));
}

export function saveCustomerNotes(notes: CustomerNote[]) {
  secureStorage.setItem('appleflow-customer-notes', JSON.stringify(notes));
}

export function saveStoreCredits(credits: StoreCredit[]) {
  secureStorage.setItem('appleflow-store-credits', JSON.stringify(credits));
}

export function saveManagerOverrides(overrides: ManagerOverride[]) {
  secureStorage.setItem('appleflow-manager-overrides', JSON.stringify(overrides));
}

export function saveReceiptReprints(reprints: ReceiptReprint[]) {
  secureStorage.setItem('appleflow-receipt-reprints', JSON.stringify(reprints));
}

export function saveNoReceiptReturns(returns: NoReceiptReturn[]) {
  secureStorage.setItem('appleflow-no-receipt-returns', JSON.stringify(returns));
}

export function savePurchaseOrders(pos: PurchaseOrder[]) {
  secureStorage.setItem('appleflow-purchase-orders', JSON.stringify(pos));
}

export function saveStockAlerts(alerts: StockAlert[]) {
  secureStorage.setItem('appleflow-stock-alerts', JSON.stringify(alerts));
}

export function saveAuditLogs(logs: AuditLog[]) {
  secureStorage.setItem('appleflow-audit-logs', JSON.stringify(logs));
}

// Audit Log Helper
export function addAuditLog(action: AuditLog['action'], entityType: string, entityId: string, details: string, userId?: string, userName?: string, oldValue?: string, newValue?: string) {
  const logs = getAuditLogs();
  const sessionUser = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  logs.unshift({
    id: 'log-' + Date.now(),
    userId: userId || sessionUser.id || 'system',
    userName: userName || sessionUser.name || 'System',
    action,
    entityType,
    entityId,
    details,
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
  });
  
  // Keep only last 1000 logs
  saveAuditLogs(logs.slice(0, 1000));
}

// Stock Alert Helper
export function checkStockAlerts() {
  const products = getProducts();
  const existingAlerts = getStockAlerts();
  const newAlerts: StockAlert[] = [];
  
  products.forEach(product => {
    if (!product.trackInventory) return;
    
    if (product.quantity === 0) {
      // Check if alert already exists
      if (!existingAlerts.some(a => a.productId === product.id && a.alertType === 'out_of_stock' && !a.isRead)) {
        newAlerts.push({
          id: 'alert-' + Date.now() + '-' + product.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.quantity,
          minStockLevel: product.minStockLevel,
          alertType: 'out_of_stock',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (product.quantity <= product.minStockLevel) {
      if (!existingAlerts.some(a => a.productId === product.id && a.alertType === 'low_stock' && !a.isRead)) {
        newAlerts.push({
          id: 'alert-' + Date.now() + '-' + product.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.quantity,
          minStockLevel: product.minStockLevel,
          alertType: 'low_stock',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  });
  
  if (newAlerts.length > 0) {
    saveStockAlerts([...newAlerts, ...existingAlerts]);
  }
  
  return newAlerts;
}

// ID Generators
export function generateReceiptNumber(): string {
  const date = new Date();
  const prefix = 'RCP';
  const timestamp = date.getFullYear().toString().slice(2) +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${prefix}-${timestamp}-${random}`;
}

export function generateSaleId(): string {
  return 'sale-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function generateShiftId(): string {
  return 'shift-' + Date.now().toString(36);
}

export function generatePONumber(): string {
  const date = new Date();
  return `PO-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
}

// Calculations
export function calculateVAT(price: number, vatRate: number, inclusive: boolean): number {
  if (inclusive) {
    return price - (price / (1 + vatRate / 100));
  }
  return price * (vatRate / 100);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Product Helpers
export function findProductByBarcode(barcode: string): Product | undefined {
  const products = getProducts();
  return products.find(p => p.barcode === barcode && p.isActive);
}

export function findProductById(id: string): Product | undefined {
  const products = getProducts();
  return products.find(p => p.id === id && p.isActive);
}

// Active Shift
export function getActiveShift(): Shift | null {
  const shifts = getShifts();
  return shifts.find(s => s.isActive && !s.isClosed) || null;
}

// ============================================
// GIFT CARD FUNCTIONS
// ============================================

export function findGiftCardByNumber(cardNumber: string): GiftCard | undefined {
  const cards = getGiftCards();
  return cards.find(c => c.cardNumber.toLowerCase() === cardNumber.toLowerCase() && c.status === 'active');
}

export function issueGiftCard(initialBalance: number, customerId?: string, customerName?: string, notes?: string): GiftCard {
  const cards = getGiftCards();
  const cardNumber = `GC-${100000 + cards.length + 1}`;
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  const newCard: GiftCard = {
    id: 'gc-' + Date.now(),
    cardNumber,
    initialBalance,
    currentBalance: initialBalance,
    status: 'active',
    issuedAt: new Date().toISOString(),
    issuedBy: user.id || 'system',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    customerId,
    customerName,
    notes,
  };
  
  cards.push(newCard);
  saveGiftCards(cards);
  
  // Log transaction
  logGiftCardTransaction(newCard.id, cardNumber, 'issue', initialBalance, initialBalance);
  addAuditLog('gift_card_issued', 'gift_card', newCard.id, `Issued gift card ${cardNumber} with balance ${formatCurrency(initialBalance)}`);
  
  return newCard;
}

export function loadGiftCard(cardId: string, amount: number, notes?: string): boolean {
  const cards = getGiftCards();
  const card = cards.find(c => c.id === cardId);
  if (!card || card.status !== 'active') return false;
  
  const newBalance = card.currentBalance + amount;
  
  card.currentBalance = newBalance;
  card.lastUsedAt = new Date().toISOString();
  saveGiftCards(cards);
  
  logGiftCardTransaction(cardId, card.cardNumber, 'load', amount, newBalance, notes);
  addAuditLog('gift_card_loaded', 'gift_card', cardId, `Loaded ${formatCurrency(amount)} to card ${card.cardNumber}`);
  
  return true;
}

export function redeemGiftCard(cardId: string, amount: number, saleId?: string, receiptNumber?: string): boolean {
  const cards = getGiftCards();
  const card = cards.find(c => c.id === cardId);
  if (!card || card.status !== 'active' || card.currentBalance < amount) return false;
  
  const newBalance = card.currentBalance - amount;
  card.currentBalance = newBalance;
  card.lastUsedAt = new Date().toISOString();
  
  if (newBalance === 0) {
    card.status = 'depleted';
  }
  
  saveGiftCards(cards);
  logGiftCardTransaction(cardId, card.cardNumber, 'redeem', amount, newBalance, undefined, saleId, receiptNumber);
  addAuditLog('gift_card_redeemed', 'gift_card', cardId, `Redeemed ${formatCurrency(amount)} from card ${card.cardNumber}`);
  
  return true;
}

function logGiftCardTransaction(
  giftCardId: string, 
  cardNumber: string, 
  type: GiftCardTransaction['type'], 
  amount: number, 
  balanceAfter: number,
  notes?: string,
  saleId?: string,
  receiptNumber?: string
) {
  const transactions = getGiftCardTransactions();
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  transactions.unshift({
    id: 'gct-' + Date.now(),
    giftCardId,
    cardNumber,
    type,
    amount,
    balanceAfter,
    saleId,
    receiptNumber,
    performedBy: user.id || 'system',
    performedAt: new Date().toISOString(),
    notes,
  });
  
  saveGiftCardTransactions(transactions.slice(0, 1000));
}

// ============================================
// PRODUCT BUNDLE FUNCTIONS
// ============================================

export function findBundleByBarcode(barcode: string): ProductBundle | undefined {
  const bundles = getBundles();
  return bundles.find(b => b.barcode === barcode && b.isActive);
}

export function findBundleById(id: string): ProductBundle | undefined {
  const bundles = getBundles();
  return bundles.find(b => b.id === id && b.isActive);
}

export function addBundle(bundle: Omit<ProductBundle, 'id' | 'createdAt' | 'updatedAt'>): ProductBundle {
  const bundles = getBundles();
  const newBundle: ProductBundle = {
    ...bundle,
    id: 'bundle-' + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bundles.push(newBundle);
  saveBundles(bundles);
  addAuditLog('product_created', 'bundle', newBundle.id, `Created bundle ${newBundle.name}`);
  return newBundle;
}

export function updateBundle(id: string, updates: Partial<ProductBundle>): boolean {
  const bundles = getBundles();
  const index = bundles.findIndex(b => b.id === id);
  if (index === -1) return false;
  
  bundles[index] = { ...bundles[index], ...updates, updatedAt: new Date().toISOString() };
  saveBundles(bundles);
  addAuditLog('product_updated', 'bundle', id, `Updated bundle ${bundles[index].name}`);
  return true;
}

// ============================================
// MANAGER OVERRIDE FUNCTIONS
// ============================================

export function requestManagerOverride(
  type: ManagerOverride['type'],
  reason: string,
  amount?: number,
  originalValue?: string,
  newValue?: string
): ManagerOverride {
  const overrides = getManagerOverrides();
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  const override: ManagerOverride = {
    id: 'ovr-' + Date.now(),
    type,
    originalValue,
    newValue,
    amount,
    reason,
    requestedBy: user.id || 'unknown',
    requestedByName: user.name || 'Unknown',
    approvedBy: '',
    approvedByName: '',
    requestedAt: new Date().toISOString(),
    approvedAt: '',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    isUsed: false,
  };
  
  overrides.unshift(override);
  saveManagerOverrides(overrides.slice(0, 100));
  
  addAuditLog('manager_override_requested', 'override', override.id, `${user.name} requested ${type} override`);
  
  return override;
}

export function approveManagerOverride(overrideId: string, managerId: string, managerName: string): boolean {
  const overrides = getManagerOverrides();
  const index = overrides.findIndex(o => o.id === overrideId);
  if (index === -1) return false;
  
  overrides[index].approvedBy = managerId;
  overrides[index].approvedByName = managerName;
  overrides[index].approvedAt = new Date().toISOString();
  overrides[index].expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from approval
  
  saveManagerOverrides(overrides);
  addAuditLog('manager_override_approved', 'override', overrideId, `Manager ${managerName} approved override`);
  
  return true;
}

export function useManagerOverride(overrideId: string, usedFor: string): boolean {
  const overrides = getManagerOverrides();
  const override = overrides.find(o => o.id === overrideId);
  if (!override) return false;
  if (override.approvedAt === '') return false;
  if (new Date() > new Date(override.expiresAt)) return false;
  if (override.isUsed) return false;
  
  override.isUsed = true;
  override.usedFor = usedFor;
  override.usedAt = new Date().toISOString();
  
  saveManagerOverrides(overrides);
  return true;
}

export function isOverrideValid(overrideId: string): boolean {
  const overrides = getManagerOverrides();
  const override = overrides.find(o => o.id === overrideId);
  if (!override) return false;
  if (override.approvedAt === '') return false;
  if (new Date() > new Date(override.expiresAt)) return false;
  if (override.isUsed) return false;
  return true;
}

// ============================================
// TIME-BASED PRICING (HAPPY HOUR)
// ============================================

export function isHappyHourActive(priceId: string): boolean {
  const prices = getTimeBasedPrices();
  const price = prices.find(p => p.id === priceId && p.isActive);
  if (!price) return false;
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  // Check day of week
  if (!price.daysOfWeek.includes(currentDay)) return false;
  
  // Check time range
  if (currentTime < price.startTime || currentTime > price.endTime) return false;
  
  // Check date range if specified
  if (price.startDate && new Date() < new Date(price.startDate)) return false;
  if (price.endDate && new Date() > new Date(price.endDate)) return false;
  
  return true;
}

export function getActiveHappyHourPrice(productId: string): TimeBasedPrice | undefined {
  const prices = getTimeBasedPrices()
    .filter(p => p.isActive && p.productIds.includes(productId))
    .sort((a, b) => b.priority - a.priority);
  
  for (const price of prices) {
    if (isHappyHourActive(price.id)) {
      return price;
    }
  }
  return undefined;
}

export function getProductPriceWithHappyHour(product: Product): { price: number; happyHourApplied: boolean; discount: number } {
  const happyHour = getActiveHappyHourPrice(product.id);
  if (happyHour) {
    return {
      price: happyHour.specialPrice,
      happyHourApplied: true,
      discount: happyHour.discountPercent,
    };
  }
  return {
    price: product.sellingPrice,
    happyHourApplied: false,
    discount: 0,
  };
}

// ============================================
// QUICK KEYS / FAVORITES
// ============================================

export function getActiveQuickKeys(): QuickKey[] {
  return getQuickKeys().filter(qk => qk.isActive).sort((a, b) => a.position - b.position);
}

export function addQuickKey(productId: string, position: number, color?: string, shortcutKey?: string): QuickKey | null {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return null;
  
  const quickKeys = getQuickKeys();
  
  // Check if position already taken
  const existingIndex = quickKeys.findIndex(qk => qk.position === position);
  if (existingIndex !== -1) {
    quickKeys[existingIndex] = {
      ...quickKeys[existingIndex],
      productId,
      productName: product.name,
      color,
      shortcutKey,
      isActive: true,
    };
  } else {
    quickKeys.push({
      id: 'qk-' + Date.now(),
      productId,
      productName: product.name,
      position,
      color,
      shortcutKey,
      isActive: true,
    });
  }
  
  saveQuickKeys(quickKeys);
  return quickKeys.find(qk => qk.position === position) || null;
}

export function removeQuickKey(position: number): boolean {
  const quickKeys = getQuickKeys();
  const index = quickKeys.findIndex(qk => qk.position === position);
  if (index === -1) return false;
  
  quickKeys[index].isActive = false;
  saveQuickKeys(quickKeys);
  return true;
}

// ============================================
// CUSTOMER NOTES & WARNINGS
// ============================================

export function getCustomerNotesForCustomer(customerId: string): CustomerNote[] {
  return getCustomerNotes().filter(n => n.customerId === customerId && n.isActive);
}

export function getActiveWarningsForCustomer(customerId: string): CustomerNote[] {
  return getCustomerNotes().filter(n => 
    n.customerId === customerId && 
    n.isActive && 
    n.showAtCheckout &&
    (n.type === 'warning' || n.type === 'fraud_alert' || n.type === 'payment_issue')
  );
}

export function addCustomerNote(
  customerId: string,
  type: CustomerNote['type'],
  title: string,
  content: string,
  showAtCheckout: boolean = true,
  expiresAt?: string
): CustomerNote {
  const notes = getCustomerNotes();
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  const note: CustomerNote = {
    id: 'cn-' + Date.now(),
    customerId,
    type,
    title,
    content,
    isActive: true,
    showAtCheckout,
    createdBy: user.id || 'system',
    createdByName: user.name || 'System',
    createdAt: new Date().toISOString(),
    expiresAt,
  };
  
  notes.unshift(note);
  saveCustomerNotes(notes.slice(0, 500));
  
  addAuditLog('customer_note_added', 'customer_note', note.id, `Added ${type} note for customer`);
  
  return note;
}

// ============================================
// STORE CREDIT FUNCTIONS
// ============================================

export function getStoreCreditForCustomer(customerId: string): StoreCredit | undefined {
  return getStoreCredits().find(sc => sc.customerId === customerId && sc.isActive && sc.balance > 0);
}

export function getTotalStoreCreditBalance(customerId: string): number {
  return getStoreCredits()
    .filter(sc => sc.customerId === customerId && sc.isActive)
    .reduce((sum, sc) => sum + sc.balance, 0);
}

export function issueStoreCredit(
  customerId: string,
  customerName: string,
  amount: number,
  reason: string,
  issuedFrom?: string
): StoreCredit {
  const credits = getStoreCredits();
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  const credit: StoreCredit = {
    id: 'sc-' + Date.now(),
    customerId,
    customerName,
    amount,
    balance: amount,
    reason,
    issuedFrom,
    issuedAt: new Date().toISOString(),
    issuedBy: user.id || 'system',
    isActive: true,
  };
  
  credits.unshift(credit);
  saveStoreCredits(credits);
  
  addAuditLog('store_credit_issued', 'store_credit', credit.id, `Issued ${formatCurrency(amount)} store credit to ${customerName}`);
  
  return credit;
}

export function redeemStoreCredit(creditId: string, amount: number): boolean {
  const credits = getStoreCredits();
  const credit = credits.find(c => c.id === creditId && c.isActive);
  if (!credit || credit.balance < amount) return false;
  
  credit.balance -= amount;
  if (credit.balance === 0) {
    credit.isActive = false;
  }
  
  saveStoreCredits(credits);
  addAuditLog('store_credit_redeemed', 'store_credit', creditId, `Redeemed ${formatCurrency(amount)} store credit`);
  
  return true;
}

// ============================================
// RECEIPT REPRINT FUNCTIONS
// ============================================

export function logReceiptReprint(saleId: string, receiptNumber: string, reason: string): ReceiptReprint {
  const reprints = getReceiptReprints();
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  // Count existing reprints for this sale
  const existingCount = reprints.filter(r => r.saleId === saleId).length;
  
  const reprint: ReceiptReprint = {
    id: 'rp-' + Date.now(),
    saleId,
    receiptNumber,
    reprintedBy: user.id || 'system',
    reprintedByName: user.name || 'System',
    reprintedAt: new Date().toISOString(),
    reason,
    copyNumber: existingCount + 1,
  };
  
  reprints.unshift(reprint);
  saveReceiptReprints(reprints.slice(0, 500));
  
  addAuditLog('receipt_reprinted', 'sale', saleId, `Receipt reprinted (copy #${reprint.copyNumber}): ${reason}`);
  
  return reprint;
}

// ============================================
// NO-RECEIPT RETURN FUNCTIONS
// ============================================

export function createNoReceiptReturn(
  items: NoReceiptReturn['items'],
  totalRefundAmount: number,
  customerName?: string,
  customerPhone?: string,
  customerId?: string,
  idVerified: boolean = false,
  idType?: NoReceiptReturn['idType'],
  idNumber?: string,
  managerOverrideId?: string,
  notes: string = ''
): NoReceiptReturn {
  const returns = getNoReceiptReturns();
  const user = JSON.parse(secureStorage.getItem('appleflow-session') || '{}');
  
  const returnNumber = `NRR-${Date.now().toString().slice(-8)}`;
  
  const noReceiptReturn: NoReceiptReturn = {
    id: 'nrr-' + Date.now(),
    returnNumber,
    items,
    totalRefundAmount,
    customerName,
    customerPhone,
    customerId,
    idVerified,
    idType,
    idNumber,
    managerOverrideId,
    processedBy: user.id || 'system',
    processedAt: new Date().toISOString(),
    notes,
    status: managerOverrideId ? 'approved' : 'pending',
  };
  
  returns.unshift(noReceiptReturn);
  saveNoReceiptReturns(returns);
  
  addAuditLog('no_receipt_return', 'return', noReceiptReturn.id, `No-receipt return ${returnNumber} for ${formatCurrency(totalRefundAmount)}`);
  
  return noReceiptReturn;
}

// ============================================
// CASH DRAWER DENOMINATION FUNCTIONS
// ============================================

export function createEmptyCashDrawerReconciliation(): CashDrawerReconciliation {
  const zeroDenom = (denomination: number): CashDenomination => ({
    denomination,
    count: 0,
    total: 0,
  });
  
  return {
    thousands: zeroDenom(1000),
    fiveHundreds: zeroDenom(500),
    twoHundreds: zeroDenom(200),
    hundreds: zeroDenom(100),
    fifties: zeroDenom(50),
    twenties: zeroDenom(20),
    tens: zeroDenom(10),
    fiveCoins: zeroDenom(5),
    oneCoins: zeroDenom(1),
    fiftyCents: zeroDenom(0.5),
    total: 0,
  };
}

export function calculateCashDrawerTotal(denomination: CashDrawerReconciliation): number {
  return (
    denomination.thousands.total +
    denomination.fiveHundreds.total +
    denomination.twoHundreds.total +
    denomination.hundreds.total +
    denomination.fifties.total +
    denomination.twenties.total +
    denomination.tens.total +
    denomination.fiveCoins.total +
    denomination.oneCoins.total +
    denomination.fiftyCents.total
  );
}

export function updateDenominationCount(
  reconciliation: CashDrawerReconciliation,
  key: keyof Omit<CashDrawerReconciliation, 'total'>,
  count: number
): CashDrawerReconciliation {
  const updated = { ...reconciliation };
  const denomKey = key as keyof typeof updated;
  const denom = updated[denomKey] as CashDenomination;
  
  denom.count = count;
  denom.total = count * denom.denomination;
  
  (updated[denomKey] as CashDenomination) = denom;
  updated.total = calculateCashDrawerTotal(updated);
  
  return updated;
}

// Cart Calculations
export function calculateCartTotals(
  cart: any[], 
  customerDiscount: number = 0,
  additionalDiscounts: any[] = []
) {
  const subtotal = cart.reduce((sum, item) => {
    const basePrice = item.customPrice || item.product.sellingPrice;
    const itemDiscount = item.discountPercent || 0;
    const priceAfterItemDiscount = basePrice * (1 - itemDiscount / 100);
    const priceWithoutVAT = item.product.isVatInclusive 
      ? priceAfterItemDiscount / (1 + item.product.vatRate / 100)
      : priceAfterItemDiscount;
    const qty = item.product.productType === 'weighted' ? (item.weight || 0) : item.quantity;
    return sum + (priceWithoutVAT * qty);
  }, 0);
  
  const afterCustomerDiscount = subtotal * (1 - customerDiscount / 100);
  const additionalDiscountTotal = additionalDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const afterAllDiscounts = Math.max(0, afterCustomerDiscount - additionalDiscountTotal);
  
  const vatTotal = cart.reduce((sum, item) => {
    const basePrice = item.customPrice || item.product.sellingPrice;
    const itemDiscount = item.discountPercent || 0;
    const priceAfterItemDiscount = basePrice * (1 - itemDiscount / 100);
    const vatAmount = item.product.isVatInclusive
      ? priceAfterItemDiscount - (priceAfterItemDiscount / (1 + item.product.vatRate / 100))
      : (priceAfterItemDiscount * item.product.vatRate / 100);
    const qty = item.product.productType === 'weighted' ? (item.weight || 0) : item.quantity;
    return sum + (vatAmount * qty);
  }, 0);
  
  const total = afterAllDiscounts + vatTotal;
  
  return { 
    subtotal, 
    discountTotal: subtotal - afterAllDiscounts,
    vatTotal, 
    total 
  };
}

// Backup & Export
export function exportAllData(): string {
  const data = {
    users: getUsers(),
    products: getProducts(),
    categories: getCategories(),
    customers: getCustomers(),
    suppliers: getSuppliers(),
    business: getBusiness(),
    settings: getSettings(),
    sales: getSales(),
    shifts: getShifts(),
    purchaseOrders: getPurchaseOrders(),
    // Advanced features
    giftCards: getGiftCards(),
    giftCardTransactions: getGiftCardTransactions(),
    bundles: getBundles(),
    timeBasedPrices: getTimeBasedPrices(),
    quickKeys: getQuickKeys(),
    customerNotes: getCustomerNotes(),
    storeCredits: getStoreCredits(),
    managerOverrides: getManagerOverrides(),
    receiptReprints: getReceiptReprints(),
    noReceiptReturns: getNoReceiptReturns(),
    exportedAt: new Date().toISOString(),
    version: '2.0',
  };
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.users) secureStorage.setItem('appleflow-users', JSON.stringify(data.users));
    if (data.products) secureStorage.setItem('appleflow-products', JSON.stringify(data.products));
    if (data.categories) secureStorage.setItem('appleflow-categories', JSON.stringify(data.categories));
    if (data.customers) secureStorage.setItem('appleflow-customers', JSON.stringify(data.customers));
    if (data.suppliers) secureStorage.setItem('appleflow-suppliers', JSON.stringify(data.suppliers));
    if (data.business) secureStorage.setItem('appleflow-business', JSON.stringify(data.business));
    if (data.settings) secureStorage.setItem('appleflow-settings', JSON.stringify(data.settings));
    if (data.sales) secureStorage.setItem('appleflow-sales', JSON.stringify(data.sales));
    if (data.shifts) secureStorage.setItem('appleflow-shifts', JSON.stringify(data.shifts));
    if (data.purchaseOrders) secureStorage.setItem('appleflow-purchase-orders', JSON.stringify(data.purchaseOrders));
    // Advanced features
    if (data.giftCards) secureStorage.setItem('appleflow-gift-cards', JSON.stringify(data.giftCards));
    if (data.giftCardTransactions) secureStorage.setItem('appleflow-gift-card-transactions', JSON.stringify(data.giftCardTransactions));
    if (data.bundles) secureStorage.setItem('appleflow-bundles', JSON.stringify(data.bundles));
    if (data.timeBasedPrices) secureStorage.setItem('appleflow-time-based-prices', JSON.stringify(data.timeBasedPrices));
    if (data.quickKeys) secureStorage.setItem('appleflow-quick-keys', JSON.stringify(data.quickKeys));
    if (data.customerNotes) secureStorage.setItem('appleflow-customer-notes', JSON.stringify(data.customerNotes));
    if (data.storeCredits) secureStorage.setItem('appleflow-store-credits', JSON.stringify(data.storeCredits));
    if (data.managerOverrides) secureStorage.setItem('appleflow-manager-overrides', JSON.stringify(data.managerOverrides));
    if (data.receiptReprints) secureStorage.setItem('appleflow-receipt-reprints', JSON.stringify(data.receiptReprints));
    if (data.noReceiptReturns) secureStorage.setItem('appleflow-no-receipt-returns', JSON.stringify(data.noReceiptReturns));
    
    return true;
  } catch (e) {
    return false;
  }
}

export function downloadBackup() {
  const data = exportAllData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appleflow-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Update last backup time
  const settings = getSettings();
  settings.lastBackup = new Date().toISOString();
  saveSettings(settings);
}

// ============================================
// X/Z REPORTS & END-OF-DAY RECONCILIATION
// ============================================

// Generate X Report (Mid-Shift Reading)
export function generateXReport(shiftId: string): XReport | null {
  const shifts = getShifts();
  const shift = shifts.find((s: Shift) => s.id === shiftId);
  if (!shift) return null;

  const sales = getSales().filter((s: Sale) => s.shiftId === shiftId && s.status === 'completed');
  const movements = getCashMovements().filter((m: CashMovement) => m.shiftId === shiftId);
  
  const paidIn = movements.filter((m: CashMovement) => m.type === 'paid_in').reduce((sum: number, m: CashMovement) => sum + m.amount, 0);
  const paidOut = movements.filter((m: CashMovement) => m.type === 'paid_out').reduce((sum: number, m: CashMovement) => sum + m.amount, 0);
  
  const grossSales = sales.reduce((sum: number, s: Sale) => sum + s.subtotal + s.vatTotal, 0);
  const netSales = sales.reduce((sum: number, s: Sale) => sum + s.total, 0);
  const taxTotal = sales.reduce((sum: number, s: Sale) => sum + s.vatTotal, 0);
  const discountTotal = sales.reduce((sum: number, s: Sale) => sum + s.discountTotal, 0);
  
  // Calculate payment breakdown (gift_card and store_credit are stored in payment method field)
  const payments: PaymentSummary = {
    cash: sales.filter((s: Sale) => s.payment.method === 'cash').reduce((sum: number, s: Sale) => sum + s.total, 0),
    mpesa: sales.filter((s: Sale) => s.payment.method === 'mpesa').reduce((sum: number, s: Sale) => sum + s.total, 0),
    card: sales.filter((s: Sale) => s.payment.method === 'card').reduce((sum: number, s: Sale) => sum + s.total, 0),
    credit: sales.filter((s: Sale) => s.payment.method === 'credit').reduce((sum: number, s: Sale) => sum + s.total, 0),
    giftCard: 0, // Would need to track separately
    storeCredit: 0, // Would need to track separately
    total: netSales,
  };

  // Get voids and refunds from audit logs
  const auditLogs = getAuditLogs();
  const voids = auditLogs.filter((log: AuditLog) => log.action === 'sale_voided' && log.timestamp >= shift.openedAt);
  const refunds = auditLogs.filter((log: AuditLog) => log.action === 'sale_refunded' && log.timestamp >= shift.openedAt);

  return {
    id: 'X-' + Date.now(),
    shiftId,
    cashierName: shift.userName,
    generatedAt: new Date().toISOString(),
    reportType: 'X',
    shiftOpenedAt: shift.openedAt,
    reportGeneratedAt: new Date().toISOString(),
    grossSales,
    netSales,
    taxTotal,
    discountTotal,
    refundTotal: refunds.length > 0 ? refunds.reduce((sum: number, r: AuditLog) => {
      const match = r.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    voidTotal: voids.length > 0 ? voids.reduce((sum: number, v: AuditLog) => {
      const match = v.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    payments,
    transactionCount: sales.length,
    itemCount: sales.reduce((sum: number, s: Sale) => sum + s.items.reduce((is: number, item: SaleItem) => is + item.quantity, 0), 0),
    averageTransaction: sales.length > 0 ? netSales / sales.length : 0,
    voidCount: voids.length,
    refundCount: refunds.length,
    openingCash: shift.openingCash,
    cashSales: shift.cashSales,
    cashRefunds: 0, // Would need to track separately
    paidIn,
    paidOut,
    expectedCash: shift.openingCash + shift.cashSales + paidIn - paidOut,
    isActive: shift.isActive && !shift.isClosed,
  };
}

// Generate Z Report (End-of-Shift)
export function generateZReport(shiftId: string, generatedBy: string): ZReport | null {
  const shifts = getShifts();
  const shift = shifts.find((s: Shift) => s.id === shiftId);
  if (!shift) return null;

  const sales = getSales().filter((s: Sale) => s.shiftId === shiftId && s.status === 'completed');
  const movements = getCashMovements().filter((m: CashMovement) => m.shiftId === shiftId);
  
  const paidIn = movements.filter((m: CashMovement) => m.type === 'paid_in').reduce((sum: number, m: CashMovement) => sum + m.amount, 0);
  const paidOut = movements.filter((m: CashMovement) => m.type === 'paid_out').reduce((sum: number, m: CashMovement) => sum + m.amount, 0);
  
  const grossSales = sales.reduce((sum: number, s: Sale) => sum + s.subtotal + s.vatTotal, 0);
  const netSales = sales.reduce((sum: number, s: Sale) => sum + s.total, 0);
  const taxTotal = sales.reduce((sum: number, s: Sale) => sum + s.vatTotal, 0);
  const discountTotal = sales.reduce((sum: number, s: Sale) => sum + s.discountTotal, 0);
  
  const payments: PaymentSummary = {
    cash: sales.filter((s: Sale) => s.payment.method === 'cash').reduce((sum: number, s: Sale) => sum + s.total, 0),
    mpesa: sales.filter((s: Sale) => s.payment.method === 'mpesa').reduce((sum: number, s: Sale) => sum + s.total, 0),
    card: sales.filter((s: Sale) => s.payment.method === 'card').reduce((sum: number, s: Sale) => sum + s.total, 0),
    credit: sales.filter((s: Sale) => s.payment.method === 'credit').reduce((sum: number, s: Sale) => sum + s.total, 0),
    giftCard: 0, // Would need to track separately
    storeCredit: 0, // Would need to track separately
    total: netSales,
  };

  const auditLogs = getAuditLogs();
  const voids = auditLogs.filter((log: AuditLog) => log.action === 'sale_voided' && log.timestamp >= shift.openedAt);
  const refunds = auditLogs.filter((log: AuditLog) => log.action === 'sale_refunded' && log.timestamp >= shift.openedAt);
  const noReceiptReturns = auditLogs.filter((log: AuditLog) => log.action === 'no_receipt_return' && log.timestamp >= shift.openedAt);

  const openedAt = new Date(shift.openedAt);
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : new Date();
  const duration = Math.floor((closedAt.getTime() - openedAt.getTime()) / 60000);

  return {
    id: 'Z-' + Date.now(),
    shiftId,
    reportType: 'Z',
    reportDate: new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    generatedBy,
    periodStart: shift.openedAt,
    periodEnd: shift.closedAt || new Date().toISOString(),
    grossSales,
    netSales,
    taxTotal,
    discountTotal,
    refundTotal: refunds.length > 0 ? refunds.reduce((sum: number, r: AuditLog) => {
      const match = r.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    voidTotal: voids.length > 0 ? voids.reduce((sum: number, v: AuditLog) => {
      const match = v.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    payments,
    transactionCount: sales.length,
    itemCount: sales.reduce((sum: number, s: Sale) => sum + s.items.reduce((is: number, item: SaleItem) => is + item.quantity, 0), 0),
    averageTransaction: sales.length > 0 ? netSales / sales.length : 0,
    voidCount: voids.length,
    voidAmount: voids.length > 0 ? voids.reduce((sum: number, v: AuditLog) => {
      const match = v.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    refundCount: refunds.length,
    refundAmount: refunds.length > 0 ? refunds.reduce((sum: number, r: AuditLog) => {
      const match = r.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    noReceiptReturns: noReceiptReturns.length,
    noReceiptReturnAmount: noReceiptReturns.length > 0 ? noReceiptReturns.reduce((sum: number, r: AuditLog) => {
      const match = r.details.match(/[\d,]+\.?\d*/);
      return sum + (match ? parseFloat(match[0].replace(/,/g, '')) : 0);
    }, 0) : 0,
    openingCash: shift.openingCash,
    cashSales: shift.cashSales,
    cashRefunds: 0,
    paidIn,
    paidOut,
    expectedCash: shift.expectedCash || shift.openingCash + shift.cashSales + paidIn - paidOut,
    actualCash: shift.closingCash || 0,
    cashDifference: shift.cashDifference || 0,
    shiftInfo: {
      cashierName: shift.userName,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt || new Date().toISOString(),
      duration,
    },
    isFinal: shift.isClosed,
    reprintCount: 0,
  };
}

// Generate End-of-Day Summary
export function generateEndOfDaySummary(date: string, generatedBy: string): EndOfDaySummary {
  const shifts = getShifts().filter((s: Shift) => s.openedAt.startsWith(date));
  const sales = getSales().filter((s: Sale) => s.createdAt.startsWith(date) && s.status === 'completed');
  
  const grossSales = sales.reduce((sum: number, s: Sale) => sum + s.subtotal + s.vatTotal, 0);
  const netSales = sales.reduce((sum: number, s: Sale) => sum + s.total, 0);
  const taxTotal = sales.reduce((sum: number, s: Sale) => sum + s.vatTotal, 0);
  const discountTotal = sales.reduce((sum: number, s: Sale) => sum + s.discountTotal, 0);
  
  const payments: PaymentSummary = {
    cash: sales.filter((s: Sale) => s.payment.method === 'cash').reduce((sum: number, s: Sale) => sum + s.total, 0),
    mpesa: sales.filter((s: Sale) => s.payment.method === 'mpesa').reduce((sum: number, s: Sale) => sum + s.total, 0),
    card: sales.filter((s: Sale) => s.payment.method === 'card').reduce((sum: number, s: Sale) => sum + s.total, 0),
    credit: sales.filter((s: Sale) => s.payment.method === 'credit').reduce((sum: number, s: Sale) => sum + s.total, 0),
    giftCard: 0, // Would need to track separately
    storeCredit: 0, // Would need to track separately
    total: netSales,
  };

  // Per-cashier breakdown
  interface CashierSummary {
    userId: string;
    userName: string;
    shiftCount: number;
    salesTotal: number;
    transactionCount: number;
    voidCount: number;
    refundCount: number;
    cashDifference: number;
  }

  const cashierMap = new Map<string, CashierSummary>();
  shifts.forEach((shift: Shift) => {
    const existing = cashierMap.get(shift.userId);
    if (existing) {
      existing.shiftCount++;
      existing.salesTotal += shift.cashSales + shift.mpesaSales + shift.cardSales;
      existing.transactionCount += shift.transactionCount;
      existing.voidCount += shift.voidCount;
      existing.refundCount += shift.refundCount;
      existing.cashDifference += shift.cashDifference || 0;
    } else {
      cashierMap.set(shift.userId, {
        userId: shift.userId,
        userName: shift.userName,
        shiftCount: 1,
        salesTotal: shift.cashSales + shift.mpesaSales + shift.cardSales,
        transactionCount: shift.transactionCount,
        voidCount: shift.voidCount,
        refundCount: shift.refundCount,
        cashDifference: shift.cashDifference || 0,
      });
    }
  });

  // Top products
  const productSales = new Map<string, { productId: string; productName: string; sku: string; quantity: number; revenue: number; categoryName: string }>();
  sales.forEach((sale: Sale) => {
    sale.items.forEach((item: SaleItem) => {
      const existing = productSales.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.total;
      } else {
        productSales.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          revenue: item.total,
          categoryName: '', // Would need to look up
        });
      }
    });
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(p => ({
      productId: p.productId,
      productName: p.productName,
      sku: p.sku,
      quantitySold: p.quantity,
      totalRevenue: p.revenue,
      categoryName: p.categoryName,
    }));

  // Hourly breakdown
  interface HourlyData {
    hour: number;
    sales: number;
    transactions: number;
  }

  const hourlySales: HourlyData[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourSales = sales.filter((s: Sale) => new Date(s.createdAt).getHours() === hour);
    hourlySales.push({
      hour,
      sales: hourSales.reduce((sum: number, s: Sale) => sum + s.total, 0),
      transactions: hourSales.length,
    });
  }

  const closedShifts = shifts.filter((s: Shift) => s.isClosed);

  return {
    date,
    generatedAt: new Date().toISOString(),
    generatedBy,
    totalShifts: shifts.length,
    activeShifts: shifts.filter((s: Shift) => s.isActive && !s.isClosed).length,
    closedShifts: closedShifts.length,
    grossSales,
    netSales,
    taxTotal,
    discountTotal,
    refundTotal: shifts.reduce((sum: number, s: Shift) => sum + (s.refundTotal || 0), 0),
    voidTotal: 0, // Would calculate from audit logs
    payments,
    totalTransactions: sales.length,
    totalItems: sales.reduce((sum: number, s: Sale) => sum + s.items.reduce((is: number, item: SaleItem) => is + item.quantity, 0), 0),
    averageTransaction: sales.length > 0 ? netSales / sales.length : 0,
    totalOpeningCash: shifts.reduce((sum: number, s: Shift) => sum + s.openingCash, 0),
    totalClosingCash: closedShifts.reduce((sum: number, s: Shift) => sum + (s.closingCash || 0), 0),
    totalExpectedCash: closedShifts.reduce((sum: number, s: Shift) => sum + (s.expectedCash || 0), 0),
    totalCashDifference: closedShifts.reduce((sum: number, s: Shift) => sum + (s.cashDifference || 0), 0),
    cashierSummaries: Array.from(cashierMap.values()),
    topProducts,
    categorySales: [], // Would need to aggregate by category
    hourlySales,
    isReconciled: closedShifts.length === shifts.length && shifts.length > 0,
    notes: '',
  };
}

// Save and retrieve reports
export function saveXReport(report: XReport): void {
  const reports = JSON.parse(secureStorage.getItem('appleflow-x-reports') || '[]');
  reports.push(report);
  secureStorage.setItem('appleflow-x-reports', JSON.stringify(reports));
}

export function saveZReport(report: ZReport): void {
  const reports = JSON.parse(secureStorage.getItem('appleflow-z-reports') || '[]');
  reports.push(report);
  secureStorage.setItem('appleflow-z-reports', JSON.stringify(reports));
}

export function getXReports(): XReport[] {
  return JSON.parse(secureStorage.getItem('appleflow-x-reports') || '[]');
}

export function getZReports(): ZReport[] {
  return JSON.parse(secureStorage.getItem('appleflow-z-reports') || '[]');
}

export function getZReportsByDate(date: string): ZReport[] {
  return getZReports().filter((r: ZReport) => r.reportDate === date);
}

// ============================================
// MISSING REAL-WORLD FEATURES - DATA LAYER
// ============================================

// Purchase Order Management
export function createPurchaseOrder(order: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt'>): PurchaseOrder {
  const newOrder: PurchaseOrder = {
    ...order,
    id: 'po-' + Date.now(),
    poNumber: generatePONumber(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const orders = getPurchaseOrders();
  orders.unshift(newOrder);
  savePurchaseOrders(orders);
  addAuditLog('purchase_order_created', 'purchase_order', newOrder.id, `Created PO ${newOrder.poNumber} for ${newOrder.supplierName}`);
  return newOrder;
}

export function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): PurchaseOrder | null {
  const orders = getPurchaseOrders();
  const index = orders.findIndex(o => o.id === id);
  if (index === -1) return null;
  
  orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
  savePurchaseOrders(orders);
  addAuditLog('purchase_order_updated', 'purchase_order', id, `Updated PO ${orders[index].poNumber}`);
  return orders[index];
}

// Expense Management
export function getExpenses(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-expenses') || '[]');
}

export function saveExpenses(expenses: any[]): void {
  secureStorage.setItem('appleflow-expenses', JSON.stringify(expenses));
}

export function generateExpenseNumber(): string {
  const count = getExpenses().length + 1;
  return `EXP-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

export function createExpense(expense: any): any {
  const newExpense = {
    ...expense,
    id: 'exp-' + Date.now(),
    expenseNumber: generateExpenseNumber(),
    createdAt: new Date().toISOString(),
  };
  const expenses = getExpenses();
  expenses.unshift(newExpense);
  saveExpenses(expenses);
  addAuditLog('expense_created', 'expense', newExpense.id, `Created expense ${newExpense.expenseNumber}: ${formatCurrency(newExpense.totalAmount || newExpense.amount)}`);
  return newExpense;
}

export function getTotalExpenses(startDate?: string, endDate?: string): number {
  const expenses = startDate && endDate 
    ? getExpenses().filter((e: any) => e.date >= startDate && e.date <= endDate)
    : getExpenses();
  return expenses.reduce((sum: number, e: any) => sum + (e.totalAmount || e.amount || 0), 0);
}

// Quotes / Estimates
export function getQuotes(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-quotes') || '[]');
}

export function saveQuotes(quotes: any[]): void {
  secureStorage.setItem('appleflow-quotes', JSON.stringify(quotes));
}

export function generateQuoteNumber(): string {
  const count = getQuotes().length + 1;
  return `QT-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

export function createQuote(quote: any): any {
  const newQuote = {
    ...quote,
    id: 'qt-' + Date.now(),
    quoteNumber: generateQuoteNumber(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const quotes = getQuotes();
  quotes.unshift(newQuote);
  saveQuotes(quotes);
  addAuditLog('quote_created', 'quote', newQuote.id, `Created quote ${newQuote.quoteNumber}`);
  return newQuote;
}

// Layaway System
export function getLayaways(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-layaways') || '[]');
}

export function saveLayaways(layaways: any[]): void {
  secureStorage.setItem('appleflow-layaways', JSON.stringify(layaways));
}

export function generateLayawayNumber(): string {
  const count = getLayaways().length + 1;
  return `LW-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

export function createLayaway(layaway: any): any {
  const newLayaway = {
    ...layaway,
    id: 'lw-' + Date.now(),
    layawayNumber: generateLayawayNumber(),
    payments: [],
    createdAt: new Date().toISOString(),
  };
  const layaways = getLayaways();
  layaways.unshift(newLayaway);
  saveLayaways(layaways);
  addAuditLog('layaway_created', 'layaway', newLayaway.id, `Created layaway ${newLayaway.layawayNumber}`);
  return newLayaway;
}

// Stock Transfers
export function getStockTransfers(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-stock-transfers') || '[]');
}

export function saveStockTransfers(transfers: any[]): void {
  secureStorage.setItem('appleflow-stock-transfers', JSON.stringify(transfers));
}

export function generateTransferNumber(): string {
  const count = getStockTransfers().length + 1;
  return `ST-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

// Notifications
export function getNotifications(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-notifications') || '[]');
}

export function saveNotifications(notifications: any[]): void {
  secureStorage.setItem('appleflow-notifications', JSON.stringify(notifications));
}

export function createNotification(notification: any): any {
  const newNotification = {
    ...notification,
    id: 'notif-' + Date.now(),
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  const notifications = getNotifications();
  notifications.unshift(newNotification);
  saveNotifications(notifications);
  return newNotification;
}

export function getUnreadNotifications(): any[] {
  return getNotifications().filter((n: any) => !n.isRead);
}

// Delivery Orders
export function getDeliveryOrders(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-delivery-orders') || '[]');
}

export function saveDeliveryOrders(orders: any[]): void {
  secureStorage.setItem('appleflow-delivery-orders', JSON.stringify(orders));
}

export function generateDeliveryOrderNumber(): string {
  const count = getDeliveryOrders().length + 1;
  return `DO-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

// Loyalty Tiers
export function getLoyaltyTiers(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-loyalty-tiers') || '[]');
}

export function saveLoyaltyTiers(tiers: any[]): void {
  secureStorage.setItem('appleflow-loyalty-tiers', JSON.stringify(tiers));
}

// Debtor Accounts
export function getDebtorAccounts(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-debtor-accounts') || '[]');
}

export function saveDebtorAccounts(accounts: any[]): void {
  secureStorage.setItem('appleflow-debtor-accounts', JSON.stringify(accounts));
}

// Stock Adjustments
export function getStockAdjustments(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-stock-adjustments') || '[]');
}

export function saveStockAdjustments(adjustments: any[]): void {
  secureStorage.setItem('appleflow-stock-adjustments', JSON.stringify(adjustments));
}

export function generateAdjustmentNumber(): string {
  const count = getStockAdjustments().length + 1;
  return `ADJ-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;
}

// Time Clock
export function getTimeEntries(): any[] {
  return JSON.parse(secureStorage.getItem('appleflow-time-entries') || '[]');
}

export function saveTimeEntries(entries: any[]): void {
  secureStorage.setItem('appleflow-time-entries', JSON.stringify(entries));
}

// CSV Export
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return String(value);
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
