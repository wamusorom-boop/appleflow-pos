/**
 * AppleFlow POS - Production-Hardened M-Pesa Integration Service
 * Safaricom M-Pesa API with idempotency, signature validation, retry logic, and audit logging
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { PrismaClient, MpesaStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { auditService } from './audit';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION & TYPES
// ============================================

interface MpesaConfig {
  environment: 'sandbox' | 'production';
  shortCode: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
  initiatorName: string;
  initiatorPassword: string;
  callbackUrl: string;
  resultUrl: string;
  timeoutUrl: string;
  // Security
  callbackSecret?: string;
}

interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
  idempotencyKey?: string;
  saleId?: string;
}

interface STKPushResponse {
  success: boolean;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  errorMessage?: string;
  idempotencyKey?: string;
}

interface TransactionStatus {
  success: boolean;
  isComplete: boolean;
  isSuccessful: boolean;
  resultCode?: string;
  resultDesc?: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
  errorMessage?: string;
}

interface C2BTransaction {
  transactionType: string;
  transactionId: string;
  transactionTime: string;
  amount: number;
  businessShortCode: string;
  billRefNumber: string;
  invoiceNumber: string;
  msisdn: string;
  firstName: string;
  middleName?: string;
  lastName?: string;
  orgAccountBalance?: string;
}

// Payment state machine states
const PAYMENT_STATE_MACHINE = {
  [MpesaStatus.PENDING]: ['PROCESSING', 'FAILED', 'CANCELLED'],
  [MpesaStatus.PROCESSING]: ['COMPLETED', 'FAILED', 'CANCELLED'],
  [MpesaStatus.COMPLETED]: ['REFUNDED'],
  [MpesaStatus.FAILED]: ['PENDING'], // Allow retry
  [MpesaStatus.CANCELLED]: [],
  [MpesaStatus.REFUNDED]: [],
} as const;

// ============================================
// M-PESA SERVICE
// ============================================

export class MpesaService {
  private client: AxiosInstance;
  private config: MpesaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private pendingTransactions: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.config = {
      environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      shortCode: process.env.MPESA_SHORT_CODE || '',
      passkey: process.env.MPESA_PASSKEY || '',
      consumerKey: process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
      initiatorName: process.env.MPESA_INITIATOR_NAME || '',
      initiatorPassword: process.env.MPESA_INITIATOR_PASSWORD || '',
      callbackUrl: process.env.MPESA_CALLBACK_URL || '',
      resultUrl: process.env.MPESA_RESULT_URL || '',
      timeoutUrl: process.env.MPESA_TIMEOUT_URL || '',
      callbackSecret: process.env.MPESA_CALLBACK_SECRET,
    };

    const baseURL = this.config.environment === 'production'
      ? 'https://api.safaricom.et'
      : 'https://sandbox.safaricom.et';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('M-Pesa API response', {
          url: response.config.url,
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('M-Pesa API error', {
          url: error.config?.url,
          status: error.response?.status,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(
        `${this.config.consumerKey}:${this.config.consumerSecret}`
      ).toString('base64');

      const response = await axios.get(
        `${this.client.defaults.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      logger.info('M-Pesa access token refreshed');
      return this.accessToken;
    } catch (error) {
      logger.error('M-Pesa token acquisition failed', { error });
      return null;
    }
  }

  // ============================================
  // IDEMPOTENCY & DUPLICATE PROTECTION
  // ============================================

  private generateIdempotencyKey(): string {
    return `mpesa_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private async checkDuplicateTransaction(
    idempotencyKey: string,
    phoneNumber: string,
    amount: number
  ): Promise<{ isDuplicate: boolean; existingTx?: any }> {
    // Check by idempotency key
    const byKey = await prisma.mpesaTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (byKey) {
      return { isDuplicate: true, existingTx: byKey };
    }

    // Check for recent duplicate (same phone + amount within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentDuplicate = await prisma.mpesaTransaction.findFirst({
      where: {
        phoneNumber,
        amount,
        createdAt: { gte: fiveMinutesAgo },
        status: { in: [MpesaStatus.PENDING, MpesaStatus.PROCESSING, MpesaStatus.COMPLETED] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentDuplicate) {
      return { isDuplicate: true, existingTx: recentDuplicate };
    }

    return { isDuplicate: false };
  }

  // ============================================
  // SIGNATURE VALIDATION
  // ============================================

  validateCallbackSignature(payload: any, signature: string): boolean {
    if (!this.config.callbackSecret) {
      logger.warn('Callback secret not configured, skipping signature validation');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.callbackSecret)
        .update(JSON.stringify(payload))
        .digest('base64');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.warn('Invalid callback signature', { signature });
      }

      return isValid;
    } catch (error) {
      logger.error('Signature validation error', { error });
      return false;
    }
  }

  // ============================================
  // STK PUSH
  // ============================================

  async stkPush(request: STKPushRequest): Promise<STKPushResponse> {
    const idempotencyKey = request.idempotencyKey || this.generateIdempotencyKey();

    try {
      // Check for duplicates
      const { isDuplicate, existingTx } = await this.checkDuplicateTransaction(
        idempotencyKey,
        request.phoneNumber,
        request.amount
      );

      if (isDuplicate && existingTx) {
        logger.info('Duplicate M-Pesa transaction detected', { idempotencyKey });
        return {
          success: true,
          merchantRequestId: existingTx.merchantRequestId || undefined,
          checkoutRequestId: existingTx.checkoutRequestId || undefined,
          responseCode: '0',
          responseDescription: 'Duplicate transaction - returning existing',
          idempotencyKey,
        };
      }

      const { password, timestamp } = this.generatePassword();

      // Format phone number
      let phoneNumber = request.phoneNumber.replace(/\s/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '254' + phoneNumber.slice(1);
      } else if (phoneNumber.startsWith('+')) {
        phoneNumber = phoneNumber.slice(1);
      }

      const payload = {
        BusinessShortCode: this.config.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount),
        PartyA: phoneNumber,
        PartyB: this.config.shortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: request.callbackUrl || this.config.callbackUrl,
        AccountReference: request.accountReference.slice(0, 12),
        TransactionDesc: request.transactionDesc.slice(0, 13),
      };

      // Create transaction record before API call
      const transaction = await prisma.mpesaTransaction.create({
        data: {
          idempotencyKey,
          phoneNumber,
          amount: request.amount,
          accountReference: request.accountReference,
          description: request.transactionDesc,
          status: MpesaStatus.PENDING,
          saleId: request.saleId,
          maxRetries: 3,
        },
      });

      // Make API call
      const response = await this.client.post(
        '/mpesa/stkpush/v1/processrequest',
        payload
      );

      // Update transaction with response
      await prisma.mpesaTransaction.update({
        where: { id: transaction.id },
        data: {
          merchantRequestId: response.data.MerchantRequestID,
          checkoutRequestId: response.data.CheckoutRequestID,
          status: MpesaStatus.PROCESSING,
        },
      });

      // Schedule automatic status check
      this.scheduleStatusCheck(response.data.CheckoutRequestID);

      // Audit log
      await auditService.log({
        action: 'MPESA_STK_PUSH',
        entityType: 'MpesaTransaction',
        entityId: transaction.id,
        details: `STK Push initiated for ${phoneNumber}, amount: ${request.amount}`,
      });

      return {
        success: true,
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
        idempotencyKey,
      };
    } catch (error: any) {
      logger.error('STK Push failed', { error, idempotencyKey });

      // Update transaction as failed
      await prisma.mpesaTransaction.updateMany({
        where: { idempotencyKey },
        data: {
          status: MpesaStatus.FAILED,
          resultDesc: error.response?.data?.errorMessage || error.message,
          failedAt: new Date(),
        },
      });

      return {
        success: false,
        errorMessage: error.response?.data?.errorMessage || error.message,
        idempotencyKey,
      };
    }
  }

  private generatePassword(): { password: string; timestamp: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    const password = Buffer.from(
      `${this.config.shortCode}${this.config.passkey}${timestamp}`
    ).toString('base64');

    return { password, timestamp };
  }

  // ============================================
  // STATUS CHECKING & POLLING
  // ============================================

  private scheduleStatusCheck(checkoutRequestId: string): void {
    // Clear any existing timeout
    const existingTimeout = this.pendingTransactions.get(checkoutRequestId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule status check after 30 seconds
    const timeout = setTimeout(async () => {
      await this.checkTransactionStatus(checkoutRequestId);
      this.pendingTransactions.delete(checkoutRequestId);
    }, 30000);

    this.pendingTransactions.set(checkoutRequestId, timeout);
  }

  async checkTransactionStatus(checkoutRequestId: string): Promise<TransactionStatus> {
    try {
      const transaction = await prisma.mpesaTransaction.findUnique({
        where: { checkoutRequestId },
      });

      if (!transaction) {
        return {
          success: false,
          isComplete: false,
          isSuccessful: false,
          errorMessage: 'Transaction not found',
        };
      }

      // If already complete, return cached result
      if (transaction.status === MpesaStatus.COMPLETED) {
        return {
          success: true,
          isComplete: true,
          isSuccessful: true,
          resultCode: '0',
          mpesaReceiptNumber: transaction.mpesaReceiptNumber || undefined,
        };
      }

      if (transaction.status === MpesaStatus.FAILED) {
        return {
          success: true,
          isComplete: true,
          isSuccessful: false,
          resultDesc: transaction.resultDesc || undefined,
        };
      }

      const { password, timestamp } = this.generatePassword();

      const response = await this.client.post(
        '/mpesa/stkpushquery/v1/query',
        {
          BusinessShortCode: this.config.shortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }
      );

      const resultCode = response.data.ResultCode;
      const isSuccessful = resultCode === '0';

      // Update transaction
      await prisma.mpesaTransaction.update({
        where: { checkoutRequestId },
        data: {
          status: isSuccessful ? MpesaStatus.COMPLETED : MpesaStatus.FAILED,
          resultCode: resultCode?.toString(),
          resultDesc: response.data.ResultDesc,
          mpesaReceiptNumber: response.data.MpesaReceiptNumber,
          transactionDate: response.data.TransactionDate
            ? this.parseMpesaDate(response.data.TransactionDate)
            : null,
          completedAt: isSuccessful ? new Date() : null,
          failedAt: !isSuccessful ? new Date() : null,
        },
      });

      return {
        success: true,
        isComplete: true,
        isSuccessful,
        resultCode,
        resultDesc: response.data.ResultDesc,
        amount: response.data.Amount,
        mpesaReceiptNumber: response.data.MpesaReceiptNumber,
        transactionDate: response.data.TransactionDate,
        phoneNumber: response.data.PhoneNumber,
      };
    } catch (error: any) {
      logger.error('Transaction status check failed', { checkoutRequestId, error });

      return {
        success: false,
        isComplete: false,
        isSuccessful: false,
        errorMessage: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  async pollTransactionStatus(
    checkoutRequestId: string,
    maxAttempts: number = 10,
    intervalMs: number = 5000
  ): Promise<TransactionStatus> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.checkTransactionStatus(checkoutRequestId);

      if (status.isComplete) {
        return status;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return {
      success: false,
      isComplete: false,
      isSuccessful: false,
      errorMessage: 'Transaction status check timed out',
    };
  }

  // ============================================
  // CALLBACK HANDLING
  // ============================================

  async handleSTKCallback(callbackData: any, signature?: string): Promise<void> {
    try {
      // Validate signature if configured
      if (signature && !this.validateCallbackSignature(callbackData, signature)) {
        logger.error('Invalid callback signature');
        throw new Error('Invalid callback signature');
      }

      const {
        Body: {
          stkCallback: {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata,
          },
        },
      } = callbackData;

      const isSuccessful = ResultCode === 0;

      // Extract metadata
      let mpesaReceiptNumber: string | undefined;
      let amount: number | undefined;
      let phoneNumber: string | undefined;
      let transactionDate: string | undefined;

      if (CallbackMetadata && CallbackMetadata.Item) {
        CallbackMetadata.Item.forEach((item: any) => {
          switch (item.Name) {
            case 'MpesaReceiptNumber':
              mpesaReceiptNumber = item.Value;
              break;
            case 'Amount':
              amount = item.Value;
              break;
            case 'PhoneNumber':
              phoneNumber = item.Value?.toString();
              break;
            case 'TransactionDate':
              transactionDate = item.Value?.toString();
              break;
          }
        });
      }

      // Update transaction
      const transaction = await prisma.mpesaTransaction.update({
        where: { checkoutRequestId: CheckoutRequestID },
        data: {
          status: isSuccessful ? MpesaStatus.COMPLETED : MpesaStatus.FAILED,
          resultCode: ResultCode?.toString(),
          resultDesc: ResultDesc,
          mpesaReceiptNumber,
          amount: amount ? amount : undefined,
          phoneNumber,
          transactionDate: transactionDate ? this.parseMpesaDate(transactionDate) : null,
          callbackReceivedAt: new Date(),
          callbackSignature: signature,
          signatureValid: signature ? true : null,
          completedAt: isSuccessful ? new Date() : null,
          failedAt: !isSuccessful ? new Date() : null,
        },
      });

      // Update associated sale payment if successful
      if (isSuccessful && transaction.saleId) {
        await prisma.payment.updateMany({
          where: { saleId: transaction.saleId, method: 'MPESA' },
          data: {
            mpesaCode: mpesaReceiptNumber,
            status: 'COMPLETED',
          },
        });
      }

      // Audit log
      await auditService.log({
        action: isSuccessful ? 'MPESA_CALLBACK_SUCCESS' : 'MPESA_CALLBACK_FAILED',
        entityType: 'MpesaTransaction',
        entityId: transaction.id,
        details: `Callback received: ${ResultDesc}`,
        oldValue: JSON.stringify({ status: 'PROCESSING' }),
        newValue: JSON.stringify({ status: isSuccessful ? 'COMPLETED' : 'FAILED', mpesaReceiptNumber }),
      });

      logger.info('M-Pesa callback processed', {
        checkoutRequestId: CheckoutRequestID,
        resultCode: ResultCode,
        isSuccessful,
      });
    } catch (error) {
      logger.error('STK callback handling failed', { error, callbackData });
      throw error;
    }
  }

  // ============================================
  // RETRY LOGIC
  // ============================================

  async retryFailedTransaction(checkoutRequestId: string): Promise<STKPushResponse> {
    const transaction = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
    });

    if (!transaction) {
      return { success: false, errorMessage: 'Transaction not found' };
    }

    if (transaction.status !== MpesaStatus.FAILED) {
      return { success: false, errorMessage: 'Transaction is not in failed state' };
    }

    if (transaction.retryCount >= transaction.maxRetries) {
      return { success: false, errorMessage: 'Maximum retry attempts exceeded' };
    }

    // Increment retry count
    await prisma.mpesaTransaction.update({
      where: { checkoutRequestId },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        status: MpesaStatus.PENDING,
      },
    });

    // Retry the STK push
    return this.stkPush({
      phoneNumber: transaction.phoneNumber,
      amount: Number(transaction.amount),
      accountReference: transaction.accountReference || 'RETRY',
      transactionDesc: transaction.description || 'Retry payment',
      idempotencyKey: `${transaction.idempotencyKey}_retry_${transaction.retryCount + 1}`,
      saleId: transaction.saleId || undefined,
    });
  }

  // ============================================
  // C2B HANDLING
  // ============================================

  async handleC2BValidation(data: C2BTransaction): Promise<{
    resultCode: number;
    resultDesc: string;
  }> {
    try {
      // Validate the transaction
      if (data.billRefNumber) {
        const sale = await prisma.sale.findFirst({
          where: { receiptNumber: data.billRefNumber },
        });

        if (!sale) {
          return {
            resultCode: 1,
            resultDesc: 'Invalid bill reference number',
          };
        }

        if (Number(sale.total) !== data.amount) {
          return {
            resultCode: 1,
            resultDesc: 'Amount does not match invoice',
          };
        }
      }

      return {
        resultCode: 0,
        resultDesc: 'Success',
      };
    } catch (error) {
      logger.error('C2B validation failed', { error });
      return {
        resultCode: 1,
        resultDesc: 'Validation error',
      };
    }
  }

  async handleC2BConfirmation(data: C2BTransaction): Promise<void> {
    try {
      // Save C2B transaction
      await prisma.mpesaTransaction.create({
        data: {
          transactionId: data.transactionId,
          transactionType: data.transactionType,
          phoneNumber: data.msisdn,
          amount: data.amount,
          accountReference: data.billRefNumber,
          mpesaReceiptNumber: data.transactionId,
          status: MpesaStatus.COMPLETED,
          transactionDate: new Date(data.transactionTime),
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          completedAt: new Date(),
        },
      });

      // If linked to a sale, update it
      if (data.billRefNumber) {
        const sale = await prisma.sale.findFirst({
          where: { receiptNumber: data.billRefNumber },
        });

        if (sale) {
          await prisma.payment.create({
            data: {
              saleId: sale.id,
              method: 'MPESA',
              amount: data.amount,
              mpesaCode: data.transactionId,
              status: 'COMPLETED',
            },
          });
        }
      }

      logger.info('C2B confirmation processed', { transactionId: data.transactionId });
    } catch (error) {
      logger.error('C2B confirmation handling failed', { error });
      throw error;
    }
  }

  // ============================================
  // RECONCILIATION
  // ============================================

  async reconcile(date: Date): Promise<{
    success: boolean;
    totalTransactions: number;
    matched: number;
    unmatched: number;
    discrepancies: any[];
    reconciliationId: string;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all M-Pesa transactions for the day
    const mpesaTransactions = await prisma.mpesaTransaction.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: MpesaStatus.COMPLETED,
      },
    });

    // Get all sales with M-Pesa payments for the day
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        payments: {
          some: {
            method: 'MPESA',
          },
        },
      },
      include: {
        payments: true,
      },
    });

    const discrepancies: any[] = [];
    let matched = 0;

    // Match transactions
    for (const mpesaTx of mpesaTransactions) {
      const matchingSale = sales.find(sale =>
        sale.payments.some(
          (p: any) => p.mpesaCode === mpesaTx.mpesaReceiptNumber
        )
      );

      if (matchingSale) {
        matched++;
        // Mark as reconciled
        await prisma.mpesaTransaction.update({
          where: { id: mpesaTx.id },
          data: { reconciledAt: new Date() },
        });
      } else {
        discrepancies.push({
          type: 'unmatched_mpesa',
          mpesaTransaction: mpesaTx,
        });
      }
    }

    // Check for sales without matching M-Pesa transaction
    for (const sale of sales) {
      const mpesaPayments = sale.payments.filter(
        (p: any) => p.method === 'MPESA' && p.mpesaCode
      );

      for (const payment of mpesaPayments) {
        const matchingTx = mpesaTransactions.find(
          tx => tx.mpesaReceiptNumber === payment.mpesaCode
        );

        if (!matchingTx) {
          discrepancies.push({
            type: 'unmatched_sale',
            sale,
            payment,
          });
        }
      }
    }

    // Create reconciliation record
    const reconciliation = await prisma.paymentReconciliation.create({
      data: {
        date,
        totalExpected: mpesaTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
        totalReceived: mpesaTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
        difference: 0,
        matchedCount: matched,
        unmatchedCount: discrepancies.length,
        status: discrepancies.length === 0 ? 'COMPLETED' : 'PENDING',
        details: { discrepancies },
        performedBy: 'system',
      },
    });

    return {
      success: true,
      totalTransactions: mpesaTransactions.length,
      matched,
      unmatched: discrepancies.length,
      discrepancies,
      reconciliationId: reconciliation.id,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private parseMpesaDate(dateStr: string): Date {
    // M-Pesa date format: YYYYMMDDHHMMSS
    return new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(4, 6)) - 1,
      parseInt(dateStr.slice(6, 8)),
      parseInt(dateStr.slice(8, 10)),
      parseInt(dateStr.slice(10, 12)),
      parseInt(dateStr.slice(12, 14))
    );
  }

  async getTransactions(options?: {
    page?: number;
    limit?: number;
    from?: Date;
    to?: Date;
    status?: MpesaStatus;
  }): Promise<{
    transactions: any[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { page = 1, limit = 50, from, to, status } = options || {};

    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.mpesaTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mpesaTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async getStatistics(period: 'today' | 'week' | 'month'): Promise<{
    totalTransactions: number;
    totalAmount: number;
    successful: number;
    failed: number;
    pending: number;
  }> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const [
      totalTransactions,
      totalAmount,
      successful,
      failed,
      pending,
    ] = await Promise.all([
      prisma.mpesaTransaction.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.mpesaTransaction.aggregate({
        where: {
          createdAt: { gte: startDate },
          status: MpesaStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
      prisma.mpesaTransaction.count({
        where: {
          createdAt: { gte: startDate },
          status: MpesaStatus.COMPLETED,
        },
      }),
      prisma.mpesaTransaction.count({
        where: {
          createdAt: { gte: startDate },
          status: MpesaStatus.FAILED,
        },
      }),
      prisma.mpesaTransaction.count({
        where: {
          createdAt: { gte: startDate },
          status: { in: [MpesaStatus.PENDING, MpesaStatus.PROCESSING] },
        },
      }),
    ]);

    return {
      totalTransactions,
      totalAmount: Number(totalAmount._sum.amount) || 0,
      successful,
      failed,
      pending,
    };
  }

  async simulatePayment(
    phoneNumber: string,
    amount: number,
    reference: string = 'TEST'
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    if (this.config.environment !== 'sandbox') {
      return {
        success: false,
        message: 'Simulation only available in sandbox',
      };
    }

    try {
      let msisdn = phoneNumber.replace(/\s/g, '');
      if (msisdn.startsWith('0')) {
        msisdn = '254' + msisdn.slice(1);
      } else if (msisdn.startsWith('+')) {
        msisdn = msisdn.slice(1);
      }

      const response = await this.client.post(
        '/mpesa/c2b/v1/simulate',
        {
          ShortCode: this.config.shortCode,
          CommandID: 'CustomerPayBillOnline',
          Amount: amount,
          Msisdn: msisdn,
          BillRefNumber: reference,
        }
      );

      return {
        success: response.data.ResponseCode === '0',
        message: response.data.ResponseDescription,
      };
    } catch (error: any) {
      logger.error('Payment simulation failed', { error });
      return {
        success: false,
        message: error.response?.data?.errorMessage || error.message,
      };
    }
  }
}

// Singleton instance
export const mpesaService = new MpesaService();
