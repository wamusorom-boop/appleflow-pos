/**
 * AppleFlow POS - Shift Routes
 * Cash register shift management
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { requirePermission } from '../middleware/auth.js';

const router = Router();

const openShiftSchema = z.object({
  storeId: z.string().uuid(),
  openingCash: z.number().min(0),
});

const closeShiftSchema = z.object({
  closingCash: z.number().min(0),
});

const cashMovementSchema = z.object({
  type: z.enum(['paid_in', 'paid_out', 'cash_drop']),
  amount: z.number().positive(),
  reason: z.string().min(1, 'Reason is required'),
});

/**
 * GET /api/shifts
 * List shifts
 */
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const isClosed = req.query.isClosed === 'true' ? true :
                   req.query.isClosed === 'false' ? false : undefined;

  let query = supabase
    .from('shifts')
    .select(`
      *,
      user:user_profiles(id, full_name),
      store:stores(id, name)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('opened_at', { ascending: false });

  if (isClosed !== undefined) {
    query = query.eq('is_closed', isClosed);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: shifts, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch shifts', { error, tenantId });
    throw new Error('Failed to fetch shifts');
  }

  res.json({
    success: true,
    data: {
      shifts: shifts || [],
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
 * GET /api/shifts/current
 * Get current open shift for user
 */
router.get('/current', asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  const { data: shift, error } = await supabase
    .from('shifts')
    .select(`
      *,
      store:stores(id, name),
      movements:cash_movements(*)
    `)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_closed', false)
    .single();

  if (error) {
    // No open shift is OK
    res.json({
      success: true,
      data: { shift: null },
    });
    return;
  }

  res.json({
    success: true,
    data: { shift },
  });
}));

/**
 * POST /api/shifts/open
 * Open a new shift
 */
router.post('/open', requirePermission('sales:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;

  const result = openShiftSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid shift data', { errors: result.error.errors });
  }

  const data = result.data;

  // Check if user already has an open shift
  const { data: existingShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_closed', false)
    .single();

  if (existingShift) {
    throw new ConflictError('You already have an open shift');
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      tenant_id: tenantId,
      store_id: data.storeId,
      user_id: userId,
      opening_cash: data.openingCash,
      is_closed: false,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to open shift', { error, tenantId });
    throw new Error('Failed to open shift');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'SHIFT_OPENED',
    entity_type: 'SHIFT',
    entity_id: shift.id,
    description: `Opened shift with KSh ${data.openingCash}`,
    new_values: shift,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.status(201).json({
    success: true,
    data: { shift },
  });
}));

/**
 * POST /api/shifts/:id/close
 * Close a shift
 */
router.post('/:id/close', requirePermission('sales:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const result = closeShiftSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid close data', { errors: result.error.errors });
  }

  const data = result.data;

  // Get shift
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_closed', false)
    .single();

  if (shiftError || !shift) {
    throw new NotFoundError('Open shift');
  }

  // Get sales summary for this shift
  const { data: salesSummary } = await supabase
    .from('sales')
    .select('method, amount')
    .eq('shift_id', id)
    .eq('status', 'completed');

  const cashSales = salesSummary
    ?.filter(s => s.method === 'cash')
    .reduce((sum, s) => sum + s.amount, 0) || 0;

  const expectedCash = shift.opening_cash + cashSales;
  const cashDifference = data.closingCash - expectedCash;

  // Close shift
  const { data: closedShift, error } = await supabase
    .from('shifts')
    .update({
      closed_at: new Date().toISOString(),
      closing_cash: data.closingCash,
      expected_cash: expectedCash,
      cash_difference: cashDifference,
      cash_sales: cashSales,
      is_closed: true,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to close shift', { error, shiftId: id });
    throw new Error('Failed to close shift');
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'SHIFT_CLOSED',
    entity_type: 'SHIFT',
    entity_id: id,
    description: `Closed shift. Cash difference: KSh ${cashDifference}`,
    old_values: shift,
    new_values: closedShift,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    data: { shift: closedShift },
  });
}));

/**
 * POST /api/shifts/:id/movement
 * Add cash movement to shift
 */
router.post('/:id/movement', requirePermission('sales:create'), asyncHandler(async (req, res) => {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const { id } = req.params;

  const result = cashMovementSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid movement data', { errors: result.error.errors });
  }

  const data = result.data;

  // Verify shift exists and is open
  const { data: shift, error: shiftError } = await supabase
    .from('shifts')
    .select('id, is_closed')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (shiftError || !shift) {
    throw new NotFoundError('Shift');
  }

  if (shift.is_closed) {
    throw new ConflictError('Cannot add movement to closed shift');
  }

  const { data: movement, error } = await supabase
    .from('cash_movements')
    .insert({
      tenant_id: tenantId,
      shift_id: id,
      movement_type: data.type,
      amount: data.amount,
      reason: data.reason,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create cash movement', { error, shiftId: id });
    throw new Error('Failed to create cash movement');
  }

  res.status(201).json({
    success: true,
    data: { movement },
  });
}));

export { router as shiftRouter };
