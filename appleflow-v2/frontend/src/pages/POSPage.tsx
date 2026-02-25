/**
 * AppleFlow POS - POS Page
 * Main point of sale interface
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

import { productsApi, customersApi, salesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  taxRate: number;
}

export function POSPage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');

  // Fetch products
  const { data: productsData } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { products: [] };
      const response = await productsApi.list({ search: searchQuery, limit: 20 });
      return response.data.data;
    },
    enabled: searchQuery.length > 0,
  });

  // Fetch customers
  const { data: customersData } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: async () => {
      if (!customerSearch) return { customers: [] };
      const response = await customersApi.list({ search: customerSearch, limit: 10 });
      return response.data.data;
    },
    enabled: customerSearch.length > 0,
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: (data: any) => salesApi.create(data),
    onSuccess: (response) => {
      toast.success(`Sale completed! Receipt: ${response.data.data.sale.receipt_number}`);
      setCart([]);
      setSelectedCustomer(null);
      setShowPaymentModal(false);
      setCashReceived('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to complete sale');
    },
  });

  // Add product to cart
  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          price: product.selling_price,
          quantity: 1,
          taxRate: product.tax_rate || 0,
        },
      ];
    });
    setSearchQuery('');
    toast.success(`Added ${product.name} to cart`);
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + taxTotal;

  // Handle checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setShowPaymentModal(true);
  };

  // Complete sale
  const completeSale = () => {
    const items = cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
      taxRate: item.taxRate,
    }));

    const payments = [
      {
        method: paymentMethod,
        amount: total,
      },
    ];

    createSaleMutation.mutate({
      customerId: selectedCustomer?.id,
      items,
      payments,
    });
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6">
      {/* Left side - Product Search */}
      <div className="flex-1 flex flex-col">
        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name, SKU, or barcode..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            autoFocus
          />
        </div>

        {/* Product Results */}
        {searchQuery && (
          <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
            {productsData?.products.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No products found
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {productsData?.products.map((product: any) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary-600">
                        KSh {product.selling_price?.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Stock: {product.inventory?.[0]?.available_quantity || 0}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Customer Selection */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer (Optional)
          </label>
          <div className="relative">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                if (!e.target.value) setSelectedCustomer(null);
              }}
              placeholder={selectedCustomer ? selectedCustomer.full_name : 'Search customer...'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              disabled={!!selectedCustomer}
            />
            {selectedCustomer && (
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
          
          {customerSearch && !selectedCustomer && (
            <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-auto">
              {customersData?.customers.map((customer: any) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setCustomerSearch('');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50"
                >
                  <p className="font-medium">{customer.full_name}</p>
                  <p className="text-sm text-gray-500">{customer.phone}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Cart */}
      <div className="w-full lg:w-96 bg-white rounded-lg border border-gray-200 flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current Sale</h2>
          <p className="text-sm text-gray-500">{cart.length} items</p>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Scan or search products to add</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-sm text-gray-500">KSh {item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 ml-2"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>KSh {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax</span>
              <span>KSh {taxTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary-600">KSh {total.toLocaleString()}</span>
            </div>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Checkout
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-3xl font-bold text-primary-600">
                KSh {total.toLocaleString()}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            {paymentMethod === 'cash' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cash Received
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                {parseFloat(cashReceived) >= total && (
                  <p className="mt-2 text-sm text-green-600">
                    Change: KSh {(parseFloat(cashReceived) - total).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={completeSale}
                disabled={createSaleMutation.isPending}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
