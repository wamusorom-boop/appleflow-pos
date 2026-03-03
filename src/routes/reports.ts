import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// X-Report (Current shift/day report without closing)
router.get('/x-report', authenticate, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all sales for the day
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: { not: 'VOIDED' }
      },
      include: {
        items: true,
        payments: true,
        user: { select: { name: true } }
      }
    });

    // Get voided sales
    const voidedSales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'VOIDED'
      },
      select: {
        id: true,
        receiptNumber: true,
        total: true,
        voidedAt: true,
        voidedBy: true
      }
    });

    // Get returns
    const returns = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'RETURNED'
      },
      include: {
        items: true
      }
    });

    const report = generateXReport(sales, voidedSales, returns, date as string);
    res.json(report);
  } catch (error) {
    console.error('X-Report error:', error);
    res.status(500).json({ error: 'Failed to generate X-Report' });
  }
});

// Z-Report (End of day report - finalizes the day)
router.post('/z-report', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const schema = z.object({
      date: z.string().optional(),
      closingCash: z.number().min(0).optional()
    });

    const { date = new Date().toISOString().split('T')[0], closingCash } = schema.parse(req.body);

    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if Z-report already exists for this date
    const existingZReport = await prisma.zReport.findUnique({
      where: { date: startOfDay }
    });

    if (existingZReport) {
      return res.status(400).json({ 
        error: 'Z-Report already generated for this date',
        report: existingZReport
      });
    }

    // Get all sales for the day
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: { not: 'VOIDED' }
      },
      include: {
        items: true,
        payments: true
      }
    });

    // Calculate totals
    const totals = calculateTotals(sales);

    // Create Z-Report record
    const zReport = await prisma.zReport.create({
      data: {
        date: startOfDay,
        generatedBy: req.user!.userId,
        openingCash: req.body.openingCash || 0,
        closingCash: closingCash ? Math.round(closingCash * 100) : null,
        totalSales: totals.totalSales,
        totalTransactions: totals.transactionCount,
        totalTax: totals.totalTax,
        totalDiscounts: totals.totalDiscounts,
        cashSales: totals.paymentsByMethod['CASH'] || 0,
        mpesaSales: totals.paymentsByMethod['MPESA'] || 0,
        cardSales: totals.paymentsByMethod['CARD'] || 0,
        bankSales: totals.paymentsByMethod['BANK'] || 0,
        creditSales: totals.paymentsByMethod['CREDIT'] || 0,
        reportData: totals as any
      }
    });

    res.json({
      message: 'Z-Report generated successfully',
      report: {
        ...zReport,
        details: totals
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Z-Report error:', error);
    res.status(500).json({ error: 'Failed to generate Z-Report' });
  }
});

// Get Z-Report history
router.get('/z-reports', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { page = '1', limit = '30', from, to } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }

    const [reports, total] = await Promise.all([
      prisma.zReport.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { date: 'desc' },
        include: {
          generatedByUser: {
            select: { name: true }
          }
        }
      }),
      prisma.zReport.count({ where })
    ]);

    res.json({
      reports,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get Z-Reports error:', error);
    res.status(500).json({ error: 'Failed to fetch Z-Reports' });
  }
});

// Sales report with date range
router.get('/sales', authenticate, async (req, res) => {
  try {
    const { from, to, groupBy = 'day' } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required' });
    }

    const startDate = new Date(from as string);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(to as string);
    endDate.setHours(23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: { not: 'VOIDED' }
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, category: true }
            }
          }
        },
        payments: true,
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const report = generateSalesReport(sales, groupBy as string);
    res.json(report);
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
});

// Product performance report
router.get('/products', authenticate, async (req, res) => {
  try {
    const { from, to, limit = '50' } = req.query;

    const startDate = from ? new Date(from as string) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = to ? new Date(to as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          status: { not: 'VOIDED' }
        }
      },
      include: {
        product: {
          select: { name: true, sku: true, category: true }
        },
        sale: {
          select: { createdAt: true }
        }
      }
    });

    // Aggregate by product
    const productMap = new Map();
    saleItems.forEach(item => {
      const key = item.productId;
      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: key,
          name: item.product.name,
          sku: item.product.sku,
          category: item.product.category,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          transactions: 0
        });
      }
      const p = productMap.get(key);
      p.quantity += item.quantity;
      p.revenue += item.total;
      p.cost += item.costAtTime * item.quantity;
      p.profit += item.total - (item.costAtTime * item.quantity);
      p.transactions++;
    });

    const products = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, parseInt(limit as string));

    res.json({
      period: { from: startDate, to: endDate },
      products,
      summary: {
        totalProducts: productMap.size,
        totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
        totalRevenue: products.reduce((sum, p) => sum + p.revenue, 0),
        totalProfit: products.reduce((sum, p) => sum + p.profit, 0)
      }
    });
  } catch (error) {
    console.error('Product report error:', error);
    res.status(500).json({ error: 'Failed to generate product report' });
  }
});

// Cashier performance report
router.get('/cashiers', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { from, to } = req.query;

    const startDate = from ? new Date(from as string) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = to ? new Date(to as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: { not: 'VOIDED' }
      },
      include: {
        payments: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Aggregate by cashier
    const cashierMap = new Map();
    sales.forEach(sale => {
      const key = sale.userId;
      if (!cashierMap.has(key)) {
        cashierMap.set(key, {
          userId: key,
          name: sale.user.name,
          email: sale.user.email,
          sales: 0,
          revenue: 0,
          items: 0,
          averageSale: 0,
          byMethod: {} as Record<string, number>
        });
      }
      const c = cashierMap.get(key);
      c.sales++;
      c.revenue += sale.total;
      c.items += sale.items?.length || 0;
      sale.payments.forEach(p => {
        c.byMethod[p.method] = (c.byMethod[p.method] || 0) + p.amount;
      });
    });

    const cashiers = Array.from(cashierMap.values()).map(c => ({
      ...c,
      averageSale: c.sales > 0 ? Math.round(c.revenue / c.sales) : 0
    }));

    res.json({
      period: { from: startDate, to: endDate },
      cashiers,
      summary: {
        totalCashiers: cashiers.length,
        totalSales: cashiers.reduce((sum, c) => sum + c.sales, 0),
        totalRevenue: cashiers.reduce((sum, c) => sum + c.revenue, 0)
      }
    });
  } catch (error) {
    console.error('Cashier report error:', error);
    res.status(500).json({ error: 'Failed to generate cashier report' });
  }
});

// Inventory valuation report
router.get('/inventory', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        quantity: true,
        costPrice: true,
        price: true
      }
    });

    const valuation = products.map(p => ({
      ...p,
      stockValue: p.quantity * p.costPrice,
      retailValue: p.quantity * p.price,
      potentialProfit: (p.quantity * p.price) - (p.quantity * p.costPrice)
    }));

    res.json({
      generatedAt: new Date(),
      summary: {
        totalProducts: products.length,
        totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
        totalStockValue: valuation.reduce((sum, p) => sum + p.stockValue, 0),
        totalRetailValue: valuation.reduce((sum, p) => sum + p.retailValue, 0),
        totalPotentialProfit: valuation.reduce((sum, p) => sum + p.potentialProfit, 0)
      },
      byCategory: Object.entries(
        valuation.reduce((acc, p) => {
          if (!acc[p.category]) {
            acc[p.category] = { count: 0, quantity: 0, value: 0 };
          }
          acc[p.category].count++;
          acc[p.category].quantity += p.quantity;
          acc[p.category].value += p.stockValue;
          return acc;
        }, {} as Record<string, any>)
      ).map(([category, data]) => ({ category, ...data })),
      lowStock: valuation
        .filter(p => p.quantity <= 10)
        .sort((a, b) => a.quantity - b.quantity)
    });
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

// Helper functions
function generateXReport(sales: any[], voidedSales: any[], returns: any[], date: string) {
  const totals = calculateTotals(sales);

  return {
    reportType: 'X-REPORT',
    date,
    generatedAt: new Date(),
    isFinal: false,
    summary: {
      totalSales: totals.totalSales,
      transactionCount: totals.transactionCount,
      averageTransaction: totals.averageTransaction,
      totalTax: totals.totalTax,
      totalDiscounts: totals.totalDiscounts,
      itemCount: totals.itemCount
    },
    paymentsByMethod: totals.paymentsByMethod,
    byCategory: totals.byCategory,
    hourlyBreakdown: totals.hourlyBreakdown,
    voidedTransactions: {
      count: voidedSales.length,
      amount: voidedSales.reduce((sum, s) => sum + s.total, 0),
      transactions: voidedSales.map(s => ({
        receiptNumber: s.receiptNumber,
        amount: s.total,
        voidedAt: s.voidedAt,
        voidedBy: s.voidedBy
      }))
    },
    returns: {
      count: returns.length,
      amount: returns.reduce((sum, r) => sum + r.total, 0)
    }
  };
}

function calculateTotals(sales: any[]) {
  const paymentsByMethod: Record<string, number> = {};
  const byCategory: Record<string, { quantity: number; amount: number }> = {};
  const hourlyBreakdown: Record<string, { sales: number; count: number }> = {};

  let totalTax = 0;
  let totalDiscounts = 0;
  let itemCount = 0;

  sales.forEach(sale => {
    // Payments
    sale.payments.forEach((payment: any) => {
      paymentsByMethod[payment.method] = (paymentsByMethod[payment.method] || 0) + payment.amount;
    });

    // Items by category
    sale.items.forEach((item: any) => {
      const category = item.category || 'Uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = { quantity: 0, amount: 0 };
      }
      byCategory[category].quantity += item.quantity;
      byCategory[category].amount += item.total;
      itemCount += item.quantity;
    });

    // Hourly
    const hour = new Date(sale.createdAt).getHours();
    const hourKey = `${hour.toString().padStart(2, '0')}:00`;
    if (!hourlyBreakdown[hourKey]) {
      hourlyBreakdown[hourKey] = { sales: 0, count: 0 };
    }
    hourlyBreakdown[hourKey].sales += sale.total;
    hourlyBreakdown[hourKey].count++;

    totalTax += sale.taxAmount || 0;
    totalDiscounts += sale.discountAmount || 0;
  });

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);

  return {
    totalSales,
    transactionCount: sales.length,
    averageTransaction: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
    totalTax,
    totalDiscounts,
    itemCount,
    paymentsByMethod,
    byCategory,
    hourlyBreakdown: Object.entries(hourlyBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, data]) => ({ hour, ...data }))
  };
}

function generateSalesReport(sales: any[], groupBy: string) {
  const grouped: Record<string, any> = {};

  sales.forEach(sale => {
    let key: string;
    const date = new Date(sale.createdAt);

    switch (groupBy) {
      case 'hour':
        key = `${date.toISOString().split('T')[0]} ${date.getHours().toString().padStart(2, '0')}:00`;
        break;
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        break;
      default:
        key = date.toISOString().split('T')[0];
    }

    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        sales: 0,
        revenue: 0,
        tax: 0,
        discounts: 0,
        items: 0
      };
    }

    grouped[key].sales++;
    grouped[key].revenue += sale.total;
    grouped[key].tax += sale.taxAmount || 0;
    grouped[key].discounts += sale.discountAmount || 0;
    grouped[key].items += sale.items?.length || 0;
  });

  return {
    groupBy,
    data: Object.values(grouped).sort((a: any, b: any) => a.period.localeCompare(b.period)),
    summary: {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
      totalTax: sales.reduce((sum, s) => sum + (s.taxAmount || 0), 0),
      totalDiscounts: sales.reduce((sum, s) => sum + (s.discountAmount || 0), 0)
    }
  };
}

export default router;
