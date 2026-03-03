/**
 * AppleFlow POS - Database Seed Script
 * Creates initial data for development and testing
 */

import { PrismaClient, UserRole, PaymentMethod, ProductType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ============================================
  // Create Admin User
  // ============================================
  const adminPinHash = await bcrypt.hash('1234', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@appleflow.pos' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@appleflow.pos',
      pinHash: adminPinHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // ============================================
  // Create Manager User
  // ============================================
  const managerPinHash = await bcrypt.hash('1234', 12);
  
  const manager = await prisma.user.upsert({
    where: { email: 'manager@appleflow.pos' },
    update: {},
    create: {
      name: 'Store Manager',
      email: 'manager@appleflow.pos',
      pinHash: managerPinHash,
      role: UserRole.MANAGER,
      isActive: true,
    },
  });
  console.log('✅ Manager user created:', manager.email);

  // ============================================
  // Create Cashier User
  // ============================================
  const cashierPinHash = await bcrypt.hash('1234', 12);
  
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@appleflow.pos' },
    update: {},
    create: {
      name: 'Cashier',
      email: 'cashier@appleflow.pos',
      pinHash: cashierPinHash,
      role: UserRole.CASHIER,
      isActive: true,
    },
  });
  console.log('✅ Cashier user created:', cashier.email);

  // ============================================
  // Create Categories
  // ============================================
  const categories = [
    { name: 'Beverages', color: '#3b82f6' },
    { name: 'Snacks', color: '#f59e0b' },
    { name: 'Dairy', color: '#10b981' },
    { name: 'Produce', color: '#22c55e' },
    { name: 'Household', color: '#8b5cf6' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categories created');

  // ============================================
  // Create Products
  // ============================================
  const beveragesCategory = await prisma.category.findUnique({ where: { name: 'Beverages' } });
  const snacksCategory = await prisma.category.findUnique({ where: { name: 'Snacks' } });
  const dairyCategory = await prisma.category.findUnique({ where: { name: 'Dairy' } });

  const products = [
    {
      sku: 'BEV001',
      name: 'Coca-Cola 500ml',
      barcode: '5449000000996',
      costPrice: 45,
      sellingPrice: 65,
      quantity: 100,
      minStockLevel: 20,
      categoryId: beveragesCategory!.id,
    },
    {
      sku: 'BEV002',
      name: 'Sprite 500ml',
      barcode: '5449000000997',
      costPrice: 45,
      sellingPrice: 65,
      quantity: 80,
      minStockLevel: 20,
      categoryId: beveragesCategory!.id,
    },
    {
      sku: 'SNK001',
      name: 'Potato Chips 150g',
      barcode: '1234567890123',
      costPrice: 80,
      sellingPrice: 120,
      quantity: 50,
      minStockLevel: 10,
      categoryId: snacksCategory!.id,
    },
    {
      sku: 'SNK002',
      name: 'Chocolate Bar 50g',
      barcode: '1234567890124',
      costPrice: 60,
      sellingPrice: 95,
      quantity: 75,
      minStockLevel: 15,
      categoryId: snacksCategory!.id,
    },
    {
      sku: 'DAI001',
      name: 'Fresh Milk 500ml',
      barcode: '1234567890125',
      costPrice: 50,
      sellingPrice: 75,
      quantity: 40,
      minStockLevel: 10,
      categoryId: dairyCategory!.id,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        ...product,
        productType: ProductType.STANDARD,
        isActive: true,
        trackInventory: true,
      },
    });
  }
  console.log('✅ Products created');

  // ============================================
  // Create Business Settings
  // ============================================
  await prisma.business.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'AppleFlow Store',
      legalName: 'AppleFlow Retail Ltd',
      address: '123 Main Street',
      city: 'Nairobi',
      country: 'Kenya',
      phone: '+254 700 000000',
      email: 'info@appleflow.pos',
      currency: 'KES',
      currencySymbol: 'KSh',
      enableTax: false,
      taxRate: 0,
      enableLoyalty: true,
      enableGiftCards: true,
      receiptHeader: 'Thank you for shopping with us!',
      receiptFooter: 'Returns accepted within 7 days with receipt',
    },
  });
  console.log('✅ Business settings created');

  // ============================================
  // Create Sample Customer
  // ============================================
  await prisma.customer.upsert({
    where: { phone: '254712345678' },
    update: {},
    create: {
      name: 'John Doe',
      phone: '254712345678',
      email: 'john@example.com',
      address: '456 Customer Street, Nairobi',
      loyaltyPoints: 100,
      loyaltyTier: 'SILVER',
      isActive: true,
    },
  });
  console.log('✅ Sample customer created');

  console.log('\n✅ Database seeding completed!');
  console.log('\nDefault credentials:');
  console.log('  Admin:    admin@appleflow.pos / 1234');
  console.log('  Manager:  manager@appleflow.pos / 1234');
  console.log('  Cashier:  cashier@appleflow.pos / 1234');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
