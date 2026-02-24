import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { AuditService } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
const audit = new AuditService();

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('Kenya'),
  loyaltyPoints: z.number().int().min(0).default(0),
  loyaltyTier: z.enum(['NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).default('NONE'),
  creditLimit: z.number().min(0).default(0),
  outstandingBalance: z.number().min(0).default(0),
  notes: z.string().optional(),
});

// Get all customers with search and pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, page = '1', limit = '50', tier } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }
    
    if (tier) {
      where.loyaltyTier = tier;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { sales: true }
          }
        }
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      customers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            receiptNumber: true,
            total: true,
            createdAt: true,
            status: true
          }
        },
        loyaltyHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create customer
router.post('/', authenticate, async (req, res) => {
  try {
    const data = customerSchema.parse(req.body);
    
    const customer = await prisma.customer.create({
      data: {
        ...data,
        creditLimit: Math.round(data.creditLimit * 100),
        outstandingBalance: Math.round(data.outstandingBalance * 100),
      }
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'CUSTOMER_CREATE',
      entityType: 'Customer',
      entityId: customer.id,
      details: { name: customer.name }
    });

    res.status(201).json(customer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', authenticate, async (req, res) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    
    const updateData: any = { ...data };
    if (data.creditLimit !== undefined) {
      updateData.creditLimit = Math.round(data.creditLimit * 100);
    }
    if (data.outstandingBalance !== undefined) {
      updateData.outstandingBalance = Math.round(data.outstandingBalance * 100);
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: updateData
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'CUSTOMER_UPDATE',
      entityType: 'Customer',
      entityId: customer.id,
      details: { name: customer.name }
    });

    res.json(customer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { sales: true } } }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (customer._count.sales > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete customer with sales history',
        salesCount: customer._count.sales
      });
    }

    await prisma.customer.delete({ where: { id: req.params.id } });

    await audit.log({
      userId: req.user!.userId,
      action: 'CUSTOMER_DELETE',
      entityType: 'Customer',
      entityId: req.params.id,
      details: { name: customer.name }
    });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Add loyalty points
router.post('/:id/loyalty', authenticate, async (req, res) => {
  try {
    const { points, reason } = z.object({
      points: z.number().int(),
      reason: z.string()
    }).parse(req.body);

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: req.params.id },
        data: {
          loyaltyPoints: { increment: points }
        }
      });

      await tx.loyaltyHistory.create({
        data: {
          customerId: req.params.id,
          points,
          type: points >= 0 ? 'EARNED' : 'REDEEMED',
          reason,
          saleId: req.body.saleId
        }
      });

      return updated;
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'LOYALTY_ADJUST',
      entityType: 'Customer',
      entityId: customer.id,
      details: { points, reason, newBalance: customer.loyaltyPoints }
    });

    res.json(customer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Loyalty adjustment error:', error);
    res.status(500).json({ error: 'Failed to adjust loyalty points' });
  }
});

// Get customer statement
router.get('/:id/statement', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    
    const sales = await prisma.sale.findMany({
      where: {
        customerId: req.params.id,
        createdAt: {
          gte: from ? new Date(from as string) : undefined,
          lte: to ? new Date(to as string) : undefined
        },
        status: { not: 'VOIDED' }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        payments: true
      }
    });

    const payments = await prisma.debtorPayment.findMany({
      where: {
        customerId: req.params.id,
        createdAt: {
          gte: from ? new Date(from as string) : undefined,
          lte: to ? new Date(to as string) : undefined
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      select: { name: true, outstandingBalance: true, creditLimit: true }
    });

    res.json({
      customer,
      transactions: [
        ...sales.map(s => ({
          date: s.createdAt,
          type: 'SALE',
          reference: s.receiptNumber,
          debit: s.total,
          credit: 0,
          balance: 0
        })),
        ...payments.map(p => ({
          date: p.createdAt,
          type: 'PAYMENT',
          reference: p.reference,
          debit: 0,
          credit: p.amount,
          balance: 0
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    });
  } catch (error) {
    console.error('Get statement error:', error);
    res.status(500).json({ error: 'Failed to generate statement' });
  }
});

export default router;
