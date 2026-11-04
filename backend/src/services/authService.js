import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from './tokenService.js';

const BCRYPT_ROUNDS = 12;

/**
 * Registers a customer and creates the simulated wallet in one transaction.
 * The incoming role is ignored on purpose: only an administrative seed script
 * can create an admin.
 */
export async function registerCustomer({ name, email, password }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const session = await mongoose.startSession();
  let user;
  let account;

  try {
    await session.withTransaction(async () => {
      const [createdUser] = await User.create(
        [{ name, email, passwordHash, role: 'customer' }],
        { session }
      );
      user = createdUser;

      const [createdAccount] = await Account.create(
        [
          {
            userId: createdUser._id,
            balance: env.STARTING_BALANCE_PAISE,
            currency: 'INR',
            status: 'active',
          },
        ],
        { session }
      );
      account = createdAccount;
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict('EMAIL_IN_USE', 'An account with this email already exists.');
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return {
    user: user.toSafeJSON(),
    account: account.toJSON(),
    token: signToken(user),
  };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const account = await Account.findOne({ userId: user._id });

  return {
    user: user.toSafeJSON(),
    account: account ? account.toJSON() : null,
    token: signToken(user),
  };
}

export async function getProfile(userId) {
  const [user, account] = await Promise.all([
    User.findById(userId),
    Account.findOne({ userId }),
  ]);

  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  return {
    user: user.toSafeJSON(),
    account: account ? account.toJSON() : null,
  };
}
