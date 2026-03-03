/**
 * AppleFlow POS - Sync API Routes
 * Offline synchronization endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { syncService } from '../services/sync';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Get sync queue status
router.get('/status', authenticate, async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const status = await syncService.getQueueStatus(deviceId);
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Sync status error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
    });
  }
});

// Add item to sync queue
router.post('/queue', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      entityType: z.string(),
      entityId: z.string(),
      operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
      payload: z.record(z.any()),
      deviceId: z.string().optional(),
      clientVersion: z.string().optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: result.error,
      });
    }

    const queueId = await syncService.addToQueue({
      ...result.data,
    });

    res.json({
      success: true,
      data: { queueId },
    });
  } catch (error) {
    logger.error('Add to queue error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to add to queue',
    });
  }
});

// Process sync queue (admin only)
router.post('/process', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      batchSize: z.number().min(1).max(50).optional(),
    });

    const result = schema.safeParse(req.body);
    const batchSize = result.success ? result.data.batchSize : 10;

    const results = await syncService.processQueue(batchSize);

    res.json({
      success: true,
      data: {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success && !r.conflict).length,
        conflicts: results.filter(r => r.conflict).length,
        results,
      },
    });
  } catch (error) {
    logger.error('Process queue error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to process queue',
    });
  }
});

// Get pending items for device
router.get('/pending', authenticate, async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required',
      });
    }

    const items = await prisma.offlineSyncQueue.findMany({
      where: {
        deviceId,
        status: { in: ['PENDING', 'PROCESSING', 'RETRYING', 'CONFLICT'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    logger.error('Get pending items error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get pending items',
    });
  }
});

// Resolve conflict
router.post('/resolve/:queueId', authenticate, async (req, res) => {
  try {
    const { queueId } = req.params;
    
    const schema = z.object({
      resolution: z.enum(['client_wins', 'server_wins', 'merge']),
      mergedData: z.record(z.any()).optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: result.error,
      });
    }

    const { resolution, mergedData } = result.data;

    const syncResult = await syncService.resolveConflict(queueId, resolution, mergedData);

    res.json({
      success: syncResult.success,
      data: syncResult,
    });
  } catch (error) {
    logger.error('Resolve conflict error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve conflict',
    });
  }
});

// Cleanup old items (admin only)
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      days: z.number().min(1).max(365).optional(),
    });

    const result = schema.safeParse(req.body);
    const days = result.success ? result.data.days : 30;

    const count = await syncService.cleanupOldItems(days);

    res.json({
      success: true,
      data: { deleted: count },
    });
  } catch (error) {
    logger.error('Cleanup error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old items',
    });
  }
});

export { router as syncRouter };
