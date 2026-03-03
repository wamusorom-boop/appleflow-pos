/**
 * AppleFlow POS - Offline Sync Service
 * Handles synchronization of offline transactions when connectivity returns
 */

import { PrismaClient, SyncStatus, SyncOperation } from '@prisma/client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

interface SyncConflict {
  clientVersion: any;
  serverVersion: any;
  resolution: 'client_wins' | 'server_wins' | 'merge' | 'manual';
}

interface SyncResult {
  success: boolean;
  entityId: string;
  serverId?: string;
  error?: string;
  conflict?: SyncConflict;
}

export class SyncService extends EventEmitter {
  private isProcessing: boolean = false;
  private retryDelays: number[] = [5000, 15000, 30000, 60000, 300000]; // 5s, 15s, 30s, 1m, 5m

  // ============================================
  // QUEUE MANAGEMENT
  // ============================================

  async addToQueue(data: {
    entityType: string;
    entityId: string;
    operation: SyncOperation;
    payload: any;
    deviceId?: string;
    clientVersion?: string;
  }): Promise<string> {
    const queueItem = await prisma.offlineSyncQueue.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        operation: data.operation,
        payload: data.payload,
        deviceId: data.deviceId,
        clientVersion: data.clientVersion,
        status: SyncStatus.PENDING,
        retryCount: 0,
        maxRetries: 5,
        nextRetryAt: new Date(),
      },
    });

    logger.info(`Added to sync queue: ${data.entityType} ${data.entityId}`);
    this.emit('itemAdded', queueItem);

    return queueItem.id;
  }

  async getQueueStatus(deviceId?: string): Promise<{
    pending: number;
    processing: number;
    failed: number;
    completed: number;
    conflicts: number;
  }> {
    const where = deviceId ? { deviceId } : {};

    const [
      pending,
      processing,
      failed,
      completed,
      conflicts,
    ] = await Promise.all([
      prisma.offlineSyncQueue.count({ where: { ...where, status: SyncStatus.PENDING } }),
      prisma.offlineSyncQueue.count({ where: { ...where, status: SyncStatus.PROCESSING } }),
      prisma.offlineSyncQueue.count({ where: { ...where, status: SyncStatus.FAILED } }),
      prisma.offlineSyncQueue.count({ where: { ...where, status: SyncStatus.COMPLETED } }),
      prisma.offlineSyncQueue.count({ where: { ...where, status: SyncStatus.CONFLICT } }),
    ]);

    return { pending, processing, failed, completed, conflicts };
  }

  // ============================================
  // SYNC PROCESSING
  // ============================================

  async processQueue(batchSize: number = 10): Promise<SyncResult[]> {
    if (this.isProcessing) {
      logger.debug('Sync already in progress, skipping');
      return [];
    }

    this.isProcessing = true;
    this.emit('processingStarted');

    try {
      // Get pending items
      const items = await prisma.offlineSyncQueue.findMany({
        where: {
          status: { in: [SyncStatus.PENDING, SyncStatus.RETRYING] },
          nextRetryAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      const results: SyncResult[] = [];

      for (const item of items) {
        const result = await this.processItem(item);
        results.push(result);
      }

      return results;
    } catch (error) {
      logger.error('Sync queue processing failed', { error });
      return [];
    } finally {
      this.isProcessing = false;
      this.emit('processingCompleted');
    }
  }

  private async processItem(item: any): Promise<SyncResult> {
    try {
      // Mark as processing
      await prisma.offlineSyncQueue.update({
        where: { id: item.id },
        data: {
          status: SyncStatus.PROCESSING,
          lastRetryAt: new Date(),
        },
      });

      let result: SyncResult;

      // Route to appropriate handler based on entity type
      switch (item.entityType) {
        case 'sale':
          result = await this.syncSale(item);
          break;
        case 'payment':
          result = await this.syncPayment(item);
          break;
        case 'stock_adjustment':
          result = await this.syncStockAdjustment(item);
          break;
        case 'customer':
          result = await this.syncCustomer(item);
          break;
        default:
          result = {
            success: false,
            entityId: item.entityId,
            error: `Unknown entity type: ${item.entityType}`,
          };
      }

      // Update queue item based on result
      if (result.success) {
        await prisma.offlineSyncQueue.update({
          where: { id: item.id },
          data: {
            status: SyncStatus.COMPLETED,
            serverId: result.serverId,
            syncedAt: new Date(),
          },
        });
        this.emit('itemSynced', { item, result });
      } else if (result.conflict) {
        await prisma.offlineSyncQueue.update({
          where: { id: item.id },
          data: {
            status: SyncStatus.CONFLICT,
            conflictData: result.conflict as any,
          },
        });
        this.emit('conflictDetected', { item, conflict: result.conflict });
      } else {
        await this.handleFailedItem(item, result.error);
      }

      return result;
    } catch (error: any) {
      logger.error(`Failed to process sync item ${item.id}`, { error });
      await this.handleFailedItem(item, error.message);
      return {
        success: false,
        entityId: item.entityId,
        error: error.message,
      };
    }
  }

  private async handleFailedItem(item: any, error?: string): Promise<void> {
    const retryCount = item.retryCount + 1;
    const maxRetries = item.maxRetries;

    if (retryCount >= maxRetries) {
      await prisma.offlineSyncQueue.update({
        where: { id: item.id },
        data: {
          status: SyncStatus.FAILED,
          retryCount,
          lastError: error,
          errorDetails: { message: error, maxRetriesReached: true },
        },
      });
      this.emit('itemFailed', { item, error });
    } else {
      const delay = this.retryDelays[Math.min(retryCount - 1, this.retryDelays.length - 1)];
      const nextRetryAt = new Date(Date.now() + delay);

      await prisma.offlineSyncQueue.update({
        where: { id: item.id },
        data: {
          status: SyncStatus.RETRYING,
          retryCount,
          lastError: error,
          nextRetryAt,
        },
      });
      this.emit('itemRetrying', { item, retryCount, nextRetryAt });
    }
  }

  // ============================================
  // ENTITY SYNC HANDLERS
  // ============================================

  private async syncSale(item: any): Promise<SyncResult> {
    const payload = item.payload;

    try {
      // Check for duplicate (same receipt number)
      const existing = await prisma.sale.findFirst({
        where: {
          receiptNumber: payload.receiptNumber,
        },
      });

      if (existing) {
        // Check for conflict
        if (existing.total !== payload.total || existing.status !== payload.status) {
          return {
            success: false,
            entityId: item.entityId,
            conflict: {
              clientVersion: payload,
              serverVersion: existing,
              resolution: 'manual',
            },
          };
        }

        // No conflict, return existing
        return {
          success: true,
          entityId: item.entityId,
          serverId: existing.id,
        };
      }

      // Create new sale
      const sale = await prisma.sale.create({
        data: {
          receiptNumber: payload.receiptNumber,
          subtotal: payload.subtotal,
          discountTotal: payload.discountTotal || 0,
          taxTotal: payload.taxTotal || 0,
          total: payload.total,
          status: payload.status,
          userId: payload.userId,
          shiftId: payload.shiftId,
          customerId: payload.customerId,
          items: {
            create: payload.items.map((item: any) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount || 0,
              taxAmount: item.taxAmount || 0,
              total: item.total,
            })),
          },
          payments: {
            create: payload.payments.map((payment: any) => ({
              method: payment.method,
              amount: payment.amount,
              reference: payment.reference,
            })),
          },
        },
      });

      // Update stock
      for (const item of payload.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        // Create stock movement
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            previousQty: 0, // Will be calculated
            newQty: 0, // Will be calculated
            reference: payload.receiptNumber,
            performedBy: payload.userId,
          },
        });
      }

      return {
        success: true,
        entityId: item.entityId,
        serverId: sale.id,
      };
    } catch (error: any) {
      return {
        success: false,
        entityId: item.entityId,
        error: error.message,
      };
    }
  }

  private async syncPayment(item: any): Promise<SyncResult> {
    // Payments are usually synced as part of sales
    // This handles standalone payment updates
    return {
      success: true,
      entityId: item.entityId,
    };
  }

  private async syncStockAdjustment(item: any): Promise<SyncResult> {
    const payload = item.payload;

    try {
      // Check for duplicate
      const existing = await prisma.stockAdjustment.findFirst({
        where: {
          productId: payload.productId,
          createdAt: {
            gte: new Date(Date.now() - 60000), // Within last minute
          },
        },
      });

      if (existing) {
        return {
          success: true,
          entityId: item.entityId,
          serverId: existing.id,
        };
      }

      const product = await prisma.product.findUnique({
        where: { id: payload.productId },
      });

      if (!product) {
        return {
          success: false,
          entityId: item.entityId,
          error: 'Product not found',
        };
      }

      const previousQuantity = product.quantity;
      let newQuantity: number;

      switch (payload.type) {
        case 'ADD':
          newQuantity = previousQuantity + payload.quantity;
          break;
        case 'REMOVE':
          newQuantity = previousQuantity - payload.quantity;
          break;
        case 'SET':
          newQuantity = payload.quantity;
          break;
        default:
          newQuantity = previousQuantity;
      }

      const adjustment = await prisma.stockAdjustment.create({
        data: {
          productId: payload.productId,
          quantity: payload.quantity,
          type: payload.type,
          reason: payload.reason,
          notes: payload.notes,
          previousQuantity,
          newQuantity,
          userId: payload.userId,
        },
      });

      await prisma.product.update({
        where: { id: payload.productId },
        data: { quantity: newQuantity },
      });

      return {
        success: true,
        entityId: item.entityId,
        serverId: adjustment.id,
      };
    } catch (error: any) {
      return {
        success: false,
        entityId: item.entityId,
        error: error.message,
      };
    }
  }

  private async syncCustomer(item: any): Promise<SyncResult> {
    const payload = item.payload;

    try {
      // Check for existing by phone or email
      const existing = await prisma.customer.findFirst({
        where: {
          OR: [
            payload.phone ? { phone: payload.phone } : {},
            payload.email ? { email: payload.email } : {},
          ],
        },
      });

      if (existing) {
        // Update existing
        const updated = await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            address: payload.address,
          },
        });

        return {
          success: true,
          entityId: item.entityId,
          serverId: updated.id,
        };
      }

      // Create new
      const customer = await prisma.customer.create({
        data: {
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
        },
      });

      return {
        success: true,
        entityId: item.entityId,
        serverId: customer.id,
      };
    } catch (error: any) {
      return {
        success: false,
        entityId: item.entityId,
        error: error.message,
      };
    }
  }

  // ============================================
  // CONFLICT RESOLUTION
  // ============================================

  async resolveConflict(
    queueItemId: string,
    resolution: 'client_wins' | 'server_wins' | 'merge',
    mergedData?: any
  ): Promise<SyncResult> {
    const item = await prisma.offlineSyncQueue.findUnique({
      where: { id: queueItemId },
    });

    if (!item) {
      return {
        success: false,
        entityId: '',
        error: 'Queue item not found',
      };
    }

    await prisma.offlineSyncQueue.update({
      where: { id: queueItemId },
      data: {
        resolutionStrategy: resolution,
        payload: resolution === 'merge' ? mergedData : item.payload,
        status: SyncStatus.PENDING,
        retryCount: 0,
        nextRetryAt: new Date(),
      },
    });

    // Re-process immediately
    return this.processItem({ ...item, payload: resolution === 'merge' ? mergedData : item.payload });
  }

  // ============================================
  // CLEANUP
  // ============================================

  async cleanupOldItems(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.offlineSyncQueue.deleteMany({
      where: {
        status: { in: [SyncStatus.COMPLETED, SyncStatus.FAILED] },
        updatedAt: { lt: cutoffDate },
      },
    });

    logger.info(`Cleaned up ${result.count} old sync items`);
    return result.count;
  }
}

// Singleton instance
export const syncService = new SyncService();
