/**
 * AppleFlow POS - Dashboard Page
 */

import { useEffect, useState } from 'react';
import { 
  DollarSign, 
  Package, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  ShoppingCart
} from 'lucide-react';
import { apiClient } from '../context/AuthContext';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  lowStockProducts: number;
  totalCustomers: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get('/api/reports/dashboard');
        if (response.data?.success) {
          setStats(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Today's Sales",
      value: stats ? `KES ${stats.todaySales.toLocaleString()}` : '-',
      icon: DollarSign,
      color: 'bg-emerald-500',
      trend: `${stats?.todayTransactions || 0} transactions`,
    },
    {
      title: 'Total Products',
      value: stats?.totalProducts.toLocaleString() || '-',
      icon: Package,
      color: 'bg-blue-500',
      trend: `${stats?.lowStockProducts || 0} low stock`,
    },
    {
      title: 'Customers',
      value: stats?.totalCustomers.toLocaleString() || '-',
      icon: Users,
      color: 'bg-purple-500',
      trend: 'Total registered',
    },
    {
      title: 'Performance',
      value: '100%',
      icon: TrendingUp,
      color: 'bg-orange-500',
      trend: 'System uptime',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? (
                    <span className="inline-block w-16 h-6 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    card.value
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">{card.trend}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a 
            href="/sales" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            New Sale
          </a>
          <a 
            href="/products" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Package className="w-4 h-4" />
            Manage Products
          </a>
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats && stats.lowStockProducts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Low Stock Alert
            </p>
            <p className="text-sm text-amber-700">
              {stats.lowStockProducts} product(s) are running low on stock. 
              <a href="/products" className="underline ml-1">View products</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
