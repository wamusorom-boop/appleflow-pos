/**
 * AppleFlow POS - Tenant Routes
 * Multi-tenant management (super admin only)
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';

const router = Router();

const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Kenya'),
  currency: z.string().max(10).default('KES'),
  subscriptionTier: z.enum(['trial', 'starter', 'professional', 'enterprise']).default('trial'),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'cancelled', 'suspended']).optional(),
  subscriptionTier: z.enum(['trial', 'starter', 'professional', 'enterprise']).optional(),
  subscriptionExpiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/tenants
 * List all tenants (super admin only)
 */
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  const { data: tenants, error, count } = await supabase
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    logger.error('Failed to fetch tenants', { error });
    throw new Error('Failed to fetch tenants');
  }

  res.json({
    success: true,
    data: {
      tenants: tenants || [],
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
 * GET /api/tenants/:id
 * Get a single tenant
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      *,
      stores:stores(count),
      users:user_profiles(count),
      products:products(count)
    `)
    .eq('id', id)
    .single();

  if (error || !tenant) {
    throw new NotFoundError('Tenant');
  }

  res.json({
    success: true,
    data: { tenant },
  });
}));

/**
 * POST /api/tenants
 * Create a new tenant
 */
router.post('/', asyncHandler(async (req, res) => {
  const result = createTenantSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid tenant data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check for duplicate slug
  const { data: existingSlug } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', data.slug)
    .single();

  if (existingSlug) {
    throw new ConflictError(`Tenant with slug "${data.slug}" already exists`);
  }

  // Set subscription expiry based on tier
  let subscriptionExpiresAt: string | null = null;
  if (data.subscriptionTier === 'trial') {
    subscriptionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days
  }

  // Set limits based on tier
  const tierLimits: Record<string, { maxUsers: number; maxStores: number; maxProducts: number }> = {
    trial: { maxUsers: 2, maxStores: 1, maxProducts: 100 },
    starter: { maxUsers: 5, maxStores: 1, maxProducts: 1000 },
    professional: { maxUsers: 20, maxStores: 5, maxProducts: 10000 },
    enterprise: { maxUsers: -1, maxStores: -1, maxProducts: -1 },
  };

  const limits = tierLimits[data.subscriptionTier];

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({
      name: data.name,
      slug: data.slug,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      country: data.country,
      currency: data.currency,
      subscription_status: data.subscriptionTier === 'trial' ? 'trial' : 'active',
      subscription_tier: data.subscriptionTier,
      subscription_expires_at: subscriptionExpiresAt,
      max_users: limits.maxUsers,
      max_stores: limits.maxStores,
      max_products: limits.maxProducts,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create tenant', { error });
    throw new Error('Failed to create tenant');
  }

  logger.info('Tenant created', { tenantId: tenant.id, slug: tenant.slug });

  res.status(201).json({
    success: true,
    data: { tenant },
  });
}));

/**
 * PUT /api/tenants/:id
 * Update a tenant
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = updateTenantSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid tenant data', { errors: result.error.errors });
  }

  const data = result.data;

  const { data: existingTenant, error: existingError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError || !existingTenant) {
    throw new NotFoundError('Tenant');
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.country) updateData.country = data.country;
  if (data.currency) updateData.currency = data.currency;
  if (data.subscriptionStatus) updateData.subscription_status = data.subscriptionStatus;
  if (data.subscriptionTier) updateData.subscription_tier = data.subscriptionTier;
  if (data.subscriptionExpiresAt) updateData.subscription_expires_at = data.subscriptionExpiresAt;
  if (data.isActive !== undefined) updateData.status = data.isActive ? 'active' : 'suspended';

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update tenant', { error, tenantId: id });
    throw new Error('Failed to update tenant');
  }

  logger.info('Tenant updated', { tenantId: id });

  res.json({
    success: true,
    data: { tenant },
  });
}));

/**
 * POST /api/tenants/:id/suspend
 * Suspend a tenant
 */
router.post('/:id/suspend', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update({
      status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !tenant) {
    throw new NotFoundError('Tenant');
  }

  logger.info('Tenant suspended', { tenantId: id });

  res.json({
    success: true,
    message: 'Tenant suspended successfully',
    data: { tenant },
  });
}));

/**
 * POST /api/tenants/:id/activate
 * Activate a tenant
 */
router.post('/:id/activate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !tenant) {
    throw new NotFoundError('Tenant');
  }

  logger.info('Tenant activated', { tenantId: id });

  res.json({
    success: true,
    message: 'Tenant activated successfully',
    data: { tenant },
  });
}));

export { router as tenantRouter };
