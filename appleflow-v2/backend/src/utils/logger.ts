/**
 * AppleFlow POS - Logger Utility
 * Structured logging with Winston
 */

import winston from 'winston';

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {
    service: 'appleflow-pos',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        timestamp(),
        errors({ stack: true }),
        process.env.NODE_ENV === 'production' 
          ? json() 
          : combine(colorize(), devFormat)
      ),
    }),
  ],
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: combine(timestamp(), json()),
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    format: combine(timestamp(), json()),
  }));
}

// Request logger middleware format
export const requestLoggerFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Sanitize sensitive data from logs
export function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = [
    'password', 'pin', 'token', 'secret', 'apiKey', 'api_key',
    'authorization', 'cookie', 'session', 'credit_card', 'cvv'
  ];
  
  const sanitized: any = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
}
