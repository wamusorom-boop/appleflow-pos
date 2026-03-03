/**
 * AppleFlow POS - Unified Production Server
 * Serves both API and frontend static files from a single process
 * No CORS issues, no separate deployments, bulletproof authentication
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

// Initialize Express
const app = express();
const prisma = new PrismaClient();

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'appleflow-dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'appleflow-refresh-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Trust proxy for correct IP behind reverse proxy
app.set('trust proxy', 1);

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS - Allow all in development, configured in production
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173', '*'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many login attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Verify JWT token and attach user to request
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      code: 'NO_TOKEN',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      // Invalid token, but we don't fail
    }
  }
  next();
}

/**
 * Check if user has required role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

// ============================================
// HEALTH CHECKS
// ============================================

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '3.0.0',
      environment: NODE_ENV,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        environment: NODE_ENV,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Database connection failed',
    });
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    // Validate input
    const { email, pin } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or PIN',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.pinHash);

    if (!isValidPin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or PIN',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is disabled. Please contact your administrator.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Return success
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 28800, // 8 hours in seconds
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
      code: 'LOGIN_ERROR',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Generate new access token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 28800,
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired. Please log in again.',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  // In JWT-based auth, logout is handled client-side by removing tokens
  // Here we could implement token blacklisting if needed
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
    });
  }
});

/**
 * POST /api/auth/validate
 * Validate access token (used by frontend on init)
 */
app.post('/api/auth/validate', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided',
      code: 'NO_TOKEN',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'INVALID_USER',
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
        },
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
});

/**
 * POST /api/auth/change-pin
 * Change user PIN
 */
app.post('/api/auth/change-pin', authenticateToken, async (req, res) => {
  try {
    const schema = z.object({
      currentPin: z.string().min(4),
      newPin: z.string().min(4),
    });

    const { currentPin, newPin } = schema.parse(req.body);
    const userId = req.user.userId;

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
    const isValid = await bcrypt.compare(currentPin, user.pinHash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current PIN is incorrect',
      });
    }

    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);

    // Update PIN
    await prisma.user.update({
      where: { id: userId },
      data: { pinHash: newPinHash },
    });

    res.json({
      success: true,
      message: 'PIN changed successfully. Please log in again.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
    }
    console.error('Change PIN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change PIN',
    });
  }
});

// ============================================
// PROTECTED API ROUTES
// ============================================

// Products
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isDeleted: false },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { products } });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, error: 'Failed to get products' });
  }
});

app.post('/api/products', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: req.body,
    });
    res.json({ success: true, data: { product } });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

// Categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { categories } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get categories' });
  }
});

// Customers
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { customers } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get customers' });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customer = await prisma.customer.create({
      data: req.body,
    });
    res.json({ success: true, data: { customer } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create customer' });
  }
});

// Sales
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: { sales } });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sales' });
  }
});

app.post('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { items, payments, customerId, discount } = req.body;
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const total = subtotal - (discount || 0);

    // Generate receipt number
    const receiptNumber = `RCP${Date.now()}`;

    // Create sale with items and payments in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          receiptNumber,
          subtotal,
          discount: discount || 0,
          total,
          customerId,
          userId: req.user.userId,
          status: 'COMPLETED',
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
          payments: {
            create: payments.map(payment => ({
              method: payment.method,
              amount: payment.amount,
              reference: payment.reference,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
        },
      });

      // Update inventory
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newSale;
    });

    res.json({ success: true, data: { sale } });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ success: false, error: 'Failed to create sale' });
  }
});

// Dashboard Stats
app.get('/api/reports/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySales, totalProducts, lowStockProducts, totalCustomers] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          createdAt: { gte: today },
          status: 'COMPLETED',
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.product.count({ where: { isDeleted: false } }),
      prisma.product.count({
        where: {
          isDeleted: false,
          quantity: { lte: prisma.raw('"minStockLevel"') },
        },
      }),
      prisma.customer.count(),
    ]);

    res.json({
      success: true,
      data: {
        todaySales: todaySales._sum.total || 0,
        todayTransactions: todaySales._count.id || 0,
        totalProducts,
        lowStockProducts,
        totalCustomers,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

// Users (Admin only)
app.get('/api/users', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { users } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

app.post('/api/users', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { email, name, role, pin } = req.body;
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role,
        pinHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    
    res.json({ success: true, data: { user } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// ============================================
// STATIC FILES - FRONTEND
// ============================================

// Serve static files from client/dist in production
const clientDistPath = path.join(__dirname, 'client', 'dist');

if (NODE_ENV === 'production') {
  // Serve static files
  app.use(express.static(clientDistPath));

  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🍎 AppleFlow POS v3.0 - UNIFIED EDITION                        ║
║                                                                  ║
║   ✅ Server running successfully!                                ║
║                                                                  ║
║   Environment: ${NODE_ENV.padEnd(48)}║
║   Port: ${PORT.toString().padEnd(59)}║
║   API: http://localhost:${PORT}/api${' '.repeat(33)}║
║   Health: http://localhost:${PORT}/health${' '.repeat(28)}║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

module.exports = app;
