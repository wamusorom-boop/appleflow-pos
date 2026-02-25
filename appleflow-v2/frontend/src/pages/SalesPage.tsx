import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Download,
  Eye,
  RotateCcw,
  Printer,
  Calendar,
  DollarSign,
  ShoppingCart,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';

interface Sale {
  id: string;
  receipt_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  final_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  store_name: string;
  cashier_name: string;
  item_count: number;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SaleDetail extends Sale {
  items: SaleItem[];
  notes: string | null;
}

const statusColors: Record<string, string> = {
  completed: 'success',
  pending: 'warning',
  cancelled: 'error',
  refunded: 'secondary',
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mpesa: 'M-Pesa',
  bank_transfer: 'Bank Transfer',
  mixed: 'Mixed',
};

export function SalesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', { search: searchQuery, dateFrom, dateTo, status: statusFilter, page: currentPage }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      
      const response = await api.get(`/sales?${params}`);
      return response.data;
    },
  });

  const { data: saleDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['sale', selectedSale?.id],
    queryFn: async () => {
      if (!selectedSale) return null;
      const response = await api.get(`/sales/${selectedSale.id}`);
      return response.data;
    },
    enabled: !!selectedSale && isDetailModalOpen,
  });

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const handlePrintReceipt = (saleId: string) => {
    window.open(`/api/sales/${saleId}/receipt`, '_blank');
  };

  const handleVoidSale = async (saleId: string) => {
    if (!confirm('Are you sure you want to void this sale? This action cannot be undone.')) {
      return;
    }
    try {
      await api.post(`/sales/${saleId}/void`, { reason: 'Voided by user' });
      // Refetch sales
      window.location.reload();
    } catch (error) {
      alert('Failed to void sale');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const totalPages = sales?.pagination?.totalPages || 1;
  const totalSales = sales?.pagination?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
          <p className="text-gray-500 mt-1">View and manage all transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
          <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />}>
            Print Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-xl font-bold text-gray-900">{totalSales}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(sales?.summary?.totalRevenue || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Today's Sales</p>
              <p className="text-xl font-bold text-gray-900">
                {sales?.summary?.todayCount || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <RotateCcw className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Refunds</p>
              <p className="text-xl font-bold text-gray-900">
                {sales?.summary?.refundCount || 0}
              </p>
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
              placeholder="Search by receipt #, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
            <Button variant="outline" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Sales Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Loading sales...
                    </div>
                  </td>
                </tr>
              ) : sales?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>No sales found</p>
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                sales?.data?.map((sale: Sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-gray-900">
                        {sale.receipt_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {sale.customer_name || 'Walk-in Customer'}
                      {sale.customer_phone && (
                        <p className="text-xs text-gray-500">{sale.customer_phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {sale.item_count} items
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(sale.final_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {paymentMethodLabels[sale.payment_method] || sale.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColors[sale.status] as any || 'default'}>
                        {sale.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSale(sale)}
                          leftIcon={<Eye className="w-4 h-4" />}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintReceipt(sale.id)}
                          leftIcon={<Printer className="w-4 h-4" />}
                        />
                        {sale.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoidSale(sale.id)}
                            leftIcon={<RotateCcw className="w-4 h-4 text-red-500" />}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, totalSales)} of {totalSales} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>
              <span className="px-3 py-2 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sale Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Sale Details - ${selectedSale?.receipt_number}`}
        size="lg"
      >
        {isDetailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : saleDetail ? (
          <div className="space-y-6">
            {/* Sale Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium">{formatDateTime(saleDetail.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cashier</p>
                <p className="font-medium">{saleDetail.cashier_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Store</p>
                <p className="font-medium">{saleDetail.store_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="font-medium">
                  {paymentMethodLabels[saleDetail.payment_method] || saleDetail.payment_method}
                </p>
              </div>
            </div>

            {/* Customer Info */}
            {saleDetail.customer_name && (
              <div className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Customer</p>
                <p className="text-gray-900">{saleDetail.customer_name}</p>
                {saleDetail.customer_phone && (
                  <p className="text-sm text-gray-500">{saleDetail.customer_phone}</p>
                )}
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {saleDetail.items?.map((item: SaleItem) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-sm">{item.product_name}</td>
                      <td className="px-3 py-2 text-sm text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-sm text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium">
                        {formatCurrency(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(saleDetail.total_amount)}</span>
                </div>
                {saleDetail.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-green-600">-{formatCurrency(saleDetail.discount_amount)}</span>
                  </div>
                )}
                {saleDetail.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span>{formatCurrency(saleDetail.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(saleDetail.final_amount)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {saleDetail.notes && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Notes</p>
                <p className="text-sm text-yellow-700">{saleDetail.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => handlePrintReceipt(saleDetail.id)}
                leftIcon={<Printer className="w-4 h-4" />}
                className="flex-1"
              >
                Print Receipt
              </Button>
              {saleDetail.status === 'completed' && (
                <Button
                  variant="outline"
                  onClick={() => handleVoidSale(saleDetail.id)}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Void Sale
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
