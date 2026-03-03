/**
 * AppleFlow POS - Payment Reconciliation Worker
 * Background job for reconciling M-Pesa transactions
 */

import { logger } from '../utils/logger';
import { mpesaService } from '../services/mpesa';
import { syncService } from '../services/sync';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Run reconciliation for pending transactions
 */
async function runReconciliation(): Promise<void> {
  if (isRunning) {
    logger.debug('Reconciliation already running, skipping');
    return;
  }

  isRunning = true;
  logger.info('Starting payment reconciliation');

  try {
    // Reconcile today's transactions
    const today = new Date();
    const result = await mpesaService.reconcile(today);

    if (result.unmatched > 0) {
      logger.warn(`Reconciliation found ${result.unmatched} unmatched transactions`, {
        discrepancies: result.discrepancies,
      });
    } else {
      logger.info('Reconciliation completed successfully', {
        matched: result.matched,
        total: result.totalTransactions,
      });
    }
  } catch (error) {
    logger.error('Reconciliation failed', { error });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the reconciliation worker
 */
export function startReconciliationWorker(): void {
  if (intervalId) {
    logger.warn('Reconciliation worker already started');
    return;
  }

  // Run immediately on start
  runReconciliation();

  // Then run every hour
  intervalId = setInterval(runReconciliation, 60 * 60 * 1000);

  logger.info('Reconciliation worker started');
}

/**
 * Stop the reconciliation worker
 */
export function stopReconciliationWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Reconciliation worker stopped');
  }
}
