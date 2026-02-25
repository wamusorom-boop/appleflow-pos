/**
 * AppleFlow POS - Dashboard Page
 */

import { useQuery } from '@tanstack/react-query';
import {
  CurrencyDollarIcon,
  ShoppingBagIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';

import { reportsApi } from '@/lib/api';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          {trend && (
            <p className={`mt-2 text-sm font-medium ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await reportsApi.getDashboard();
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  const stats = dashboardData || {
    today: { sales: 0, transactions: 0 },
    month: { sales: 0, transactions: 0 },
    inventory: { lowStock: 0, totalProducts: 0 },
    customers: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
        </div>
        <a
          href="/pos"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Open POS
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Sales"
          value={`KSh ${stats.today.sales.toLocaleString()}`}
          subtitle={`${stats.today.transactions} transactions`}
          icon={CurrencyDollarIcon}
          color="bg-green-500"
        />
        <StatCard
          title="This Month"
          value={`KSh ${stats.month.sales.toLocaleString()}`}
          subtitle={`${stats.month.transactions} transactions`}
          icon={ShoppingBagIcon}
          color="bg-blue-500"
        />
        <StatCard
          title="Total Customers"
          value={stats.customers.toLocaleString()}
          icon={UsersIcon}
          color="bg-purple-500"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.inventory.lowStock.toString()}
          subtitle={`of ${stats.inventory.totalProducts} products`}
          icon={ExclamationTriangleIcon}
          color={stats.inventory.lowStock > 0 ? 'bg-red-500' : 'bg-gray-400'}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/pos"
            className="flex flex-col items-center p-4 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            <ShoppingBagIcon className="w-8 h-8 text-primary-600 mb-2" />
            <span className="text-sm font-medium text-primary-700">New Sale</span>
          </a>
          <a
            href="/products"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <CubeIcon className="w-8 h-8 text-gray-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Add Product</span>
          </a>
          <a
            href="/customers"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <UsersIcon className="w-8 h-8 text-gray-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Add Customer</span>
          </a>
          <a
            href="/inventory"
            className="flex flex-col items-center p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <ExclamationTriangleIcon className="w-8 h-8 text-gray-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">View Inventory</span>
          </a>
        </div>
      </div>
    </div>
  );
}
