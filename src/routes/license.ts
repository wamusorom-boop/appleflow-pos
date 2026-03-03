/**
 * AppleFlow POS - License Management Routes
 */

import { Router } from 'express';
import { prisma } from '../server';
import { generateLicenseKey, isValidLicenseFormat, getLicenseFeatures } from '../middleware/license';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Activate license (public - for initial setup)
router.post('/activate', async (req, res) => {
  try {
    const { key, name, email, phone, deviceId, deviceName } = req.body;

    if (!key || !isValidLicenseFormat(key)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid license key format'
      });
    }

    // Check if license exists
    let license = await prisma.licenseKey.findUnique({
      where: { key }
    });

    if (!license) {
      // Auto-create license for demo purposes (in production, this would be pre-created)
      if (process.env.AUTO_CREATE_LICENSES === 'true') {
        license = await prisma.licenseKey.create({
          data: {
            key,
            name: name || 'Demo User',
            email: email || 'demo@appleflow.pos',
            phone,
            tier: 'PROFESSIONAL',
            status: 'ACTIVE',
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            features: getLicenseFeatures('PROFESSIONAL'),
            createdBy: 'system'
          }
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'License key not found'
        });
      }
    }

    // Check license status
    if (license.status === 'REVOKED') {
      return res.status(403).json({
        success: false,
        error: 'License has been revoked'
      });
    }

    if (license.status === 'EXPIRED' || (license.expiresAt && license.expiresAt < new Date())) {
      return res.status(403).json({
        success: false,
        error: 'License has expired'
      });
    }

    // Check device limit
    const deviceCount = await prisma.licenseDevice.count({
      where: { licenseId: license.id }
    });

    if (deviceCount >= license.maxDevices) {
      return res.status(403).json({
        success: false,
        error: 'Maximum device limit reached',
        maxDevices: license.maxDevices,
        currentDevices: deviceCount
      });
    }

    // Register device
    if (deviceId) {
      await prisma.licenseDevice.upsert({
        where: { deviceId },
        create: {
          licenseId: license.id,
          deviceId,
          deviceName: deviceName || 'Unknown Device',
          lastSeenAt: new Date()
        },
        update: {
          lastSeenAt: new Date()
        }
      });

      // Update device count
      await prisma.licenseKey.update({
        where: { id: license.id },
        data: { 
          deviceCount: deviceCount + 1,
          activatedAt: license.activatedAt || new Date()
        }
      });
    }

    // Update environment variable (in production, this would be done differently)
    process.env.LICENSE_KEY = key;

    return res.json({
      success: true,
      message: 'License activated successfully',
      data: {
        key: license.key,
        tier: license.tier,
        status: license.status,
        expiresAt: license.expiresAt,
        features: license.features,
        maxDevices: license.maxDevices,
        deviceCount: deviceCount + 1
      }
    });
  } catch (error) {
    console.error('License activation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to activate license'
    });
  }
});

// Verify license status (public)
router.get('/verify', async (req, res) => {
  try {
    const key = req.query.key as string || process.env.LICENSE_KEY;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'No license key provided'
      });
    }

    const license = await prisma.licenseKey.findUnique({
      where: { key },
      include: { devices: true }
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        error: 'License not found'
      });
    }

    const isExpired = license.expiresAt ? license.expiresAt < new Date() : false;
    const isValid = license.status === 'ACTIVE' && !isExpired;

    return res.json({
      success: true,
      data: {
        valid: isValid,
        key: license.key,
        tier: license.tier,
        status: isExpired ? 'EXPIRED' : license.status,
        name: license.name,
        email: license.email,
        expiresAt: license.expiresAt,
        features: license.features,
        maxDevices: license.maxDevices,
        deviceCount: license.devices.length,
        devices: license.devices.map(d => ({
          id: d.deviceId,
          name: d.deviceName,
          lastSeen: d.lastSeenAt
        }))
      }
    });
  } catch (error) {
    console.error('License verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify license'
    });
  }
});

// Get license info (authenticated)
router.get('/info', authenticateToken, async (req, res) => {
  try {
    const key = process.env.LICENSE_KEY;
    
    if (!key) {
      return res.json({
        success: true,
        data: {
          valid: false,
          tier: 'UNLICENSED',
          message: 'Running in trial mode'
        }
      });
    }

    const license = await prisma.licenseKey.findUnique({
      where: { key }
    });

    if (!license) {
      return res.json({
        success: true,
        data: {
          valid: false,
          tier: 'UNLICENSED'
        }
      });
    }

    const isExpired = license.expiresAt ? license.expiresAt < new Date() : false;
    const daysUntilExpiry = license.expiresAt 
      ? Math.ceil((license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return res.json({
      success: true,
      data: {
        valid: license.status === 'ACTIVE' && !isExpired,
        key: license.key,
        tier: license.tier,
        status: isExpired ? 'EXPIRED' : license.status,
        name: license.name,
        expiresAt: license.expiresAt,
        daysUntilExpiry,
        features: license.features,
        maxDevices: license.maxDevices
      }
    });
  } catch (error) {
    console.error('Get license info error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get license info'
    });
  }
});

// Admin: Create new license (admin only)
router.post('/create', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { tier, name, email, phone, expiresInDays, maxDevices, notes } = req.body;

    const key = generateLicenseKey();
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const license = await prisma.licenseKey.create({
      data: {
        key,
        name: name || 'New License',
        email: email || '',
        phone,
        tier: tier || 'BASIC',
        status: 'PENDING',
        expiresAt,
        maxDevices: maxDevices || 1,
        features: getLicenseFeatures(tier || 'BASIC'),
        notes,
        createdBy: (req as any).user.id
      }
    });

    return res.json({
      success: true,
      message: 'License created successfully',
      data: {
        key: license.key,
        tier: license.tier,
        expiresAt: license.expiresAt,
        status: license.status
      }
    });
  } catch (error) {
    console.error('Create license error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create license'
    });
  }
});

// Admin: List all licenses (admin only)
router.get('/list', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const licenses = await prisma.licenseKey.findMany({
      include: {
        _count: {
          select: { devices: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: licenses.map(l => ({
        id: l.id,
        key: l.key,
        name: l.name,
        email: l.email,
        tier: l.tier,
        status: l.status,
        activatedAt: l.activatedAt,
        expiresAt: l.expiresAt,
        maxDevices: l.maxDevices,
        deviceCount: l._count.devices,
        createdAt: l.createdAt
      }))
    });
  } catch (error) {
    console.error('List licenses error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list licenses'
    });
  }
});

// Admin: Revoke license (admin only)
router.post('/revoke/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.licenseKey.update({
      where: { id },
      data: { status: 'REVOKED' }
    });

    return res.json({
      success: true,
      message: 'License revoked successfully'
    });
  } catch (error) {
    console.error('Revoke license error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke license'
    });
  }
});

export { router as licenseRouter };
