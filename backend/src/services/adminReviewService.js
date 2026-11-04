import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Account } from '../models/Account.js';
import { Review } from '../models/Review.js';
import { FraudAlert } from '../models/FraudAlert.js';
import { ApiError } from '../utils/ApiError.js';
import { settleTransfer } from './paymentService.js';
import { assertTransition } from './transactionStateService.js';
import { findPopulatedTransactionById } from './transactionService.js';
import { presentTransaction } from './transactionPresenter.js';
import * as velocityService from './velocityService.js';
import { emitToAdmins, emitToUser } from '../sockets/socketRegistry.js';

async function notifyReview(transaction, decision) {
  const senderId = transaction.senderId._id || transaction.senderId;
  const receiverId = transaction.receiverId._id || transaction.receiverId;

  emitToUser(senderId, 'transaction:reviewed', {
    transaction: presentTransaction(transaction, senderId),
    decision,
  });

  if (decision === 'APPROVED' && transaction.status === 'COMPLETED') {
    emitToUser(receiverId, 'transaction:reviewed', {
      transaction: presentTransaction(transaction, receiverId),
      decision,
    });
  }

  emitToAdmins('transaction:reviewed', {
    transaction: presentTransaction(transaction),
    decision,
  });
}

async function approvePendingTransfer({ transaction, adminId, reason }) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const claimed = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'PENDING_REVIEW' },
        {
          $set: {
            status: 'APPROVED',
            reviewedBy: adminId,
            reviewedAt: new Date(),
            reviewReason: reason,
          },
        },
        { new: true, session }
      );

      if (!claimed) {
        throw ApiError.conflict(
          'REVIEW_ALREADY_PROCESSED',
          'This transaction is no longer awaiting review.'
        );
      }

      const [senderAccount, receiverAccount] = await Promise.all([
        Account.findOne({ userId: claimed.senderId }).session(session),
        Account.findOne({ userId: claimed.receiverId }).session(session),
      ]);

      if (!senderAccount || !receiverAccount) {
        throw ApiError.unprocessable(
          'ACCOUNT_NOT_FOUND',
          'One of the accounts for this transaction is no longer available.'
        );
      }

      await settleTransfer({
        transaction: claimed,
        senderAccountId: senderAccount._id,
        receiverAccountId: receiverAccount._id,
        amount: claimed.amount,
        session,
      });

      await Review.create(
        [
          {
            transactionId: claimed._id,
            adminId,
            decision: 'APPROVED',
            reason,
          },
        ],
        { session }
      );

      await FraudAlert.findOneAndUpdate(
        { transactionId: claimed._id },
        {
          $set: {
            status: 'RESOLVED',
            resolutionNote: `Approved by admin: ${reason}`,
            resolvedBy: adminId,
            resolvedAt: new Date(),
          },
        },
        { session }
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict(
        'REVIEW_ALREADY_RECORDED',
        'A review decision has already been recorded for this transaction.'
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

async function rejectPendingTransfer({ transaction, adminId, reason }) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      assertTransition('PENDING_REVIEW', 'DECLINED');

      const declined = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'PENDING_REVIEW' },
        {
          $set: {
            status: 'DECLINED',
            declinedAt: new Date(),
            reviewedBy: adminId,
            reviewedAt: new Date(),
            reviewReason: reason,
          },
        },
        { new: true, session }
      );

      if (!declined) {
        throw ApiError.conflict(
          'REVIEW_ALREADY_PROCESSED',
          'This transaction is no longer awaiting review.'
        );
      }

      await Review.create(
        [
          {
            transactionId: declined._id,
            adminId,
            decision: 'REJECTED',
            reason,
          },
        ],
        { session }
      );

      await FraudAlert.findOneAndUpdate(
        { transactionId: declined._id },
        {
          $set: {
            status: 'RESOLVED',
            resolutionNote: `Rejected by admin: ${reason}`,
            resolvedBy: adminId,
            resolvedAt: new Date(),
          },
        },
        { session }
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict(
        'REVIEW_ALREADY_RECORDED',
        'A review decision has already been recorded for this transaction.'
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  await velocityService.recordFailedAttempt(
    transaction.senderId,
    `rejected-${transaction.transactionId}`
  );
}

/**
 * Approves or rejects a PENDING_REVIEW transfer.
 * `action` is APPROVE or REJECT; approval is the only path that moves money.
 */
export async function reviewPendingTransaction({ transactionId, adminId, action, reason }) {
  const transaction = await Transaction.findOne({ transactionId });

  if (!transaction) {
    throw ApiError.notFound('Transaction not found.');
  }

  if (transaction.status !== 'PENDING_REVIEW') {
    throw ApiError.conflict(
      'REVIEW_NOT_PENDING',
      `Only transactions awaiting review can be decided. This one is ${transaction.status}.`
    );
  }

  if (action === 'APPROVE') {
    await approvePendingTransfer({ transaction, adminId, reason });
  } else if (action === 'REJECT') {
    await rejectPendingTransfer({ transaction, adminId, reason });
  } else {
    throw ApiError.badRequest('Unsupported review action.');
  }

  const populated = await findPopulatedTransactionById(transaction._id);
  await notifyReview(populated, action === 'APPROVE' ? 'APPROVED' : 'REJECTED');

  return populated;
}
