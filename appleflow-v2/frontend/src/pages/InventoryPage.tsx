import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  TrendingDown,
  History,
  ArrowUpDown,
  Filter,
  Download,
  CheckCircle,
  X,
  Calendar,
  User,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  store_id: string;
  store_name: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  reorder_level: number;
  reorder_point: number;
  location: string | null;
  last_counted_at: string | null;
  updated_at: string;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by_name: string;
}

interface AdjustmentFormData {
  quantity: number;
  type: 'in' | 'out';
  notes: string;
}

export function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState<AdjustmentFormData>({
    quantity: 0,
    type: 'in',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', { search: searchQuery, store: storeFilter, stock: stockFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (storeFilter) params.append('store', storeFilter);
      if (stockFilter) params.append('stock', stockFilter);
      const response = await api.get(`/inventory?${params}`);
      return response.data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ['stock-movements', selectedItem?.product_id],
    queryFn: async () => {
      if (!selectedItem) return null;
      const response = await api.get(`/inventory/movements?productId=${selectedItem.product_id}`);
      return response.data;
    },
    enabled: !!selectedItem && isHistoryModalOpen,
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; storeId: string; quantity: number; type: string; notes: string }) =>
      api.post('/inventory/adjust', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsAdjustModalOpen(false);
      setAdjustForm({ quantity: 0, type: 'in', notes: '' });
    },
  });

  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsAdjustModalOpen(true);
  };

  const handleViewHistory = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    adjustMutation.mutate({
      productId: selectedItem.product_id,
      storeId: selectedItem.store_id,
      quantity: adjustForm.quantity,
      type: adjustForm.type,
      notes: adjustForm.notes,
    });
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.available_quantity <= 0) {
      return { label: 'Out of Stock', variant: 'error' as const };
    }
    if (item.available_quantity <= item.reorder_point) {
      return { label: 'Low Stock', variant: 'warning' as const };
    }
    if (item.available_quantity <= item.reorder_level) {
      return { label: 'Reorder Soon', variant: 'secondary' as const };
    }
    return { label: 'In Stock', variant: 'success' as const };
  };

  const lowStockCount = inventory?.data?.filter((item: InventoryItem) => 
    item.available_quantity <= item.reorder_point
  ).length || 0;

  const outOfStockCount = inventory?.data?.filter((item: InventoryItem) => 
    item.available_quantity <= 0
  ).length || 0;

  const totalItems = inventory?.data?.length || 0;
  const totalValue = inventory?.data?.reduce((sum: number, item: InventoryItem) => 
    sum + (item.available_quantity * 0), 0
  ) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-1">Track and manage stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
          <Button variant="outline" leftIcon={<History className="w-4 h-4" />}>
            Stock Count
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total SKUs</p>
              <p className="text-xl font-bold text-gray-900">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Stock</p>
              <p className="text-xl font-bold text-gray-900">
                {totalItems - lowStockCount - outOfStockCount}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-xl font-bold text-gray-900">{lowStockCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-xl font-bold text-gray-900">{outOfStockCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stores</option>
              {stores?.data?.map((store: any) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="in">In Stock</option>
            </select>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setStoreFilter(''); setStockFilter(''); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Inventory Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Loading inventory...
                    </div>
                  </td>
                </tr>
              ) : inventory?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>No inventory items found</p>
                  </td>
                </tr>
              ) : (
                inventory?.data?.map((item: InventoryItem) => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.product_sku}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.store_name}</td>
                      <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {item.available_quantity}
                        {item.reserved_quantity > 0 && (
                          <span className="text-xs text-gray-500 block">
                            ({item.reserved_quantity} reserved)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{item.reorder_point}</td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAdjustStock(item)}
                            leftIcon={<ArrowUpDown className="w-4 h-4" />}
                          >
                            Adjust
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewHistory(item)}
                            leftIcon={<History className="w-4 h-4" />}
                          >
                            History
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Adjust Stock - ${selectedItem?.product_name}`}
      >
        <form onSubmit={handleSubmitAdjustment} className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Current Quantity</p>
                <p className="text-xl font-bold">{selectedItem?.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available</p>
                <p className="text-xl font-bold">{selectedItem?.available_quantity}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustForm({ ...adjustForm, type: 'in' })}
                className={`flex-1 py-2 px-4 rounded-lg border ${
                  adjustForm.type === 'in'
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Stock In (+)
              </button>
              <button
                type="button"
                onClick={() => setAdjustForm({ ...adjustForm, type: 'out' })}
                className={`flex-1 py-2 px-4 rounded-lg border ${
                  adjustForm.type === 'out'
                    ? 'bg-red-100 border-red-500 text-red-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Stock Out (-)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="1"
              value={adjustForm.quantity || ''}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })}
              placeholder="Enter quantity"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              placeholder="Reason for adjustment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAdjustModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={adjustMutation.isPending}
              className="flex-1"
            >
              Save Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Stock History - ${selectedItem?.product_name}`}
        size="lg"
      >
        {movements?.data?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No stock movements recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Before</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">After</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements?.data?.map((movement: StockMovement) => (
                  <tr key={movement.id}>
                    <td className="px-3 py-2 text-sm">
                      {formatDateTime(movement.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          movement.type === 'sale'
                            ? 'success'
                            : movement.type === 'adjustment'
                            ? 'warning'
                            : movement.type === 'return'
                            ? 'secondary'
                            : 'default'
                        }
                      >
                        {movement.type}
                      </Badge>
                    </td>
                    <td className={`px-3 py-2 text-right text-sm font-medium ${
                      movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-600">
                      {movement.previous_quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium">
                      {movement.new_quantity}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {movement.created_by_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
