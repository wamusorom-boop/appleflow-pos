import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many login attempts, please try again later'
  }
});

// Login schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().min(4, 'PIN must be at least 4 characters')
});

// Refresh token schema
const refreshSchema = z.object({
  refreshToken: z.string()
});

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, pin } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.pinHash);

    if (!isValidPin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 28800 // 8 hours in seconds
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Generate new access token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 28800
      }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // Here we could implement token blacklisting if needed
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET /auth/me
router.get('/me', async (req, res) => {
  // This would be protected by auth middleware in production
  res.json({
    success: true,
    message: 'Get current user endpoint'
  });
});

export { router as authRouter };
   next(error);
  }
});

/**
 * POST /api/auth/change-pin
 * Change user PIN
 */
router.post('/change-pin', authenticateToken, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPin: z.string().length(4),
      newPin: z.string().length(4),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
      });
    }

    const { currentPin, newPin } = result.data;
    const userId = (req as any).user.userId;

    // Get user with PIN hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify current PIN
    const isValid = await authService.verifyPIN(currentPin, user.pinHash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current PIN is incorrect',
      });
    }

    // Hash new PIN
    const newPinHash = await authService.hashPIN(newPin);

    // Update PIN
    await prisma.user.update({
      where: { id: userId },
      data: { pinHash: newPinHash },
    });

    // Invalidate all sessions (force re-login)
    await authService.invalidateAllUserSessions(userId);

    // Log PIN change
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PIN_CHANGED',
        entityType: 'USER',
        entityId: userId,
        details: 'PIN changed successfully',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'PIN changed successfully. Please log in again.',
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
