/**
 * AppleFlow POS - Store Routes
 * Multi-store management
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requirePermission, requireRole } from '../middleware/auth.js';
import { checkResourceLimit } from '../middleware/tenant.js';

const router = Router();

const storeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().min(1, 'Code is required').max(50),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Kenya'),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  managerId: z.string().uuid().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/stores
 * List all stores
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  const { data: stores, error } = await supabase
    .from('stores')
    .select(`
      *,
      manager:user_profiles(id, full_name, email)
    `)
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error) {
    logger.error('Failed to fetch stores', { error, tenantId });
    throw new Error('Failed to fetch stores');
  }

  res.json({
    success: true,
    data: { stores: stores || [] },
  });
}));

/**
 * GET /api/stores/:id
 * Get a single store
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { id } = req.params;

  const { data: store, error } = await supabase
    .from('stores')
    .select(`
      *,
      manager:user_profiles(id, full_name, email),
      inventory_count:inventory(count),
      user_count:user_profiles(count)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !store) {
    throw new NotFoundError('Store');
  }

  res.json({
    success: true,
    data: { store },
  });
}));

/**
 * POST /api/stores
 * Create a new store (admin only)
 */
router.post('/', requireRole(['super_admin', 'tenant_admin']), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  // Check store limit
  const limitCheck = await checkResourceLimit(tenantId, 'stores');
  if (!limitCheck.allowed) {
    throw new ConflictError(`Store limit reached (${limitCheck.current}/${limitCheck.limit})`);
  }

  const result = storeSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid store data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check for duplicate code
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', data.code)
    .single();

  if (existing) {
    throw new ConflictError(`Store with code "${data.code}" already exists`);
  }

  const { data: store, error } = await supabase
    .from('stores')
    .insert({
      tenant_id: tenantId,
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city,
      country: data.country,
      phone: data.phone,
      email: data.email,
      manager_id: data.managerId,
      opening_time: data.openingTime,
      closing_time: data.closingTime,
      receipt_header: data.receiptHeader,
      receipt_footer: data.receiptFooter,
      is_active: data.isActive,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create store', { error, tenantId });
    throw new Error('Failed to create store');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'STORE_CREATED',
    entity_type: 'STORE',
    entity_id: store.id,
    description: `Created store: ${store.name}`,
    new_values: store,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.status(201).json({
    success: true,
    data: { store },
  });
}));

/**
 * PUT /api/stores/:id
 * Update a store
 */
router.put('/:id', requireRole(['super_admin', 'tenant_admin', 'manager']), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const result = storeSchema.partial().safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid store data', { errors: result.error.errors });
  }

  const data = result.data;

  const { data: existingStore, error: existingError } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (existingError || !existingStore) {
    throw new NotFoundError('Store');
  }

  const { data: store, error } = await supabase
    .from('stores')
    .update({
      ...(data.name && { name: data.name }),
      ...(data.code && { code: data.code }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.country && { country: data.country }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.managerId !== undefined && { manager_id: data.managerId }),
      ...(data.openingTime !== undefined && { opening_time: data.openingTime }),
      ...(data.closingTime !== undefined && { closing_time: data.closingTime }),
      ...(data.receiptHeader !== undefined && { receipt_header: data.receiptHeader }),
      ...(data.receiptFooter !== undefined && { receipt_footer: data.receiptFooter }),
      ...(data.isActive !== undefined && { is_active: data.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update store', { error, storeId: id, tenantId });
    throw new Error('Failed to update store');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'STORE_UPDATED',
    entity_type: 'STORE',
    entity_id: id,
    description: `Updated store: ${store.name}`,
    old_values: existingStore,
    new_values: store,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { store },
  });
}));

export { router as storeRouter };
