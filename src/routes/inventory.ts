import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { z } from 'zod';
import { AuditService } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();
const audit = new AuditService();

// Get all stock adjustments
router.get('/adjustments', authenticate, async (req, res) => {
  try {
    const { page = '1', limit = '50', productId, from, to } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (productId) where.productId = productId as string;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const [adjustments, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { name: true, sku: true }
          },
          user: {
            select: { name: true }
          }
        }
      }),
      prisma.stockAdjustment.count({ where })
    ]);

    res.json({
      adjustments,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get adjustments error:', error);
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
});

// Create stock adjustment
router.post('/adjustments', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const schema = z.object({
      productId: z.string(),
      quantity: z.number().int(),
      type: z.enum(['ADD', 'REMOVE', 'SET', 'DAMAGE', 'EXPIRY', 'THEFT']),
      reason: z.string().min(1, 'Reason is required'),
      notes: z.string().optional(),
      reference: z.string().optional()
    });

    const data = schema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: data.productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Calculate new quantity
    let newQuantity: number;
    switch (data.type) {
      case 'ADD':
        newQuantity = product.quantity + data.quantity;
        break;
      case 'REMOVE':
      case 'DAMAGE':
      case 'EXPIRY':
      case 'THEFT':
        newQuantity = product.quantity - data.quantity;
        break;
      case 'SET':
        newQuantity = data.quantity;
        break;
      default:
        newQuantity = product.quantity;
    }

    if (newQuantity < 0) {
      return res.status(400).json({ 
        error: 'Adjustment would result in negative stock',
        currentQuantity: product.quantity,
        requestedChange: data.quantity,
        wouldResult: newQuantity
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create adjustment record
      const adjustment = await tx.stockAdjustment.create({
        data: {
          productId: data.productId,
          quantity: data.quantity,
          type: data.type,
          reason: data.reason,
          notes: data.notes,
          reference: data.reference,
          previousQuantity: product.quantity,
          newQuantity,
          userId: req.user!.userId
        }
      });

      // Update product quantity
      await tx.product.update({
        where: { id: data.productId },
        data: { quantity: newQuantity }
      });

      return adjustment;
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'STOCK_ADJUST',
      entityType: 'Product',
      entityId: data.productId,
      details: {
        type: data.type,
        quantity: data.quantity,
        previous: product.quantity,
        new: newQuantity,
        reason: data.reason
      }
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create adjustment error:', error);
    res.status(500).json({ error: 'Failed to create adjustment' });
  }
});

// Get stock transfers
router.get('/transfers', authenticate, async (req, res) => {
  try {
    const { page = '1', limit = '50', status, fromLocation, toLocation } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (fromLocation) where.fromLocation = fromLocation as string;
    if (toLocation) where.toLocation = toLocation as string;

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
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
          createdByUser: {
            select: { name: true }
          },
          receivedByUser: {
            select: { name: true }
          }
        }
      }),
      prisma.stockTransfer.count({ where })
    ]);

    res.json({
      transfers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// Create stock transfer
router.post('/transfers', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const schema = z.object({
      fromLocation: z.string().min(1, 'From location is required'),
      toLocation: z.string().min(1, 'To location is required'),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive()
      })).min(1, 'At least one item is required')
    });

    const data = schema.parse(req.body);

    if (data.fromLocation === data.toLocation) {
      return res.status(400).json({ error: 'From and to locations cannot be the same' });
    }

    // Validate stock availability
    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}`,
          available: product.quantity,
          requested: item.quantity
        });
      }
    }

    const transferNumber = `TRF-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create transfer
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromLocation: data.fromLocation,
          toLocation: data.toLocation,
          notes: data.notes,
          status: 'PENDING',
          createdBy: req.user!.userId,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity
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
          }
        }
      });

      // Reserve stock (reduce from source)
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity }
          }
        });
      }

      return transfer;
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'TRANSFER_CREATE',
      entityType: 'StockTransfer',
      entityId: result.id,
      details: {
        transferNumber,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        itemCount: data.items.length
      }
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create transfer error:', error);
    res.status(500).json({ error: 'Failed to create transfer' });
  }
});

// Receive transfer
router.post('/transfers/:id/receive', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { notes } = req.body;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: `Transfer is already ${transfer.status}` });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update transfer status
      const updated = await tx.stockTransfer.update({
        where: { id: req.params.id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receivedBy: req.user!.userId,
          notes: notes ? `${transfer.notes || ''}\nReceived: ${notes}` : transfer.notes
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, sku: true }
              }
            }
          }
        }
      });

      // Add stock to destination (in a real multi-location system)
      // For now, we just log the receipt

      return updated;
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'TRANSFER_RECEIVE',
      entityType: 'StockTransfer',
      entityId: transfer.id,
      details: { transferNumber: transfer.transferNumber }
    });

    res.json(result);
  } catch (error) {
    console.error('Receive transfer error:', error);
    res.status(500).json({ error: 'Failed to receive transfer' });
  }
});

// Cancel transfer
router.post('/transfers/:id/cancel', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { reason } = req.body;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot cancel ${transfer.status} transfer` });
    }

    await prisma.$transaction(async (tx) => {
      // Return stock to source
      for (const item of transfer.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: item.quantity }
          }
        });
      }

      // Update transfer status
      await tx.stockTransfer.update({
        where: { id: req.params.id },
        data: {
          status: 'CANCELLED',
          notes: reason ? `${transfer.notes || ''}\nCancelled: ${reason}` : transfer.notes
        }
      });
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'TRANSFER_CANCEL',
      entityType: 'StockTransfer',
      entityId: transfer.id,
      details: { transferNumber: transfer.transferNumber, reason }
    });

    res.json({ message: 'Transfer cancelled successfully' });
  } catch (error) {
    console.error('Cancel transfer error:', error);
    res.status(500).json({ error: 'Failed to cancel transfer' });
  }
});

// Get purchase orders
router.get('/purchase-orders', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { page = '1', limit = '50', status, supplier } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (supplier) where.supplier = { contains: supplier as string, mode: 'insensitive' };

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
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
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// Create purchase order
router.post('/purchase-orders', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const schema = z.object({
      supplier: z.string().min(1, 'Supplier is required'),
      supplierReference: z.string().optional(),
      expectedDelivery: z.string().datetime().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        unitCost: z.number().positive()
      })).min(1, 'At least one item is required')
    });

    const data = schema.parse(req.body);

    const orderNumber = `PO-${Date.now()}`;
    const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplier: data.supplier,
        supplierReference: data.supplierReference,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
        notes: data.notes,
        status: 'DRAFT',
        totalAmount: Math.round(totalAmount * 100),
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: Math.round(item.unitCost * 100),
            totalCost: Math.round(item.quantity * item.unitCost * 100)
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
        }
      }
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'PO_CREATE',
      entityType: 'PurchaseOrder',
      entityId: order.id,
      details: { orderNumber, supplier: data.supplier, totalAmount }
    });

    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Receive purchase order (GRN)
router.post('/purchase-orders/:id/receive', authenticate, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        itemId: z.string(),
        receivedQuantity: z.number().int().nonnegative(),
        unitCost: z.number().positive().optional()
      })),
      notes: z.string().optional()
    });

    const { items, notes } = schema.parse(req.body);

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Order already fully received' });
    }

    const grnNumber = `GRN-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Create GRN
      const grn = await tx.goodsReceivedNote.create({
        data: {
          grnNumber,
          purchaseOrderId: order.id,
          notes,
          items: {
            create: items.map(item => ({
              orderItemId: item.itemId,
              receivedQuantity: item.receivedQuantity,
              unitCost: item.unitCost ? Math.round(item.unitCost * 100) : undefined
            }))
          }
        }
      });

      // Update order items and product stock
      for (const received of items) {
        const orderItem = order.items.find(i => i.id === received.itemId);
        if (orderItem) {
          // Update received quantity on order item
          await tx.purchaseOrderItem.update({
            where: { id: received.itemId },
            data: {
              receivedQuantity: { increment: received.receivedQuantity }
            }
          });

          // Add stock to product
          await tx.product.update({
            where: { id: orderItem.productId },
            data: {
              quantity: { increment: received.receivedQuantity },
              costPrice: received.unitCost ? Math.round(received.unitCost * 100) : undefined
            }
          });
        }
      }

      // Check if fully received
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id }
      });
      const fullyReceived = updatedItems.every(item => item.receivedQuantity >= item.quantity);

      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: fullyReceived ? 'RECEIVED' : 'PARTIAL',
          receivedAt: fullyReceived ? new Date() : null
        }
      });

      return grn;
    });

    await audit.log({
      userId: req.user!.userId,
      action: 'PO_RECEIVE',
      entityType: 'PurchaseOrder',
      entityId: order.id,
      details: { grnNumber, orderNumber: order.orderNumber }
    });

    res.json({
      message: 'Goods received successfully',
      grn: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Receive PO error:', error);
    res.status(500).json({ error: 'Failed to receive goods' });
  }
});

// Get low stock alerts
router.get('/alerts/low-stock', authenticate, async (req, res) => {
  try {
    const { threshold = '10' } = req.query;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        quantity: {
          lte: parseInt(threshold as string)
        }
      },
      orderBy: { quantity: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        quantity: true,
        reorderPoint: true,
        reorderQuantity: true,
        supplier: true
      }
    });

    res.json({
      threshold: parseInt(threshold as string),
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Low stock alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts' });
  }
});

export default router;
