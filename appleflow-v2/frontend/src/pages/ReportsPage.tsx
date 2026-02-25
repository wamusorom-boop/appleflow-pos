import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  Download,
  Filter,
  ChevronDown,
  PieChart,
  Activity,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

interface SalesReport {
  period: string;
  total_sales: number;
  total_revenue: number;
  total_discount: number;
  total_tax: number;
  average_order_value: number;
  unique_customers: number;
}

interface ProductReport {
  product_id: string;
  product_name: string;
  sku: string;
  total_quantity_sold: number;
  total_revenue: number;
  profit: number;
}

interface PaymentReport {
  payment_method: string;
  count: number;
  total_amount: number;
  percentage: number;
}

export function ReportsPage() {
  const [dateRange, setDateRange] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'payments'>('sales');

  const dateParams = () => {
    const params = new URLSearchParams();
    if (dateRange === 'custom' && customFrom && customTo) {
      params.append('from', customFrom);
      params.append('to', customTo);
    } else {
      params.append('range', dateRange);
    }
    return params;
  };

  const { data: salesReport, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-report', dateRange, customFrom, customTo],
    queryFn: async () => {
      const response = await api.get(`/reports/sales?${dateParams()}`);
      return response.data;
    },
  });

  const { data: productsReport, isLoading: productsLoading } = useQuery({
    queryKey: ['products-report', dateRange, customFrom, customTo],
    queryFn: async () => {
      const response = await api.get(`/reports/products?${dateParams()}`);
      return response.data;
    },
    enabled: activeTab === 'products',
  });

  const { data: paymentsReport, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments-report', dateRange, customFrom, customTo],
    queryFn: async () => {
      const response = await api.get(`/reports/payments?${dateParams()}`);
      return response.data;
    },
    enabled: activeTab === 'payments',
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/reports/dashboard');
      return response.data;
    },
  });

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const exportReport = () => {
    const params = dateParams();
    params.append('format', 'csv');
    window.open(`/api/reports/${activeTab}?${params}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500 mt-1">View business performance and insights</p>
        </div>
        <Button variant="outline" onClick={exportReport} leftIcon={<Download className="w-4 h-4" />}>
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(dashboardStats?.totalRevenue || 0)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">+12.5%</span>
                <span className="text-xs text-gray-400">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardStats?.totalSales?.toLocaleString() || 0}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">+8.2%</span>
                <span className="text-xs text-gray-400">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Order</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(dashboardStats?.averageOrderValue || 0)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600">-2.1%</span>
                <span className="text-xs text-gray-400">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unique Customers</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardStats?.uniqueCustomers?.toLocaleString() || 0}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">+15.3%</span>
                <span className="text-xs text-gray-400">vs last period</span>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Date Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {dateRangeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="self-center text-gray-500">to</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: 'sales', label: 'Sales Report', icon: BarChart3 },
            { id: 'products', label: 'Top Products', icon: Package },
            { id: 'payments', label: 'Payment Methods', icon: PieChart },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sales Report Tab */}
      {activeTab === 'sales' && (
        <Card>
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Sales Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">AOV</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Customers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salesLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : salesReport?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No data available for selected period
                    </td>
                  </tr>
                ) : (
                  salesReport?.data?.map((row: SalesReport, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{row.period}</td>
                      <td className="px-4 py-3 text-right">{row.total_sales.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.total_revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.total_discount)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.total_tax)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.average_order_value)}</td>
                      <td className="px-4 py-3 text-right">{row.unique_customers}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Products Report Tab */}
      {activeTab === 'products' && (
        <Card>
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Top Selling Products</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : productsReport?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No product data available
                    </td>
                  </tr>
                ) : (
                  productsReport?.data?.map((product: ProductReport, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{product.product_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{product.sku}</td>
                      <td className="px-4 py-3 text-right">{product.total_quantity_sold}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(product.total_revenue)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{formatCurrency(product.profit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Payments Report Tab */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Payment Methods</h3>
            </div>
            <div className="p-4">
              {paymentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : paymentsReport?.data?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No payment data available</p>
              ) : (
                <div className="space-y-4">
                  {paymentsReport?.data?.map((payment: PaymentReport, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium capitalize">{payment.payment_method}</span>
                        <span className="text-gray-600">{payment.count} transactions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${payment.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-20 text-right">
                          {formatCurrency(payment.total_amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Payment Summary</h3>
            </div>
            <div className="p-4">
              {paymentsReport?.summary && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Total Transactions</span>
                    <span className="font-bold text-lg">{paymentsReport.summary.totalTransactions}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-green-700">Total Amount</span>
                    <span className="font-bold text-lg text-green-700">
                      {formatCurrency(paymentsReport.summary.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-blue-700">Average Transaction</span>
                    <span className="font-bold text-lg text-blue-700">
                      {formatCurrency(paymentsReport.summary.averageTransaction)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
