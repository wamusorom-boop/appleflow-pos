/**
 * AppleFlow POS - Reports Routes
 * Sales analytics and business intelligence
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';

const router = Router();

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  storeId: z.string().uuid().optional(),
});

/**
 * GET /api/reports/dashboard
 * Dashboard summary statistics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId;

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Today's sales
  let todaySalesQuery = supabase
    .from('sales')
    .select('total, status')
    .eq('tenant_id', tenantId)
    .gte('created_at', today)
    .eq('status', 'completed');

  if (storeId) {
    todaySalesQuery = todaySalesQuery.eq('store_id', storeId);
  }

  const { data: todaySales } = await todaySalesQuery;

  // This month's sales
  let monthSalesQuery = supabase
    .from('sales')
    .select('total, status')
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo)
    .eq('status', 'completed');

  if (storeId) {
    monthSalesQuery = monthSalesQuery.eq('store_id', storeId);
  }

  const { data: monthSales } = await monthSalesQuery;

  // Low stock count
  let lowStockQuery = supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .lte('available_quantity', supabase.raw('min_stock_level'));

  if (storeId) {
    lowStockQuery = lowStockQuery.eq('store_id', storeId);
  }

  const { count: lowStockCount } = await lowStockQuery;

  // Total customers
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  // Total products
  let productsQuery = supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (storeId) {
    productsQuery = productsQuery.or(`store_id.eq.${storeId},store_id.is.null`);
  }

  const { count: productCount } = await productsQuery;

  // Calculate totals
  const todayTotal = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const monthTotal = monthSales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const todayTransactions = todaySales?.length || 0;

  res.json({
    success: true,
    data: {
      today: {
        sales: todayTotal,
        transactions: todayTransactions,
      },
      month: {
        sales: monthTotal,
        transactions: monthSales?.length || 0,
      },
      inventory: {
        lowStock: lowStockCount || 0,
        totalProducts: productCount || 0,
      },
      customers: customerCount || 0,
    },
  });
}));

/**
 * GET /api/reports/sales
 * Sales report with date range
 */
router.get('/sales', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  const result = dateRangeSchema.safeParse({
    from: req.query.from,
    to: req.query.to,
    storeId: req.query.storeId,
  });

  if (!result.success) {
    throw new ValidationError('Invalid date range', { errors: result.error.errors });
  }

  const { from, to, storeId } = result.data;

  let query = supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, full_name),
      user:user_profiles(id, full_name),
      items:sale_items(*),
      payments:payments(*)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (from) {
    query = query.gte('created_at', from);
  }

  if (to) {
    query = query.lte('created_at', to);
  }

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data: sales, error } = await query;

  if (error) {
    logger.error('Failed to fetch sales report', { error, tenantId });
    throw new Error('Failed to fetch sales report');
  }

  // Calculate summary
  const summary = {
    totalSales: sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0,
    totalTransactions: sales?.length || 0,
    totalTax: sales?.reduce((sum, s) => sum + (s.tax_total || 0), 0) || 0,
    totalDiscount: sales?.reduce((sum, s) => sum + (s.discount_total || 0), 0) || 0,
    averageOrderValue: sales?.length ? (sales.reduce((sum, s) => sum + (s.total || 0), 0) / sales.length) : 0,
  };

  // Payment method breakdown
  const paymentMethods: Record<string, number> = {};
  sales?.forEach(sale => {
    sale.payments?.forEach((payment: any) => {
      paymentMethods[payment.method] = (paymentMethods[payment.method] || 0) + (payment.amount || 0);
    });
  });

  res.json({
    success: true,
    data: {
      summary,
      paymentMethods,
      sales: sales || [],
    },
  });
}));

/**
 * GET /api/reports/products
 * Product performance report
 */
router.get('/products', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  const result = dateRangeSchema.safeParse({
    from: req.query.from,
    to: req.query.to,
    storeId: req.query.storeId,
  });

  if (!result.success) {
    throw new ValidationError('Invalid date range', { errors: result.error.errors });
  }

  const { from, to, storeId } = result.data;

  // Get top selling products
  let query = supabase
    .from('sale_items')
    .select(`
      product_id,
      product_name,
      sku,
      quantity,
      total,
      product:products(id, category:categories(name))
    `)
    .eq('tenant_id', tenantId);

  if (from) {
    query = query.gte('created_at', from);
  }

  if (to) {
    query = query.lte('created_at', to);
  }

  const { data: items, error } = await query;

  if (error) {
    logger.error('Failed to fetch product report', { error, tenantId });
    throw new Error('Failed to fetch product report');
  }

  // Aggregate by product
  const productStats: Record<string, {
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
  }> = {};

  items?.forEach((item: any) => {
    if (!productStats[item.product_id]) {
      productStats[item.product_id] = {
        productId: item.product_id,
        name: item.product_name,
        sku: item.sku,
        quantity: 0,
        revenue: 0,
      };
    }
    productStats[item.product_id].quantity += item.quantity || 0;
    productStats[item.product_id].revenue += item.total || 0;
  });

  const topProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  res.json({
    success: true,
    data: {
      topProducts,
    },
  });
}));

/**
 * GET /api/reports/inventory
 * Inventory valuation report
 */
router.get('/inventory', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId || (req.query.storeId as string);

  let query = supabase
    .from('inventory')
    .select(`
      quantity,
      product:products(id, name, sku, cost_price, selling_price)
    `)
    .eq('tenant_id', tenantId);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data: inventory, error } = await query;

  if (error) {
    logger.error('Failed to fetch inventory report', { error, tenantId });
    throw new Error('Failed to fetch inventory report');
  }

  let totalCost = 0;
  let totalValue = 0;
  let totalQuantity = 0;

  inventory?.forEach((item: any) => {
    const qty = item.quantity || 0;
    const cost = item.product?.cost_price || 0;
    const price = item.product?.selling_price || 0;

    totalQuantity += qty;
    totalCost += qty * cost;
    totalValue += qty * price;
  });

  res.json({
    success: true,
    data: {
      summary: {
        totalQuantity,
        totalCost,
        totalValue,
        potentialProfit: totalValue - totalCost,
      },
    },
  });
}));

export { router as reportRouter };
