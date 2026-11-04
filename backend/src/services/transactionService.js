import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Transaction } from '../models/Transaction.js';
import { FraudAlert } from '../models/FraudAlert.js';
import { Review } from '../models/Review.js';
import { ApiError } from '../utils/ApiError.js';
import { presentAlert, presentTransaction } from './transactionPresenter.js';

const POPULATE_PATHS = [
  { path: 'senderId', select: 'name email' },
  { path: 'receiverId', select: 'name email' },
  { path: 'reviewedBy', select: 'name email' },
];

export function buildTransactionQuery(identifier) {
  if (mongoose.isValidObjectId(identifier)) {
    return { _id: identifier };
  }
  return { transactionId: identifier };
}

function applyFilters(query, filters) {
  const result = { ...query };

  if (filters.status) result.status = filters.status;
  if (filters.riskLevel) result.riskLevel = filters.riskLevel;

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    result.amount = {};
    if (filters.minAmount !== undefined) result.amount.$gte = filters.minAmount;
    if (filters.maxAmount !== undefined) result.amount.$lte = filters.maxAmount;
  }

  if (filters.from || filters.to) {
    result.createdAt = {};
    if (filters.from) result.createdAt.$gte = filters.from;
    if (filters.to) result.createdAt.$lte = filters.to;
  }

  return result;
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function listTransactions({ userId, applyOwnership, filters }) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;

  let baseQuery = {};
  if (applyOwnership) {
    baseQuery = {
      $or: [{ senderId: userId }, { receiverId: userId }],
    };
  }

  const query = applyFilters(baseQuery, filters);

  const [total, documents] = await Promise.all([
    Transaction.countDocuments(query),
    Transaction.find(query)
      .populate(POPULATE_PATHS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: documents.map((document) => presentTransaction(document, userId || null)),
    pagination: buildPagination(page, limit, total),
  };
}

export async function findPopulatedTransactionById(id) {
  return Transaction.findById(id).populate(POPULATE_PATHS).lean();
}

async function findTransactionDocument(identifier, user, allowAdminAccess) {
  const transaction = await Transaction.findOne(buildTransactionQuery(identifier));
  if (!transaction) {
    throw ApiError.notFound('Transaction not found.');
  }

  const isParticipant =
    transaction.senderId.toString() === user._id.toString() ||
    transaction.receiverId.toString() === user._id.toString();

  if (!isParticipant && !(allowAdminAccess && user.role === 'admin')) {
    // Return 404 rather than 403 so a customer cannot probe other transaction ids.
    throw ApiError.notFound('Transaction not found.');
  }

  return transaction;
}

export async function getTransaction(identifier, user) {
  await findTransactionDocument(identifier, user, true);

  const transaction = await Transaction.findOne(buildTransactionQuery(identifier))
    .populate(POPULATE_PATHS)
    .lean();

  return presentTransaction(transaction, user._id);
}

export async function getTransactionRisk(identifier, user) {
  const transaction = await findTransactionDocument(identifier, user, true);

  const [alert, review, populated] = await Promise.all([
    FraudAlert.findOne({ transactionId: transaction._id }).lean(),
    Review.findOne({ transactionId: transaction._id })
      .populate('adminId', 'name email')
      .lean(),
    findPopulatedTransactionById(transaction._id),
  ]);

  const ruleScore = (transaction.riskReasons || []).reduce(
    (sum, reason) => sum + reason.weight,
    0
  );

  return {
    transaction: presentTransaction(populated, user._id),
    risk: {
      riskScore: transaction.riskScore,
      riskLevel: transaction.riskLevel,
      decision: transaction.decision,
      ruleScore: Math.min(100, ruleScore),
      mlScore:
        transaction.mlProbability === null
          ? null
          : Math.round(transaction.mlProbability * 100),
      mlProbability: transaction.mlProbability,
      mlAvailable: transaction.mlAvailable,
      mlModel: transaction.mlModel,
      reasons: transaction.riskReasons || [],
      thresholds: {
        medium: env.RISK_MEDIUM_THRESHOLD,
        high: env.RISK_HIGH_THRESHOLD,
      },
    },
    alert: alert ? presentAlert(alert, populated) : null,
    review: review
      ? {
          decision: review.decision,
          reason: review.reason,
          admin: review.adminId,
          createdAt: review.createdAt,
        }
      : null,
  };
}

export { POPULATE_PATHS };
