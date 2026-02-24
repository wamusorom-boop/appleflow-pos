/**
 * AppleFlow POS - Hardware API Routes
 * Printer, scanner, and cash drawer management
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { hardwareService } from '../services/hardware';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

// Get device status
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await hardwareService.getDeviceStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Hardware status error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get device status',
    });
  }
});

// Add printer
router.post('/printers', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const schema = z.object({
      id: z.string(),
      type: z.enum(['usb', 'network', 'bluetooth']),
      address: z.string(),
      width: z.number().optional(),
      isDefault: z.boolean().optional(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: result.error,
      });
    }

    const { id, type, address, width, isDefault } = result.data;

    const success = await hardwareService.addPrinter(id, {
      type,
      address,
      width,
    }, isDefault);

    if (success) {
      res.json({
        success: true,
        message: 'Printer added successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to connect to printer',
      });
    }
  } catch (error) {
    logger.error('Add printer error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to add printer',
    });
  }
});

// Remove printer
router.delete('/printers/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const success = await hardwareService.removePrinter(id);

    if (success) {
      res.json({
        success: true,
        message: 'Printer removed successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Printer not found',
      });
    }
  } catch (error) {
    logger.error('Remove printer error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to remove printer',
    });
  }
});

// Print receipt
router.post('/print/receipt', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      printerId: z.string().optional(),
      receipt: z.object({
        receiptNumber: z.string(),
        date: z.string(),
        cashier: z.string(),
        items: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
          price: z.number(),
          total: z.number(),
        })),
        subtotal: z.number(),
        tax: z.number().optional(),
        discount: z.number().optional(),
        total: z.number(),
        payments: z.array(z.object({
          method: z.string(),
          amount: z.number(),
        })),
        change: z.number().optional(),
        businessName: z.string().optional(),
        businessInfo: z.array(z.string()).optional(),
        header: z.array(z.string()).optional(),
        footer: z.array(z.string()).optional(),
        qrCode: z.string().optional(),
      }),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: result.error,
      });
    }

    const { printerId, receipt } = result.data;
    const success = await hardwareService.printReceipt(receipt, printerId);

    if (success) {
      res.json({
        success: true,
        message: 'Receipt printed successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to print receipt',
      });
    }
  } catch (error) {
    logger.error('Print receipt error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to print receipt',
    });
  }
});

// Print test page
router.post('/print/test', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      printerId: z.string().optional(),
    });

    const result = schema.safeParse(req.body);
    const printerId = result.success ? result.data.printerId : undefined;

    const success = await hardwareService.printTestPage(printerId);

    if (success) {
      res.json({
        success: true,
        message: 'Test page printed successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to print test page',
      });
    }
  } catch (error) {
    logger.error('Print test page error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to print test page',
    });
  }
});

// Open cash drawer
router.post('/drawer/open', authenticate, async (req, res) => {
  try {
    const schema = z.object({
      printerId: z.string().optional(),
    });

    const result = schema.safeParse(req.body);
    const printerId = result.success ? result.data.printerId : undefined;

    const success = await hardwareService.openCashDrawer(printerId);

    if (success) {
      res.json({
        success: true,
        message: 'Cash drawer opened',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to open cash drawer',
      });
    }
  } catch (error) {
    logger.error('Open drawer error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to open cash drawer',
    });
  }
});

export { router as hardwareRouter };
