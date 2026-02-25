/**
 * AppleFlow POS - Authentication Routes
 * Login, logout, refresh token, and password management
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, ValidationError, AuthenticationError } from '../middleware/errorHandler.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRY = '8h';
const REFRESH_TOKEN_EXPIRY = '7d';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().length(4, 'PIN must be exactly 4 digits'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePinSchema = z.object({
  currentPin: z.string().length(4, 'Current PIN must be exactly 4 digits'),
  newPin: z.string().length(4, 'New PIN must be exactly 4 digits'),
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', asyncHandler(async (req, res) => {
  // Validate input
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid input', { errors: result.error.errors });
  }

  const { email, pin } = result.data;

  // Find user by email
  const { data: user, error: userError } = await supabase
    .from('user_profiles')
    .select('*, tenants:tenant_id(*)')
    .eq('email', email)
    .single();

  if (userError || !user) {
    logger.warn('Login attempt for non-existent user', { email });
    throw new AuthenticationError('Invalid credentials');
  }

  // Check if user is active
  if (!user.is_active) {
    throw new AuthenticationError('Account is disabled');
  }

  // Check tenant status
  const tenant = user.tenants as any;
  if (tenant.status !== 'active') {
    throw new AuthenticationError('Tenant account is suspended');
  }

  // Verify PIN
  if (!user.pin_hash) {
    throw new AuthenticationError('PIN not set. Please contact administrator.');
  }

  const isPinValid = await bcrypt.compare(pin, user.pin_hash);
  if (!isPinValid) {
    // Log failed attempt
    await supabase.from('activity_logs').insert({
      tenant_id: user.tenant_id,
      user_id: user.id,
      action: 'LOGIN_FAILED',
      description: 'Failed login attempt',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    throw new AuthenticationError('Invalid credentials');
  }

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id,
    storeId: user.store_id,
  };

  const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  // Update last login
  await supabase
    .from('user_profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // Create session
  await supabase.from('user_sessions').insert({
    user_id: user.id,
    tenant_id: user.tenant_id,
    token: accessToken,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  // Log successful login
  await supabase.from('activity_logs').insert({
    tenant_id: user.tenant_id,
    user_id: user.id,
    action: 'LOGIN_SUCCESS',
    description: 'User logged in successfully',
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  logger.info('User logged in', { userId: user.id, email: user.email });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        tenantId: user.tenant_id,
        storeId: user.store_id,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 28800, // 8 hours in seconds
      },
    },
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const result = refreshSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid input', { errors: result.error.errors });
  }

  const { refreshToken } = result.data;

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };

    // Get user
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('id, email, role, tenant_id, store_id, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || !user.is_active) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Generate new access token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      storeId: user.store_id,
    };

    const newAccessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 28800,
      },
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token expired');
    }
    throw new AuthenticationError('Invalid refresh token');
  }
}));

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    // Revoke session
    await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'user_logout',
      })
      .eq('token', token);
  }

  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;

  if (userId && tenantId) {
    // Log logout
    await supabase.from('activity_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      action: 'LOGOUT',
      description: 'User logged out',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;

  if (!userId) {
    throw new AuthenticationError();
  }

  const { data: user, error } = await supabase
    .from('user_profiles')
    .select('id, email, first_name, last_name, full_name, role, avatar_url, tenant_id, store_id, last_login_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new AuthenticationError('User not found');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        tenantId: user.tenant_id,
        storeId: user.store_id,
        lastLoginAt: user.last_login_at,
      },
    },
  });
}));

/**
 * POST /api/auth/change-pin
 * Change user PIN
 */
router.post('/change-pin', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;

  if (!userId) {
    throw new AuthenticationError();
  }

  const result = changePinSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid input', { errors: result.error.errors });
  }

  const { currentPin, newPin } = result.data;

  // Get user with PIN hash
  const { data: user, error } = await supabase
    .from('user_profiles')
    .select('pin_hash')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new AuthenticationError('User not found');
  }

  // Verify current PIN
  if (!user.pin_hash) {
    throw new ValidationError('PIN not set');
  }

  const isValid = await bcrypt.compare(currentPin, user.pin_hash);
  if (!isValid) {
    throw new ValidationError('Current PIN is incorrect');
  }

  // Hash new PIN
  const newPinHash = await bcrypt.hash(newPin, 12);

  // Update PIN
  await supabase
    .from('user_profiles')
    .update({ pin_hash: newPinHash })
    .eq('id', userId);

  // Revoke all sessions except current
  await supabase
    .from('user_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: 'pin_changed',
    })
    .eq('user_id', userId)
    .neq('token', req.headers.authorization?.substring(7) || '');

  // Log PIN change
  await supabase.from('activity_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action: 'PIN_CHANGED',
    description: 'PIN changed successfully',
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'PIN changed successfully. Please log in again.',
  });
}));

export { router as authRouter };
