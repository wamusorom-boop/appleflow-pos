/**
 * AppleFlow POS - WebSocket Hook
 * Real-time updates using Socket.IO client
 */

import { useEffect, useRef, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { TokenManager } from '@/lib/api';

// WebSocket configuration
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

// Event handlers type
type EventHandler = (data: any) => void;

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onConnect, onDisconnect, onError } = options;
  
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const eventHandlersRef = useRef<Map<string, EventHandler[]>>(new Map());

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setIsConnecting(true);

    const token = TokenManager.getAccessToken();
    if (!token) {
      setIsConnecting(false);
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      onDisconnect?.(reason);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnecting(false);
      onError?.(error);
    });

    // Re-register event handlers
    eventHandlersRef.current.forEach((handlers, event) => {
      handlers.forEach(handler => {
        socket.on(event, handler);
      });
    });

    socketRef.current = socket;
  }, [onConnect, onDisconnect, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Subscribe to an event
  const subscribe = useCallback(<T = any>(
    event: string,
    handler: (data: T) => void
  ): (() => void) => {
    // Store handler for reconnection
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.push(handler as EventHandler);
    eventHandlersRef.current.set(event, handlers);

    // Register with current socket
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlersRef.current.get(event) || [];
      const updatedHandlers = handlers.filter(h => h !== handler);
      
      if (updatedHandlers.length === 0) {
        eventHandlersRef.current.delete(event);
      } else {
        eventHandlersRef.current.set(event, updatedHandlers);
      }

      socketRef.current?.off(event, handler);
    };
  }, []);

  // Emit an event
  const emit = useCallback(<T = any>(event: string, data: T): void => {
    socketRef.current?.emit(event, data);
  }, []);

  // Join a room
  const joinRoom = useCallback((room: string): void => {
    socketRef.current?.emit('subscribe', room);
  }, []);

  // Leave a room
  const leaveRoom = useCallback((room: string): void => {
    socketRef.current?.emit('unsubscribe', room);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    subscribe,
    emit,
    joinRoom,
    leaveRoom,
  };
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

// Hook for real-time sales updates
export function useRealtimeSales(onSaleCreated?: (sale: any) => void, onSaleVoided?: (sale: any) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onSaleCreated) {
      unsubscribers.push(subscribe('sale:created', onSaleCreated));
    }

    if (onSaleVoided) {
      unsubscribers.push(subscribe('sale:voided', onSaleVoided));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [subscribe, onSaleCreated, onSaleVoided]);

  return { isConnected };
}

// Hook for real-time inventory updates
export function useRealtimeInventory(
  onInventoryUpdate?: (data: { productId: string; quantity: number; lowStock: boolean }) => void,
  onLowStockAlert?: (product: any) => void
) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (onInventoryUpdate) {
      unsubscribers.push(subscribe('inventory:update', onInventoryUpdate));
    }

    if (onLowStockAlert) {
      unsubscribers.push(subscribe('alert:low-stock', onLowStockAlert));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [subscribe, onInventoryUpdate, onLowStockAlert]);

  return { isConnected };
}

// Hook for real-time notifications
export function useRealtimeNotifications(onNotification?: (notification: any) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!onNotification) return;

    return subscribe('notification:new', onNotification);
  }, [subscribe, onNotification]);

  return { isConnected };
}

// Hook for real-time M-Pesa updates
export function useRealtimeMpesa(
  checkoutRequestId: string | null,
  onUpdate?: (data: { status: string; [key: string]: any }) => void
) {
  const { subscribe, isConnected, joinRoom, leaveRoom } = useWebSocket();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutRequestId) return;

    // Join room for this specific transaction
    joinRoom(`mpesa:${checkoutRequestId}`);

    const unsubscribe = subscribe('mpesa:update', (data: any) => {
      if (data.checkoutRequestId === checkoutRequestId) {
        setStatus(data.status);
        onUpdate?.(data);
      }
    });

    return () => {
      unsubscribe();
      leaveRoom(`mpesa:${checkoutRequestId}`);
    };
  }, [checkoutRequestId, subscribe, joinRoom, leaveRoom, onUpdate]);

  return { isConnected, status };
}

// Hook for real-time KRA updates
export function useRealtimeKra(
  saleId: string | null,
  onUpdate?: (data: { status: string; [key: string]: any }) => void
) {
  const { subscribe, isConnected } = useWebSocket();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!saleId) return;

    const unsubscribe = subscribe('kra:update', (data: any) => {
      if (data.saleId === saleId) {
        setStatus(data.status);
        onUpdate?.(data);
      }
    });

    return unsubscribe;
  }, [saleId, subscribe, onUpdate]);

  return { isConnected, status };
}

// Hook for real-time dashboard stats
export function useRealtimeDashboard(onStatsUpdate?: (stats: any) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!onStatsUpdate) return;

    return subscribe('dashboard:stats', onStatsUpdate);
  }, [subscribe, onStatsUpdate]);

  return { isConnected };
}

// Hook for shift updates
export function useRealtimeShift(onShiftUpdate?: (shift: any) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!onShiftUpdate) return;

    return subscribe('shift:update', onShiftUpdate);
  }, [subscribe, onShiftUpdate]);

  return { isConnected };
}

// Hook for system messages
export function useSystemMessages(onMessage?: (message: { message: string; type: string }) => void) {
  const { subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    if (!onMessage) return;

    return subscribe('system:message', onMessage);
  }, [subscribe, onMessage]);

  return { isConnected };
}

// ============================================
// WEBSOCKET PROVIDER CONTEXT
// ============================================

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  subscribe: <T = any>(event: string, handler: (data: T) => void) => (() => void);
  emit: <T = any>(event: string, data: T) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket({ autoConnect: true });

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
