import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import { Transaction } from '../models/Transaction.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { FraudAlert } from '../models/FraudAlert.js';
import { Device } from '../models/Device.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTransactionId, hashRequest } from '../utils/ids.js';
import { isNewDevice } from './deviceService.js';
import * as velocityService from './velocityService.js';
import { evaluateRules } from './fraudRulesService.js';
import { getFraudPrediction } from './fraudPredictionService.js';
import { decideRisk } from './riskDecisionService.js';
import {
  findIdempotentTransaction,
  rememberIdempotency,
} from './idempotencyService.js';
import { assertTransition } from './transactionStateService.js';
import { POPULATE_PATHS } from './transactionService.js';
import { presentAlert, presentTransaction } from './transactionPresenter.js';
import { emitToAdmins, emitToUser } from '../sockets/socketRegistry.js';

async function loadPopulatedTransaction(id) {
  return Transaction.findById(id).populate(POPULATE_PATHS).lean();
}

async function getAverageOutgoingAmount(userId) {
  const recent = await Transaction.find({ senderId: userId, status: 'COMPLETED' })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('amount')
    .lean();

  if (recent.length === 0) return 0;

  const total = recent.reduce((sum, transaction) => sum + transaction.amount, 0);
  return Math.round(total / recent.length);
}

/**
 * A location is "unusual" only once the customer has at least two previous
 * payments from other locations. First-time use is therefore not punished.
 */
async function detectUnusualLocation(userId, location) {
  if (!location) return false;

  const recent = await Transaction.find({
    senderId: userId,
    clientLocation: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('clientLocation')
    .lean();

  if (recent.length < 2) return false;

  return !recent.some((transaction) => transaction.clientLocation === location);
}

/**
 * Moves money and writes the double-entry ledger inside the caller's MongoDB
 * session. The conditional balance update guarantees a balance can never go
 * below zero, even with concurrent transfers.
 */
export async function settleTransfer({
  transaction,
  senderAccountId,
  receiverAccountId,
  amount,
  session,
}) {
  assertTransition(transaction.status, 'COMPLETED');

  const debitedAccount = await Account.findOneAndUpdate(
    {
      _id: senderAccountId,
      status: 'active',
      balance: { $gte: amount },
    },
    { $inc: { balance: -amount } },
    { new: true, session }
  );

  if (!debitedAccount) {
    throw ApiError.unprocessable(
      'INSUFFICIENT_FUNDS',
      'The sender does not have enough available balance for this payment.'
    );
  }

  const creditedAccount = await Account.findOneAndUpdate(
    { _id: receiverAccountId, status: 'active' },
    { $inc: { balance: amount } },
    { new: true, session }
  );

  if (!creditedAccount) {
    throw ApiError.conflict(
      'RECEIVER_ACCOUNT_UNAVAILABLE',
      'The receiver account is no longer available.'
    );
  }

  await LedgerEntry.create(
    [
      {
        transactionId: transaction._id,
        accountId: senderAccountId,
        entryType: 'DEBIT',
        amount,
        balanceAfter: debitedAccount.balance,
      },
    ],
    { session }
  );

  await LedgerEntry.create(
    [
      {
        transactionId: transaction._id,
        accountId: receiverAccountId,
        entryType: 'CREDIT',
        amount,
        balanceAfter: creditedAccount.balance,
      },
    ],
    { session }
  );

  const completed = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: 'APPROVED' },
    { $set: { status: 'COMPLETED', completedAt: new Date() } },
    { new: true, session }
  );

  if (!completed) {
    throw ApiError.conflict(
      'INVALID_TRANSACTION_TRANSITION',
      'The transaction could not be completed from its current state.'
    );
  }

  transaction.status = 'COMPLETED';
  transaction.completedAt = completed.completedAt;

  return { debitedAccount, creditedAccount };
}

async function createFraudAlertIfNeeded(transaction) {
  if (transaction.riskLevel === 'LOW') return null;

  try {
    return await FraudAlert.create({
      transactionId: transaction._id,
      riskScore: transaction.riskScore,
      riskLevel: transaction.riskLevel,
      reasons: transaction.riskReasons,
      status: 'OPEN',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return FraudAlert.findOne({ transactionId: transaction._id });
    }
    console.error(`[fraud-alert] Could not create alert: ${error.message}`);
    return null;
  }
}

function notifyCreatedTransaction(transaction, alert) {
  const senderId = transaction.senderId._id || transaction.senderId;
  const receiverId = transaction.receiverId._id || transaction.receiverId;

  emitToUser(senderId, 'transaction:created', {
    transaction: presentTransaction(transaction, senderId),
  });

  // Receivers should only learn about money that actually arrived.
  if (transaction.status === 'COMPLETED') {
    emitToUser(receiverId, 'transaction:created', {
      transaction: presentTransaction(transaction, receiverId),
    });
  }

  emitToAdmins('transaction:created', {
    transaction: presentTransaction(transaction),
  });

  if (alert) {
    emitToAdmins('fraud:alert', {
      alert: presentAlert(alert.toObject ? alert.toObject() : alert, transaction),
    });
  }
}

async function recordFailedTransaction({
  senderId,
  receiverId,
  amount,
  currency,
  description,
  idempotencyKey,
  requestHash,
  risk,
  mlPrediction,
  meta,
  failureReason,
  transactionId,
}) {
  try {
    return await Transaction.create({
      transactionId: transactionId || generateTransactionId(),
      senderId,
      receiverId,
      amount,
      currency,
      description,
      status: 'FAILED',
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      decision: risk.decision,
      riskReasons: [],
      mlProbability: mlPrediction.available ? mlPrediction.probability : null,
      mlAvailable: mlPrediction.available,
      mlModel: mlPrediction.model,
      idempotencyKey,
      requestHash,
      clientDeviceId: meta.deviceId || null,
      clientLocation: meta.location || null,
      failureReason,
    });
  } catch (error) {
    if (error?.code !== 11000) {
      console.error(`[payment] Could not record failed transaction: ${error.message}`);
    }
    return null;
  }
}

/**
 * Full payment flow:
 * validate -> idempotency -> risk features -> rules + ML -> decision ->
 * atomic transaction -> ledger -> post-commit notifications.
 */
export async function createTransfer({ sender, input, meta }) {
  const senderAccount = await Account.findOne({ userId: sender._id });

  if (!senderAccount) {
    throw ApiError.notFound('Sender account not found.');
  }

  if (senderAccount.status !== 'active') {
    throw ApiError.unprocessable(
      'ACCOUNT_INACTIVE',
      'This wallet is not active. Contact support before making transfers.'
    );
  }

  const receiver = await User.findOne({ email: input.receiverEmail });
  if (!receiver) {
    throw ApiError.notFound('No registered customer was found with that email address.');
  }

  if (receiver._id.equals(sender._id)) {
    throw ApiError.badRequest('You cannot transfer money to your own wallet.');
  }

  const receiverAccount = await Account.findOne({ userId: receiver._id });
  if (!receiverAccount || receiverAccount.status !== 'active') {
    throw ApiError.unprocessable(
      'RECEIVER_ACCOUNT_UNAVAILABLE',
      'The receiver does not have an active wallet.'
    );
  }

  const amount = input.amount;
  const currency = senderAccount.currency;
  const description = input.description || '';
  const idempotencyKey = input.idempotencyKey;
  const requestHash = hashRequest({
    receiverId: receiver._id.toString(),
    amount,
    currency,
    description,
  });

  // A replay must return the original result before re-running risk checks.
  const previous = await findIdempotentTransaction({
    senderId: sender._id,
    idempotencyKey,
    requestHash,
  });

  if (previous) {
    return {
      transaction: await loadPopulatedTransaction(previous._id),
      replay: true,
    };
  }

  if (senderAccount.balance < amount) {
    await velocityService.recordFailedAttempt(sender._id);
    throw ApiError.unprocessable(
      'INSUFFICIENT_FUNDS',
      `Insufficient wallet balance. Available: ${(senderAccount.balance / 100).toFixed(2)} INR.`,
      {
        availableBalance: senderAccount.balance,
        requiredAmount: amount,
      }
    );
  }

  const [velocity, averageAmount30d, newDevice, unusualLocation] = await Promise.all([
    velocityService.getVelocityFeatures(sender._id),
    getAverageOutgoingAmount(sender._id),
    isNewDevice(sender._id, meta.deviceId),
    detectUnusualLocation(sender._id, meta.location),
  ]);

  const now = new Date();
  const mlFeatures = {
    amount: amount / 100,
    transaction_type: 'TRANSFER',
    transaction_count_10m: velocity.transactions10m,
    transaction_count_1h: velocity.transactions1h,
    is_new_device: newDevice,
    is_unusual_location: unusualLocation,
    failed_attempts_15m: velocity.failedAttempts15m,
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
    avg_amount_30d: averageAmount30d / 100,
    amount_to_balance_ratio: Number((amount / senderAccount.balance).toFixed(4)),
  };

  const ruleResult = evaluateRules({
    amount,
    balanceBefore: senderAccount.balance,
    averageAmount30d,
    transactions10m: velocity.transactions10m,
    transactions1h: velocity.transactions1h,
    failedAttempts15m: velocity.failedAttempts15m,
    isNewDevice: newDevice,
    isUnusualLocation: unusualLocation,
  });

  const mlPrediction = await getFraudPrediction(mlFeatures);

  const risk = decideRisk({
    ruleScore: ruleResult.ruleScore,
    mlAvailable: mlPrediction.available,
    mlProbability: mlPrediction.probability,
  });

  const initialStatus =
    risk.decision === 'DECLINE'
      ? 'DECLINED'
      : risk.decision === 'MANUAL_REVIEW'
        ? 'PENDING_REVIEW'
        : 'APPROVED';

  const session = await mongoose.startSession();
  let transaction;

  try {
    await session.withTransaction(async () => {
      const [created] = await Transaction.create(
        [
          {
            transactionId: generateTransactionId(),
            senderId: sender._id,
            receiverId: receiver._id,
            amount,
            currency,
            description,
            status: initialStatus,
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            decision: risk.decision,
            riskReasons: ruleResult.reasons,
            mlProbability: mlPrediction.available ? mlPrediction.probability : null,
            mlAvailable: mlPrediction.available,
            mlModel: mlPrediction.model,
            idempotencyKey,
            requestHash,
            clientDeviceId: meta.deviceId || null,
            clientLocation: meta.location || null,
            declinedAt: initialStatus === 'DECLINED' ? new Date() : null,
          },
        ],
        { session }
      );

      transaction = created;

      if (meta.deviceId) {
        await Device.findOneAndUpdate(
          { userId: sender._id, deviceId: meta.deviceId },
          {
            $set: { lastSeen: new Date() },
            $setOnInsert: { trusted: false },
          },
          { upsert: true, new: true, session }
        );
      }

      // Low-risk payments settle immediately. Pending or declined payments
      // never touch balances until an admin approves them.
      if (initialStatus === 'APPROVED') {
        await settleTransfer({
          transaction: created,
          senderAccountId: senderAccount._id,
          receiverAccountId: receiverAccount._id,
          amount,
          session,
        });
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Transaction.findOne({
        senderId: sender._id,
        idempotencyKey,
      });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw ApiError.conflict(
            'IDEMPOTENCY_KEY_REUSED',
            'This idempotency key was already used with different payment details.',
            { transactionId: existing.transactionId }
          );
        }

        return {
          transaction: await loadPopulatedTransaction(existing._id),
          replay: true,
        };
      }
    }

    if (
      error instanceof ApiError &&
      error.code === 'INSUFFICIENT_FUNDS'
    ) {
      await velocityService.recordFailedAttempt(sender._id);
      const failed = await recordFailedTransaction({
        senderId: sender._id,
        receiverId: receiver._id,
        amount,
        currency,
        description,
        idempotencyKey,
        requestHash,
        risk,
        mlPrediction,
        meta,
        failureReason: error.message,
      });

      if (failed) {
        throw new ApiError(error.statusCode, error.code, error.message, {
          ...(error.details || {}),
          transactionId: failed.transactionId,
        });
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }

  // Post-commit work must never turn a successful payment into an API error.
  try {
    await velocityService.recordTransaction(sender._id, transaction.transactionId);
    if (initialStatus === 'DECLINED') {
      await velocityService.recordFailedAttempt(sender._id, transaction.transactionId);
    }
    await rememberIdempotency({
      senderId: sender._id,
      idempotencyKey,
      transaction,
    });
  } catch (error) {
    console.warn(`[payment] post-commit bookkeeping failed: ${error.message}`);
  }

  const alert = await createFraudAlertIfNeeded(transaction);
  const populated = await loadPopulatedTransaction(transaction._id);

  notifyCreatedTransaction(populated, alert);

  return { transaction: populated, replay: false };
}

export { recordFailedTransaction };
