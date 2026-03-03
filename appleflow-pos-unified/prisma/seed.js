/**
 * AppleFlow POS - Database Seed
 * Creates default admin user and sample data
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPinHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@appleflow.pos' },
    update: {},
    create: {
      email: 'admin@appleflow.pos',
      name: 'Admin User',
      pinHash: adminPinHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create manager user
  const managerPinHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@appleflow.pos' },
    update: {},
    create: {
      email: 'manager@appleflow.pos',
      name: 'Manager',
      pinHash: managerPinHash,
      role: 'MANAGER',
      isActive: true,
    },
  });
  console.log('✅ Manager user created:', manager.email);

  // Create cashier user
  const cashierPinHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@appleflow.pos' },
    update: {},
    create: {
      email: 'cashier@appleflow.pos',
      name: 'Cashier',
      pinHash: cashierPinHash,
      role: 'CASHIER',
      isActive: true,
    },
  });
  console.log('✅ Cashier user created:', cashier.email);

  // Create default categories
  const categories = [
    { name: 'Beverages', description: 'Drinks and beverages' },
    { name: 'Food', description: 'Food items' },
    { name: 'Electronics', description: 'Electronic devices' },
    { name: 'Clothing', description: 'Apparel and clothing' },
    { name: 'Household', description: 'Household items' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categories created');

  // Create sample products
  const beveragesCategory = await prisma.category.findUnique({ where: { name: 'Beverages' } });
  const foodCategory = await prisma.category.findUnique({ where: { name: 'Food' } });

  const products = [
    {
      sku: 'BEV001',
      name: 'Coca Cola 500ml',
      barcode: '1234567890123',
      costPrice: 50,
      sellingPrice: 75,
      quantity: 100,
      minStockLevel: 20,
      categoryId: beveragesCategory?.id,
    },
    {
      sku: 'BEV002',
      name: 'Sprite 500ml',
      barcode: '1234567890124',
      costPrice: 50,
      sellingPrice: 75,
      quantity: 80,
      minStockLevel: 20,
      categoryId: beveragesCategory?.id,
    },
    {
      sku: 'BEV003',
      name: 'Water 1L',
      barcode: '1234567890125',
      costPrice: 30,
      sellingPrice: 50,
      quantity: 150,
      minStockLevel: 30,
      categoryId: beveragesCategory?.id,
    },
    {
      sku: 'FOOD001',
      name: 'Bread',
      barcode: '1234567890126',
      costPrice: 40,
      sellingPrice: 60,
      quantity: 50,
      minStockLevel: 10,
      categoryId: foodCategory?.id,
    },
    {
      sku: 'FOOD002',
      name: 'Cookies',
      barcode: '1234567890127',
      costPrice: 80,
      sellingPrice: 120,
      quantity: 60,
      minStockLevel: 15,
      categoryId: foodCategory?.id,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
  console.log('✅ Sample products created');

  // Create sample customers
  const customers = [
    { name: 'John Doe', email: 'john@example.com', phone: '254712345678' },
    { name: 'Jane Smith', email: 'jane@example.com', phone: '254723456789' },
    { name: 'Walk-in Customer', phone: '0000000000' },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { email: customer.email || `walkin-${customer.phone}` },
      update: {},
      create: customer,
    });
  }
  console.log('✅ Sample customers created');

  // Create default settings
  const settings = [
    { key: 'store_name', value: 'AppleFlow POS Store', description: 'Store name displayed on receipts' },
    { key: 'store_address', value: '123 Main Street, Nairobi', description: 'Store address' },
    { key: 'store_phone', value: '254700000000', description: 'Store phone number' },
    { key: 'currency', value: 'KES', description: 'Default currency' },
    { key: 'tax_rate', value: '0', description: 'Tax rate percentage' },
    { key: 'receipt_footer', value: 'Thank you for shopping with us!', description: 'Receipt footer text' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Default settings created');

  console.log('\n🎉 Database seeding complete!');
  console.log('\nDefault login credentials:');
  console.log('  Admin:   admin@appleflow.pos / 1234');
  console.log('  Manager: manager@appleflow.pos / 1234');
  console.log('  Cashier: cashier@appleflow.pos / 1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
