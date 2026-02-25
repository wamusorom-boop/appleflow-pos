/**
 * AppleFlow POS - Cashier Speed & Error Recovery Optimized
 * Ultra-fast checkout with instant lookup, parked carts, void operations, and quick reprints
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, User as UserIcon, CreditCard,
  Banknote, Smartphone, Receipt, Check, Percent, Pause,
  X, AlertCircle, Calculator, Scale, Hash,
  Package, AlertTriangle, Keyboard, Grid3X3,
  Shield, Ticket, Zap, Undo2, Printer,
  Ban, History, Play, Sparkles,
  ScanLine, Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  getProducts, getCustomers, getCategories, saveProducts, saveCustomers,
  saveSales, getSales, saveCart, getCart, saveShifts, getShifts, getStockAlerts,
  generateReceiptNumber, generateSaleId, addAuditLog, checkStockAlerts,
  formatCurrency, DEMO_BUSINESS, getActiveShift, saveHeldTransactions, 
  getHeldTransactions, calculateCartTotals, findProductByBarcode, getSettings,
  getActiveQuickKeys, getActiveWarningsForCustomer, getTotalStoreCreditBalance,
  findBundleByBarcode, logReceiptReprint
} from '@/lib/data';
import type { Product, Customer, CartItem, Sale, PaymentSplit, ProductBundle, CustomerNote } from '@/types';
import { useAuth } from '@/context/AuthContext';

// Quick Action Button for fast access
type QuickActionType = 'void_last' | 'void_sale' | 'reprint' | 'park' | 'resume' | 'lookup';

type PermissionType = 'canProcessSales' | 'canApplyDiscounts' | 'canRefund' | 'canVoid' | 
  'canManageInventory' | 'canManageProducts' | 'canViewReports' | 'canManageUsers' | 'canOpenCloseShift';

interface QuickAction {
  type: QuickActionType;
  label: string;
  shortcut: string;
  icon: React.ElementType;
  color: string;
  requiresCart?: boolean;
  permission?: PermissionType;
}

const QUICK_ACTIONS: QuickAction[] = [
  { type: 'lookup', label: 'Lookup', shortcut: 'F2', icon: Search, color: 'blue', requiresCart: false },
  { type: 'park', label: 'Park', shortcut: 'F4', icon: Pause, color: 'amber', requiresCart: true },
  { type: 'resume', label: 'Resume', shortcut: 'F5', icon: Play, color: 'emerald', requiresCart: false },
  { type: 'void_last', label: 'Void Last', shortcut: 'Del', icon: Undo2, color: 'red', requiresCart: true, permission: 'canVoid' },
  { type: 'void_sale', label: 'Void All', shortcut: 'Shift+Del', icon: Ban, color: 'red', requiresCart: true, permission: 'canVoid' },
  { type: 'reprint', label: 'Reprint', shortcut: 'F8', icon: Printer, color: 'purple', requiresCart: false },
];

// Quantity Keypad for fast entry
interface QuantityKeypadProps {
  value: string;
  onDigit: (d: string) => void;
  onClear: () => void;
  onEnter: () => void;
  onModeChange: (mode: 'quantity' | 'price' | 'discount') => void;
  mode: 'quantity' | 'price' | 'discount';
  targetItem?: CartItem | null;
}

function QuantityKeypad({ value, onDigit, onClear, onEnter, onModeChange, mode, targetItem }: QuantityKeypadProps) {
  const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '.'];
  
  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="flex gap-1 mb-2">
        {(['quantity', 'price', 'discount'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              mode === m 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {m === 'quantity' ? 'Qty' : m === 'price' ? 'Price' : 'Disc%'}
          </button>
        ))}
      </div>
      
      {/* Target Item Display */}
      {targetItem && (
        <div className="mb-2 p-2 bg-slate-800 rounded text-xs">
          <p className="text-slate-400 truncate">{targetItem.product.name}</p>
          <p className="text-emerald-400 font-medium">
            Current: {mode === 'quantity' ? targetItem.quantity : mode === 'price' ? formatCurrency(targetItem.product.sellingPrice) : `${targetItem.discountPercent || 0}%`}
          </p>
        </div>
      )}
      
      {/* Value Display */}
      <div className="mb-2">
        <Input
          value={value}
          readOnly
          className="bg-slate-800 border-slate-700 text-slate-200 text-xl text-center font-mono"
          placeholder={mode === 'quantity' ? 'Qty' : mode === 'price' ? 'Price' : '%'}
        />
      </div>
      
      {/* Keypad */}
      <div className="grid grid-cols-3 gap-1 flex-1">
        {digits.map((d) => (
          <button
            key={d}
            onClick={() => onDigit(d)}
            className="h-12 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-lg transition-colors"
          >
            {d}
          </button>
        ))}
        <button
          onClick={onClear}
          className="h-12 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium"
        >
          C
        </button>
        <button
          onClick={onEnter}
          className="h-12 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium col-span-2"
        >
          <Check className="w-5 h-5 mx-auto" />
        </button>
      </div>
    </div>
  );
}

// Parked Cart Card Component
interface ParkedCartCardProps {
  hold: {
    id: string;
    name: string;
    cart: CartItem[];
    customer?: Customer;
    total: number;
    heldAt: string;
    heldBy: string;
    note?: string;
  };
  onResume: () => void;
  onDelete: () => void;
  isCompact?: boolean;
}

function ParkedCartCard({ hold, onResume, onDelete, isCompact }: ParkedCartCardProps) {
  const heldTime = new Date(hold.heldAt);
  const timeAgo = Math.floor((Date.now() - heldTime.getTime()) / 60000);
  const timeText = timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;
  
  if (isCompact) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 hover:border-emerald-500/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Pause className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-slate-200 text-sm">{hold.name}</p>
              <p className="text-xs text-slate-500">{hold.cart.length} items • {timeText}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-400">{formatCurrency(hold.total)}</span>
            <Button size="sm" onClick={onResume} className="bg-emerald-600 hover:bg-emerald-700">
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-emerald-500/50 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Pause className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="font-medium text-slate-200">{hold.name}</p>
            <p className="text-xs text-slate-500">{hold.cart.length} items • {hold.heldBy} • {timeText}</p>
            {hold.note && <p className="text-xs text-slate-400 mt-1">{hold.note}</p>}
          </div>
        </div>
        <p className="font-bold text-emerald-400 text-lg">{formatCurrency(hold.total)}</p>
      </div>
      
      {/* Item Preview */}
      <div className="space-y-1 mb-3">
        {hold.cart.slice(0, 3).map((item, idx) => (
          <div key={idx} className="flex justify-between text-xs">
            <span className="text-slate-400">{item.quantity}x {item.product.name}</span>
            <span className="text-slate-500">{formatCurrency(item.product.sellingPrice * item.quantity)}</span>
          </div>
        ))}
        {hold.cart.length > 3 && (
          <p className="text-xs text-slate-500">+{hold.cart.length - 3} more items</p>
        )}
      </div>
      
      {hold.customer && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-slate-800 rounded">
          <UserIcon className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-300">{hold.customer.name}</span>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button size="sm" onClick={onResume} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
          <Play className="w-4 h-4 mr-1" />
          Resume
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="border-slate-700 text-red-400 hover:bg-red-500/10">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Quick Lookup Dialog
interface QuickLookupProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelect: (product: Product) => void;
}

function QuickLookup({ isOpen, onClose, products, onSelect }: QuickLookupProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    ).slice(0, 10);
  }, [query, products]);
  
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);
  
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]);
      setQuery('');
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-lg p-0 gap-0">
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type SKU, barcode, or product name..."
              className="pl-10 bg-slate-800 border-slate-700 text-slate-200 text-lg"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            ↑↓ Navigate • Enter Select • Esc Close
          </p>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            query ? (
              <div className="p-8 text-center text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Type className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Start typing to search</p>
              </div>
            )
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map((product, idx) => (
                <button
                  key={product.id}
                  onClick={() => {
                    onSelect(product);
                    setQuery('');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    idx === selectedIndex 
                      ? 'bg-emerald-600/20 border border-emerald-500/30' 
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      className="text-xs"
                      style={{ backgroundColor: product.category.color + '30', color: product.category.color }}
                    >
                      {product.category.name}
                    </Badge>
                    <div>
                      <p className="font-medium text-slate-200">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.sku} {product.barcode && `• ${product.barcode}`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(product.sellingPrice)}</p>
                    <p className={`text-xs ${product.quantity <= product.minStockLevel ? 'text-red-400' : 'text-slate-500'}`}>
                      {product.quantity} {product.unit}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Manager Override Dialog
interface ManagerOverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (managerPin: string) => void;
  action: string;
}

function ManagerOverrideDialog({ isOpen, onClose, onApprove, action }: ManagerOverrideDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = () => {
    // Check against demo manager PINs
    const managerPins = ['9999', '8888'];
    if (managerPins.includes(pin)) {
      onApprove(pin);
      setPin('');
      setError('');
      onClose();
    } else {
      setError('Invalid manager PIN');
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Manager Approval Required
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">{action}</p>
          <Input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter manager PIN"
            className="bg-slate-800 border-slate-700 text-slate-200 text-center text-2xl tracking-widest"
            maxLength={4}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-amber-600 hover:bg-amber-700">
              Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main POS View Component
export function POSView() {
  const { user, hasPermission } = useAuth();
  
  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  
  // View states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadValue, setNumpadValue] = useState('');
  const [numpadMode, setNumpadMode] = useState<'quantity' | 'price' | 'discount'>('quantity');
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState<number | null>(null);
  
  // Dialog states
  const [showCheckout, setShowCheckout] = useState(false);
  const [showParkDialog, setShowParkDialog] = useState(false);
  const [showParkedList, setShowParkedList] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [showSerialInput, setShowSerialInput] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  
  // Input states
  const [weightInput, setWeightInput] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [parkName, setParkName] = useState('');
  const [parkNote, setParkNote] = useState('');
  
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'split'>('cash');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [mpesaCode, setMpesaCode] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [splitAmount, setSplitAmount] = useState('');
  const [splitMethod, setSplitMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  
  // Advanced states
  const [quickKeys, setQuickKeys] = useState<any[]>([]);
  const [customerWarnings, setCustomerWarnings] = useState<CustomerNote[]>([]);
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentBundle, setCurrentBundle] = useState<ProductBundle | null>(null);
  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [parkedTransactions, setParkedTransactions] = useState<any[]>([]);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const parkNameRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
    const savedCart = getCart();
    if (savedCart.length > 0) {
      const prods = getProducts();
      const restoredCart: CartItem[] = savedCart
        .map((item: any) => {
          const product = prods.find((p: Product) => p.id === item.product.id);
          return product ? { 
            product, 
            quantity: item.quantity, 
            weight: item.weight,
            serialNumber: item.serialNumber,
            discountPercent: item.discountPercent,
            customPrice: item.customPrice
          } : null;
        })
        .filter(Boolean) as CartItem[];
      setCart(restoredCart);
    }
    
    const alerts = checkStockAlerts();
    if (alerts.length > 0) {
      setStockAlerts(alerts);
    }
  }, []);

  // Save cart when it changes
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  // Update customer data when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerWarnings(getActiveWarningsForCustomer(selectedCustomer.id));
      setStoreCreditBalance(getTotalStoreCreditBalance(selectedCustomer.id));
    } else {
      setCustomerWarnings([]);
      setStoreCreditBalance(0);
    }
  }, [selectedCustomer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 - Quick Lookup
      if (e.key === 'F2') {
        e.preventDefault();
        setShowLookup(true);
      }
      // F3 - Barcode Scan
      if (e.key === 'F3') {
        e.preventDefault();
        setShowBarcode(true);
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      }
      // F4 - Park Cart
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        setShowParkDialog(true);
        setTimeout(() => parkNameRef.current?.focus(), 100);
      }
      // F5 - Resume Parked
      if (e.key === 'F5') {
        e.preventDefault();
        loadParkedTransactions();
        setShowParkedList(true);
      }
      // F8 - Reprint Last
      if (e.key === 'F8') {
        e.preventDefault();
        handleQuickReprint();
      }
      // F9 - Checkout
      if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        handleCheckout();
      }
      // F10 - Toggle Numpad
      if (e.key === 'F10') {
        e.preventDefault();
        setShowNumpad(!showNumpad);
      }
      // Delete - Void Last Item
      if (e.key === 'Delete' && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        handleVoidLastItem();
      }
      // Shift+Delete - Void Sale
      if (e.key === 'Delete' && e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setShowVoidConfirm(true);
      }
      // Escape - Close dialogs
      if (e.key === 'Escape') {
        setShowCheckout(false);
        setShowParkDialog(false);
        setShowParkedList(false);
        setShowBarcode(false);
        setShowWeightInput(false);
        setShowSerialInput(false);
        setShowNumpad(false);
        setShowLookup(false);
        setShowVoidConfirm(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, showNumpad]);

  const loadData = () => {
    const prods = getProducts();
    setProducts(prods);
    setCategories(getCategories());
    setCustomers(getCustomers());
    setActiveShift(getActiveShift());
    setSettings(getSettings());
    setParkedTransactions(getHeldTransactions());
    setStockAlerts(getStockAlerts().filter((a: any) => !a.isRead));
    setQuickKeys(getActiveQuickKeys());
  };

  const loadParkedTransactions = () => {
    setParkedTransactions(getHeldTransactions());
  };

  // Cart calculations
  const customerDiscount = selectedCustomer?.discountPercent || 0;
  const cartTotals = useMemo(() => {
    return calculateCartTotals(cart, customerDiscount);
  }, [cart, customerDiscount]);

  // Filtered products for grid
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchQuery));
      const matchesCategory = !selectedCategory || product.category.id === selectedCategory;
      return matchesSearch && matchesCategory && product.isActive;
    });
  }, [products, searchQuery, selectedCategory]);

  // Add to cart handlers
  const handleAddToCart = (product: Product) => {
    if (!activeShift && settings?.requireShiftToSell) {
      toast.error('Please start a shift before making sales');
      return;
    }
    
    if (product.trackInventory && product.quantity <= 0 && !product.allowBackorders) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    
    setCurrentProduct(product);
    
    if (product.productType === 'weighted') {
      setWeightInput('');
      setShowWeightInput(true);
      return;
    }
    
    if (product.productType === 'serialized' && product.serialNumbers && product.serialNumbers.length > 0) {
      setSerialInput('');
      setShowSerialInput(true);
      return;
    }
    
    addToCart(product);
  };

  const addToCart = (product: Product, weight?: number, serialNumber?: string, customPrice?: number) => {
    const existingItem = cart.find(item => 
      item.product.id === product.id && 
      item.serialNumber === serialNumber &&
      item.customPrice === customPrice
    );
    
    if (existingItem) {
      if (product.trackInventory && !product.allowBackorders) {
        const maxQty = product.quantity;
        const currentQty = product.productType === 'weighted' ? (existingItem.weight || 0) : existingItem.quantity;
        if (currentQty >= maxQty) {
          toast.error(`Only ${maxQty} ${product.unit} available`);
          return;
        }
      }
      
      setCart(cart.map(item => {
        if (item.product.id === product.id && item.serialNumber === serialNumber && item.customPrice === customPrice) {
          if (product.productType === 'weighted' && weight) {
            return { ...item, weight: (item.weight || 0) + weight };
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      }));
    } else {
      const newItem: CartItem = { 
        product, 
        quantity: 1,
        weight: product.productType === 'weighted' ? weight : undefined,
        serialNumber,
        customPrice
      };
      setCart([...cart, newItem]);
      setSelectedCartItemIndex(cart.length);
    }
    
    toast.success(`Added ${product.name}`);
    setCurrentProduct(null);
    setShowWeightInput(false);
    setShowSerialInput(false);
  };

  // Cart operations
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) return;
    const item = cart[index];
    if (item.product.trackInventory && !item.product.allowBackorders && newQuantity > item.product.quantity) {
      toast.error(`Only ${item.product.quantity} units available`);
      return;
    }
    setCart(cart.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item));
  };

  const updateWeight = (index: number, newWeight: number) => {
    if (newWeight <= 0) return;
    const item = cart[index];
    if (item.product.trackInventory && !item.product.allowBackorders && newWeight > item.product.quantity) {
      toast.error(`Only ${item.product.quantity} ${item.product.unit} available`);
      return;
    }
    setCart(cart.map((item, i) => i === index ? { ...item, weight: newWeight } : item));
  };

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    if (selectedCartItemIndex === index) {
      setSelectedCartItemIndex(null);
    } else if (selectedCartItemIndex !== null && selectedCartItemIndex > index) {
      setSelectedCartItemIndex(selectedCartItemIndex - 1);
    }
    toast.info('Item removed');
  };

  // Void operations
  const handleVoidLastItem = () => {
    if (cart.length === 0) return;
    
    // Check permission
    if (!hasPermission('canVoid')) {
      setPendingAction(() => () => {
        const lastIndex = cart.length - 1;
        const item = cart[lastIndex];
        setCart(cart.filter((_, i) => i !== lastIndex));
        toast.info(`Voided: ${item.product.name}`);
        addAuditLog('sale_voided', 'cart_item', item.product.id, `Voided ${item.product.name} from cart`, user?.id || '', user?.name || '');
      });
      setOverrideReason('Void last item');
      setShowManagerOverride(true);
      return;
    }
    
    const lastIndex = cart.length - 1;
    const item = cart[lastIndex];
    setCart(cart.filter((_, i) => i !== lastIndex));
    toast.info(`Voided: ${item.product.name}`);
    addAuditLog('sale_voided', 'cart_item', item.product.id, `Voided ${item.product.name} from cart`, user?.id || '', user?.name || '');
  };

  const handleVoidSale = () => {
    if (cart.length === 0) return;
    
    if (!hasPermission('canVoid')) {
      setPendingAction(() => () => {
        const itemCount = cart.length;
        setCart([]);
        setSelectedCustomer(null);
        toast.info(`Voided entire sale (${itemCount} items)`);
        addAuditLog('sale_voided', 'cart', 'all', `Voided entire cart (${itemCount} items)`, user?.id || '', user?.name || '');
      });
      setOverrideReason('Void entire sale');
      setShowManagerOverride(true);
      return;
    }
    
    const itemCount = cart.length;
    setCart([]);
    setSelectedCustomer(null);
    toast.info(`Voided entire sale (${itemCount} items)`);
    addAuditLog('sale_voided', 'cart', 'all', `Voided entire cart (${itemCount} items)`, user?.id || '', user?.name || '');
    setShowVoidConfirm(false);
  };

  // Line item discount with permission
  const applyLineItemDiscount = (index: number, percent: number) => {
    const maxDiscount = user?.permissions?.maxDiscountPercent || 0;
    
    if (percent > maxDiscount) {
      setPendingAction(() => () => {
        setCart(cart.map((item, i) => i === index ? { ...item, discountPercent: percent } : item));
        toast.success(`Discount applied: ${percent}%`);
      });
      setOverrideReason(`Apply ${percent}% discount (exceeds your ${maxDiscount}% limit)`);
      setShowManagerOverride(true);
      return;
    }
    
    setCart(cart.map((item, i) => i === index ? { ...item, discountPercent: percent } : item));
    toast.success(`Discount applied: ${percent}%`);
  };

  // Park/Resume operations
  const parkTransaction = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    const held = getHeldTransactions();
    const newPark = {
      id: 'park-' + Date.now(),
      name: parkName || `Park #${held.length + 1}`,
      cart: [...cart],
      customer: selectedCustomer || undefined,
      subtotal: cartTotals.subtotal,
      discountTotal: cartTotals.discountTotal,
      vatTotal: cartTotals.vatTotal,
      total: cartTotals.total,
      heldAt: new Date().toISOString(),
      heldBy: user?.name || 'Unknown',
      note: parkNote,
    };
    
    saveHeldTransactions([...held, newPark]);
    setCart([]);
    setSelectedCustomer(null);
    setParkName('');
    setParkNote('');
    setShowParkDialog(false);
    loadParkedTransactions();
    toast.success('Transaction parked');
    addAuditLog('sale_created', 'parked', newPark.id, `Parked transaction: ${newPark.name}`, user?.id || '', user?.name || '');
  };

  const resumeParked = (park: any) => {
    setCart(park.cart);
    setSelectedCustomer(park.customer);
    
    const held = getHeldTransactions();
    saveHeldTransactions(held.filter(h => h.id !== park.id));
    loadParkedTransactions();
    setShowParkedList(false);
    toast.success('Transaction resumed');
  };

  const deleteParked = (parkId: string) => {
    const held = getHeldTransactions();
    saveHeldTransactions(held.filter(h => h.id !== parkId));
    loadParkedTransactions();
    toast.info('Parked transaction deleted');
  };

  // Quick reprint
  const handleQuickReprint = () => {
    const sales = getSales();
    if (sales.length === 0) {
      toast.error('No sales to reprint');
      return;
    }
    
    const last = sales[0];
    setLastSale(last);
    setShowReceipt(true);
    logReceiptReprint(last.id, last.receiptNumber, 'Quick reprint from POS');
    addAuditLog('receipt_reprinted', 'sale', last.id, `Quick reprint: ${last.receiptNumber}`, user?.id || '', user?.name || '');
  };

  // Numpad handlers
  const handleNumpadDigit = (digit: string) => {
    setNumpadValue(prev => prev + digit);
  };

  const handleNumpadClear = () => {
    setNumpadValue('');
  };

  const handleNumpadEnter = () => {
    const value = parseFloat(numpadValue);
    if (isNaN(value) || value <= 0) {
      toast.error('Invalid value');
      return;
    }
    
    if (selectedCartItemIndex !== null && cart[selectedCartItemIndex]) {
      const item = cart[selectedCartItemIndex];
      
      if (numpadMode === 'quantity') {
        if (item.product.productType === 'weighted') {
          updateWeight(selectedCartItemIndex, value);
        } else {
          updateQuantity(selectedCartItemIndex, Math.floor(value));
        }
      } else if (numpadMode === 'discount') {
        applyLineItemDiscount(selectedCartItemIndex, value);
      }
    }
    
    setNumpadValue('');
  };

  // Barcode scan
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const bundle = findBundleByBarcode(barcodeInput);
    if (bundle) {
      setCurrentBundle(bundle);
      setShowBundleDialog(true);
      setBarcodeInput('');
      setShowBarcode(false);
      return;
    }
    
    const product = findProductByBarcode(barcodeInput);
    if (product) {
      handleAddToCart(product);
      setBarcodeInput('');
      setShowBarcode(false);
    } else {
      toast.error('Product not found');
    }
  };

  // Checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!activeShift && settings?.requireShiftToSell) {
      toast.error('No active shift');
      return;
    }
    setPaymentSplits([]);
    setShowCheckout(true);
  };

  const processPayment = () => {
    const total = cartTotals.total;
    
    if (paymentMethod === 'split') {
      const splitTotal = paymentSplits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(splitTotal - total) > 0.01) {
        toast.error(`Split payments must equal total`);
        return;
      }
    } else if (paymentMethod === 'mpesa' && !mpesaCode.trim()) {
      toast.error('Enter M-Pesa code');
      return;
    } else if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < total) {
        toast.error('Insufficient cash');
        return;
      }
    }

    const payment: any = {
      method: paymentMethod,
      amount: total,
      isSplit: paymentMethod === 'split',
    };
    
    if (paymentMethod === 'split') {
      payment.splits = paymentSplits;
    } else if (paymentMethod === 'mpesa') {
      payment.mpesaCode = mpesaCode;
    }

    const sale: Sale = {
      id: generateSaleId(),
      receiptNumber: generateReceiptNumber(),
      status: 'completed',
      items: cart.map(item => {
        const basePrice = item.customPrice || item.product.sellingPrice;
        const itemDiscount = item.discountPercent || 0;
        const priceAfterDiscount = basePrice * (1 - itemDiscount / 100);
        const qty = item.product.productType === 'weighted' ? (item.weight || 0) : item.quantity;
        
        return {
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          weight: item.weight,
          serialNumber: item.serialNumber,
          unitPrice: item.product.isVatInclusive 
            ? priceAfterDiscount / (1 + item.product.vatRate / 100)
            : priceAfterDiscount,
          originalPrice: item.product.sellingPrice,
          vatAmount: item.product.isVatInclusive
            ? priceAfterDiscount - (priceAfterDiscount / (1 + item.product.vatRate / 100))
            : (priceAfterDiscount * item.product.vatRate / 100),
          total: priceAfterDiscount * qty,
          discountPercent: item.discountPercent,
          discountAmount: item.discountPercent 
            ? (basePrice * item.discountPercent / 100) * qty
            : 0,
        };
      }),
      subtotal: cartTotals.subtotal,
      discountTotal: cartTotals.discountTotal,
      vatTotal: cartTotals.vatTotal,
      total,
      amountPaid: total,
      balanceDue: 0,
      payment,
      appliedDiscounts: customerDiscount > 0 ? [{
        id: 'customer-discount',
        name: `${selectedCustomer?.tier.toUpperCase()} Member`,
        type: 'percentage',
        value: customerDiscount,
        amount: cartTotals.subtotal * customerDiscount / 100,
        appliedBy: user?.name || 'Unknown',
        appliedAt: new Date().toISOString(),
      }] : [],
      customer: selectedCustomer || undefined,
      cashierId: user?.id || '',
      cashierName: user?.name || 'Unknown',
      shiftId: activeShift?.id,
      createdAt: new Date().toISOString(),
      isLayaway: false,
    };

    const sales = getSales();
    sales.unshift(sale);
    saveSales(sales);
    
    addAuditLog('sale_created', 'sale', sale.id, `Sale: ${formatCurrency(total)}`, user?.id || '', user?.name || '');

    // Update inventory
    const updatedProducts = products.map(product => {
      const cartItem = cart.find(item => item.product.id === product.id);
      if (cartItem) {
        const qty = cartItem.product.productType === 'weighted' 
          ? (cartItem.weight || 0) 
          : cartItem.quantity;
        
        const updatedSerials = cartItem.serialNumber 
          ? product.serialNumbers?.filter(s => s !== cartItem.serialNumber)
          : product.serialNumbers;
        
        return { 
          ...product, 
          quantity: Math.max(0, product.quantity - qty),
          serialNumbers: updatedSerials
        };
      }
      return product;
    });
    saveProducts(updatedProducts);

    // Update customer
    if (selectedCustomer) {
      const updatedCustomers = customers.map(c => {
        if (c.id === selectedCustomer.id) {
          return {
            ...c,
            points: c.points + Math.floor(total / 100),
            totalSpent: c.totalSpent + total,
          };
        }
        return c;
      });
      saveCustomers(updatedCustomers);
    }

    // Update shift
    if (activeShift) {
      const shifts = getShifts();
      const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      const updatedShifts = shifts.map(s => {
        if (s.id === activeShift.id) {
          return {
            ...s,
            transactionCount: s.transactionCount + 1,
            itemCount: (s.itemCount || 0) + itemCount,
            cashSales: s.cashSales + (paymentMethod === 'cash' ? total : paymentSplits.filter(sp => sp.method === 'cash').reduce((sum, sp) => sum + sp.amount, 0)),
            mpesaSales: s.mpesaSales + (paymentMethod === 'mpesa' ? total : paymentSplits.filter(sp => sp.method === 'mpesa').reduce((sum, sp) => sum + sp.amount, 0)),
            cardSales: s.cardSales + (paymentMethod === 'card' ? total : paymentSplits.filter(sp => sp.method === 'card').reduce((sum, sp) => sum + sp.amount, 0)),
          };
        }
        return s;
      });
      saveShifts(updatedShifts);
    }

    setLastSale(sale);
    setCart([]);
    setSelectedCustomer(null);
    setShowCheckout(false);
    setShowReceipt(true);
    setMpesaCode('');
    setCashReceived('');
    setPaymentSplits([]);
    setProducts(updatedProducts);
    
    const alerts = checkStockAlerts();
    if (alerts.length > 0) {
      setStockAlerts(getStockAlerts().filter((a: any) => !a.isRead));
    }
    
    toast.success('Sale completed!');
  };

  // Quick key handler
  const handleQuickKeyClick = (quickKey: any) => {
    const product = products.find(p => p.id === quickKey.productId);
    if (product) {
      handleAddToCart(product);
    }
  };

  // Bundle handler
  const addBundleToCart = (bundle: ProductBundle) => {
    const bundleProduct: Product = {
      id: `bundle-${bundle.id}`,
      sku: bundle.sku,
      name: bundle.name,
      description: bundle.description || '',
      barcode: bundle.barcode,
      category: { id: 'bundle', name: 'Bundle', color: '#8b5cf6' },
      unit: 'set',
      productType: 'standard',
      costPrice: bundle.bundlePrice * 0.7,
      sellingPrice: bundle.bundlePrice,
      vatRate: 16,
      isVatInclusive: true,
      quantity: 999,
      minStockLevel: 0,
      reorderPoint: 0,
      isActive: true,
      allowBackorders: true,
      trackInventory: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    addToCart(bundleProduct);
    toast.success(`Bundle added - Saved ${formatCurrency(bundle.savingsAmount)}!`);
    setShowBundleDialog(false);
    setCurrentBundle(null);
  };

  // Payment split handlers
  const addPaymentSplit = () => {
    const amount = parseFloat(splitAmount);
    if (!amount || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }
    
    const currentTotal = paymentSplits.reduce((sum, s) => sum + s.amount, 0);
    if (currentTotal + amount > cartTotals.total) {
      toast.error('Exceeds total');
      return;
    }
    
    const newSplit: PaymentSplit = {
      method: splitMethod,
      amount,
      mpesaCode: splitMethod === 'mpesa' ? mpesaCode : undefined,
    };
    
    setPaymentSplits([...paymentSplits, newSplit]);
    setSplitAmount('');
    setMpesaCode('');
  };

  const removePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Stock Alerts Banner */}
      {stockAlerts.length > 0 && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-400">
            {stockAlerts.length} alert{stockAlerts.length > 1 ? 's' : ''}: 
            {stockAlerts.slice(0, 3).map((a: any) => ` ${a.productName}`).join(',')}
            {stockAlerts.length > 3 && ` +${stockAlerts.length - 3} more`}
          </span>
        </div>
      )}

      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            POS
          </h1>
          {!activeShift && settings?.requireShiftToSell && (
            <Badge variant="destructive" className="animate-pulse text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              No Shift
            </Badge>
          )}
          {parkedTransactions.length > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs cursor-pointer" onClick={() => { loadParkedTransactions(); setShowParkedList(true); }}>
              <Pause className="w-3 h-3 mr-1" />
              {parkedTransactions.length} Parked
            </Badge>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isDisabled = action.requiresCart && cart.length === 0;
            const colorClasses: Record<string, string> = {
              blue: 'text-blue-400 hover:bg-blue-500/20',
              amber: 'text-amber-400 hover:bg-amber-500/20',
              emerald: 'text-emerald-400 hover:bg-emerald-500/20',
              red: 'text-red-400 hover:bg-red-500/20',
              purple: 'text-purple-400 hover:bg-purple-500/20',
            };
            
            return (
              <button
                key={action.type}
                onClick={() => {
                  if (action.type === 'lookup') setShowLookup(true);
                  if (action.type === 'park' && cart.length > 0) setShowParkDialog(true);
                  if (action.type === 'resume') { loadParkedTransactions(); setShowParkedList(true); }
                  if (action.type === 'void_last') handleVoidLastItem();
                  if (action.type === 'void_sale') setShowVoidConfirm(true);
                  if (action.type === 'reprint') handleQuickReprint();
                }}
                disabled={isDisabled}
                className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorClasses[action.color]}`}
                title={`${action.label} (${action.shortcut})`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{action.label}</span>
                <kbd className="hidden xl:inline-block px-1 bg-slate-800 rounded text-[10px]">{action.shortcut}</kbd>
              </button>
            );
          })}
          
          {selectedCustomer && (
            <Badge variant="secondary" className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 ml-2">
              <UserIcon className="w-3 h-3 mr-1" />
              {selectedCustomer.name}
              {(selectedCustomer.discountPercent || 0) > 0 && ` (-${selectedCustomer.discountPercent}%)`}
            </Badge>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search & Categories */}
          <div className="p-2 border-b border-slate-800 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search [F2] or Scan [F3]"
                  className="pl-9 bg-slate-900 border-slate-700 text-slate-200 h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="border-slate-700 text-slate-400 h-9 px-2"
              >
                {viewMode === 'grid' ? <Grid3X3 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNumpad(!showNumpad)}
                className={`h-9 px-2 ${showNumpad ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30' : 'border-slate-700 text-slate-400'}`}
              >
                <Keyboard className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Categories */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2 py-1 rounded-lg whitespace-nowrap text-xs font-medium transition-colors ${
                  !selectedCategory 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 rounded-lg whitespace-nowrap text-xs font-medium transition-colors ${
                    selectedCategory === cat.id 
                      ? 'text-white' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                  style={{ backgroundColor: selectedCategory === cat.id ? cat.color : undefined }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            
            {/* Quick Keys */}
            {quickKeys.length > 0 && (
              <div className="border-t border-slate-800 pt-2">
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {quickKeys.slice(0, 12).map((qk) => (
                    <button
                      key={qk.id}
                      onClick={() => handleQuickKeyClick(qk)}
                      className="px-2 py-1.5 rounded-lg whitespace-nowrap text-xs font-medium transition-all hover:scale-105 flex-shrink-0"
                      style={{ 
                        backgroundColor: qk.color ? qk.color + '30' : '#3b82f630',
                        color: qk.color || '#3b82f6',
                        border: `1px solid ${qk.color ? qk.color + '50' : '#3b82f650'}`
                      }}
                    >
                      <span className="opacity-70 block text-[9px]">{qk.shortcutKey}</span>
                      <span className="truncate max-w-[60px] block">{qk.productName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Products Grid/List */}
          <ScrollArea className="flex-1 p-2">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-left hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <Badge 
                        className="text-[10px] px-1"
                        style={{ backgroundColor: product.category.color + '30', color: product.category.color }}
                      >
                        {product.category.name}
                      </Badge>
                      {product.productType === 'weighted' && <Scale className="w-3 h-3 text-slate-500" />}
                      {product.productType === 'serialized' && <Hash className="w-3 h-3 text-slate-500" />}
                    </div>
                    <h3 className="font-medium text-slate-200 text-xs mb-0.5 line-clamp-2">{product.name}</h3>
                    <p className="text-[10px] text-slate-500 mb-1">{product.sku}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-400">
                        {formatCurrency(product.sellingPrice)}
                      </span>
                      <span className={`text-[10px] ${product.quantity <= product.minStockLevel ? 'text-red-400' : 'text-slate-500'}`}>
                        {product.quantity}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className="w-full flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-emerald-500/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        className="text-[10px]"
                        style={{ backgroundColor: product.category.color + '30', color: product.category.color }}
                      >
                        {product.category.name}
                      </Badge>
                      <div className="text-left">
                        <p className="font-medium text-slate-200 text-sm">{product.name}</p>
                        <p className="text-[10px] text-slate-500">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">{formatCurrency(product.sellingPrice)}</p>
                      <p className={`text-[10px] ${product.quantity <= product.minStockLevel ? 'text-red-400' : 'text-slate-500'}`}>
                        {product.quantity} {product.unit}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Cart Section */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
          <CardHeader className="border-b border-slate-800 py-2 px-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Order ({cart.length})
              </span>
              {cart.length > 0 && (
                <button 
                  onClick={() => setShowVoidConfirm(true)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Ban className="w-3 h-3" />
                  Clear
                </button>
              )}
            </CardTitle>
          </CardHeader>

          <ScrollArea className="flex-1 p-2">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Cart empty</p>
                <div className="mt-3 text-[10px] text-slate-600 space-y-0.5">
                  <p>F2=Lookup F3=Scan F4=Park</p>
                  <p>F5=Resume F8=Reprint F9=Pay</p>
                  <p>Del=VoidLast Shift+Del=VoidAll</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map((item, idx) => (
                  <div 
                    key={`${item.product.id}-${item.serialNumber || idx}`} 
                    onClick={() => setSelectedCartItemIndex(idx)}
                    className={`rounded-lg p-2 cursor-pointer transition-colors ${
                      selectedCartItemIndex === idx 
                        ? 'bg-emerald-600/20 border border-emerald-500/30' 
                        : 'bg-slate-800/50 border border-transparent hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-200 text-xs truncate">{item.product.name}</p>
                        {item.serialNumber && (
                          <p className="text-[10px] text-blue-400">S/N: {item.serialNumber}</p>
                        )}
                        {item.discountPercent && item.discountPercent > 0 && (
                          <Badge className="mt-0.5 bg-amber-500/20 text-amber-400 text-[9px]">
                            -{item.discountPercent}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCartItemIndex(idx); setNumpadMode('discount'); setShowNumpad(true); }}
                          className="p-1 text-slate-500 hover:text-amber-400"
                          title="Discount"
                        >
                          <Percent className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      {item.product.productType === 'weighted' ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateWeight(idx, Math.max(0.1, (item.weight || 0) - 0.1)); }}
                            className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-slate-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedCartItemIndex(idx); setNumpadMode('quantity'); setShowNumpad(true); }}
                            className="text-center min-w-[50px]"
                          >
                            <span className="text-xs font-medium">{(item.weight || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-500 ml-0.5">{item.product.weightUnit}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateWeight(idx, (item.weight || 0) + 0.1); }}
                            className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-slate-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQuantity(idx, item.quantity - 1); }}
                            className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-slate-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedCartItemIndex(idx); setNumpadMode('quantity'); setShowNumpad(true); }}
                            className="w-8 text-center"
                          >
                            <span className="text-xs font-medium">{item.quantity}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQuantity(idx, item.quantity + 1); }}
                            className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center text-slate-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="text-xs font-medium text-emerald-400">
                        {formatCurrency(
                          (item.customPrice || item.product.sellingPrice) * 
                          (item.product.productType === 'weighted' ? (item.weight || 0) : item.quantity) * 
                          (1 - (item.discountPercent || 0) / 100)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Cart Footer */}
          <div className="p-2 border-t border-slate-800 space-y-2">
            {/* Customer Warnings */}
            {customerWarnings.length > 0 && (
              <div className="space-y-1">
                {customerWarnings.map((warning) => (
                  <div 
                    key={warning.id} 
                    className={`p-1.5 rounded text-[10px] flex items-start gap-1.5 ${
                      warning.type === 'fraud_alert' 
                        ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                        : warning.type === 'payment_issue'
                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                        : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                    }`}
                  >
                    <Shield className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{warning.title}</p>
                      <p className="opacity-80">{warning.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Customer Selection */}
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const customer = customers.find(c => c.id === e.target.value);
                setSelectedCustomer(customer || null);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} {(customer.discountPercent || 0) > 0 ? `(-${customer.discountPercent}%)` : ''} {getTotalStoreCreditBalance(customer.id) > 0 ? `(Credit: ${formatCurrency(getTotalStoreCreditBalance(customer.id))})` : ''}
                </option>
              ))}
            </select>
            
            {/* Store Credit */}
            {storeCreditBalance > 0 && settings?.enableStoreCredit && (
              <div className="flex items-center justify-between p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Ticket className="w-3 h-3" />
                  Store Credit
                </span>
                <span className="font-bold text-emerald-400 text-xs">{formatCurrency(storeCreditBalance)}</span>
              </div>
            )}

            {/* Totals */}
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>{formatCurrency(cartTotals.subtotal)}</span>
              </div>
              {cartTotals.discountTotal > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discounts</span>
                  <span>-{formatCurrency(cartTotals.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>VAT (16%)</span>
                <span>{formatCurrency(cartTotals.vatTotal)}</span>
              </div>
              <Separator className="bg-slate-700 my-1" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-slate-200">Total</span>
                <span className="text-emerald-400">{formatCurrency(cartTotals.total)}</span>
              </div>
            </div>

            {/* Pay Button */}
            <Button
              onClick={handleCheckout}
              disabled={cart.length === 0 || (!activeShift && settings?.requireShiftToSell)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 text-base font-bold"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              PAY [F9]
            </Button>
          </div>
        </div>

        {/* Numpad Panel */}
        {showNumpad && (
          <div className="w-56 bg-slate-900 border-l border-slate-800 p-2">
            <QuantityKeypad
              value={numpadValue}
              onDigit={handleNumpadDigit}
              onClear={handleNumpadClear}
              onEnter={handleNumpadEnter}
              onModeChange={setNumpadMode}
              mode={numpadMode}
              targetItem={selectedCartItemIndex !== null ? cart[selectedCartItemIndex] : null}
            />
          </div>
        )}
      </div>

      {/* Quick Lookup Dialog */}
      <QuickLookup
        isOpen={showLookup}
        onClose={() => setShowLookup(false)}
        products={products}
        onSelect={handleAddToCart}
      />

      {/* Manager Override Dialog */}
      <ManagerOverrideDialog
        isOpen={showManagerOverride}
        onClose={() => { setShowManagerOverride(false); setPendingAction(null); }}
        onApprove={() => {
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
        action={overrideReason}
      />

      {/* Void Confirm Dialog */}
      <Dialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="w-5 h-5" />
              Void Entire Sale?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will remove all {cart.length} items from the cart. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowVoidConfirm(false)} className="flex-1 border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleVoidSale} className="flex-1 bg-red-600 hover:bg-red-700">
                <Ban className="w-4 h-4 mr-1" />
                Void Sale
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weight Input Dialog */}
      <Dialog open={showWeightInput} onOpenChange={setShowWeightInput}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Enter Weight
            </DialogTitle>
          </DialogHeader>
          {currentProduct && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">{currentProduct.name}</p>
              <p className="text-lg font-bold text-emerald-400">
                {formatCurrency(currentProduct.sellingPrice)} / {currentProduct.weightUnit}
              </p>
              <Input
                type="number"
                step="0.01"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder={`Weight in ${currentProduct.weightUnit}`}
                className="bg-slate-800 border-slate-700 text-slate-200 text-lg"
                autoFocus
              />
              {weightInput && (
                <p className="text-sm text-slate-400">
                  Total: {formatCurrency(parseFloat(weightInput) * currentProduct.sellingPrice)}
                </p>
              )}
              <Button onClick={() => {
                const weight = parseFloat(weightInput);
                if (!weight || weight <= 0) {
                  toast.error('Invalid weight');
                  return;
                }
                addToCart(currentProduct!, weight);
              }} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Serial Number Dialog */}
      <Dialog open={showSerialInput} onOpenChange={setShowSerialInput}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-blue-400" />
              Select Serial Number
            </DialogTitle>
          </DialogHeader>
          {currentProduct && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">{currentProduct.name}</p>
              <select
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              >
                <option value="">Select S/N</option>
                {currentProduct.serialNumbers?.map(sn => (
                  <option key={sn} value={sn}>{sn}</option>
                ))}
              </select>
              <Button onClick={() => {
                if (!serialInput.trim()) {
                  toast.error('Select serial number');
                  return;
                }
                if (cart.some(item => item.serialNumber === serialInput)) {
                  toast.error('Serial already in cart');
                  return;
                }
                addToCart(currentProduct!, undefined, serialInput);
              }} className="w-full bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Dialog */}
      <Dialog open={showBarcode} onOpenChange={setShowBarcode}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-emerald-400" />
              Scan Barcode
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBarcodeScan} className="space-y-4">
            <Input
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan or type barcode..."
              className="bg-slate-800 border-slate-700 text-slate-200 text-lg"
              autoFocus
            />
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Search className="w-4 h-4 mr-2" />
              Find Product
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Park Dialog */}
      <Dialog open={showParkDialog} onOpenChange={setShowParkDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-amber-400" />
              Park Transaction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              ref={parkNameRef}
              value={parkName}
              onChange={(e) => setParkName(e.target.value)}
              placeholder="Name (optional)"
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
            <textarea
              value={parkNote}
              onChange={(e) => setParkNote(e.target.value)}
              placeholder="Note (optional)"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowParkDialog(false)} className="flex-1 border-slate-700">
                Cancel
              </Button>
              <Button onClick={parkTransaction} className="flex-1 bg-amber-600 hover:bg-amber-700">
                <Pause className="w-4 h-4 mr-2" />
                Park
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parked List Dialog */}
      <Dialog open={showParkedList} onOpenChange={setShowParkedList}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Parked Transactions ({parkedTransactions.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {parkedTransactions.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <Pause className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No parked transactions</p>
              </div>
            ) : (
              parkedTransactions.map(park => (
                <ParkedCartCard
                  key={park.id}
                  hold={park}
                  onResume={() => resumeParked(park)}
                  onDelete={() => deleteParked(park.id)}
                  isCompact={parkedTransactions.length > 3}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Complete Payment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-center py-4 bg-slate-800 rounded-xl">
              <p className="text-sm text-slate-400 mb-1">Amount Due</p>
              <p className="text-4xl font-bold text-emerald-400">
                {formatCurrency(cartTotals.total)}
              </p>
              {cartTotals.discountTotal > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  You saved {formatCurrency(cartTotals.discountTotal)}!
                </p>
              )}
            </div>

            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <TabsList className="grid grid-cols-4 bg-slate-800">
                <TabsTrigger value="cash" className="data-[state=active]:bg-emerald-600">
                  <Banknote className="w-4 h-4 mr-1" />
                  Cash
                </TabsTrigger>
                <TabsTrigger value="mpesa" className="data-[state=active]:bg-emerald-600">
                  <Smartphone className="w-4 h-4 mr-1" />
                  M-Pesa
                </TabsTrigger>
                <TabsTrigger value="card" className="data-[state=active]:bg-emerald-600">
                  <CreditCard className="w-4 h-4 mr-1" />
                  Card
                </TabsTrigger>
                <TabsTrigger value="split" className="data-[state=active]:bg-emerald-600">
                  <Calculator className="w-4 h-4 mr-1" />
                  Split
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cash" className="mt-4">
                <Input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Cash received"
                  className="bg-slate-800 border-slate-700 text-slate-200 text-lg"
                  autoFocus
                />
                {parseFloat(cashReceived) > cartTotals.total && (
                  <p className="mt-2 text-sm text-emerald-400">
                    Change: {formatCurrency(parseFloat(cashReceived) - cartTotals.total)}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="mpesa" className="mt-4">
                <Input
                  value={mpesaCode}
                  onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  placeholder="M-Pesa code (e.g., SHG123XYZ)"
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  autoFocus
                />
              </TabsContent>

              <TabsContent value="card" className="mt-4">
                <p className="text-center text-slate-400 py-4">
                  Process at card terminal
                </p>
              </TabsContent>

              <TabsContent value="split" className="mt-4 space-y-4">
                {paymentSplits.length > 0 && (
                  <div className="space-y-2">
                    {paymentSplits.map((split, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="capitalize">{split.method}</span>
                        <div className="flex items-center gap-2">
                          <span>{formatCurrency(split.amount)}</span>
                          <button onClick={() => removePaymentSplit(idx)} className="text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Remaining:</span>
                      <span className={paymentSplits.reduce((sum, s) => sum + s.amount, 0) >= cartTotals.total ? 'text-emerald-400' : 'text-amber-400'}>
                        {formatCurrency(cartTotals.total - paymentSplits.reduce((sum, s) => sum + s.amount, 0))}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={splitMethod}
                    onChange={(e) => setSplitMethod(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-2 text-slate-200"
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="card">Card</option>
                  </select>
                  <Input
                    type="number"
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    placeholder="Amount"
                    className="bg-slate-800 border-slate-700 text-slate-200"
                  />
                  <Button onClick={addPaymentSplit} variant="outline" className="border-slate-700">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCheckout(false)} className="flex-1 border-slate-700 text-slate-400">
                Cancel
              </Button>
              <Button onClick={processPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Check className="w-4 h-4 mr-2" />
                Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bundle Dialog */}
      <Dialog open={showBundleDialog} onOpenChange={setShowBundleDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Product Bundle
            </DialogTitle>
          </DialogHeader>
          {currentBundle && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg text-slate-200">{currentBundle.name}</h3>
                <p className="text-sm text-slate-400">{currentBundle.description}</p>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-slate-300">Includes:</p>
                {currentBundle.components.map((comp, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-400">{comp.quantity}x {comp.productName}</span>
                    <span className="text-slate-500 line-through">{formatCurrency(comp.unitPrice * comp.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div>
                  <p className="text-sm text-slate-400">Bundle Price</p>
                  <p className="text-2xl font-bold text-purple-400">{formatCurrency(currentBundle.bundlePrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 line-through">{formatCurrency(currentBundle.originalTotalPrice)}</p>
                  <Badge className="bg-green-500/20 text-green-400">
                    Save {formatCurrency(currentBundle.savingsAmount)}
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowBundleDialog(false)} className="flex-1 border-slate-700">
                  Cancel
                </Button>
                <Button onClick={() => addBundleToCart(currentBundle)} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bundle
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="bg-white text-slate-900 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Receipt className="w-5 h-5" />
              Receipt
            </DialogTitle>
          </DialogHeader>
          
          {lastSale && (
            <div className="space-y-4">
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="font-bold text-lg">{DEMO_BUSINESS.name}</h3>
                <p className="text-xs text-slate-500">{DEMO_BUSINESS.address}</p>
                <p className="text-xs text-slate-500">Tel: {DEMO_BUSINESS.phone}</p>
                <p className="text-xs text-slate-500">KRA PIN: {DEMO_BUSINESS.kraPin}</p>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt:</span>
                  <span>{lastSale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>{new Date(lastSale.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span>{lastSale.cashierName}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left">Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSale.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-left py-1">
                          {item.productName}
                          {item.serialNumber && <span className="text-blue-600 block text-[10px]">S/N: {item.serialNumber}</span>}
                        </td>
                        <td className="text-center">
                          {item.weight ? `${item.weight.toFixed(2)}kg` : item.quantity}
                        </td>
                        <td className="text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span>{formatCurrency(lastSale.subtotal)}</span>
                </div>
                {lastSale.discountTotal > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(lastSale.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">VAT (16%):</span>
                  <span>{formatCurrency(lastSale.vatTotal)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>TOTAL:</span>
                  <span className="text-emerald-600">{formatCurrency(lastSale.total)}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                {lastSale.payment.isSplit ? (
                  <div>
                    <p>Split Payment:</p>
                    {lastSale.payment.splits?.map((split, idx) => (
                      <p key={idx} className="ml-2">
                        • {split.method.toUpperCase()}: {formatCurrency(split.amount)}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>Payment: {lastSale.payment.method.toUpperCase()}</p>
                )}
              </div>

              <div className="text-center text-xs text-slate-500 border-t border-slate-200 pt-4">
                <p className="whitespace-pre-line">{DEMO_BUSINESS.receiptFooter}</p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (lastSale) {
                      logReceiptReprint(lastSale.id, lastSale.receiptNumber, 'Customer copy');
                      toast.success('Receipt reprinted!');
                    }
                  }}
                  className="flex-1 border-slate-700 text-slate-600"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Reprint
                </Button>
                <Button onClick={() => setShowReceipt(false)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  <Check className="w-4 h-4 mr-2" />
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
