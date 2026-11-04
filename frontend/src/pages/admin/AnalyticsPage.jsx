import { useCallback, useEffect } from 'react';
import {
  BarChart3,
  Bot,
  BrainCircuit,
  FlaskConical,
  Gavel,
  ShieldAlert,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import Skeleton, { CardsSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import ActivityChart from '../../components/charts/ActivityChart';
import RiskDistributionChart from '../../components/charts/RiskDistributionChart';
import StatusBarChart from '../../components/charts/StatusBarChart';
import RuleFrequencyChart from '../../components/charts/RuleFrequencyChart';
import AmountBucketsChart from '../../components/charts/AmountBucketsChart';
import { useRealtime } from '../../context/RealtimeContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData } from '../../services/api';
import { STATUS_META } from '../../utils/constants';
import {
  formatInrCompact,
  formatNumber,
  formatPercent,
} from '../../utils/format';

export default function AnalyticsPage() {
  useDocumentTitle('Analytics');

  const { event } = useRealtime();

  const loadAnalytics = useCallback(async () => {
    const response = await api.get('/admin/analytics');
    return apiData(response);
  }, []);

  const { data, loading, error, reload } = useAsyncData(loadAnalytics);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  const mlStats = data?.mlStats;
  const totalAnalysed = mlStats?.totalTransactions || 0;
  const mlCoverage =
    totalAnalysed > 0
      ? (mlStats.mlPredictions / totalAnalysed) * 100
      : 0;

  const statusChartData = (data?.statusDistribution || []).map((entry) => ({
    key: entry.status,
    label: STATUS_META[entry.status]?.label || entry.status,
    count: entry.count,
  }));

  const reviewTotal = (data?.reviewDecisions || []).reduce(
    (sum, entry) => sum + entry.count,
    0
  );
  const alertTotal = (data?.alertStatus || []).reduce(
    (sum, entry) => sum + entry.count,
    0
  );
  const completedVolume = (data?.dailySeries || []).reduce(
    (sum, entry) => sum + entry.volume,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Model & risk insights"
        title="Fraud analytics"
        description="A rolling view of payment activity, risk bands, rule triggers and machine-learning coverage."
        actions={<Badge tone="info">Last {data?.periodDays || 14} days</Badge>}
      />

      {error && !data ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : (
        <>
          {loading && !data ? (
            <CardsSkeleton count={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Transactions analysed"
                value={formatNumber(totalAnalysed)}
                hint={`${formatInrCompact(completedVolume)} settled in period`}
                icon={BarChart3}
                tone="blue"
              />
              <StatCard
                label="ML-scored payments"
                value={formatNumber(mlStats?.mlPredictions)}
                hint={`${formatPercent(mlCoverage, 1)} model coverage`}
                icon={BrainCircuit}
                tone="emerald"
              />
              <StatCard
                label="Rule-only fallbacks"
                value={formatNumber(mlStats?.ruleOnlyDecisions)}
                hint="Used when the model service is unavailable"
                icon={FlaskConical}
                tone="amber"
              />
              <StatCard
                label="Avg fraud probability"
                value={
                  mlStats?.averageFraudProbability === null ||
                  mlStats?.averageFraudProbability === undefined
                    ? '—'
                    : formatPercent(mlStats.averageFraudProbability * 100, 1)
                }
                hint="Mean ML output across all payments"
                icon={Bot}
                tone="navy"
              />
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Daily payment activity"
                description="All transactions as bars; medium and high risk payments as the red line."
                action={<Badge tone="neutral">14 days</Badge>}
              />
              <CardBody>
                {loading && !data ? (
                  <Skeleton className="h-[260px] w-full rounded-xl" />
                ) : (
                  <ActivityChart data={data?.dailySeries || []} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Risk mix"
                description="How risk bands are distributed."
              />
              <CardBody>
                {loading && !data ? (
                  <Skeleton className="h-[200px] w-full rounded-xl" />
                ) : (
                  <RiskDistributionChart data={data?.riskDistribution || []} />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Most frequent fraud rules"
                description="Rule triggers across all scored payments."
              />
              <CardBody>
                {loading && !data ? (
                  <Skeleton className="h-[280px] w-full rounded-xl" />
                ) : data?.topRules?.length ? (
                  <RuleFrequencyChart data={data.topRules} />
                ) : (
                  <EmptyState
                    title="No rule triggers yet"
                    description="As soon as a payment trips a fraud rule it will be counted here."
                    className="py-10"
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Completed transfers by amount"
                description="Distribution of settled payment sizes."
              />
              <CardBody>
                {loading && !data ? (
                  <Skeleton className="h-[260px] w-full rounded-xl" />
                ) : data?.amountBuckets?.length ? (
                  <AmountBucketsChart data={data.amountBuckets} />
                ) : (
                  <EmptyState
                    title="No completed transfers"
                    description="Amount buckets appear after the first successful transfer."
                    className="py-10"
                  />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Payment status mix"
                description="Where payments end up after the decision engine runs."
              />
              <CardBody>
                {loading && !data ? (
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                ) : statusChartData.length ? (
                  <StatusBarChart data={statusChartData} />
                ) : (
                  <EmptyState
                    title="No payments yet"
                    description="Status analytics appear once customers start transferring."
                    className="py-10"
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Review & alert outcomes"
                description="Human decisions and resolved alerts."
              />
              <CardBody className="space-y-5">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Gavel className="h-3.5 w-3.5" />
                    Review decisions
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {(data?.reviewDecisions || []).length ? (
                      data.reviewDecisions.map((entry) => (
                        <li
                          key={entry.decision}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm"
                        >
                          <span className="capitalize text-slate-600">
                            {entry.decision.toLowerCase()}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatNumber(entry.count)}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-400">
                        No admin reviews have been recorded yet.
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {formatNumber(reviewTotal)} total decisions
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Fraud alerts
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {(data?.alertStatus || []).length ? (
                      data.alertStatus.map((entry) => (
                        <li
                          key={entry.status}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm"
                        >
                          <span className="capitalize text-slate-600">
                            {entry.status.toLowerCase()}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatNumber(entry.count)}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-400">
                        No fraud alerts have been opened.
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {formatNumber(alertTotal)} total alerts
                  </p>
                </div>

                <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                  ML metrics shown in the README are measured on a synthetic
                  dataset. They describe the model, not real-world fraud
                  performance.
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
