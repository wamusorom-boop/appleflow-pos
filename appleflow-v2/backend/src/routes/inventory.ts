/**
 * AppleFlow POS - Inventory Routes
 * Stock management and adjustments
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

const adjustmentSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int(),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

/**
 * GET /api/inventory
 * Get inventory levels with filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId || (req.query.storeId as string);

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const lowStock = req.query.lowStock === 'true';
  const search = req.query.search as string;

  let query = supabase
    .from('inventory')
    .select(`
      *,
      product:products(id, name, sku, barcode, selling_price),
      variant:product_variants(*)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  if (search) {
    query = query.or(`product.name.ilike.%${search}%,product.sku.ilike.%${search}%`);
  }

  if (lowStock) {
    query = query.lte('available_quantity', supabase.raw('min_stock_level'));
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: inventory, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch inventory', { error, tenantId });
    throw new Error('Failed to fetch inventory');
  }

  res.json({
    success: true,
    data: {
      inventory: inventory || [],
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
 * GET /api/inventory/low-stock
 * Get low stock alerts
 */
router.get('/low-stock', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId;

  let query = supabase
    .from('inventory')
    .select(`
      *,
      product:products(id, name, sku),
      store:stores(id, name)
    `)
    .eq('tenant_id', tenantId)
    .lte('available_quantity', supabase.raw('min_stock_level'));

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data: lowStock, error } = await query;

  if (error) {
    logger.error('Failed to fetch low stock', { error, tenantId });
    throw new Error('Failed to fetch low stock');
  }

  res.json({
    success: true,
    data: { lowStock: lowStock || [] },
  });
}));

/**
 * POST /api/inventory/adjust
 * Adjust inventory quantity
 */
router.post('/adjust', requirePermission('inventory:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  const result = adjustmentSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid adjustment data', { errors: result.error.errors });
  }

  const data = result.data;

  // Get current inventory
  const { data: currentInventory, error: inventoryError } = await supabase
    .from('inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('store_id', data.storeId)
    .eq('product_id', data.productId)
    .eq('variant_id', data.variantId || null)
    .single();

  const previousQuantity = currentInventory?.quantity || 0;
  const newQuantity = previousQuantity + data.quantity;

  if (newQuantity < 0) {
    throw new ValidationError('Adjustment would result in negative inventory');
  }

  // Upsert inventory
  const { data: inventory, error } = await supabase
    .from('inventory')
    .upsert({
      tenant_id: tenantId,
      store_id: data.storeId,
      product_id: data.productId,
      variant_id: data.variantId,
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,store_id,product_id,variant_id',
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to adjust inventory', { error, tenantId });
    throw new Error('Failed to adjust inventory');
  }

  // Create stock movement
  await supabase.from('stock_movements').insert({
    tenant_id: tenantId,
    store_id: data.storeId,
    product_id: data.productId,
    variant_id: data.variantId,
    movement_type: data.quantity >= 0 ? 'adjustment' : 'adjustment',
    quantity: Math.abs(data.quantity),
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    reason: data.reason,
    notes: data.notes,
    created_by: userId,
  });

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'INVENTORY_ADJUSTED',
    entity_type: 'INVENTORY',
    entity_id: data.productId,
    description: `Inventory adjusted by ${data.quantity > 0 ? '+' : ''}${data.quantity}`,
    old_values: { quantity: previousQuantity },
    new_values: { quantity: newQuantity },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { inventory },
  });
}));

/**
 * GET /api/inventory/movements
 * Get stock movement history
 */
router.get('/movements', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId || (req.query.storeId as string);
  const productId = req.query.productId as string;

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  let query = supabase
    .from('stock_movements')
    .select(`
      *,
      product:products(id, name, sku),
      created_by_user:user_profiles(id, full_name)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: movements, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch stock movements', { error, tenantId });
    throw new Error('Failed to fetch stock movements');
  }

  res.json({
    success: true,
    data: {
      movements: movements || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    },
  });
}));

export { router as inventoryRouter };
