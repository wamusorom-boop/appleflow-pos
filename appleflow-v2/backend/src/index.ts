/**
 * AppleFlow POS v2.0 - Enterprise Backend
 * Multi-tenant SaaS with Supabase integration
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import { authRouter } from './routes/auth.js';
import { tenantRouter } from './routes/tenant.js';
import { productRouter } from './routes/products.js';
import { saleRouter } from './routes/sales.js';
import { customerRouter } from './routes/customers.js';
import { inventoryRouter } from './routes/inventory.js';
import { reportRouter } from './routes/reports.js';
import { shiftRouter } from './routes/shifts.js';
import { userRouter } from './routes/users.js';
import { storeRouter } from './routes/stores.js';
import { categoryRouter } from './routes/categories.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { setupTenantContext } from './middleware/tenant.js';
import { securityHeaders } from './middleware/security.js';

// Import services
import { logger } from './utils/logger.js';
import { supabase } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Trust proxy for correct IP behind reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(securityHeaders);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Tenant-ID',
    'X-Store-ID',
    'X-Idempotency-Key',
    'X-Request-ID',
  ],
  exposedHeaders: ['X-Request-ID'],
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts, please try again later',
      code: 'AUTH_RATE_LIMIT',
    });
  },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip || 'unknown',
});

app.use(generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/payments', paymentLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// ============================================
// HEALTH CHECKS
// ============================================

app.get('/health', async (req, res) => {
  try {
    // Check Supabase connection
    const { error } = await supabase.from('tenants').select('id').limit(1);
    
    res.json({
      status: error ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      checks: {
        database: error ? 'error' : 'ok',
        supabase: error ? error.message : 'connected',
      },
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

app.get('/ready', async (req, res) => {
  try {
    const { error } = await supabase.from('tenants').select('id').limit(1);
    res.status(error ? 503 : 200).json({ ready: !error });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

// ============================================
// PUBLIC ROUTES
// ============================================

app.use('/api/auth', authRouter);

// ============================================
// PROTECTED ROUTES (Require Authentication)
// ============================================

// Apply authentication to all routes below
app.use(authenticate);

// Setup tenant context for multi-tenancy
app.use(setupTenantContext);

// Tenant management (super admin only)
app.use('/api/tenants', requireRole(['super_admin']), tenantRouter);

// Store management
app.use('/api/stores', storeRouter);

// User management
app.use('/api/users', userRouter);

// Product catalog
app.use('/api/categories', categoryRouter);
app.use('/api/products', productRouter);

// Inventory
app.use('/api/inventory', inventoryRouter);

// Sales & Payments
app.use('/api/sales', saleRouter);

// Customers
app.use('/api/customers', customerRouter);

// Shifts
app.use('/api/shifts', shiftRouter);

// Reports
app.use('/api/reports', reportRouter);

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
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(PORT, () => {
  logger.info(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🍎 AppleFlow POS v2.0 - Enterprise Edition                     ║
║                                                                  ║
║   ✅ Server running successfully!                                ║
║                                                                  ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(48)}║
║   Port: ${PORT.toString().padEnd(59)}║
║   Database: Supabase PostgreSQL${' '.repeat(36)}║
║                                                                  ║
║   Health Check: http://localhost:${PORT}/health${' '.repeat(22)}║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

export default app;
