/**
 * AppleFlow POS - Sales Routes
 * Process sales, handle payments, and manage transactions
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const saleItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  method: z.enum(['cash', 'mpesa', 'card', 'bank_transfer', 'cheque', 'gift_card', 'store_credit', 'loyalty_points']),
  amount: z.number().positive(),
  reference: z.string().optional(),
  mpesaCode: z.string().optional(),
  mpesaPhone: z.string().optional(),
  cardLast4: z.string().optional(),
  cardType: z.string().optional(),
});

const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  payments: z.array(paymentSchema).min(1, 'At least one payment is required'),
  discountTotal: z.number().min(0).default(0),
  notes: z.string().optional(),
  saleType: z.enum(['instore', 'online', 'phone', 'delivery', 'pickup']).default('instore'),
  tableId: z.string().uuid().optional(),
  guests: z.number().int().positive().optional(),
});

const voidSaleSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * GET /api/sales
 * List sales with pagination and filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId;

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const status = req.query.status as string;
  const customerId = req.query.customerId as string;
  const userId = req.query.userId as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let query = supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, full_name, phone),
      user:user_profiles(id, full_name),
      items:sale_items(*, product:products(id, name, sku)),
      payments:payments(*)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: sales, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch sales', { error, tenantId });
    throw new Error('Failed to fetch sales');
  }

  res.json({
    success: true,
    data: {
      sales: sales || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    },
  });
}));

/**
 * GET /api/sales/:id
 * Get a single sale by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { id } = req.params;

  const { data: sale, error } = await supabase
    .from('sales')
    .select(`
      *,
      customer:customers(*),
      user:user_profiles(id, full_name, email),
      store:stores(id, name),
      items:sale_items(*, product:products(id, name, sku)),
      payments:payments(*)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !sale) {
    throw new NotFoundError('Sale');
  }

  res.json({
    success: true,
    data: { sale },
  });
}));

/**
 * POST /api/sales
 * Create a new sale
 */
router.post('/', requirePermission('sales:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const storeId = (req as any).user?.storeId || req.body.storeId;

  if (!storeId) {
    throw new ValidationError('Store ID is required');
  }

  // Validate input
  const result = createSaleSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid sale data', { errors: result.error.errors });
  }

  const data = result.data;

  // Calculate totals
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = data.discountTotal;

  const saleItems = [];

  for (const item of data.items) {
    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = item.discountAmount || (itemSubtotal * (item.discountPercent / 100));
    const itemTaxableAmount = itemSubtotal - itemDiscount;
    const itemTax = itemTaxableAmount * (item.taxRate / 100);

    subtotal += itemSubtotal;
    discountTotal += itemDiscount;
    taxTotal += itemTax;

    saleItems.push({
      product_id: item.productId,
      variant_id: item.variantId,
      product_name: '', // Will be filled after product lookup
      sku: '',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent,
      discount_amount: itemDiscount,
      tax_rate: item.taxRate,
      tax_amount: itemTax,
      total: itemTaxableAmount + itemTax,
      serial_number: item.serialNumber,
      notes: item.notes,
    });
  }

  const total = subtotal - discountTotal + taxTotal;

  // Validate payment total matches sale total
  const paymentTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
  if (Math.abs(paymentTotal - total) > 0.01) {
    throw new ValidationError('Payment total does not match sale total');
  }

  // Check inventory for each item
  for (const item of data.items) {
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('quantity, available_quantity')
      .eq('product_id', item.productId)
      .eq('store_id', storeId)
      .single();

    if (inventoryError || !inventory) {
      throw new ValidationError(`Product ${item.productId} not found in inventory`);
    }

    if (inventory.available_quantity < item.quantity) {
      throw new ValidationError(`Insufficient stock for product ${item.productId}`);
    }

    // Get product details
    const { data: product } = await supabase
      .from('products')
      .select('name, sku')
      .eq('id', item.productId)
      .single();

    if (product) {
      const saleItem = saleItems.find(si => si.product_id === item.productId);
      if (saleItem) {
        saleItem.product_name = product.name;
        saleItem.sku = product.sku;
      }
    }
  }

  // Create sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      tenant_id: tenantId,
      store_id: storeId,
      customer_id: data.customerId,
      user_id: userId,
      subtotal,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total,
      status: 'completed',
      sale_type: data.saleType,
      table_id: data.tableId,
      guests: data.guests,
      notes: data.notes,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (saleError || !sale) {
    logger.error('Failed to create sale', { error: saleError, tenantId });
    throw new Error('Failed to create sale');
  }

  // Create sale items
  const saleItemsWithSaleId = saleItems.map(item => ({
    ...item,
    tenant_id: tenantId,
    sale_id: sale.id,
  }));

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItemsWithSaleId);

  if (itemsError) {
    logger.error('Failed to create sale items', { error: itemsError, saleId: sale.id });
    // Rollback sale
    await supabase.from('sales').delete().eq('id', sale.id);
    throw new Error('Failed to create sale items');
  }

  // Create payments
  const paymentsWithSaleId = data.payments.map(payment => ({
    tenant_id: tenantId,
    sale_id: sale.id,
    method: payment.method,
    amount: payment.amount,
    reference: payment.reference,
    mpesa_code: payment.mpesaCode,
    mpesa_phone: payment.mpesaPhone,
    card_last4: payment.cardLast4,
    card_type: payment.cardType,
    status: 'completed',
  }));

  const { error: paymentsError } = await supabase
    .from('payments')
    .insert(paymentsWithSaleId);

  if (paymentsError) {
    logger.error('Failed to create payments', { error: paymentsError, saleId: sale.id });
    // Rollback
    await supabase.from('sale_items').delete().eq('sale_id', sale.id);
    await supabase.from('sales').delete().eq('id', sale.id);
    throw new Error('Failed to create payments');
  }

  // Update inventory
  for (const item of data.items) {
    // Get current inventory
    const { data: currentInventory } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.productId)
      .eq('store_id', storeId)
      .single();

    const currentQty = currentInventory?.quantity || 0;
    const newQty = currentQty - item.quantity;

    // Update inventory
    await supabase
      .from('inventory')
      .upsert({
        tenant_id: tenantId,
        store_id: storeId,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,store_id,product_id,variant_id',
      });

    // Create stock movement
    await supabase.from('stock_movements').insert({
      tenant_id: tenantId,
      store_id: storeId,
      product_id: item.productId,
      variant_id: item.variantId,
      movement_type: 'sale',
      quantity: item.quantity,
      previous_quantity: currentQty,
      new_quantity: newQty,
      reference_type: 'sale',
      reference_id: sale.id,
      created_by: userId,
    });
  }

  // Update customer stats if customer exists
  if (data.customerId) {
    await supabase.rpc('update_customer_stats', {
      p_customer_id: data.customerId,
      p_amount: total,
    });
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'SALE_CREATED',
    entity_type: 'SALE',
    entity_id: sale.id,
    description: `Created sale: ${sale.receipt_number} for ${total}`,
    new_values: sale,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('Sale created', { saleId: sale.id, receiptNumber: sale.receipt_number, total, tenantId });

  res.status(201).json({
    success: true,
    data: { sale },
  });
}));

/**
 * POST /api/sales/:id/void
 * Void a sale
 */
router.post('/:id/void', requirePermission('sales:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  // Validate input
  const result = voidSaleSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid void data', { errors: result.error.errors });
  }

  const { reason } = result.data;

  // Get sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (saleError || !sale) {
    throw new NotFoundError('Sale');
  }

  if (sale.status === 'voided') {
    throw new ConflictError('Sale is already voided');
  }

  // Void the sale
  const { error: voidError } = await supabase
    .from('sales')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      voided_by: userId,
      void_reason: reason,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (voidError) {
    logger.error('Failed to void sale', { error: voidError, saleId: id });
    throw new Error('Failed to void sale');
  }

  // Restore inventory
  for (const item of sale.items) {
    const { data: currentInventory } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('store_id', sale.store_id)
      .single();

    const currentQty = currentInventory?.quantity || 0;
    const newQty = currentQty + item.quantity;

    await supabase
      .from('inventory')
      .upsert({
        tenant_id: tenantId,
        store_id: sale.store_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,store_id,product_id,variant_id',
      });

    // Create stock movement
    await supabase.from('stock_movements').insert({
      tenant_id: tenantId,
      store_id: sale.store_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      movement_type: 'return',
      quantity: item.quantity,
      previous_quantity: currentQty,
      new_quantity: newQty,
      reference_type: 'sale_void',
      reference_id: sale.id,
      reason: `Sale voided: ${reason}`,
      created_by: userId,
    });
  }

  // Reverse customer stats if customer exists
  if (sale.customer_id) {
    await supabase.rpc('update_customer_stats', {
      p_customer_id: sale.customer_id,
      p_amount: -sale.total,
    });
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'SALE_VOIDED',
    entity_type: 'SALE',
    entity_id: id,
    description: `Voided sale: ${sale.receipt_number}. Reason: ${reason}`,
    old_values: sale,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('Sale voided', { saleId: id, receiptNumber: sale.receipt_number, reason, tenantId });

  res.json({
    success: true,
    message: 'Sale voided successfully',
  });
}));

/**
 * GET /api/sales/receipt/:receiptNumber
 * Get sale by receipt number
 */
router.get('/receipt/:receiptNumber', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { receiptNumber } = req.params;

  const { data: sale, error } = await supabase
    .from('sales')
    .select(`
      *,
      customer:customers(*),
      user:user_profiles(id, full_name),
      items:sale_items(*, product:products(id, name, sku)),
      payments:payments(*)
    `)
    .eq('receipt_number', receiptNumber)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !sale) {
    throw new NotFoundError('Sale');
  }

  res.json({
    success: true,
    data: { sale },
  });
}));

export { router as saleRouter };
