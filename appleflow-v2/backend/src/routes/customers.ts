/**
 * AppleFlow POS - Customer Routes
 * Customer management with loyalty program
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const customerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  phone2: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Kenya'),
  companyName: z.string().optional(),
  taxId: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  creditLimit: z.number().min(0).default(0),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

const loyaltyTransactionSchema = z.object({
  points: z.number().int(),
  type: z.enum(['earned', 'redeemed', 'adjusted', 'bonus', 'expired']),
  reason: z.string().min(1),
  saleId: z.string().uuid().optional(),
});

/**
 * GET /api/customers
 * List customers with pagination and search
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const search = req.query.search as string;
  const isActive = req.query.isActive === 'true' ? true :
                   req.query.isActive === 'false' ? false : undefined;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,loyalty_card_number.ilike.%${search}%`);
  }

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: customers, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch customers', { error, tenantId });
    throw new Error('Failed to fetch customers');
  }

  res.json({
    success: true,
    data: {
      customers: customers || [],
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
 * GET /api/customers/:id
 * Get a single customer
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const { id } = req.params;

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (error || !customer) {
    throw new NotFoundError('Customer');
  }

  // Get loyalty history
  const { data: loyaltyHistory } = await supabase
    .from('loyalty_history')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  res.json({
    success: true,
    data: {
      customer,
      loyaltyHistory: loyaltyHistory || [],
    },
  });
}));

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', requirePermission('customers:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  const result = customerSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid customer data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check for duplicate phone
  if (data.phone) {
    const { data: existingPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', data.phone)
      .is('deleted_at', null)
      .single();

    if (existingPhone) {
      throw new ConflictError(`Customer with phone "${data.phone}" already exists`);
    }
  }

  // Check for duplicate email
  if (data.email) {
    const { data: existingEmail } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', data.email)
      .is('deleted_at', null)
      .single();

    if (existingEmail) {
      throw new ConflictError(`Customer with email "${data.email}" already exists`);
    }
  }

  // Generate loyalty card number
  const loyaltyCardNumber = `Loyal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      phone2: data.phone2,
      address: data.address,
      city: data.city,
      country: data.country,
      company_name: data.companyName,
      tax_id: data.taxId,
      birth_date: data.birthDate,
      loyalty_card_number: loyaltyCardNumber,
      credit_limit: data.creditLimit,
      notes: data.notes,
      is_active: data.isActive,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create customer', { error, tenantId });
    throw new Error('Failed to create customer');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CUSTOMER_CREATED',
    entity_type: 'CUSTOMER',
    entity_id: customer.id,
    description: `Created customer: ${customer.full_name}`,
    new_values: customer,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('Customer created', { customerId: customer.id, tenantId });

  res.status(201).json({
    success: true,
    data: { customer },
  });
}));

/**
 * PUT /api/customers/:id
 * Update a customer
 */
router.put('/:id', requirePermission('customers:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const result = customerSchema.partial().safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid customer data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check if customer exists
  const { data: existingCustomer, error: existingError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (existingError || !existingCustomer) {
    throw new NotFoundError('Customer');
  }

  // Update customer
  const { data: customer, error } = await supabase
    .from('customers')
    .update({
      ...(data.firstName && { first_name: data.firstName }),
      ...(data.lastName && { last_name: data.lastName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.phone2 !== undefined && { phone2: data.phone2 }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.country && { country: data.country }),
      ...(data.companyName !== undefined && { company_name: data.companyName }),
      ...(data.taxId !== undefined && { tax_id: data.taxId }),
      ...(data.birthDate !== undefined && { birth_date: data.birthDate }),
      ...(data.creditLimit !== undefined && { credit_limit: data.creditLimit }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.isActive !== undefined && { is_active: data.isActive }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update customer', { error, customerId: id, tenantId });
    throw new Error('Failed to update customer');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CUSTOMER_UPDATED',
    entity_type: 'CUSTOMER',
    entity_id: id,
    description: `Updated customer: ${customer.full_name}`,
    old_values: existingCustomer,
    new_values: customer,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { customer },
  });
}));

/**
 * DELETE /api/customers/:id
 * Soft delete a customer
 */
router.delete('/:id', requirePermission('customers:delete'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const { data: existingCustomer, error: existingError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (existingError || !existingCustomer) {
    throw new NotFoundError('Customer');
  }

  const { error } = await supabase
    .from('customers')
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error('Failed to delete customer', { error, customerId: id, tenantId });
    throw new Error('Failed to delete customer');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'CUSTOMER_DELETED',
    entity_type: 'CUSTOMER',
    entity_id: id,
    description: `Deleted customer: ${existingCustomer.full_name}`,
    old_values: existingCustomer,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Customer deleted successfully',
  });
}));

/**
 * POST /api/customers/:id/loyalty
 * Add loyalty points transaction
 */
router.post('/:id/loyalty', requirePermission('customers:update'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const result = loyaltyTransactionSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid loyalty data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check if customer exists
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, full_name, loyalty_points')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (customerError || !customer) {
    throw new NotFoundError('Customer');
  }

  // Calculate new points balance
  const newPoints = customer.loyalty_points + data.points;

  if (newPoints < 0) {
    throw new ValidationError('Insufficient loyalty points');
  }

  // Create loyalty history record
  const { error: historyError } = await supabase
    .from('loyalty_history')
    .insert({
      tenant_id: tenantId,
      customer_id: id,
      points: data.points,
      type: data.type,
      reason: data.reason,
      sale_id: data.saleId,
      balance_after: newPoints,
    });

  if (historyError) {
    logger.error('Failed to create loyalty history', { error: historyError, customerId: id });
    throw new Error('Failed to create loyalty history');
  }

  // Update customer points
  const { data: updatedCustomer, error: updateError } = await supabase
    .from('customers')
    .update({
      loyalty_points: newPoints,
      ...(data.type === 'earned' && { lifetime_points: customer.loyalty_points + data.points }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    logger.error('Failed to update customer points', { error: updateError, customerId: id });
    throw new Error('Failed to update customer points');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'LOYALTY_ADJUSTED',
    entity_type: 'CUSTOMER',
    entity_id: id,
    description: `Adjusted loyalty points for ${customer.full_name}: ${data.points > 0 ? '+' : ''}${data.points}`,
    new_values: { points: data.points, newBalance: newPoints },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: {
      customer: updatedCustomer,
      pointsChange: data.points,
      newBalance: newPoints,
    },
  });
}));

export { router as customerRouter };
