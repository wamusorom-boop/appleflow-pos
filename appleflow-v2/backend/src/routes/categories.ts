/**
 * AppleFlow POS - Category Routes
 * Product category management
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  color: z.string().max(7).default('#3b82f6'),
  icon: z.string().optional(),
  imageUrl: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/categories
 * List all categories
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  const { data: categories, error } = await supabase
    .from('categories')
    .select(`
      *,
      parent:parent_id(id, name),
      children:categories!parent_id(id, name)
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    logger.error('Failed to fetch categories', { error, tenantId });
    throw new Error('Failed to fetch categories');
  }

  res.json({
    success: true,
    data: { categories: categories || [] },
  });
}));

/**
 * GET /api/categories/:id
 * Get a single category
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { id } = req.params;

  const { data: category, error } = await supabase
    .from('categories')
    .select(`
      *,
      parent:parent_id(id, name),
      children:categories!parent_id(id, name),
      products:products(id, name)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (error || !category) {
    throw new NotFoundError('Category');
  }

  res.json({
    success: true,
    data: { category },
  });
}));

/**
 * POST /api/categories
 * Create a new category
 */
router.post('/', requirePermission('products:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  const result = categorySchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid category data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check for duplicate name
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', data.name)
    .is('deleted_at', null)
    .single();

  if (existing) {
    throw new ConflictError(`Category "${data.name}" already exists`);
  }

  const { data: category, error } = await supabase
    .from('categories')
    .insert({
      tenant_id: tenantId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      image_url: data.imageUrl,
      parent_id: data.parentId,
      sort_order: data.sortOrder,
      is_active: data.isActive,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create category', { error, tenantId });
    throw new Error('Failed to create category');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CATEGORY_CREATED',
    entity_type: 'CATEGORY',
    entity_id: category.id,
    description: `Created category: ${category.name}`,
    new_values: category,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.status(201).json({
    success: true,
    data: { category },
  });
}));

/**
 * PUT /api/categories/:id
 * Update a category
 */
router.put('/:id', requirePermission('products:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const result = categorySchema.partial().safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid category data', { errors: result.error.errors });
  }

  const data = result.data;

  const { data: existingCategory, error: existingError } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (existingError || !existingCategory) {
    throw new NotFoundError('Category');
  }

  const { data: category, error } = await supabase
    .from('categories')
    .update({
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.color && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.imageUrl !== undefined && { image_url: data.imageUrl }),
      ...(data.parentId !== undefined && { parent_id: data.parentId }),
      ...(data.sortOrder !== undefined && { sort_order: data.sortOrder }),
      ...(data.isActive !== undefined && { is_active: data.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update category', { error, categoryId: id, tenantId });
    throw new Error('Failed to update category');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CATEGORY_UPDATED',
    entity_type: 'CATEGORY',
    entity_id: id,
    description: `Updated category: ${category.name}`,
    old_values: existingCategory,
    new_values: category,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { category },
  });
}));

/**
 * DELETE /api/categories/:id
 * Soft delete a category
 */
router.delete('/:id', requirePermission('products:delete'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const { data: existingCategory, error: existingError } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (existingError || !existingCategory) {
    throw new NotFoundError('Category');
  }

  // Check if category has products
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .is('deleted_at', null);

  if (productCount && productCount > 0) {
    throw new ConflictError('Cannot delete category with associated products');
  }

  const { error } = await supabase
    .from('categories')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error('Failed to delete category', { error, categoryId: id, tenantId });
    throw new Error('Failed to delete category');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CATEGORY_DELETED',
    entity_type: 'CATEGORY',
    entity_id: id,
    description: `Deleted category: ${existingCategory.name}`,
    old_values: existingCategory,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Category deleted successfully',
  });
}));

export { router as categoryRouter };
