/**
 * AppleFlow POS - WebSocket Service
 * Real-time updates for sales, inventory, and notifications
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface SocketUser {
  userId: string;
  email: string;
  role: string;
}

export class WebSocketService {
  private io: SocketServer | null = null;
  private userSockets: Map<string, string[]> = new Map();
  private initialized: boolean = false;

  initialize(server: HttpServer): void {
    if (this.initialized) {
      logger.warn('WebSocket server already initialized');
      return;
    }

    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || [process.env.FRONTEND_URL || 'http://localhost:5173'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Authentication middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, JWT_SECRET) as SocketUser;
        socket.data.user = decoded;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: Socket) => {
      logger.debug(`Client connected: ${socket.id}`);
      
      const user = socket.data.user as SocketUser;
      
      // Track user's sockets
      const userSocketIds = this.userSockets.get(user.userId) || [];
      userSocketIds.push(socket.id);
      this.userSockets.set(user.userId, userSocketIds);

      // Join role-based rooms
      socket.join(`role:${user.role}`);
      socket.join('all');

      // Handle subscription to specific rooms
      socket.on('subscribe', (room: string) => {
        socket.join(room);
        logger.debug(`Socket ${socket.id} subscribed to ${room}`);
      });

      socket.on('unsubscribe', (room: string) => {
        socket.leave(room);
        logger.debug(`Socket ${socket.id} unsubscribed from ${room}`);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.debug(`Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Remove from user sockets
        const sockets = this.userSockets.get(user.userId) || [];
        const updatedSockets = sockets.filter(id => id !== socket.id);
        
        if (updatedSockets.length === 0) {
          this.userSockets.delete(user.userId);
        } else {
          this.userSockets.set(user.userId, updatedSockets);
        }
      });
    });

    this.initialized = true;
    logger.info('WebSocket server initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getIO(): SocketServer {
    if (!this.io) {
      throw new Error('WebSocket server not initialized');
    }
    return this.io;
  }

  // ============================================
  // EMIT METHODS
  // ============================================

  emitToAll(event: string, data: any): void {
    if (!this.io) return;
    this.io.to('all').emit(event, data);
  }

  emitToRoom(room: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io?.to(socketId).emit(event, data);
      });
    }
  }

  emitToRole(role: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`role:${role}`).emit(event, data);
  }

  // ============================================
  // BUSINESS EVENTS
  // ============================================

  emitSaleCreated(sale: any): void {
    this.emitToAll('sale:created', {
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      total: sale.total,
      createdAt: sale.createdAt,
    });

    this.emitToRole('admin', 'dashboard:sale', { sale });
    this.emitToRole('manager', 'dashboard:sale', { sale });
  }

  emitSaleVoided(sale: any): void {
    this.emitToAll('sale:voided', {
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      voidedAt: sale.voidedAt,
      voidedBy: sale.voidedBy,
    });
  }

  emitInventoryUpdate(productId: string, quantity: number, lowStock: boolean): void {
    this.emitToAll('inventory:update', {
      productId,
      quantity,
      lowStock,
      timestamp: new Date().toISOString(),
    });

    if (lowStock) {
      this.emitToRole('admin', 'inventory:low-stock', { productId, quantity });
      this.emitToRole('manager', 'inventory:low-stock', { productId, quantity });
    }
  }

  emitShiftUpdate(shift: any): void {
    this.emitToRole('admin', 'shift:update', { shift });
    this.emitToRole('manager', 'shift:update', { shift });
    this.emitToUser(shift.userId, 'shift:update', { shift });
  }

  emitNotification(notification: any, userId?: string): void {
    if (userId) {
      this.emitToUser(userId, 'notification:new', notification);
    } else {
      this.emitToRole('admin', 'notification:new', notification);
      this.emitToRole('manager', 'notification:new', notification);
    }
  }

  emitMpesaUpdate(checkoutRequestId: string, status: string, data?: any): void {
    this.emitToAll('mpesa:update', {
      checkoutRequestId,
      status,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitDashboardStats(stats: any): void {
    this.emitToRole('admin', 'dashboard:stats', stats);
    this.emitToRole('manager', 'dashboard:stats', stats);
  }

  getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  broadcastSystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.emitToAll('system:message', {
      message,
      type,
      timestamp: new Date().toISOString(),
    });
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
