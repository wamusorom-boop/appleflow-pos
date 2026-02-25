/**
 * AppleFlow POS - Request Logger Middleware
 * HTTP request/response logging
 */

import { Request, Response, NextFunction } from 'express';
import { logger, sanitizeForLogging } from '../utils/logger.js';

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  res.setHeader('X-Request-ID', requestId as string);
  
  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: sanitizeForLogging(req.query),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
    tenantId: (req as any).user?.tenantId,
  });
  
  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId,
    };
    
    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
}
