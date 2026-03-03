import { Router } from 'express';
import { PrismaClient, ShiftStatus } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { AuditService } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
const audit = new AuditService();

// Get current shift for user
router.get('/current', authenticate, async (req, res) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: {
        userId: req.user!.userId,
        status: 'OPEN'
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        _count: {
          select: { sales: true }
        }
      }
    });

    if (!shift) {
      return res.json(null);
    }

    // Calculate current totals
    const sales = await prisma.sale.findMany({
      where: {
        shiftId: shift.id,
        status: { not: 'VOIDED' }
      },
      include: { payments: true }
    });

    const totals = sales.reduce((acc, sale) => {
      acc.totalSales += sale.total;
      sale.payments.forEach(payment => {
        acc.paymentsByMethod[payment.method] = (acc.paymentsByMethod[payment.method] || 0) + payment.amount;
      });
      return acc;
    }, { totalSales: 0, paymentsByMethod: {} as Record<string, number> });

    res.json({
      ...shift,
      currentTotals: totals
    });
  } catch (error) {
    console.error('Get current shift error:', error);
    res.status(500).json({ error: 'Failed to fetch current shift' });
  }
});

// Start shift (clock in)
router.post('/start', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      openingCash: z.number().min(0),
      notes: z.string().optional()
    });

    const { openingCash, notes } = schema.parse(req.body);

    // Check if user already has an open shift
    const existingShift = await prisma.shift.findFirst({
      where: {
        userId: req.user!.userId,
        status: 'OPEN'
      }
    });

    if (existingShift) {
      return res.status(400).json({ error: 'You already have an open shift' });
    }

    const shift = await prisma.shift.create({
      data: {
        userId: req.user!.userId,
        openingCash: Math.round(openingCash * 100),
        notes,
        status: 'OPEN'
      },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'SHIFT_START',
      entityType: 'Shift',
      entityId: shift.id,
      details: { openingCash }
    });

    res.status(201).json(shift);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Start shift error:', error);
    res.status(500).json({ error: 'Failed to start shift' });
  }
});

// End shift (clock out)
router.post('/:id/end', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      closingCash: z.number().min(0),
      notes: z.string().optional()
    });

    const { closingCash, notes } = schema.parse(req.body);

    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: {
        sales: {
          where: { status: { not: 'VOIDED' } },
          include: { payments: true }
        }
      }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (shift.userId !== req.user!.userId && req.user!.role === 'CASHIER') {
      return res.status(403).json({ error: 'Cannot end another user\'s shift' });
    }

    if (shift.status !== 'OPEN') {
      return res.status(400).json({ error: 'Shift is already closed' });
    }

    // Calculate expected cash
    const cashSales = shift.sales.reduce((total, sale) => {
      const cashPayment = sale.payments.find(p => p.method === 'CASH');
      return total + (cashPayment?.amount || 0);
    }, 0);

    const expectedCash = shift.openingCash + cashSales;
    const cashDifference = Math.round(closingCash * 100) - expectedCash;

    const updatedShift = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        closingCash: Math.round(closingCash * 100),
        expectedCash,
        cashDifference,
        closedAt: new Date(),
        status: 'CLOSED',
        notes: notes ? `${shift.notes || ''}\n${notes}` : shift.notes
      },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'SHIFT_END',
      entityType: 'Shift',
      entityId: shift.id,
      details: { 
        openingCash: shift.openingCash,
        closingCash: Math.round(closingCash * 100),
        expectedCash,
        cashDifference,
        salesCount: shift.sales.length
      }
    });

    res.json(updatedShift);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('End shift error:', error);
    res.status(500).json({ error: 'Failed to end shift' });
  }
});

// Get shift history
router.get('/', authenticate, async (req, res) => {
  try {
    const { userId, status, page = '1', limit = '20', from, to } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    
    if (userId) where.userId = userId as string;
    if (status) where.status = status as ShiftStatus;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    // Cashiers can only see their own shifts
    if (req.user!.role === 'CASHIER') {
      where.userId = req.user!.userId;
    }

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, email: true }
          },
          _count: {
            select: { sales: true }
          }
        }
      }),
      prisma.shift.count({ where })
    ]);

    res.json({
      shifts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Get shift details with sales
router.get('/:id', authenticate, async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { name: true, email: true }
        },
        sales: {
          where: { status: { not: 'VOIDED' } },
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, sku: true }
                }
              }
            },
            payments: true,
            customer: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    // Cashiers can only view their own shifts
    if (req.user!.role === 'CASHIER' && shift.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate summary
    const summary = shift.sales.reduce((acc, sale) => {
      acc.totalSales += sale.total;
      acc.itemCount += sale.items.reduce((sum, item) => sum + item.quantity, 0);
      sale.payments.forEach(payment => {
        if (!acc.byMethod[payment.method]) {
          acc.byMethod[payment.method] = 0;
        }
        acc.byMethod[payment.method] += payment.amount;
      });
      return acc;
    }, { totalSales: 0, itemCount: 0, byMethod: {} as Record<string, number> });

    res.json({
      ...shift,
      summary
    });
  } catch (error) {
    console.error('Get shift details error:', error);
    res.status(500).json({ error: 'Failed to fetch shift details' });
  }
});

// Get shift report (X-Report style)
router.get('/:id/report', authenticate, async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { name: true } },
        sales: {
          where: { status: { not: 'VOIDED' } },
          include: {
            items: true,
            payments: true
          }
        }
      }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    // Cashiers can only view their own shift reports
    if (req.user!.role === 'CASHIER' && shift.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const report = generateShiftReport(shift);
    res.json(report);
  } catch (error) {
    console.error('Get shift report error:', error);
    res.status(500).json({ error: 'Failed to generate shift report' });
  }
});

function generateShiftReport(shift: any) {
  const sales = shift.sales;
  
  // Payment method breakdown
  const paymentsByMethod: Record<string, { count: number; amount: number }> = {};
  
  // Category breakdown
  const byCategory: Record<string, { quantity: number; amount: number }> = {};
  
  // Hourly breakdown
  const hourly: Record<string, { sales: number; count: number }> = {};

  let totalDiscounts = 0;
  let totalTax = 0;

  sales.forEach((sale: any) => {
    // Payments
    sale.payments.forEach((payment: any) => {
      if (!paymentsByMethod[payment.method]) {
        paymentsByMethod[payment.method] = { count: 0, amount: 0 };
      }
      paymentsByMethod[payment.method].count++;
      paymentsByMethod[payment.method].amount += payment.amount;
    });

    // Items by category
    sale.items.forEach((item: any) => {
      const category = item.category || 'Uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = { quantity: 0, amount: 0 };
      }
      byCategory[category].quantity += item.quantity;
      byCategory[category].amount += item.total;
    });

    // Hourly
    const hour = new Date(sale.createdAt).getHours();
    const hourKey = `${hour.toString().padStart(2, '0')}:00`;
    if (!hourly[hourKey]) {
      hourly[hourKey] = { sales: 0, count: 0 };
    }
    hourly[hourKey].sales += sale.total;
    hourly[hourKey].count++;

    totalDiscounts += sale.discountAmount || 0;
    totalTax += sale.taxAmount || 0;
  });

  const totalSales = sales.reduce((sum: number, s: any) => sum + s.total, 0);
  const cashSales = paymentsByMethod['CASH']?.amount || 0;

  return {
    shiftId: shift.id,
    cashier: shift.user.name,
    openedAt: shift.createdAt,
    closedAt: shift.closedAt,
    status: shift.status,
    openingCash: shift.openingCash,
    closingCash: shift.closingCash,
    expectedCash: shift.expectedCash,
    cashDifference: shift.cashDifference,
    summary: {
      totalSales,
      transactionCount: sales.length,
      averageTransaction: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
      totalDiscounts,
      totalTax,
      itemCount: sales.reduce((sum: number, s: any) => sum + s.items.length, 0)
    },
    paymentsByMethod,
    byCategory,
    hourly: Object.entries(hourly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, data]) => ({ hour, ...data }))
  };
}

export default router;
