/**
 * AppleFlow POS - License Key Verification System
 * Protects against unauthorized usage
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import crypto from 'crypto';

// License check middleware
export const verifyLicense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip license check for health and setup endpoints
    const publicPaths = ['/health', '/ready', '/live', '/api/auth/login', '/api/license/activate', '/api/license/verify'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Check if license is configured
    const licenseKey = process.env.LICENSE_KEY;
    
    if (!licenseKey) {
      // Allow operation but warn in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  No LICENSE_KEY configured - running in development mode');
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'License key not configured',
        code: 'LICENSE_NOT_CONFIGURED',
        message: 'Please configure a valid license key to use AppleFlow POS'
      });
    }

    // Verify license in database
    const license = await prisma.licenseKey.findUnique({
      where: { key: licenseKey }
    });

    if (!license) {
      return res.status(403).json({
        success: false,
        error: 'Invalid license key',
        code: 'INVALID_LICENSE',
        message: 'The license key is not recognized'
      });
    }

    // Check license status
    if (license.status === 'REVOKED') {
      return res.status(403).json({
        success: false,
        error: 'License revoked',
        code: 'LICENSE_REVOKED',
        message: 'This license has been revoked. Please contact support.'
      });
    }

    if (license.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: 'License suspended',
        code: 'LICENSE_SUSPENDED',
        message: 'This license has been suspended. Please contact support.'
      });
    }

    if (license.status === 'EXPIRED' || (license.expiresAt && license.expiresAt < new Date())) {
      return res.status(403).json({
        success: false,
        error: 'License expired',
        code: 'LICENSE_EXPIRED',
        message: 'Your license has expired. Please renew to continue using AppleFlow POS.'
      });
    }

    // Check device limit
    const deviceId = req.headers['x-device-id'] as string || 'default';
    
    // Update last verified
    await prisma.licenseKey.update({
      where: { id: license.id },
      data: { lastVerifiedAt: new Date() }
    });

    // Attach license info to request
    (req as any).license = license;
    
    next();
  } catch (error) {
    console.error('License verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'License verification failed',
      code: 'LICENSE_ERROR'
    });
  }
};

// Generate a new license key
export const generateLicenseKey = (): string => {
  const prefix = 'AFP';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  const checksum = crypto.createHash('md5').update(`${prefix}${timestamp}${random}`).digest('hex').substring(0, 4).toUpperCase();
  
  return `${prefix}-${timestamp}-${random}-${checksum}`;
};

// Validate license key format
export const isValidLicenseFormat = (key: string): boolean => {
  const pattern = /^AFP-[A-Z0-9]+-[A-F0-9]{8}-[A-F0-9]{4}$/;
  return pattern.test(key);
};

// Get license features based on tier
export const getLicenseFeatures = (tier: string) => {
  const features: Record<string, any> = {
    TRIAL: {
      maxProducts: 100,
      maxUsers: 2,
      maxStores: 1,
      features: ['basic_pos', 'inventory', 'reports'],
      support: 'email',
      expiresInDays: 14
    },
    BASIC: {
      maxProducts: 1000,
      maxUsers: 3,
      maxStores: 1,
      features: ['basic_pos', 'inventory', 'customers', 'reports', 'mpesa'],
      support: 'email'
    },
    STANDARD: {
      maxProducts: 5000,
      maxUsers: 10,
      maxStores: 3,
      features: ['basic_pos', 'inventory', 'customers', 'reports', 'mpesa', 'loyalty', 'gift_cards', 'multi_user'],
      support: 'email_chat'
    },
    PROFESSIONAL: {
      maxProducts: 20000,
      maxUsers: 25,
      maxStores: 10,
      features: ['basic_pos', 'inventory', 'customers', 'reports', 'mpesa', 'loyalty', 'gift_cards', 'multi_user', 'advanced_reports', 'api_access', 'integrations', 'table_management'],
      support: 'priority'
    },
    ENTERPRISE: {
      maxProducts: -1, // unlimited
      maxUsers: -1,
      maxStores: -1,
      features: ['all_features', 'white_label', 'dedicated_support', 'custom_development', 'sla'],
      support: 'dedicated'
    }
  };
  
  return features[tier] || features.BASIC;
};
