/**
 * AppleFlow POS - Authentication Middleware
 * Enterprise-grade JWT validation with multi-tenant support
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Role hierarchy for permission inheritance
const ROLE_HIERARCHY: Record<string, number> = {
  'super_admin': 100,
  'tenant_admin': 90,
  'manager': 70,
  'supervisor': 60,
  'cashier': 40,
  'staff': 20,
};

// Permission definitions by role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'super_admin': ['*'], // All permissions
  'tenant_admin': [
    'sales:create', 'sales:read', 'sales:update', 'sales:delete',
    'products:create', 'products:read', 'products:update', 'products:delete',
    'inventory:read', 'inventory:update',
    'customers:create', 'customers:read', 'customers:update',
    'users:create', 'users:read', 'users:update', 'users:delete',
    'stores:create', 'stores:read', 'stores:update',
    'reports:read',
    'settings:read', 'settings:update',
  ],
  'manager': [
    'sales:create', 'sales:read', 'sales:update',
    'products:create', 'products:read', 'products:update',
    'inventory:read', 'inventory:update',
    'customers:create', 'customers:read', 'customers:update',
    'users:read', 'users:create', 'users:update',
    'stores:read',
    'reports:read',
    'settings:read',
  ],
  'supervisor': [
    'sales:create', 'sales:read', 'sales:update',
    'products:read',
    'inventory:read',
    'customers:create', 'customers:read', 'customers:update',
    'users:read',
    'stores:read',
    'reports:read',
  ],
  'cashier': [
    'sales:create', 'sales:read',
    'products:read',
    'customers:create', 'customers:read',
    'stores:read',
  ],
  'staff': [
    'products:read',
    'customers:read',
    'stores:read',
  ],
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
        storeId?: string;
        permissions: string[];
      };
    }
  }
}

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Authenticate JWT token and attach user to request
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'NO_TOKEN',
      });
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      tenantId: string;
      storeId?: string;
    };

    // Verify user exists and is active in database
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('id, email, role, tenant_id, store_id, is_active, permissions')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      logger.warn('User not found in database', { userId: decoded.userId, error });
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    // Get permissions for role
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    const customPermissions = (user.permissions as Record<string, string[]>) || {};
    const allPermissions = [...permissions, ...(customPermissions.allowed || [])];

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      storeId: user.store_id || undefined,
      permissions: allPermissions,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    logger.error('Authentication error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Check if user has required permission
 */
export function hasPermission(user: Express.Request['user'], permission: string): boolean {
  if (!user) return false;
  
  // Super admin has all permissions
  if (user.role === 'super_admin' || user.permissions.includes('*')) {
    return true;
  }
  
  return user.permissions.includes(permission);
}

/**
 * Require specific role(s)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    if (!hasPermission(req.user, permission)) {
      res.status(403).json({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
        permission,
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - attaches user if token valid, doesn't fail if not
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      tenantId: string;
      storeId?: string;
    };

    const { data: user } = await supabase
      .from('user_profiles')
      .select('id, email, role, tenant_id, store_id, is_active, permissions')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (user) {
      const permissions = ROLE_PERMISSIONS[user.role] || [];
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        storeId: user.store_id || undefined,
        permissions,
      };
    }

    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
}

/**
 * Check if user has higher or equal role level
 */
export function hasRoleLevel(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}
