import mongoose from 'mongoose';

const riskReasonSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    weight: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Integer minor units (paise).
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Transaction amount must be an integer number of paise',
      },
    },
    currency: {
      type: String,
      enum: ['INR'],
      default: 'INR',
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 140,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'COMPLETED', 'DECLINED', 'FAILED'],
      default: 'PENDING_REVIEW',
      required: true,
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
    decision: {
      type: String,
      enum: ['APPROVE', 'MANUAL_REVIEW', 'DECLINE'],
      required: true,
    },
    riskReasons: {
      type: [riskReasonSchema],
      default: [],
    },
    mlProbability: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    mlAvailable: {
      type: Boolean,
      default: false,
    },
    mlModel: {
      type: String,
      default: 'unavailable',
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    clientDeviceId: {
      type: String,
      default: null,
      maxlength: 120,
    },
    clientLocation: {
      type: String,
      default: null,
      maxlength: 120,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    declinedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Durable idempotency: one logical payment per sender + key, even across API restarts.
transactionSchema.index({ senderId: 1, idempotencyKey: 1 }, { unique: true });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ riskLevel: 1, createdAt: -1 });

transactionSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Transaction = mongoose.model('Transaction', transactionSchema);
