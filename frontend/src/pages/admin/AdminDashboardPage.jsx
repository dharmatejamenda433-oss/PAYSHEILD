import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Percent,
  ReceiptText,
  ShieldAlert,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import { CardsSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import TransactionTable from '../../components/transactions/TransactionTable';
import VolumeChart from '../../components/charts/VolumeChart';
import RiskDistributionChart from '../../components/charts/RiskDistributionChart';
import { useRealtime } from '../../context/RealtimeContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData } from '../../services/api';
import {
  formatInr,
  formatInrCompact,
  formatNumber,
  formatPercent,
} from '../../utils/format';

const STATUS_LABELS = {
  COMPLETED: 'Completed',
  PENDING_REVIEW: 'In review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  FAILED: 'Failed',
};

export default function AdminDashboardPage() {
  useDocumentTitle('Admin overview');

  const { event } = useRealtime();

  const loadDashboard = useCallback(async () => {
    const response = await api.get('/admin/dashboard');
    return apiData(response);
  }, []);

  const { data, loading, error, reload } = useAsyncData(loadDashboard);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  const metrics = data?.metrics;
  const pendingReviews = metrics?.pendingReviews || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fraud control centre"
        title="Admin overview"
        description="Live payment volume, risk distribution and the suspicious transfers that need your attention."
        actions={
          <>
            <Button as={Link} to="/admin/alerts" variant="secondary" icon={ShieldAlert}>
              Fraud alerts
            </Button>
            <Button as={Link} to="/admin/transactions" icon={ReceiptText}>
              All transactions
            </Button>
          </>
        }
      />

      {error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : (
        <>
          {pendingReviews > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Clock3 className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  {pendingReviews} payment{pendingReviews === 1 ? '' : 's'} waiting for review
                </p>
                <p className="text-xs text-amber-700">
                  No money moves until you approve or reject these transfers.
                </p>
              </div>
              <Button
                as={Link}
                to="/admin/transactions?status=PENDING_REVIEW"
                size="sm"
                variant="secondary"
                iconRight={ArrowRight}
              >
                Open review queue
              </Button>
            </div>
          ) : null}

          {loading && !data ? (
            <CardsSkeleton count={6} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Total transactions"
                value={formatNumber(metrics?.totalTransactions)}
                hint="All simulated payment attempts"
                icon={ReceiptText}
                tone="blue"
              />
              <StatCard
                label="Completed volume"
                value={formatInrCompact(metrics?.totalVolume)}
                hint={formatInr(metrics?.totalVolume)}
                icon={IndianRupee}
                tone="emerald"
              />
              <StatCard
                label="Successful payments"
                value={formatNumber(metrics?.successfulTransactions)}
                hint="Settled with ledger entries"
                icon={CheckCircle2}
                tone="emerald"
              />
              <StatCard
                label="Flagged payments"
                value={formatNumber(metrics?.flaggedTransactions)}
                hint="Medium or high risk"
                icon={ShieldAlert}
                tone="amber"
              />
              <StatCard
                label="Pending reviews"
                value={formatNumber(metrics?.pendingReviews)}
                hint={`${formatNumber(metrics?.openAlerts)} open fraud alerts`}
                icon={Clock3}
                tone="rose"
              />
              <StatCard
                label="Fraud rate"
                value={formatPercent(metrics?.fraudRate)}
                hint={`Avg risk score ${formatNumber(metrics?.averageRiskScore)}/100`}
                icon={Percent}
                tone="navy"
              />
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Transaction volume"
                description="Completed payment value over the last seven days."
                action={<Badge tone="info">Last 7 days</Badge>}
              />
              <CardBody>
                {loading && !data ? (
                  <div className="skeleton-shimmer h-[280px] w-full rounded-xl" />
                ) : (
                  <VolumeChart data={data?.volumeSeries || []} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Risk distribution"
                description="Share of payments by risk band."
              />
              <CardBody>
                {loading && !data ? (
                  <div className="skeleton-shimmer h-[200px] w-full rounded-xl" />
                ) : (
                  <RiskDistributionChart data={data?.riskDistribution || []} />
                )}

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment status
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {(data?.statusDistribution || []).length ? (
                      data.statusDistribution.map((entry) => (
                        <li
                          key={entry.status}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-500">
                            {STATUS_LABELS[entry.status] || entry.status}
                          </span>
                          <span className="font-semibold tabular-nums text-slate-800">
                            {formatNumber(entry.count)}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-400">
                        No payments have been processed yet.
                      </li>
                    )}
                  </ul>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="Recent suspicious payments"
              description="Medium and high risk transfers, newest first."
              action={
                <Link
                  to="/admin/alerts"
                  className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  View fraud alerts
                </Link>
              }
            />

            {loading && !data ? (
              <TableSkeleton rows={4} columns={6} />
            ) : (
              <TransactionTable
                transactions={data?.recentSuspicious || []}
                variant="admin"
                emptyTitle="No suspicious payments"
                emptyDescription="When a transfer scores medium or high risk it will appear here for investigation."
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
