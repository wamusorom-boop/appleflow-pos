import { Router } from 'express';
import { PrismaClient, PaymentMethod, SaleStatus } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { AuditService } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
const audit = new AuditService();

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discountAmount: z.number().nonnegative().default(0)
});

const paymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().positive(),
  reference: z.string().optional(),
  mpesaReceipt: z.string().optional()
});

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  payments: z.array(paymentSchema).min(1, 'At least one payment is required'),
  customerId: z.string().optional(),
  discountAmount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  shiftId: z.string().optional()
});

// GET /sales - List sales
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = '1',
      limit = '50',
      from,
      to,
      status,
      customerId,
      userId
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    if (status) where.status = status as SaleStatus;
    if (customerId) where.customerId = customerId as string;
    if (userId) where.userId = userId as string;

    // Cashiers can only see their own sales
    if (req.user!.role === 'CASHIER') {
      where.userId = req.user!.userId;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: parseInt(limit as string),
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
            select: { name: true, phone: true }
          },
          user: {
            select: { name: true }
          }
        }
      }),
      prisma.sale.count({ where })
    ]);

    res.json({
      success: true,
      data: sales,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales'
    });
  }
});

// GET /sales/:id - Get sale details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, sku: true, barcode: true }
            }
          }
        },
        payments: true,
        customer: true,
        user: {
          select: { name: true }
        },
        shift: {
          select: { id: true, createdAt: true }
        }
      }
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    // Cashiers can only view their own sales
    if (req.user!.role === 'CASHIER' && sale.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sale'
    });
  }
});

// POST /sales - Create sale
router.post('/', authenticate, async (req, res) => {
  try {
    const data = saleSchema.parse(req.body);

    // Validate products and calculate totals
    let subtotal = 0;
    const saleItems = [];

    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product ${item.productId} not found`
        });
      }

      if (product.quantity < item.quantity) {
        return res.status(422).json({
          success: false,
          error: `Insufficient stock for ${product.name}`,
          details: {
            product: product.name,
            available: product.quantity,
            requested: item.quantity
          }
        });
      }

      const itemTotal = (item.unitPrice * item.quantity) - item.discountAmount;
      subtotal += itemTotal;

      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Math.round(item.unitPrice * 100),
        costAtTime: product.costPrice,
        discountAmount: Math.round(item.discountAmount * 100),
        total: Math.round(itemTotal * 100),
        category: product.category
      });
    }

    // Validate payment total
    const paymentTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
    const total = subtotal - data.discountAmount + data.taxAmount;

    if (Math.abs(paymentTotal - total) > 0.01) {
      return res.status(422).json({
        success: false,
        error: 'Payment amount does not match sale total',
        details: {
          expected: total,
          received: paymentTotal
        }
      });
    }

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}`;

    // Create sale in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          receiptNumber,
          userId: req.user!.userId,
          customerId: data.customerId,
          shiftId: data.shiftId,
          subtotal: Math.round(subtotal * 100),
          taxAmount: Math.round(data.taxAmount * 100),
          discountAmount: Math.round(data.discountAmount * 100),
          total: Math.round(total * 100),
          status: 'COMPLETED',
          notes: data.notes,
          items: {
            create: saleItems
          },
          payments: {
            create: data.payments.map(p => ({
              method: p.method,
              amount: Math.round(p.amount * 100),
              reference: p.reference,
              mpesaReceipt: p.mpesaReceipt
            }))
          }
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, sku: true }
              }
            }
          },
          payments: true
        }
      });

      // Update product quantities
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity }
          }
        });
      }

      // Update customer loyalty if applicable
      if (data.customerId) {
        const loyaltyPoints = Math.floor(total / 100); // 1 point per 100 spent
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            loyaltyPoints: { increment: loyaltyPoints }
          }
        });
      }

      return newSale;
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'SALE_CREATE',
      entityType: 'Sale',
      entityId: sale.id,
      details: {
        receiptNumber: sale.receiptNumber,
        total: sale.total,
        itemCount: sale.items.length
      }
    });

    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sale'
    });
  }
});

// POST /sales/:id/void - Void sale
router.post('/:id/void', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { reason } = z.object({
      reason: z.string().min(1, 'Reason is required')
    }).parse(req.body);

    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    if (sale.status === 'VOIDED') {
      return res.status(400).json({
        success: false,
        error: 'Sale is already voided'
      });
    }

    await prisma.$transaction(async (tx) => {
      // Void the sale
      await tx.sale.update({
        where: { id: req.params.id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidedBy: req.user!.userId,
          voidReason: reason
        }
      });

      // Return stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: item.quantity }
          }
        });
      }
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'SALE_VOID',
      entityType: 'Sale',
      entityId: sale.id,
      details: {
        receiptNumber: sale.receiptNumber,
        reason,
        amount: sale.total
      }
    });

    res.json({
      success: true,
      message: 'Sale voided successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Void sale error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to void sale'
    });
  }
});

// POST /sales/:id/reprint - Reprint receipt
router.post('/:id/reprint', authenticate, async (req, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
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
          select: { name: true, phone: true }
        },
        user: {
          select: { name: true }
        }
      }
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    // Log reprint
    await audit.log({
      userId: req.user!.userId,
      action: 'RECEIPT_REPRINT',
      entityType: 'Sale',
      entityId: sale.id,
      details: {
        receiptNumber: sale.receiptNumber,
        originalUser: sale.userId
      }
    });

    res.json({
      success: true,
      data: sale,
      message: 'Receipt reprinted'
    });
  } catch (error) {
    console.error('Reprint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reprint receipt'
    });
  }
});

export { router as salesRouter };
