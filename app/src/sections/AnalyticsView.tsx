/**
 * AppleFlow POS - Analytics View
 * Sales analytics and business insights
 */

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSales, formatCurrency } from '@/lib/data';

export function AnalyticsView() {
  const [sales, setSales] = useState<any[]>([]);
  useEffect(() => {
    setSales(getSales());
  }, []);

  // Calculate analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Filter sales by period
    const todaySales = sales.filter(s => new Date(s.createdAt) >= today);
    const yesterdaySales = sales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= yesterday && d < today;
    });
    const weekSales = sales.filter(s => new Date(s.createdAt) >= weekAgo);
    const monthSales = sales.filter(s => new Date(s.createdAt) >= monthAgo);

    // Calculate totals
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
    const weekTotal = weekSales.reduce((sum, s) => sum + s.total, 0);
    const monthTotal = monthSales.reduce((sum, s) => sum + s.total, 0);
    const allTimeTotal = sales.reduce((sum, s) => sum + s.total, 0);

    // Calculate change percentages
    const dayChange = yesterdayTotal > 0 
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 
      : 0;

    // Top selling products
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { 
            name: item.productName, 
            quantity: 0, 
            revenue: 0 
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.total;
      });
    });

    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([_, data]) => data);

    // Payment method breakdown
    const paymentMethods: Record<string, number> = {};
    sales.forEach(sale => {
      const method = sale.payment.method;
      paymentMethods[method] = (paymentMethods[method] || 0) + sale.total;
    });

    // Hourly sales distribution
    const hourlySales = Array(24).fill(0);
    sales.forEach(sale => {
      const hour = new Date(sale.createdAt).getHours();
      hourlySales[hour] += sale.total;
    });

    // Find peak hour
    const peakHour = hourlySales.indexOf(Math.max(...hourlySales));

    return {
      todayTotal,
      todayCount: todaySales.length,
      yesterdayTotal,
      dayChange,
      weekTotal,
      weekCount: weekSales.length,
      monthTotal,
      monthCount: monthSales.length,
      allTimeTotal,
      allTimeCount: sales.length,
      topProducts,
      paymentMethods,
      peakHour,
      averageOrderValue: sales.length > 0 ? allTimeTotal / sales.length : 0,
    };
  }, [sales]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-auto">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-6">
        <h1 className="text-xl font-bold text-slate-200">Analytics Dashboard</h1>
      </header>

      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Today&apos;s Sales</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(analytics.todayTotal)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {analytics.dayChange >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-xs ${analytics.dayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {analytics.dayChange >= 0 ? '+' : ''}{analytics.dayChange.toFixed(1)}% vs yesterday
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">This Week</p>
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(analytics.weekTotal)}</p>
                  <p className="text-xs text-slate-500 mt-1">{analytics.weekCount} transactions</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">This Month</p>
                  <p className="text-2xl font-bold text-purple-400">{formatCurrency(analytics.monthTotal)}</p>
                  <p className="text-xs text-slate-500 mt-1">{analytics.monthCount} transactions</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Avg Order Value</p>
                  <p className="text-2xl font-bold text-amber-400">{formatCurrency(analytics.averageOrderValue)}</p>
                  <p className="text-xs text-slate-500 mt-1">Per transaction</p>
                </div>
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                Top Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.topProducts.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topProducts.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-emerald-400">#{idx + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.quantity} units sold</p>
                        </div>
                      </div>
                      <p className="font-bold text-emerald-400">{formatCurrency(product.revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No sales data yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-400" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(analytics.paymentMethods).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(analytics.paymentMethods).map(([method, amount]) => {
                    const total = Object.values(analytics.paymentMethods).reduce((a, b) => a + b, 0);
                    const percentage = (amount / total) * 100;
                    return (
                      <div key={method}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-slate-300 capitalize">{method}</span>
                          <span className="text-sm text-slate-400">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              method === 'cash' ? 'bg-green-500' :
                              method === 'mpesa' ? 'bg-blue-500' :
                              'bg-purple-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{formatCurrency(amount)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No payment data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* All Time Stats */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200">All Time Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-400">Total Revenue</span>
                <span className="text-xl font-bold text-emerald-400">{formatCurrency(analytics.allTimeTotal)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-400">Total Transactions</span>
                <span className="text-xl font-bold text-blue-400">{analytics.allTimeCount}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-400">Peak Sales Hour</span>
                <span className="text-xl font-bold text-amber-400">{analytics.peakHour}:00</span>
              </div>
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200">Today&apos;s Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-emerald-400">{analytics.todayCount}</p>
                  <p className="text-sm text-slate-400 mt-1">Transactions</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-400">
                    {analytics.todayCount > 0 ? formatCurrency(analytics.todayTotal / analytics.todayCount) : formatCurrency(0)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">Avg Transaction</p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-400">{formatCurrency(analytics.todayTotal)}</p>
                  <p className="text-sm text-slate-400 mt-1">Total Sales</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
