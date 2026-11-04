import mongoose from 'mongoose';

const fraudAlertSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
      index: true,
    },
    reasons: {
      type: [
        {
          code: String,
          message: String,
          weight: Number,
          _id: false,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['OPEN', 'RESOLVED'],
      default: 'OPEN',
      required: true,
      index: true,
    },
    resolutionNote: {
      type: String,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

fraudAlertSchema.index({ status: 1, createdAt: -1 });

export const FraudAlert = mongoose.model('FraudAlert', fraudAlertSchema);
