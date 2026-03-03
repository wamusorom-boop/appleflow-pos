/**
 * AppleFlow POS - Sync Worker
 * Background job for processing offline sync queue
 */

import { logger } from '../utils/logger';
import { syncService } from '../services/sync';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Run sync queue processing
 */
async function runSync(): Promise<void> {
  if (isRunning) {
    logger.debug('Sync already running, skipping');
    return;
  }

  isRunning = true;

  try {
    const results = await syncService.processQueue(20);
    
    if (results.length > 0) {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success && !r.conflict).length;
      const conflicts = results.filter(r => r.conflict).length;

      logger.info(`Sync batch completed: ${successful} success, ${failed} failed, ${conflicts} conflicts`);
    }
  } catch (error) {
    logger.error('Sync processing failed', { error });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the sync worker
 */
export function startSyncWorker(): void {
  if (intervalId) {
    logger.warn('Sync worker already started');
    return;
  }

  // Run immediately on start
  runSync();

  // Then run every 30 seconds
  intervalId = setInterval(runSync, 30 * 1000);

  logger.info('Sync worker started');
}

/**
 * Stop the sync worker
 */
export function stopSyncWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Sync worker stopped');
  }
}
