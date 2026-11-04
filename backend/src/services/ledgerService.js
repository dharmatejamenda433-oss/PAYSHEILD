import { LedgerEntry } from '../models/LedgerEntry.js';

function toLedgerResponse(entry) {
  const transaction = entry.transactionId;

  return {
    id: entry._id.toString(),
    entryType: entry.entryType,
    amount: entry.amount,
    balanceAfter: entry.balanceAfter,
    createdAt: entry.createdAt,
    transaction: transaction
      ? {
          id: transaction._id.toString(),
          transactionId: transaction.transactionId,
          status: transaction.status,
          description: transaction.description,
          createdAt: transaction.createdAt,
        }
      : null,
  };
}

export async function listLedgerEntries(accountId, { page, limit }) {
  const [total, entries] = await Promise.all([
    LedgerEntry.countDocuments({ accountId }),
    LedgerEntry.find({ accountId })
      .populate('transactionId', 'transactionId status description createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: entries.map(toLedgerResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
