/**
 * AppleFlow POS Backend API - ULTIMATE EDITION
 * Production-ready Express server with security hardening and license protection
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Initialize Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

// Import routes
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { salesRouter } from './routes/sales';
import { customersRouter } from './routes/customers';
import { shiftsRouter } from './routes/shifts';
import { reportsRouter } from './routes/reports';
import { inventoryRouter } from './routes/inventory';
import { mpesaRouter } from './routes/mpesa';
import { hardwareRouter } from './routes/hardware';
import { syncRouter } from './routes/sync';
import { settingsRouter } from './routes/settings';
import { licenseRouter } from './routes/license';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authenticateToken } from './middleware/auth';
import { verifyLicense } from './middleware/license';
import { websocketService } from './services/websocket';
import { logger } from './utils/logger';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Trust proxy for correct IP behind reverse proxy
app.set('trust proxy', 1);

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration - allow all origins for development
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'https://appleflow-pos-web.onrender.com',
  '*'
];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Request-ID', 'X-Device-ID'],
  exposedHeaders: ['X-Request-ID'],
}));

// Rate limiting - general API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
});
app.use('/api/', generalLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many login attempts, please try again later',
    code: 'AUTH_RATE_LIMIT',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// Stricter rate limit for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 payment requests per minute
  message: {
    success: false,
    error: 'Payment rate limit exceeded',
    code: 'PAYMENT_RATE_LIMIT',
  },
});
app.use('/api/mpesa/stk-push', paymentLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// ============================================
// LICENSE VERIFICATION (After public routes, before protected)
// ============================================
app.use(verifyLicense);

// ============================================
// HEALTH CHECKS & MONITORING
// ============================================

// Basic health check - PUBLIC
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      checks: {
        database: 'ok',
        websocket: websocketService.isInitialized() ? 'ok' : 'not_initialized',
      },
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// Detailed health check (authenticated)
app.get('/health/detailed', authenticateToken, async (req, res) => {
  try {
    const [dbCheck, licenseStatus] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'error'),
      Promise.resolve(process.env.LICENSE_KEY ? 'configured' : 'not_configured'),
    ]);

    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: dbCheck === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      },
      checks: {
        database: dbCheck,
        license: licenseStatus,
        websocket: websocketService.isInitialized() ? 'ok' : 'not_initialized',
      },
    });
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Readiness probe for Kubernetes
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

// Liveness probe for Kubernetes
app.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

// ============================================
// API ROUTES
// ============================================

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/license', licenseRouter);

// M-Pesa callbacks (public - signature verified internally)
app.use('/api/mpesa/callback', mpesaRouter);
app.use('/api/mpesa/c2b', mpesaRouter);

// Protected routes
app.use('/api/products', authenticateToken, productsRouter);
app.use('/api/sales', authenticateToken, salesRouter);
app.use('/api/customers', authenticateToken, customersRouter);
app.use('/api/shifts', authenticateToken, shiftsRouter);
app.use('/api/reports', authenticateToken, reportsRouter);
app.use('/api/inventory', authenticateToken, inventoryRouter);
app.use('/api/mpesa', authenticateToken, mpesaRouter);
app.use('/api/hardware', authenticateToken, hardwareRouter);
app.use('/api/sync', authenticateToken, syncRouter);
app.use('/api/settings', authenticateToken, settingsRouter);

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

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    
    // Initialize WebSocket service
    websocketService.initialize(server);
    
    // Start background workers (if not in test mode)
    if (process.env.NODE_ENV !== 'test') {
      // Dynamic imports to avoid circular dependencies
      const { startReconciliationWorker } = await import('./workers/reconciliation');
      const { startSyncWorker } = await import('./workers/sync');
      startReconciliationWorker();
      startSyncWorker();
    }
    
    server.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   🍎 AppleFlow POS - ULTIMATE EDITION                            ║
║                                                                  ║
║   ✅ Server running successfully!                                ║
║                                                                  ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(48)}║
║   Port: ${PORT.toString().padEnd(59)}║
║   Database: ${(process.env.DATABASE_URL?.split('://')[0] || 'unknown').padEnd(54)}║
║   License: ${(process.env.LICENSE_KEY ? '✅ Configured' : '⚠️  Not configured').padEnd(54)}║
║   M-Pesa: ${(process.env.MPESA_ENVIRONMENT || 'disabled').padEnd(55)}║
║                                                                  ║
║   Health Check: http://localhost:${PORT}/health${' '.repeat(22)}║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('❌ Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

startServer();

export default app;
