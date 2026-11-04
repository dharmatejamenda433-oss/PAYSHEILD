import { FraudAlert } from '../models/FraudAlert.js';
import { presentAlert, presentTransaction } from './transactionPresenter.js';

/**
 * Admin fraud alert list. The transaction is populated so the investigation
 * page can show risk context without a second request.
 */
export async function listFraudAlerts({ page, limit, status, riskLevel }) {
  const query = {};
  if (status) query.status = status;
  if (riskLevel) query.riskLevel = riskLevel;

  const [total, alerts] = await Promise.all([
    FraudAlert.countDocuments(query),
    FraudAlert.find(query)
      .populate({
        path: 'transactionId',
        populate: [
          { path: 'senderId', select: 'name email' },
          { path: 'receiverId', select: 'name email' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: alerts.map((alert) => presentAlert(alert, alert.transactionId || null)),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
