import { Transaction } from '../models/Transaction.js';
import { FraudAlert } from '../models/FraudAlert.js';
import { Review } from '../models/Review.js';
import { POPULATE_PATHS } from './transactionService.js';
import { presentTransaction } from './transactionPresenter.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyBuckets(numberOfDays) {
  const today = startOfUtcDay(new Date());
  const buckets = [];

  for (let offset = numberOfDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * DAY_MS);
    buckets.push({
      date: toDateKey(date),
      count: 0,
      volume: 0,
      flagged: 0,
    });
  }

  return buckets;
}

function mergeDailySeries(numberOfDays, aggregation) {
  const buckets = buildDailyBuckets(numberOfDays);
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  for (const row of aggregation) {
    const bucket = byDate.get(row._id);
    if (bucket) {
      bucket.count = row.count;
      bucket.volume = row.volume;
      bucket.flagged = row.flagged || 0;
    }
  }

  return buckets;
}

function distributionWithAllLevels(rows) {
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  return ['LOW', 'MEDIUM', 'HIGH'].map((level) => ({
    level,
    count: counts.get(level) || 0,
  }));
}

export async function getAdminDashboard() {
  const now = new Date();
  const sevenDaysAgo = startOfUtcDay(new Date(now.getTime() - 6 * DAY_MS));

  const [
    totalTransactions,
    completedVolume,
    successfulTransactions,
    flaggedTransactions,
    pendingReviews,
    declinedTransactions,
    riskRows,
    statusRows,
    volumeByDay,
    averageRisk,
    recentSuspicious,
    openAlerts,
  ] = await Promise.all([
    Transaction.countDocuments({}),
    Transaction.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, totalVolume: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.countDocuments({ status: 'COMPLETED' }),
    Transaction.countDocuments({ riskLevel: { $in: ['MEDIUM', 'HIGH'] } }),
    Transaction.countDocuments({ status: 'PENDING_REVIEW' }),
    Transaction.countDocuments({ status: 'DECLINED' }),
    Transaction.aggregate([{ $group: { _id: '$riskLevel', count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Transaction.aggregate([
      { $match: { status: 'COMPLETED', createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          volume: { $sum: '$amount' },
          flagged: { $sum: 0 },
        },
      },
    ]),
    Transaction.aggregate([{ $group: { _id: null, average: { $avg: '$riskScore' } } }]),
    Transaction.find({ riskLevel: { $ne: 'LOW' } })
      .populate(POPULATE_PATHS)
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    FraudAlert.countDocuments({ status: 'OPEN' }),
  ]);

  const totalVolume = completedVolume[0]?.totalVolume || 0;
  const averageRiskScore = Math.round(averageRisk[0]?.average || 0);

  return {
    metrics: {
      totalTransactions,
      totalVolume,
      successfulTransactions,
      flaggedTransactions,
      pendingReviews,
      declineRate:
        totalTransactions === 0
          ? 0
          : Number(((declinedTransactions / totalTransactions) * 100).toFixed(2)),
      fraudRate:
        totalTransactions === 0
          ? 0
          : Number(((flaggedTransactions / totalTransactions) * 100).toFixed(2)),
      averageRiskScore,
      openAlerts,
    },
    recentSuspicious: recentSuspicious.map((transaction) =>
      presentTransaction(transaction)
    ),
    volumeSeries: mergeDailySeries(7, volumeByDay).map(({ date, count, volume }) => ({
      date,
      count,
      volume,
    })),
    riskDistribution: distributionWithAllLevels(riskRows),
    statusDistribution: statusRows.map((row) => ({
      status: row._id,
      count: row.count,
    })),
  };
}

export async function getAdminAnalytics() {
  const periodDays = 14;
  const since = startOfUtcDay(
    new Date(Date.now() - (periodDays - 1) * DAY_MS)
  );

  const [
    dailyRows,
    statusRows,
    riskRows,
    topRuleRows,
    mlRows,
    amountBucketRows,
    reviewRows,
    alertRows,
  ] = await Promise.all([
    Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          volume: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0],
            },
          },
          flagged: {
            $sum: {
              $cond: [{ $in: ['$riskLevel', ['MEDIUM', 'HIGH']] }, 1, 0],
            },
          },
        },
      },
    ]),
    Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $group: { _id: '$riskLevel', count: { $sum: 1 } } }]),
    Transaction.aggregate([
      { $unwind: '$riskReasons' },
      { $match: { 'riskReasons.weight': { $gt: 0 } } },
      {
        $group: {
          _id: '$riskReasons.code',
          count: { $sum: 1 },
          totalWeight: { $sum: '$riskReasons.weight' },
          message: { $first: '$riskReasons.message' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          mlPredictions: { $sum: { $cond: ['$mlAvailable', 1, 0] } },
          ruleOnly: { $sum: { $cond: ['$mlAvailable', 0, 1] } },
          averageProbability: { $avg: '$mlProbability' },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $bucket: {
          groupBy: '$amount',
          boundaries: [0, 50000, 200000, 1000000, 2500000],
          default: '2500000+',
          output: {
            count: { $sum: 1 },
            volume: { $sum: '$amount' },
          },
        },
      },
    ]),
    Review.aggregate([{ $group: { _id: '$decision', count: { $sum: 1 } } }]),
    FraudAlert.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const bucketLabels = {
    0: 'Up to ₹500',
    50000: '₹500 – ₹2,000',
    200000: '₹2,000 – ₹10,000',
    1000000: '₹10,000 – ₹25,000',
    '2500000+': '₹25,000+',
  };

  const ml = mlRows[0] || {
    total: 0,
    mlPredictions: 0,
    ruleOnly: 0,
    averageProbability: null,
  };

  return {
    periodDays,
    dailySeries: mergeDailySeries(periodDays, dailyRows),
    statusDistribution: statusRows.map((row) => ({
      status: row._id,
      count: row.count,
    })),
    riskDistribution: distributionWithAllLevels(riskRows),
    topRules: topRuleRows.map((row) => ({
      code: row._id,
      count: row.count,
      averageWeight: Math.round(row.totalWeight / row.count),
      message: row.message,
    })),
    mlStats: {
      totalTransactions: ml.total,
      mlPredictions: ml.mlPredictions,
      ruleOnlyDecisions: ml.ruleOnly,
      averageFraudProbability:
        ml.averageProbability === null
          ? null
          : Number(ml.averageProbability.toFixed(4)),
    },
    amountBuckets: amountBucketRows.map((row) => ({
      label: bucketLabels[row._id] || String(row._id),
      count: row.count,
      volume: row.volume,
    })),
    reviewDecisions: reviewRows.map((row) => ({
      decision: row._id,
      count: row.count,
    })),
    alertStatus: alertRows.map((row) => ({
      status: row._id,
      count: row.count,
    })),
  };
}
