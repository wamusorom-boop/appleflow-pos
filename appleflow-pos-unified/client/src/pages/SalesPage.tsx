/**
 * AppleFlow POS - Sales Page
 */

import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Search, Receipt } from 'lucide-react';
import { apiClient } from '../context/AuthContext';
import { toast } from 'sonner';

interface Sale {
  id: string;
  receiptNumber: string;
  total: number;
  status: string;
  createdAt: string;
  customer?: {
    name: string;
  };
  items: {
    quantity: number;
    product: {
      name: string;
    };
  }[];
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await apiClient.get('/api/sales');
      if (response.data?.success) {
        setSales(response.data.data.sales);
      }
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sale.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-700';
      case 'VOIDED':
        return 'bg-red-100 text-red-700';
      case 'REFUNDED':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-500 mt-1">View and manage sales transactions</p>
        </div>
        <a 
          href="/sales/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Sale
        </a>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by receipt number or customer..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 mt-2">Loading sales...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-gray-500 mt-2">
              {searchQuery ? 'No sales found matching your search' : 'No sales yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{sale.receiptNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(sale.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{sale.customer?.name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      KES {sale.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
