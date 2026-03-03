/**
 * AppleFlow POS - M-Pesa API Routes
 * Production-hardened endpoints with signature validation
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { mpesaService } from '../services/mpesa';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// PROTECTED ROUTES
// ============================================

// Initiate STK Push
router.post('/stk-push', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      phoneNumber: z.string().min(10),
      amount: z.number().positive(),
      reference: z.string().min(1).max(12),
      saleId: z.string().optional(),
      idempotencyKey: z.string().optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: result.error,
      });
    }

    const { phoneNumber, amount, reference, saleId, idempotencyKey } = result.data;

    const stkResult = await mpesaService.stkPush({
      phoneNumber,
      amount,
      accountReference: reference,
      transactionDesc: 'AppleFlow POS Payment',
      saleId,
      idempotencyKey,
    });

    if (stkResult.success) {
      res.json({
        success: true,
        data: {
          merchantRequestId: stkResult.merchantRequestId,
          checkoutRequestId: stkResult.checkoutRequestId,
          customerMessage: stkResult.customerMessage,
          idempotencyKey: stkResult.idempotencyKey,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: stkResult.errorMessage,
        code: 'PAYMENT_FAILED',
      });
    }
  } catch (error) {
    logger.error('M-Pesa STK push error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to initiate payment',
      code: 'INTERNAL_ERROR',
    });
  }
});

// Check transaction status
router.get('/status/:checkoutRequestId', authenticate, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const status = await mpesaService.checkTransactionStatus(checkoutRequestId);

    res.json({
      success: status.success,
      data: status,
    });
  } catch (error) {
    logger.error('M-Pesa status check error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check transaction status',
    });
  }
});

// Poll transaction status until complete
router.post('/poll-status/:checkoutRequestId', authenticate, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const { maxAttempts = 10, intervalMs = 5000 } = req.body;

    const status = await mpesaService.pollTransactionStatus(
      checkoutRequestId,
      maxAttempts,
      intervalMs
    );

    res.json({
      success: status.success,
      data: status,
    });
  } catch (error) {
    logger.error('M-Pesa poll status error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to poll transaction status',
    });
  }
});

// Retry failed transaction
router.post('/retry/:checkoutRequestId', authenticate, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const result = await mpesaService.retryFailedTransaction(checkoutRequestId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          merchantRequestId: result.merchantRequestId,
          checkoutRequestId: result.checkoutRequestId,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.errorMessage,
      });
    }
  } catch (error) {
    logger.error('M-Pesa retry error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retry transaction',
    });
  }
});

// Validate M-Pesa transaction code
router.post('/validate', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      mpesaCode: z.string().min(5),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid M-Pesa code',
      });
    }

    const validation = await mpesaService.validateTransaction(result.data.mpesaCode);
    res.json({
      success: validation.valid,
      data: validation,
    });
  } catch (error) {
    logger.error('M-Pesa validation error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to validate transaction',
    });
  }
});

// Get M-Pesa transactions
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
    });

    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
    }

    const { page, limit, from, to, status } = result.data;

    const transactions = await mpesaService.getTransactions({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status,
    });

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    logger.error('M-Pesa transactions error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
    });
  }
});

// Reconcile M-Pesa transactions for a date
router.post('/reconcile', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const reconciliation = await mpesaService.reconcile(new Date(result.data.date));
    res.json({
      success: true,
      data: reconciliation,
    });
  } catch (error) {
    logger.error('M-Pesa reconcile error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reconcile transactions',
    });
  }
});

// Register C2B URLs
router.post('/register-url', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await mpesaService.registerC2BUrls();
    res.json(result);
  } catch (error) {
    logger.error('M-Pesa register URL error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to register URLs',
    });
  }
});

// Get M-Pesa statistics
router.get('/statistics', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const schema = z.object({
      period: z.enum(['today', 'week', 'month']).default('today'),
    });

    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period',
      });
    }

    const stats = await mpesaService.getStatistics(result.data.period);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('M-Pesa statistics error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
    });
  }
});

// Simulate payment (sandbox only)
router.post('/simulate', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const schema = z.object({
      phoneNumber: z.string().min(10),
      amount: z.number().positive(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
      });
    }

    const simulation = await mpesaService.simulatePayment(
      result.data.phoneNumber,
      result.data.amount
    );

    res.json(simulation);
  } catch (error) {
    logger.error('M-Pesa simulate error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to simulate payment',
    });
  }
});

// ============================================
// CALLBACK ENDPOINTS (Public - signature verified)
// ============================================

// STK Push callback
router.post('/callback/stk', async (req, res) => {
  try {
    const signature = req.headers['x-mpesa-signature'] as string;
    logger.info('M-Pesa STK Callback received', { 
      body: req.body,
      hasSignature: !!signature,
    });
    
    await mpesaService.handleSTKCallback(req.body, signature);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    logger.error('M-Pesa STK callback error', { error });
    res.json({ ResultCode: 1, ResultDesc: 'Failed' });
  }
});

// C2B Validation
router.post('/c2b/validation', async (req, res) => {
  try {
    logger.info('M-Pesa C2B Validation', { body: req.body });
    const result = await mpesaService.handleC2BValidation(req.body);
    res.json(result);
  } catch (error) {
    logger.error('M-Pesa C2B validation error', { error });
    res.json({ resultCode: 1, resultDesc: 'Validation failed' });
  }
});

// C2B Confirmation
router.post('/c2b/confirmation', async (req, res) => {
  try {
    logger.info('M-Pesa C2B Confirmation', { body: req.body });
    await mpesaService.handleC2BConfirmation(req.body);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    logger.error('M-Pesa C2B confirmation error', { error });
    res.json({ ResultCode: 1, ResultDesc: 'Failed' });
  }
});

export { router as mpesaRouter };
