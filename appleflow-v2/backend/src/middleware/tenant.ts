/**
 * AppleFlow POS - Tenant Context Middleware
 * Multi-tenancy support with subscription validation
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Setup tenant context for the request
 * Validates subscription and sets tenant ID
 */
export async function setupTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const tenantId = req.user.tenantId;

    // Get tenant details
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      logger.error('Tenant not found', { tenantId, error });
      res.status(404).json({
        success: false,
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
      return;
    }

    // Check if tenant is active
    if (tenant.status !== 'active') {
      res.status(403).json({
        success: false,
        error: 'Tenant account is suspended',
        code: 'TENANT_SUSPENDED',
      });
      return;
    }

    // Check subscription status
    const now = new Date();
    const subscriptionExpiresAt = tenant.subscription_expires_at 
      ? new Date(tenant.subscription_expires_at) 
      : null;
    
    const gracePeriodEndsAt = tenant.grace_period_ends_at 
      ? new Date(tenant.grace_period_ends_at) 
      : null;

    // Subscription validation
    if (tenant.subscription_status === 'cancelled') {
      res.status(403).json({
        success: false,
        error: 'Subscription has been cancelled',
        code: 'SUBSCRIPTION_CANCELLED',
      });
      return;
    }

    if (tenant.subscription_status === 'suspended') {
      res.status(403).json({
        success: false,
        error: 'Subscription is suspended',
        code: 'SUBSCRIPTION_SUSPENDED',
      });
      return;
    }

    // Check if subscription has expired (with grace period)
    if (subscriptionExpiresAt && subscriptionExpiresAt < now) {
      // Check if still in grace period
      if (gracePeriodEndsAt && gracePeriodEndsAt > now) {
        // In grace period - allow read-only operations
        (req as any).tenantContext = {
          ...tenant,
          isInGracePeriod: true,
          readOnly: true,
        };
      } else {
        // Grace period expired
        res.status(403).json({
          success: false,
          error: 'Subscription has expired',
          code: 'SUBSCRIPTION_EXPIRED',
        });
        return;
      }
    }

    // Attach tenant context to request
    (req as any).tenantContext = {
      ...tenant,
      isInGracePeriod: false,
      readOnly: false,
    };

    // Set tenant context for RLS (if using RPC)
    try {
      await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
    } catch (e) {
      // RPC might not exist, continue without it
      logger.debug('set_tenant_context RPC not available');
    }

    next();
  } catch (error) {
    logger.error('Tenant context setup error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to setup tenant context',
      code: 'TENANT_CONTEXT_ERROR',
    });
  }
}

/**
 * Middleware to check write permissions (for grace period)
 */
export function requireWriteAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tenantContext = (req as any).tenantContext;
  
  if (tenantContext?.readOnly) {
    res.status(403).json({
      success: false,
      error: 'Write operations are disabled during grace period. Please renew your subscription.',
      code: 'READ_ONLY_MODE',
    });
    return;
  }
  
  next();
}

/**
 * Get tenant limits based on subscription tier
 */
export function getTenantLimits(tier: string): {
  maxUsers: number;
  maxStores: number;
  maxProducts: number;
  features: string[];
} {
  const limits: Record<string, {
    maxUsers: number;
    maxStores: number;
    maxProducts: number;
    features: string[];
  }> = {
    trial: {
      maxUsers: 2,
      maxStores: 1,
      maxProducts: 100,
      features: ['basic_pos', 'inventory', 'customers'],
    },
    starter: {
      maxUsers: 5,
      maxStores: 1,
      maxProducts: 1000,
      features: ['basic_pos', 'inventory', 'customers', 'reports'],
    },
    professional: {
      maxUsers: 20,
      maxStores: 5,
      maxProducts: 10000,
      features: ['basic_pos', 'inventory', 'customers', 'reports', 'loyalty', 'multi_store', 'api_access'],
    },
    enterprise: {
      maxUsers: -1, // unlimited
      maxStores: -1,
      maxProducts: -1,
      features: ['all_features', 'white_label', 'dedicated_support', 'sla'],
    },
  };

  return limits[tier] || limits.trial;
}

/**
 * Check if tenant has reached resource limits
 */
export async function checkResourceLimit(
  tenantId: string,
  resource: 'users' | 'stores' | 'products'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Get tenant tier
  const { data: tenant } = await supabase
    .from('tenants')
    .select('subscription_tier')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const limits = getTenantLimits(tenant.subscription_tier);
  const limit = limits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof typeof limits] as number;

  // Unlimited
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }

  // Get current count
  let count = 0;
  
  if (resource === 'users') {
    const { count: userCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    count = userCount || 0;
  } else if (resource === 'stores') {
    const { count: storeCount } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    count = storeCount || 0;
  } else if (resource === 'products') {
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    count = productCount || 0;
  }

  return {
    allowed: count < limit,
    current: count,
    limit,
  };
}
