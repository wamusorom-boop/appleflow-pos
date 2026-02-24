/**
 * AppleFlow POS - Advanced Type Definitions
 * Enterprise retail system types
 */

// User & Authentication with Permissions
export type UserRole = 'admin' | 'manager' | 'cashier' | 'supervisor';

export interface UserPermissions {
  canProcessSales: boolean;
  canApplyDiscounts: boolean;
  canRefund: boolean;
  canVoid: boolean;
  canViewReports: boolean;
  canManageProducts: boolean;
  canManageUsers: boolean;
  canOpenCloseShift: boolean;
  canViewAnalytics: boolean;
  maxDiscountPercent: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

// Product Types
export type ProductType = 'standard' | 'weighted' | 'serialized';

export interface ProductCategory {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  barcode?: string;
  category: ProductCategory;
  unit: string;
  productType: ProductType;
  // Pricing
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  vatRate: number;
  isVatInclusive: boolean;
  // Inventory
  quantity: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  // Weight-based products
  weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
  tareWeight?: number;
  // Serialized products
  serialNumbers?: string[];
  // Status
  isActive: boolean;
  allowBackorders: boolean;
  trackInventory: boolean;
  // Supplier
  supplierId?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Supplier
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  kraPin?: string;
  paymentTerms: string;
  isActive: boolean;
}

// Purchase Order
export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  vatTotal: number;
  total: number;
  status: POStatus;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Cart with advanced features
export interface CartItem {
  product: Product;
  quantity: number;
  weight?: number; // For weighted products
  serialNumber?: string; // For serialized products
  discountPercent?: number;
  discountAmount?: number;
  note?: string;
  customPrice?: number; // Override selling price
}

// Customer
export type CustomerTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tier: CustomerTier;
  points: number;
  totalSpent: number;
  creditLimit?: number;
  creditBalance: number;
  isActive: boolean;
  discountPercent?: number;
  notes?: string;
  createdAt: string;
}

// Payment Methods
export type PaymentMethod = 'cash' | 'mpesa' | 'card' | 'credit' | 'cheque' | 'bank_transfer' | 'loyalty_points';

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
  mpesaCode?: string;
  cardLast4?: string;
  chequeNumber?: string;
  bankRef?: string;
}

export interface Payment {
  method: PaymentMethod;
  amount: number;
  mpesaCode?: string;
  cardLast4?: string;
  isSplit: boolean;
  splits?: PaymentSplit[];
}

// Discount Types
export type DiscountType = 'percentage' | 'fixed' | 'buy_x_get_y';

export interface AppliedDiscount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  amount: number;
  reason?: string;
  appliedBy: string;
  appliedAt: string;
}

// Sale Item
export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  weight?: number;
  serialNumber?: string;
  unitPrice: number;
  originalPrice: number;
  vatAmount: number;
  total: number;
  discountPercent?: number;
  discountAmount?: number;
  note?: string;
}

// Sale Status
export type SaleStatus = 'completed' | 'refunded' | 'partially_refunded' | 'voided' | 'on_hold' | 'layaway';

// Layaway
export interface LayawayPayment {
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  paidBy: string;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  status: SaleStatus;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  payment: Payment;
  appliedDiscounts: AppliedDiscount[];
  customer?: Customer;
  cashierId: string;
  cashierName: string;
  shiftId?: string;
  createdAt: string;
  // Layaway
  isLayaway: boolean;
  layawayPayments?: LayawayPayment[];
  layawayDueDate?: string;
  // Refund/Void tracking
  refundedAt?: string;
  refundedBy?: string;
  refundReason?: string;
  refundAmount?: number;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  // Hold
  holdName?: string;
}

// Held Transaction
export interface HeldTransaction {
  id: string;
  name: string;
  cart: CartItem[];
  customer?: Customer;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  heldAt: string;
  heldBy: string;
  note?: string;
}

// Refund
export interface Refund {
  id: string;
  originalSaleId: string;
  receiptNumber: string;
  items: SaleItem[];
  refundAmount: number;
  reason: string;
  processedBy: string;
  processedAt: string;
  paymentMethod: PaymentMethod;
}

// Business Settings
export interface Business {
  name: string;
  legalName: string;
  kraPin: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  receiptFooter: string;
  receiptHeader?: string;
  showVatOnReceipt: boolean;
  printCustomerInfo: boolean;
  autoPrintReceipt: boolean;
  currency: string;
  taxRate: number;
}

// Shift
export interface Shift {
  id: string;
  userId: string;
  userName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  cashSales: number;
  mpesaSales: number;
  cardSales: number;
  creditSales: number;
  chequeSales: number;
  bankTransferSales: number;
  loyaltyPointsSales: number;
  transactionCount: number;
  itemCount: number;
  refundCount: number;
  refundTotal: number;
  voidCount: number;
  layawayCount: number;
  layawayTotal: number;
  isActive: boolean;
  isClosed: boolean;
  openingNote?: string;
  closingNote?: string;
}

// Cash Movement
export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'paid_in' | 'paid_out';
  amount: number;
  reason: string;
  performedBy: string;
  performedAt: string;
}

// Audit Log
export type AuditAction = 
  | 'login' | 'logout' 
  | 'sale_created' | 'sale_voided' | 'sale_refunded'
  | 'product_created' | 'product_updated' | 'product_deleted'
  | 'customer_created' | 'customer_updated'
  | 'shift_opened' | 'shift_closed'
  | 'cash_movement' | 'discount_applied'
  | 'inventory_adjusted' | 'po_created' | 'po_received'
  // Advanced features
  | 'gift_card_issued' | 'gift_card_loaded' | 'gift_card_redeemed'
  | 'manager_override_requested' | 'manager_override_approved'
  | 'customer_note_added'
  | 'store_credit_issued' | 'store_credit_redeemed'
  | 'receipt_reprinted'
  | 'no_receipt_return'
  // Fourth expansion - real-world features
  | 'purchase_order_created' | 'purchase_order_updated' | 'purchase_order_received'
  | 'expense_created' | 'expense_updated' | 'expense_deleted'
  | 'quote_created' | 'quote_updated' | 'quote_converted' | 'quote_sent'
  | 'layaway_created' | 'layaway_payment' | 'layaway_completed' | 'layaway_cancelled'
  | 'stock_transfer_created' | 'stock_transfer_sent' | 'stock_transfer_received'
  | 'stock_adjusted' | 'delivery_created' | 'delivery_updated'
  | 'debtor_payment' | 'notification_created' | 'time_clock_in' | 'time_clock_out';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  ipAddress?: string;
}

// Promotion
export interface Promotion {
  id: string;
  name: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  appliesTo: 'all' | 'category' | 'product';
  categoryId?: string;
  productIds?: string[];
  usageLimit?: number;
  usageCount: number;
}

// Stock Alert
export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  minStockLevel: number;
  alertType: 'low_stock' | 'out_of_stock' | 'overstock';
  isRead: boolean;
  createdAt: string;
}

// App Settings
export interface AppSettings {
  requireShiftToSell: boolean;
  allowNegativeInventory: boolean;
  autoPrintReceipt: boolean;
  receiptPrinter?: string;
  barcodeScannerEnabled: boolean;
  weightScaleEnabled: boolean;
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'manual';
  lastBackup?: string;
  // New advanced settings
  enableGiftCards: boolean;
  enableStoreCredit: boolean;
  enableBundles: boolean;
  enableHappyHour: boolean;
  enableManagerOverride: boolean;
  blindCloseEnabled: boolean;
  requireAgeVerification: boolean;
  defaultAgeRestriction: number;
}

// ============================================
// ADVANCED RETAIL FEATURES - THIRD EXPANSION
// ============================================

// Gift Card System
export type GiftCardStatus = 'active' | 'inactive' | 'expired' | 'depleted';

export interface GiftCard {
  id: string;
  cardNumber: string;
  initialBalance: number;
  currentBalance: number;
  status: GiftCardStatus;
  issuedAt: string;
  issuedBy: string;
  expiresAt?: string;
  customerId?: string;
  customerName?: string;
  notes?: string;
  lastUsedAt?: string;
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  cardNumber: string;
  type: 'issue' | 'load' | 'redeem' | 'refund' | 'adjust' | 'expire';
  amount: number;
  balanceAfter: number;
  saleId?: string;
  receiptNumber?: string;
  performedBy: string;
  performedAt: string;
  notes?: string;
}

// Extended Payment Methods
export type ExtendedPaymentMethod = PaymentMethod | 'gift_card' | 'store_credit';

export interface ExtendedPaymentSplit {
  method: ExtendedPaymentMethod;
  amount: number;
  mpesaCode?: string;
  cardLast4?: string;
  chequeNumber?: string;
  bankRef?: string;
  giftCardNumber?: string;
  storeCreditCustomerId?: string;
}

// Product Bundle/Kits
export interface BundleComponent {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface ProductBundle {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  components: BundleComponent[];
  bundlePrice: number;
  originalTotalPrice: number;
  savingsAmount: number;
  savingsPercent: number;
  isActive: boolean;
  categoryId?: string;
  createdAt: string;
  updatedAt: string;
}

// Manager Override System
export type OverrideType = 'discount' | 'price_change' | 'void' | 'refund' | 'no_receipt_return' | 'open_drawer' | 'negative_inventory';

export interface ManagerOverride {
  id: string;
  type: OverrideType;
  originalValue?: string;
  newValue?: string;
  amount?: number;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  approvedBy: string;
  approvedByName: string;
  requestedAt: string;
  approvedAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedFor?: string;
  usedAt?: string;
}

// Cash Drawer Denominations
export interface CashDenomination {
  denomination: number;
  count: number;
  total: number;
}

export interface CashDrawerReconciliation {
  thousands: CashDenomination;
  fiveHundreds: CashDenomination;
  twoHundreds: CashDenomination;
  hundreds: CashDenomination;
  fifties: CashDenomination;
  twenties: CashDenomination;
  tens: CashDenomination;
  fiveCoins: CashDenomination;
  oneCoins: CashDenomination;
  fiftyCents: CashDenomination;
  total: number;
}

// Extended Shift with Denominations
export interface ExtendedShift extends Shift {
  openingDenominations?: CashDrawerReconciliation;
  closingDenominations?: CashDrawerReconciliation;
  isBlindClose: boolean;
  giftCardIssued: number;
  giftCardRedeemed: number;
  storeCreditIssued: number;
  storeCreditRedeemed: number;
  bundleSales: number;
  happyHourSales: number;
}

// Customer Notes & Warnings
export type CustomerNoteType = 'general' | 'warning' | 'vip' | 'fraud_alert' | 'payment_issue' | 'preference';

export interface CustomerNote {
  id: string;
  customerId: string;
  type: CustomerNoteType;
  title: string;
  content: string;
  isActive: boolean;
  showAtCheckout: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt?: string;
}

// Time-Based Pricing (Happy Hour)
export interface TimeBasedPrice {
  id: string;
  name: string;
  description?: string;
  productIds: string[];
  categoryIds?: string[];
  regularPrice: number;
  specialPrice: number;
  discountPercent: number;
  // Schedule
  daysOfWeek: number[]; // 0-6 (Sun-Sat)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  priority: number;
}

// Quick Keys / Favorites
export interface QuickKey {
  id: string;
  productId: string;
  productName: string;
  position: number; // 1-40 for grid layout
  color?: string;
  shortcutKey?: string; // F1-F12
  isActive: boolean;
  category?: string;
}

// Extended Product with Advanced Features
export interface ExtendedProduct extends Product {
  memberPrice?: number;
  happyHourPrice?: number;
  happyHourDiscount?: number;
  isFavorite: boolean;
  requiresAgeVerification: boolean;
  minAge?: number;
  maxDiscountPercent?: number;
  isBundle: boolean;
  bundleId?: string;
  relatedProductIds?: string[];
  crossSellProductIds?: string[];
  upSellProductIds?: string[];
}

// Extended Sale with Receipt Features
export interface ExtendedSale extends Sale {
  reprintCount: number;
  lastReprintedAt?: string;
  reprintedBy?: string[];
  voidApprovedBy?: string;
  voidApprovedByName?: string;
  refundApprovedBy?: string;
  refundApprovedByName?: string;
  originalReceiptNumber?: string; // For returns
  isReturnWithoutReceipt: boolean;
  returnVerificationMethod?: 'id' | 'phone' | 'manager_override' | 'customer_lookup';
  returnVerifiedBy?: string;
  customerSignature?: string;
  exchangeSaleId?: string;
}

// Return Without Receipt
export interface NoReceiptReturn {
  id: string;
  returnNumber: string;
  items: {
    productName: string;
    description: string;
    quantity: number;
    estimatedPrice: number;
    refundAmount: number;
  }[];
  totalRefundAmount: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  idVerified: boolean;
  idType?: 'national_id' | 'passport' | 'driving_license';
  idNumber?: string;
  managerOverrideId?: string;
  processedBy: string;
  processedAt: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

// Extended Audit Actions
export type ExtendedAuditAction = AuditAction 
  | 'gift_card_issued' | 'gift_card_redeemed' | 'gift_card_loaded'
  | 'bundle_sold' | 'happy_hour_applied'
  | 'manager_override_requested' | 'manager_override_approved'
  | 'no_receipt_return' | 'receipt_reprinted'
  | 'customer_note_added' | 'customer_warning_triggered';

// Receipt Reprint Log
export interface ReceiptReprint {
  id: string;
  saleId: string;
  receiptNumber: string;
  reprintedBy: string;
  reprintedByName: string;
  reprintedAt: string;
  reason: string;
  copyNumber: number;
}

// Store Credit
export interface StoreCredit {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  balance: number;
  reason: string;
  issuedFrom?: string; // saleId or returnId
  issuedAt: string;
  issuedBy: string;
  expiresAt?: string;
  isActive: boolean;
}

// Age Verification Log
export interface AgeVerification {
  id: string;
  saleId: string;
  customerId?: string;
  customerName?: string;
  productId: string;
  productName: string;
  requiredAge: number;
  verifiedAge?: number;
  idType?: 'national_id' | 'passport' | 'driving_license';
  idNumber?: string;
  verifiedBy: string;
  verifiedAt: string;
  verificationMethod: 'manual' | 'scanner';
}

// Cashier Performance Metrics
export interface CashierMetrics {
  userId: string;
  userName: string;
  shiftId: string;
  date: string;
  salesCount: number;
  salesTotal: number;
  itemsPerTransaction: number;
  averageTransactionValue: number;
  voidCount: number;
  voidTotal: number;
  refundCount: number;
  refundTotal: number;
  discountTotal: number;
  discountCount: number;
  upSellAttempts: number;
  upSellSuccess: number;
  customerAdditions: number;
  accuracyScore: number;
}

// Extended Cart Item
export interface ExtendedCartItem extends CartItem {
  isBundleItem: boolean;
  bundleId?: string;
  originalPrice: number;
  happyHourApplied: boolean;
  happyHourDiscount: number;
  ageVerified: boolean;
  ageVerificationId?: string;
}

// ============================================
// X/Z REPORTS & END-OF-DAY RECONCILIATION
// ============================================

// Payment Summary for Reports
export interface PaymentSummary {
  cash: number;
  mpesa: number;
  card: number;
  credit: number;
  giftCard: number;
  storeCredit: number;
  total: number;
}

// X Report (Mid-Shift Reading)
export interface XReport {
  id: string;
  shiftId: string;
  cashierName: string;
  generatedAt: string;
  reportType: 'X';
  // Time period
  shiftOpenedAt: string;
  reportGeneratedAt: string;
  // Sales Summary
  grossSales: number;
  netSales: number;
  taxTotal: number;
  discountTotal: number;
  refundTotal: number;
  voidTotal: number;
  // Payment Breakdown
  payments: PaymentSummary;
  // Transaction Stats
  transactionCount: number;
  itemCount: number;
  averageTransaction: number;
  // Void/Refund Details
  voidCount: number;
  refundCount: number;
  // Cash Drawer
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  // Current Status
  isActive: boolean;
}

// Z Report (End-of-Shift/End-of-Day)
export interface ZReport {
  id: string;
  shiftId?: string; // Optional for EOD Z-report
  reportType: 'Z';
  reportDate: string;
  generatedAt: string;
  generatedBy: string;
  // Period covered
  periodStart: string;
  periodEnd: string;
  // Sales Summary
  grossSales: number;
  netSales: number;
  taxTotal: number;
  discountTotal: number;
  refundTotal: number;
  voidTotal: number;
  // Payment Breakdown
  payments: PaymentSummary;
  // Transaction Stats
  transactionCount: number;
  itemCount: number;
  averageTransaction: number;
  // Void/Refund Details
  voidCount: number;
  voidAmount: number;
  refundCount: number;
  refundAmount: number;
  noReceiptReturns: number;
  noReceiptReturnAmount: number;
  // Cash Reconciliation
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
  // Denominations (if counted)
  denominations?: CashDrawerReconciliation;
  // Shift Info (for single shift Z-report)
  shiftInfo?: {
    cashierName: string;
    openedAt: string;
    closedAt: string;
    duration: number; // minutes
  };
  // EOD Info (for end-of-day Z-report)
  eodInfo?: {
    totalShifts: number;
    totalCashiers: number;
    firstShiftStart: string;
    lastShiftEnd: string;
  };
  // Audit
  isFinal: boolean;
  reprintCount: number;
  lastReprintedAt?: string;
}

// End-of-Day Summary
export interface EndOfDaySummary {
  date: string;
  generatedAt: string;
  generatedBy: string;
  // All shifts summary
  totalShifts: number;
  activeShifts: number;
  closedShifts: number;
  // Sales Aggregate
  grossSales: number;
  netSales: number;
  taxTotal: number;
  discountTotal: number;
  refundTotal: number;
  voidTotal: number;
  // Payment Aggregate
  payments: PaymentSummary;
  // Transaction Stats
  totalTransactions: number;
  totalItems: number;
  averageTransaction: number;
  // Cash Summary
  totalOpeningCash: number;
  totalClosingCash: number;
  totalExpectedCash: number;
  totalCashDifference: number;
  // Per-Cashier Breakdown
  cashierSummaries: CashierEodSummary[];
  // Product Summary
  topProducts: ProductEodSummary[];
  categorySales: CategoryEodSummary[];
  // Hourly Breakdown
  hourlySales: HourlySale[];
  // Status
  isReconciled: boolean;
  reconciledAt?: string;
  reconciledBy?: string;
  notes?: string;
}

export interface CashierEodSummary {
  userId: string;
  userName: string;
  shiftCount: number;
  salesTotal: number;
  transactionCount: number;
  voidCount: number;
  refundCount: number;
  cashDifference: number;
}

export interface ProductEodSummary {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: number;
  totalRevenue: number;
  categoryName: string;
}

export interface CategoryEodSummary {
  categoryId: string;
  categoryName: string;
  salesCount: number;
  salesTotal: number;
  percentage: number;
}

export interface HourlySale {
  hour: number; // 0-23
  sales: number;
  transactions: number;
}

// ============================================
// MISSING REAL-WORLD FEATURES - FOURTH EXPANSION
// ============================================

// Purchase Order System
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
  vatRate: number;
  vatAmount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierKraPin?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  vatTotal: number;
  total: number;
  status: PurchaseOrderStatus;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// Goods Received Note (GRN)
export interface GRNItem {
  productId: string;
  productName: string;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  total: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface GoodsReceivedNote {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: GRNItem[];
  totalValue: number;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  notes?: string;
}

// Stock Transfer between locations
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled';

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromLocation: string;
  toLocation: string;
  items: StockTransferItem[];
  totalItems: number;
  totalValue: number;
  status: TransferStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  sentAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  receivedByName?: string;
  notes?: string;
}

// Expense Tracking
export type ExpenseCategory = 'rent' | 'utilities' | 'salaries' | 'supplies' | 'marketing' | 'maintenance' | 'transport' | 'miscellaneous' | 'other';

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  categoryName: string;
  description: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paidTo?: string;
  receiptNumber?: string;
  receiptImage?: string;
  date: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  notes?: string;
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// Quotes / Estimates
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface QuoteItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  total: number;
  status: QuoteStatus;
  validUntil: string;
  convertedToSaleId?: string;
  notes?: string;
  terms?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

// Layaway System
export type LayawayStatus = 'active' | 'completed' | 'cancelled' | 'expired';

export interface LayawayPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  notes?: string;
}

export interface Layaway {
  id: string;
  layawayNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  totalAmount: number;
  minimumDeposit: number;
  amountPaid: number;
  balanceDue: number;
  payments: LayawayPayment[];
  status: LayawayStatus;
  expiryDate: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  notes?: string;
}

// Employee Time Clock
export type TimeEntryType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  type: TimeEntryType;
  timestamp: string;
  shiftId?: string;
  notes?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export interface Timesheet {
  id: string;
  userId: string;
  userName: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  breakDuration: number; // minutes
  totalHours: number;
  overtimeHours: number;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

// Commission Tracking
export interface CommissionRule {
  id: string;
  userId: string;
  userName: string;
  productCategoryId?: string;
  productId?: string;
  commissionType: 'percentage' | 'fixed';
  commissionValue: number;
  minSaleAmount?: number;
  maxCommission?: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CommissionEntry {
  id: string;
  userId: string;
  userName: string;
  saleId: string;
  receiptNumber: string;
  productId: string;
  productName: string;
  saleAmount: number;
  commissionAmount: number;
  commissionRate: number;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  createdAt: string;
}

// Tips / Gratuities
export interface TipEntry {
  id: string;
  saleId: string;
  receiptNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  allocatedTo?: string;
  allocatedToName?: string;
  isAllocated: boolean;
  allocatedAt?: string;
  receivedAt: string;
  notes?: string;
}

// Product Images
export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  thumbnailUrl?: string;
  isPrimary: boolean;
  sortOrder: number;
  uploadedAt: string;
  uploadedBy: string;
}

// Batch/Lot Tracking (for expiry dates)
export interface ProductBatch {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  manufactureDate?: string;
  expiryDate?: string;
  receivedDate: string;
  grnId?: string;
  supplierId?: string;
  supplierName?: string;
  isActive: boolean;
}

// Stock Adjustment
export type AdjustmentReason = 'damaged' | 'expired' | 'lost' | 'found' | 'returned' | 'correction' | 'theft' | 'other';

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  productId: string;
  productName: string;
  sku: string;
  previousQuantity: number;
  newQuantity: number;
  difference: number;
  reason: AdjustmentReason;
  reasonDetails?: string;
  unitCost: number;
  totalValue: number;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  approvedBy?: string;
  approvedByName?: string;
  notes?: string;
}

// Notification System
export type NotificationType = 'low_stock' | 'expiry_alert' | 'payment_due' | 'shift_reminder' | 'system' | 'report';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  userId?: string;
}

// Delivery Orders
export type DeliveryStatus = 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  saleId: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  items: SaleItem[];
  deliveryFee: number;
  totalAmount: number;
  status: DeliveryStatus;
  assignedTo?: string;
  assignedToName?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  createdAt: string;
  updatedAt: string;
}

// Multi-location Support
export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email?: string;
  isMainLocation: boolean;
  isActive: boolean;
  createdAt: string;
}

// Price Levels (Wholesale, Retail, Member)
export interface PriceLevel {
  id: string;
  name: string; // e.g., 'Retail', 'Wholesale', 'Member'
  code: string; // e.g., 'RETAIL', 'WHOLESALE', 'MEMBER'
  isDefault: boolean;
  minQuantity?: number;
  discountPercent: number;
  isActive: boolean;
}

export interface ProductPrice {
  productId: string;
  priceLevelId: string;
  price: number;
}

// Customer Loyalty Tiers
export interface LoyaltyTier {
  id: string;
  name: string;
  code: string;
  minPoints: number;
  maxPoints?: number;
  discountPercent: number;
  pointsMultiplier: number;
  benefits: string[];
  isActive: boolean;
}

// Debtor / Credit Sales Tracking
export interface DebtorAccount {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  creditLimit: number;
  currentBalance: number;
  totalCreditGiven: number;
  totalRepaid: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  paymentTerms: number; // days
  isActive: boolean;
  notes?: string;
}

export interface DebtorPayment {
  id: string;
  debtorId: string;
  saleId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  receivedBy: string;
  receivedByName: string;
  receivedAt: string;
  notes?: string;
}

// KRA Tax Reports
export interface KRAVATReturn {
  id: string;
  periodStart: string;
  periodEnd: string;
  vatOutput: number; // VAT on sales
  vatInput: number; // VAT on purchases
  netVAT: number;
  totalSales: number;
  totalPurchases: number;
  status: 'draft' | 'submitted';
  submittedAt?: string;
  submittedBy?: string;
}

// Audit Trail Enhancement
export interface DetailedAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  oldValue?: string;
  newValue?: string;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  sessionId: string;
}

// Data Import/Export Jobs
export type ImportJobType = 'products' | 'customers' | 'suppliers' | 'sales';
export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportJob {
  id: string;
  type: ImportJobType;
  fileName: string;
  rowCount: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  errors: string[];
  status: ImportJobStatus;
  startedAt?: string;
  completedAt?: string;
  startedBy: string;
  startedByName: string;
}

// Dashboard Widgets Configuration
export interface DashboardWidget {
  id: string;
  type: 'sales_chart' | 'top_products' | 'low_stock' | 'recent_sales' | 'cash_balance' | 'hourly_sales' | 'payment_breakdown';
  title: string;
  position: number;
  size: 'small' | 'medium' | 'large';
  isVisible: boolean;
  refreshInterval?: number;
  filters?: Record<string, any>;
}
