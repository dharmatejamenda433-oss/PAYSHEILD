import { Account } from '../models/Account.js';
import { ApiError } from '../utils/ApiError.js';

export async function getAccountForUser(userId) {
  const account = await Account.findOne({ userId });
  if (!account) {
    throw ApiError.notFound('Account not found for this user.');
  }
  return account;
}
