import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      required: true,
    },
    // Integer minor units (paise).
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Ledger amount must be an integer number of paise',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'balanceAfter must be an integer number of paise',
      },
    },
  },
  { timestamps: true }
);

// A completed transfer must have exactly one debit and one credit.
ledgerEntrySchema.index({ transactionId: 1, entryType: 1 }, { unique: true });
ledgerEntrySchema.index({ accountId: 1, createdAt: -1 });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
