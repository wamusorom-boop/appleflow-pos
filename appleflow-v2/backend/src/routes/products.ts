/**
 * AppleFlow POS - Product Routes
 * CRUD operations for products with inventory management
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/auth.js';
import { checkResourceLimit } from '../middleware/tenant.js';

const router = Router();

// Validation schemas
const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.number().min(0, 'Cost price must be positive'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  wholesalePrice: z.number().optional(),
  memberPrice: z.number().optional(),
  taxRate: z.number().min(0).max(100).default(0),
  isTaxInclusive: z.boolean().default(false),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  trackInventory: z.boolean().default(true),
  allowBackorders: z.boolean().default(false),
  productType: z.enum(['standard', 'weighted', 'serialized', 'service', 'combo']).default('standard'),
  unitOfMeasure: z.string().default('piece'),
  weight: z.number().optional(),
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

const inventorySchema = z.object({
  storeId: z.string().uuid(),
  quantity: z.number().int().min(0),
  minStockLevel: z.number().int().min(0).default(10),
  maxStockLevel: z.number().int().optional(),
  reorderPoint: z.number().int().min(0).default(20),
  reorderQuantity: z.number().int().min(0).default(50),
  locationCode: z.string().optional(),
  binNumber: z.string().optional(),
});

/**
 * GET /api/products
 * List all products with pagination and filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const storeId = (req as any).user?.storeId;

  // Query parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const search = req.query.search as string;
  const categoryId = req.query.categoryId as string;
  const isActive = req.query.isActive === 'true' ? true : 
                   req.query.isActive === 'false' ? false : undefined;
  const lowStock = req.query.lowStock === 'true';

  let query = supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name, color),
      brand:brands(id, name),
      inventory:inventory(quantity, available_quantity, min_stock_level, store_id)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  // Apply filters
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  if (storeId) {
    query = query.eq('inventory.store_id', storeId);
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: products, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch products', { error, tenantId });
    throw new Error('Failed to fetch products');
  }

  // Filter low stock if requested
  let filteredProducts = products || [];
  if (lowStock) {
    filteredProducts = filteredProducts.filter((p: any) => {
      const inv = p.inventory?.[0];
      return inv && inv.available_quantity <= inv.min_stock_level;
    });
  }

  res.json({
    success: true,
    data: {
      products: filteredProducts,
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
 * GET /api/products/:id
 * Get a single product by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { id } = req.params;

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(id, name, color),
      brand:brands(id, name),
      inventory:inventory(*),
      variants:product_variants(*)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (error || !product) {
    throw new NotFoundError('Product');
  }

  res.json({
    success: true,
    data: { product },
  });
}));

/**
 * POST /api/products
 * Create a new product
 */
router.post('/', requirePermission('products:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  // Check product limit
  const limitCheck = await checkResourceLimit(tenantId, 'products');
  if (!limitCheck.allowed) {
    throw new ConflictError(`Product limit reached (${limitCheck.current}/${limitCheck.limit})`);
  }

  // Validate input
  const result = productSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid product data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check for duplicate SKU
  const { data: existingSku } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('sku', data.sku)
    .is('deleted_at', null)
    .single();

  if (existingSku) {
    throw new ConflictError(`Product with SKU "${data.sku}" already exists`);
  }

  // Check for duplicate barcode if provided
  if (data.barcode) {
    const { data: existingBarcode } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('barcode', data.barcode)
      .is('deleted_at', null)
      .single();

    if (existingBarcode) {
      throw new ConflictError(`Product with barcode "${data.barcode}" already exists`);
    }
  }

  // Create product
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      tenant_id: tenantId,
      sku: data.sku,
      name: data.name,
      description: data.description,
      barcode: data.barcode,
      cost_price: data.costPrice,
      selling_price: data.sellingPrice,
      wholesale_price: data.wholesalePrice,
      member_price: data.memberPrice,
      tax_rate: data.taxRate,
      is_tax_inclusive: data.isTaxInclusive,
      category_id: data.categoryId,
      brand_id: data.brandId,
      track_inventory: data.trackInventory,
      allow_backorders: data.allowBackorders,
      product_type: data.productType,
      unit_of_measure: data.unitOfMeasure,
      weight: data.weight,
      dimensions: data.dimensions,
      is_active: data.isActive,
      is_featured: data.isFeatured,
      tags: data.tags,
      metadata: data.metadata,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create product', { error, tenantId });
    throw new Error('Failed to create product');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'PRODUCT_CREATED',
    entity_type: 'PRODUCT',
    entity_id: product.id,
    description: `Created product: ${product.name}`,
    new_values: product,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('Product created', { productId: product.id, tenantId });

  res.status(201).json({
    success: true,
    data: { product },
  });
}));

/**
 * PUT /api/products/:id
 * Update a product
 */
router.put('/:id', requirePermission('products:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  // Check if product exists
  const { data: existingProduct, error: existingError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (existingError || !existingProduct) {
    throw new NotFoundError('Product');
  }

  // Validate input (partial update)
  const result = productSchema.partial().safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid product data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check for duplicate SKU if changing
  if (data.sku && data.sku !== existingProduct.sku) {
    const { data: duplicateSku } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku', data.sku)
      .is('deleted_at', null)
      .neq('id', id)
      .single();

    if (duplicateSku) {
      throw new ConflictError(`Product with SKU "${data.sku}" already exists`);
    }
  }

  // Update product
  const { data: product, error } = await supabase
    .from('products')
    .update({
      ...(data.sku && { sku: data.sku }),
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.costPrice !== undefined && { cost_price: data.costPrice }),
      ...(data.sellingPrice !== undefined && { selling_price: data.sellingPrice }),
      ...(data.wholesalePrice !== undefined && { wholesale_price: data.wholesalePrice }),
      ...(data.memberPrice !== undefined && { member_price: data.memberPrice }),
      ...(data.taxRate !== undefined && { tax_rate: data.taxRate }),
      ...(data.isTaxInclusive !== undefined && { is_tax_inclusive: data.isTaxInclusive }),
      ...(data.categoryId !== undefined && { category_id: data.categoryId }),
      ...(data.brandId !== undefined && { brand_id: data.brandId }),
      ...(data.trackInventory !== undefined && { track_inventory: data.trackInventory }),
      ...(data.allowBackorders !== undefined && { allow_backorders: data.allowBackorders }),
      ...(data.productType && { product_type: data.productType }),
      ...(data.unitOfMeasure && { unit_of_measure: data.unitOfMeasure }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.dimensions && { dimensions: data.dimensions }),
      ...(data.isActive !== undefined && { is_active: data.isActive }),
      ...(data.isFeatured !== undefined && { is_featured: data.isFeatured }),
      ...(data.tags && { tags: data.tags }),
      ...(data.metadata && { metadata: data.metadata }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update product', { error, productId: id, tenantId });
    throw new Error('Failed to update product');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'PRODUCT_UPDATED',
    entity_type: 'PRODUCT',
    entity_id: id,
    description: `Updated product: ${product.name}`,
    old_values: existingProduct,
    new_values: product,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('Product updated', { productId: id, tenantId });

  res.json({
    success: true,
    data: { product },
  });
}));

/**
 * DELETE /api/products/:id
 * Soft delete a product
 */
router.delete('/:id', requirePermission('products:delete'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  // Check if product exists
  const { data: existingProduct, error: existingError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (existingError || !existingProduct) {
    throw new NotFoundError('Product');
  }

  // Soft delete
  const { error } = await supabase
    .from('products')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error('Failed to delete product', { error, productId: id, tenantId });
    throw new Error('Failed to delete product');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'PRODUCT_DELETED',
    entity_type: 'PRODUCT',
    entity_id: id,
    description: `Deleted product: ${existingProduct.name}`,
    old_values: existingProduct,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('Product deleted', { productId: id, tenantId });

  res.json({
    success: true,
    message: 'Product deleted successfully',
  });
}));

/**
 * POST /api/products/:id/inventory
 * Update product inventory
 */
router.post('/:id/inventory', requirePermission('inventory:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  // Validate input
  const result = inventorySchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid inventory data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check if product exists
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, sku, track_inventory')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (productError || !product) {
    throw new NotFoundError('Product');
  }

  if (!product.track_inventory) {
    throw new ValidationError('Inventory tracking is disabled for this product');
  }

  // Get current inventory
  const { data: currentInventory } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', id)
    .eq('store_id', data.storeId)
    .single();

  const previousQuantity = currentInventory?.quantity || 0;
  const quantityChange = data.quantity - previousQuantity;

  // Upsert inventory
  const { data: inventory, error } = await supabase
    .from('inventory')
    .upsert({
      tenant_id: tenantId,
      store_id: data.storeId,
      product_id: id,
      quantity: data.quantity,
      min_stock_level: data.minStockLevel,
      max_stock_level: data.maxStockLevel,
      reorder_point: data.reorderPoint,
      reorder_quantity: data.reorderQuantity,
      location_code: data.locationCode,
      bin_number: data.binNumber,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,store_id,product_id',
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to update inventory', { error, productId: id, tenantId });
    throw new Error('Failed to update inventory');
  }

  // Create stock movement record
  if (quantityChange !== 0) {
    await supabase.from('stock_movements').insert({
      tenant_id: tenantId,
      store_id: data.storeId,
      product_id: id,
      movement_type: quantityChange > 0 ? 'adjustment' : 'adjustment',
      quantity: Math.abs(quantityChange),
      previous_quantity: previousQuantity,
      new_quantity: data.quantity,
      reason: 'Manual inventory adjustment',
      created_by: userId,
    });
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'INVENTORY_UPDATED',
    entity_type: 'INVENTORY',
    entity_id: id,
    description: `Updated inventory for: ${product.name}`,
    old_values: { quantity: previousQuantity },
    new_values: { quantity: data.quantity },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { inventory },
  });
}));

export { router as productRouter };
