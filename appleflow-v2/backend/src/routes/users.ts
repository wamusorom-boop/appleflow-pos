/**
 * AppleFlow POS - User Routes
 * User management with RBAC
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requireRole, requirePermission } from '../middleware/auth.js';
import { checkResourceLimit } from '../middleware/tenant.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(50).optional(),
  role: z.enum(['cashier', 'supervisor', 'manager', 'tenant_admin']).default('cashier'),
  storeId: z.string().uuid().optional(),
  pin: z.string().length(4, 'PIN must be exactly 4 digits'),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).optional(),
  role: z.enum(['cashier', 'supervisor', 'manager', 'tenant_admin']).optional(),
  storeId: z.string().uuid().optional().nullable(),
  pin: z.string().length(4).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/users
 * List all users in tenant
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const role = req.query.role as string;
  const isActive = req.query.isActive === 'true' ? true :
                   req.query.isActive === 'false' ? false : undefined;

  let query = supabase
    .from('user_profiles')
    .select(`
      *,
      store:stores(id, name)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (role) {
    query = query.eq('role', role);
  }

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: users, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch users', { error, tenantId });
    throw new Error('Failed to fetch users');
  }

  // Remove sensitive data
  const sanitizedUsers = users?.map(user => ({
    ...user,
    pin_hash: undefined,
  }));

  res.json({
    success: true,
    data: {
      users: sanitizedUsers || [],
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
 * GET /api/users/:id
 * Get a single user
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { id } = req.params;

  const { data: user, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      store:stores(id, name)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User');
  }

  // Remove sensitive data
  const { pin_hash, ...sanitizedUser } = user;

  res.json({
    success: true,
    data: { user: sanitizedUser },
  });
}));

/**
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', requireRole(['super_admin', 'tenant_admin', 'manager']), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const currentUserId = (req as any).user?.id;
  const currentUserRole = (req as any).user?.role;

  // Check user limit
  const limitCheck = await checkResourceLimit(tenantId, 'users');
  if (!limitCheck.allowed) {
    throw new ConflictError(`User limit reached (${limitCheck.current}/${limitCheck.limit})`);
  }

  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid user data', { errors: result.error.errors });
  }

  const data = result.data;

  // Role hierarchy check - can only create users with equal or lower role
  const roleHierarchy: Record<string, number> = {
    'super_admin': 100,
    'tenant_admin': 90,
    'manager': 70,
    'supervisor': 60,
    'cashier': 40,
    'staff': 20,
  };

  if (roleHierarchy[data.role] > roleHierarchy[currentUserRole]) {
    throw new ValidationError('Cannot create user with higher role than yourself');
  }

  // Check for duplicate email
  const { data: existingEmail } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', data.email)
    .single();

  if (existingEmail) {
    throw new ConflictError(`User with email "${data.email}" already exists`);
  }

  // Hash PIN
  const pinHash = await bcrypt.hash(data.pin, 12);

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.pin, // Temporary password same as PIN
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    logger.error('Failed to create auth user', { error: authError });
    throw new Error('Failed to create user account');
  }

  // Create user profile
  const { data: user, error } = await supabase
    .from('user_profiles')
    .insert({
      id: authUser.user.id,
      tenant_id: tenantId,
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      role: data.role,
      store_id: data.storeId,
      pin_hash: pinHash,
      is_active: data.isActive,
    })
    .select()
    .single();

  if (error) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(authUser.user.id);
    logger.error('Failed to create user profile', { error, tenantId });
    throw new Error('Failed to create user profile');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: currentUserId,
    action: 'USER_CREATED',
    entity_type: 'USER',
    entity_id: user.id,
    description: `Created user: ${user.full_name} (${user.role})`,
    new_values: user,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('User created', { userId: user.id, tenantId });

  res.status(201).json({
    success: true,
    data: { user },
  });
}));

/**
 * PUT /api/users/:id
 * Update a user
 */
router.put('/:id', requireRole(['super_admin', 'tenant_admin', 'manager']), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const currentUserId = (req as any).user?.id;
  const { id } = req.params;

  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid user data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check if user exists
  const { data: existingUser, error: existingError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (existingError || !existingUser) {
    throw new NotFoundError('User');
  }

  // Build update object
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (data.firstName) updateData.first_name = data.firstName;
  if (data.lastName) updateData.last_name = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.role) updateData.role = data.role;
  if (data.storeId !== undefined) updateData.store_id = data.storeId;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;

  // Update PIN if provided
  if (data.pin) {
    updateData.pin_hash = await bcrypt.hash(data.pin, 12);
  }

  const { data: user, error } = await supabase
    .from('user_profiles')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update user', { error, userId: id, tenantId });
    throw new Error('Failed to update user');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: currentUserId,
    action: 'USER_UPDATED',
    entity_type: 'USER',
    entity_id: id,
    description: `Updated user: ${user.full_name}`,
    old_values: existingUser,
    new_values: user,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { user },
  });
}));

/**
 * DELETE /api/users/:id
 * Deactivate a user (soft delete)
 */
router.delete('/:id', requireRole(['super_admin', 'tenant_admin']), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const currentUserId = (req as any).user?.id;
  const { id } = req.params;

  // Prevent self-deletion
  if (id === currentUserId) {
    throw new ValidationError('Cannot deactivate yourself');
  }

  const { data: existingUser, error: existingError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (existingError || !existingUser) {
    throw new NotFoundError('User');
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error('Failed to deactivate user', { error, userId: id, tenantId });
    throw new Error('Failed to deactivate user');
  }

  // Revoke all sessions
  await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: 'user_deactivated',
    })
    .eq('user_id', id);

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: currentUserId,
    action: 'USER_DEACTIVATED',
    entity_type: 'USER',
    entity_id: id,
    description: `Deactivated user: ${existingUser.full_name}`,
    old_values: existingUser,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'User deactivated successfully',
  });
}));

export { router as userRouter };
