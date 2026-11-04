import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@payshield.dev';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const CUSTOMER_PASSWORD = process.env.SEED_CUSTOMER_PASSWORD || 'Customer@123';
const DEMO_BALANCE_PAISE = Number(process.env.DEMO_BALANCE_PAISE || 10000000);

async function ensureAccount(user, balance) {
  const existing = await Account.findOne({ userId: user._id });
  if (existing) return existing;

  return Account.create({
    userId: user._id,
    balance,
    currency: 'INR',
    status: 'active',
  });
}

async function ensureUser({ name, email, password, role, balance }) {
  let user = await User.findOne({ email });

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 12);
    user = await User.create({ name, email, passwordHash, role });
    console.log(`[seed] created ${role}: ${email}`);
  } else {
    console.log(`[seed] ${role} already exists: ${email}`);
  }

  if (role === 'customer') {
    await ensureAccount(user, balance);
  }

  return user;
}

async function seed() {
  await connectDatabase();

  await ensureUser({
    name: 'PayShield Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
  });

  await ensureUser({
    name: 'Asha Verma',
    email: 'asha@example.com',
    password: CUSTOMER_PASSWORD,
    role: 'customer',
    balance: DEMO_BALANCE_PAISE,
  });

  await ensureUser({
    name: 'Ravi Kumar',
    email: 'ravi@example.com',
    password: CUSTOMER_PASSWORD,
    role: 'customer',
    balance: DEMO_BALANCE_PAISE,
  });

  console.log('\n[seed] Demo credentials (development only):');
  console.log(`  Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Customer: asha@example.com / ${CUSTOMER_PASSWORD}`);
  console.log(`  Customer: ravi@example.com / ${CUSTOMER_PASSWORD}`);
  console.log(`  Wallet balance per customer: ${(DEMO_BALANCE_PAISE / 100).toFixed(2)} INR`);
  console.log(`  Database: ${env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error('[seed] Failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
