import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { listTransactions } from '../services/transactionService.js';
import { listFraudAlerts } from '../services/adminFraudService.js';
import {
  getAdminDashboard,
  getAdminAnalytics,
} from '../services/adminAnalyticsService.js';
import { reviewPendingTransaction } from '../services/adminReviewService.js';
import { presentTransaction } from '../services/transactionPresenter.js';

export const dashboard = asyncHandler(async (_req, res) => {
  const data = await getAdminDashboard();
  return sendSuccess(res, data);
});

export const transactions = asyncHandler(async (req, res) => {
  const result = await listTransactions({
    userId: null,
    applyOwnership: false,
    filters: req.query,
  });
  return sendSuccess(res, result);
});

export const fraudAlerts = asyncHandler(async (req, res) => {
  const result = await listFraudAlerts(req.query);
  return sendSuccess(res, result);
});

export const analytics = asyncHandler(async (_req, res) => {
  const data = await getAdminAnalytics();
  return sendSuccess(res, data);
});

export const approve = asyncHandler(async (req, res) => {
  const transaction = await reviewPendingTransaction({
    transactionId: req.params.id,
    adminId: req.user._id,
    action: 'APPROVE',
    reason: req.body.reason,
  });

  return sendSuccess(res, {
    transaction: presentTransaction(transaction),
    decision: 'APPROVED',
  });
});

export const reject = asyncHandler(async (req, res) => {
  const transaction = await reviewPendingTransaction({
    transactionId: req.params.id,
    adminId: req.user._id,
    action: 'REJECT',
    reason: req.body.reason,
  });

  return sendSuccess(res, {
    transaction: presentTransaction(transaction),
    decision: 'REJECTED',
  });
});
