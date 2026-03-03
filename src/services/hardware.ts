/**
 * AppleFlow POS - Hardware Integration Service
 * Abstraction layer for receipt printers, barcode scanners, cash drawers
 */

import { PrismaClient, HardwareType } from '@prisma/client';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

// ============================================
// TYPES & INTERFACES
// ============================================

export interface PrinterConfig {
  type: 'usb' | 'network' | 'bluetooth';
  address: string; // IP:port, device path, or MAC address
  width?: number; // Paper width in characters (default: 48)
  encoding?: string; // Character encoding (default: 'utf8')
  cutPaper?: boolean; // Auto-cut after print (default: true)
}

export interface BarcodeScannerConfig {
  type: 'keyboard' | 'serial' | 'usb-hid';
  devicePath?: string;
  prefix?: string; // Barcode prefix character
  suffix?: string; // Barcode suffix character (usually Enter)
}

export interface CashDrawerConfig {
  type: 'printer' | 'usb' | 'serial';
  printerName?: string; // If connected via printer
  devicePath?: string; // If direct USB/serial
  openCode?: string; // ESC/POS open drawer command
}

export interface ReceiptData {
  header?: string[];
  businessName?: string;
  businessInfo?: string[];
  receiptNumber: string;
  date: string;
  cashier: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
  }>;
  change?: number;
  footer?: string[];
  qrCode?: string;
}

// ============================================
// PRINTER PROVIDER INTERFACE
// ============================================

abstract class PrinterProvider extends EventEmitter {
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;
  abstract print(data: Buffer): Promise<boolean>;
  abstract cut(): Promise<boolean>;
  abstract openDrawer(): Promise<boolean>;
  abstract getStatus(): { connected: boolean; error?: string };
}

// ============================================
// NETWORK PRINTER PROVIDER
// ============================================

class NetworkPrinterProvider extends PrinterProvider {
  private config: PrinterConfig;
  private connected: boolean = false;
  private socket: any = null;

  constructor(config: PrinterConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      // Dynamic import to avoid issues if net is not available
      const net = await import('net');
      
      const [host, port] = this.config.address.split(':');
      
      this.socket = new net.Socket();
      
      return new Promise((resolve) => {
        this.socket.connect(parseInt(port) || 9100, host, () => {
          this.connected = true;
          this.emit('connected');
          logger.info(`Network printer connected: ${this.config.address}`);
          resolve(true);
        });

        this.socket.on('error', (error: Error) => {
          logger.error('Network printer error', { error });
          this.connected = false;
          this.emit('error', error);
          resolve(false);
        });

        this.socket.on('close', () => {
          this.connected = false;
          this.emit('disconnected');
        });
      });
    } catch (error) {
      logger.error('Failed to connect to network printer', { error });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async print(data: Buffer): Promise<boolean> {
    if (!this.connected || !this.socket) {
      return false;
    }

    return new Promise((resolve) => {
      this.socket.write(data, (error: Error | null) => {
        if (error) {
          logger.error('Print error', { error });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async cut(): Promise<boolean> {
    // ESC/POS cut command
    const cutCommand = Buffer.from([0x1D, 0x56, 0x00]);
    return this.print(cutCommand);
  }

  async openDrawer(): Promise<boolean> {
    // ESC/POS open drawer command
    const openCommand = Buffer.from([0x1B, 0x70, 0x00, 0x32, 0xFA]);
    return this.print(openCommand);
  }

  getStatus(): { connected: boolean; error?: string } {
    return {
      connected: this.connected,
      error: this.connected ? undefined : 'Not connected',
    };
  }
}

// ============================================
// SIMULATION PRINTER PROVIDER (Fallback)
// ============================================

class SimulationPrinterProvider extends PrinterProvider {
  private config: PrinterConfig;
  private connected: boolean = false;
  private printLog: Buffer[] = [];

  constructor(config: PrinterConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<boolean> {
    this.connected = true;
    logger.info('Simulation printer connected (fallback mode)');
    this.emit('connected');
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async print(data: Buffer): Promise<boolean> {
    if (!this.connected) return false;
    
    this.printLog.push(data);
    
    // Log the receipt content for debugging
    const text = data.toString('utf8');
    logger.debug('Simulated print', { content: text.slice(0, 500) });
    
    this.emit('printed', { data, text });
    return true;
  }

  async cut(): Promise<boolean> {
    logger.debug('Simulated cut');
    return true;
  }

  async openDrawer(): Promise<boolean> {
    logger.debug('Simulated drawer open');
    return true;
  }

  getStatus(): { connected: boolean; error?: string } {
    return {
      connected: this.connected,
      error: undefined,
    };
  }

  getPrintLog(): Buffer[] {
    return this.printLog;
  }

  clearPrintLog(): void {
    this.printLog = [];
  }
}

// ============================================
// ESC/POS RECEIPT BUILDER
// ============================================

class EscPosBuilder {
  private buffer: Buffer = Buffer.alloc(0);
  private width: number;

  constructor(width: number = 48) {
    this.width = width;
  }

  // Initialize printer
  init(): EscPosBuilder {
    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x1B, 0x40])]);
    return this;
  }

  // Set text alignment
  align(align: 'left' | 'center' | 'right'): EscPosBuilder {
    const code = align === 'left' ? 0x00 : align === 'center' ? 0x01 : 0x02;
    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x1B, 0x61, code])]);
    return this;
  }

  // Set text size
  size(width: number = 1, height: number = 1): EscPosBuilder {
    const size = (width - 1) | ((height - 1) << 4);
    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x1D, 0x21, size])]);
    return this;
  }

  // Bold text
  bold(enable: boolean = true): EscPosBuilder {
    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x1B, 0x45, enable ? 0x01 : 0x00])]);
    return this;
  }

  // Add text
  text(str: string): EscPosBuilder {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(str, 'utf8')]);
    return this;
  }

  // Add new line
  newline(count: number = 1): EscPosBuilder {
    for (let i = 0; i < count; i++) {
      this.buffer = Buffer.concat([this.buffer, Buffer.from([0x0A])]);
    }
    return this;
  }

  // Add horizontal line
  line(char: string = '-'): EscPosBuilder {
    const line = char.repeat(this.width);
    return this.text(line).newline();
  }

  // Add two-column text (item and price)
  columns(left: string, right: string): EscPosBuilder {
    const space = this.width - left.length - right.length;
    const padding = space > 0 ? ' '.repeat(space) : ' ';
    return this.text(`${left}${padding}${right}`).newline();
  }

  // Cut paper
  cut(): EscPosBuilder {
    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x1D, 0x56, 0x00])]);
    return this;
  }

  // Open cash drawer
  openDrawer(): EscPosBuilder {
    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x1B, 0x70, 0x00, 0x32, 0xFA])]);
    return this;
  }

  // Get final buffer
  build(): Buffer {
    return this.buffer;
  }
}

// ============================================
// HARDWARE SERVICE
// ============================================

export class HardwareService {
  private printers: Map<string, PrinterProvider> = new Map();
  private defaultPrinter: string | null = null;

  // ============================================
  // PRINTER MANAGEMENT
  // ============================================

  async addPrinter(id: string, config: PrinterConfig, isDefault: boolean = false): Promise<boolean> {
    try {
      let provider: PrinterProvider;

      switch (config.type) {
        case 'network':
          provider = new NetworkPrinterProvider(config);
          break;
        case 'usb':
        case 'bluetooth':
          // For now, use simulation for USB/Bluetooth
          // In production, you'd implement specific providers
          logger.warn(`USB/Bluetooth printers not fully implemented, using simulation`);
          provider = new SimulationPrinterProvider(config);
          break;
        default:
          provider = new SimulationPrinterProvider(config);
      }

      const connected = await provider.connect();
      
      if (connected) {
        this.printers.set(id, provider);
        
        if (isDefault || !this.defaultPrinter) {
          this.defaultPrinter = id;
        }

        // Save to database
        await prisma.hardwareDevice.upsert({
          where: { id },
          create: {
            id,
            name: id,
            type: HardwareType.PRINTER,
            connectionType: config.type,
            address: config.address,
            config: config as any,
            isDefault: isDefault || !this.defaultPrinter,
            isActive: true,
            lastConnectedAt: new Date(),
          },
          update: {
            connectionType: config.type,
            address: config.address,
            config: config as any,
            isActive: true,
            lastConnectedAt: new Date(),
          },
        });

        logger.info(`Printer added: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to add printer', { error, id });
      return false;
    }
  }

  async removePrinter(id: string): Promise<boolean> {
    const printer = this.printers.get(id);
    if (printer) {
      await printer.disconnect();
      this.printers.delete(id);
      
      if (this.defaultPrinter === id) {
        this.defaultPrinter = this.printers.keys().next().value || null;
      }

      // Update database
      await prisma.hardwareDevice.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info(`Printer removed: ${id}`);
      return true;
    }
    return false;
  }

  getPrinter(id?: string): PrinterProvider | null {
    if (id) {
      return this.printers.get(id) || null;
    }
    return this.defaultPrinter ? this.printers.get(this.defaultPrinter) || null : null;
  }

  getPrinters(): Array<{ id: string; status: { connected: boolean; error?: string } }> {
    return Array.from(this.printers.entries()).map(([id, printer]) => ({
      id,
      status: printer.getStatus(),
    }));
  }

  // ============================================
  // RECEIPT PRINTING
  // ============================================

  async printReceipt(receipt: ReceiptData, printerId?: string): Promise<boolean> {
    const printer = this.getPrinter(printerId);
    
    if (!printer) {
      logger.error('No printer available');
      return false;
    }

    try {
      const builder = new EscPosBuilder(48);
      
      // Initialize and center align for header
      builder.init().align('center');

      // Business name
      if (receipt.businessName) {
        builder.bold(true).size(2, 2).text(receipt.businessName).newline();
        builder.bold(false).size(1, 1);
      }

      // Business info
      if (receipt.businessInfo) {
        receipt.businessInfo.forEach(line => builder.text(line).newline());
      }

      // Header lines
      if (receipt.header) {
        receipt.header.forEach(line => builder.text(line).newline());
      }

      builder.line().align('left');

      // Receipt info
      builder.text(`Receipt: ${receipt.receiptNumber}`).newline();
      builder.text(`Date: ${receipt.date}`).newline();
      builder.text(`Cashier: ${receipt.cashier}`).newline();
      builder.line();

      // Items header
      builder.bold(true);
      builder.columns('Item', 'Qty  Price  Total');
      builder.bold(false);

      // Items
      receipt.items.forEach(item => {
        const qtyPrice = `${item.quantity} x ${item.price.toFixed(2)}`;
        builder.columns(item.name.substring(0, 28), `${qtyPrice}  ${item.total.toFixed(2)}`);
      });

      builder.line();

      // Totals
      builder.columns('Subtotal:', receipt.subtotal.toFixed(2));
      
      if (receipt.tax) {
        builder.columns('Tax:', receipt.tax.toFixed(2));
      }
      
      if (receipt.discount) {
        builder.columns('Discount:', `-${receipt.discount.toFixed(2)}`);
      }

      builder.bold(true);
      builder.columns('TOTAL:', receipt.total.toFixed(2));
      builder.bold(false);

      builder.line();

      // Payments
      builder.text('Payment:').newline();
      receipt.payments.forEach(payment => {
        builder.columns(`  ${payment.method}:`, payment.amount.toFixed(2));
      });

      if (receipt.change) {
        builder.columns('Change:', receipt.change.toFixed(2));
      }

      builder.line();

      // Footer
      if (receipt.footer) {
        builder.align('center');
        receipt.footer.forEach(line => builder.text(line).newline());
      }

      // QR code placeholder (if supported by printer)
      if (receipt.qrCode) {
        builder.newline();
        builder.text('Scan for digital receipt:').newline();
        builder.text(receipt.qrCode).newline();
      }

      builder.newline(2).cut();

      // Print
      const success = await printer.print(builder.build());
      
      if (success) {
        logger.info('Receipt printed', { receiptNumber: receipt.receiptNumber });
      }

      return success;
    } catch (error) {
      logger.error('Failed to print receipt', { error, receiptNumber: receipt.receiptNumber });
      return false;
    }
  }

  async printTestPage(printerId?: string): Promise<boolean> {
    const testReceipt: ReceiptData = {
      receiptNumber: 'TEST-001',
      date: new Date().toLocaleString(),
      cashier: 'System Test',
      items: [
        { name: 'Test Product 1', quantity: 2, price: 100.00, total: 200.00 },
        { name: 'Test Product 2', quantity: 1, price: 150.00, total: 150.00 },
      ],
      subtotal: 350.00,
      tax: 56.00,
      total: 406.00,
      payments: [{ method: 'CASH', amount: 406.00 }],
      change: 0,
      footer: ['Thank you for testing!', 'AppleFlow POS'],
    };

    return this.printReceipt(testReceipt, printerId);
  }

  async openCashDrawer(printerId?: string): Promise<boolean> {
    const printer = this.getPrinter(printerId);
    
    if (!printer) {
      logger.error('No printer available for drawer');
      return false;
    }

    return printer.openDrawer();
  }

  // ============================================
  // BARCODE SCANNER (Simulation)
  // ============================================

  async simulateBarcodeScan(barcode: string): Promise<void> {
    // In a real implementation, this would listen to scanner input
    // For now, we just emit an event that can be listened to
    logger.info('Barcode scanned (simulated)', { barcode });
  }

  // ============================================
  // DEVICE STATUS
  // ============================================

  async getDeviceStatus(): Promise<{
    printers: Array<{ id: string; connected: boolean; error?: string }>;
    defaultPrinter?: string;
  }> {
    return {
      printers: this.getPrinters(),
      defaultPrinter: this.defaultPrinter || undefined,
    };
  }
}

// Singleton instance
export const hardwareService = new HardwareService();
