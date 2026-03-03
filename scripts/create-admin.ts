#!/usr/bin/env tsx
/**
 * AppleFlow POS - Create Admin User Script
 * Run this after deployment to create the first admin user
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdmin() {
  console.log('\n🍎 AppleFlow POS - Create Admin User\n');
  
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (existingAdmin) {
      console.log('⚠️  An admin user already exists:');
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   Email: ${existingAdmin.email}`);
      
      const createAnother = await question('\nCreate another admin? (y/N): ');
      if (createAnother.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        process.exit(0);
      }
    }
    
    // Get user input
    const name = await question('Full Name: ');
    const email = await question('Email: ');
    const pin = await question('PIN (4 digits): ');
    
    // Validate input
    if (!name || !email || !pin) {
      console.error('❌ All fields are required');
      process.exit(1);
    }
    
    if (!/^\d{4}$/.test(pin)) {
      console.error('❌ PIN must be exactly 4 digits');
      process.exit(1);
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      console.error('❌ A user with this email already exists');
      process.exit(1);
    }
    
    // Hash PIN
    const pinHash = await bcrypt.hash(pin, 12);
    
    // Create admin user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        pinHash,
        role: 'ADMIN',
        isActive: true,
      }
    });
    
    console.log('\n✅ Admin user created successfully!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`\n   You can now login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   PIN: ${pin}`);
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

createAdmin();
