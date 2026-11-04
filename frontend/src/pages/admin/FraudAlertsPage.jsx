import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Card, { CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import StatusBadge from '../../components/transactions/StatusBadge';
import RiskBadge from '../../components/transactions/RiskBadge';
import { useRealtime } from '../../context/RealtimeContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData } from '../../services/api';
import { formatDateTime, formatInr, formatNumber } from '../../utils/format';

const STATUS_OPTIONS = [
  { value: '', label: 'All alerts' },
  { value: 'OPEN', label: 'Open alerts' },
  { value: 'RESOLVED', label: 'Resolved alerts' },
];

const RISK_OPTIONS = [
  { value: '', label: 'All risk levels' },
  { value: 'MEDIUM', label: 'Medium risk' },
  { value: 'HIGH', label: 'High risk' },
];

function reasonLabel(code) {
  return code
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export default function FraudAlertsPage() {
  useDocumentTitle('Fraud alerts');

  const { event } = useRealtime();
  const [filters, setFilters] = useState({ status: '', riskLevel: '' });
  const [page, setPage] = useState(1);

  const loadAlerts = useCallback(async () => {
    const params = { page, limit: 10 };
    if (filters.status) params.status = filters.status;
    if (filters.riskLevel) params.riskLevel = filters.riskLevel;

    const response = await api.get('/admin/fraud-alerts', { params });
    return apiData(response);
  }, [page, filters]);

  const { data, loading, error, reload } = useAsyncData(loadAlerts, [
    page,
    filters,
  ]);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters({ status: '', riskLevel: '' });
    setPage(1);
  }

  const hasFilters = Boolean(filters.status || filters.riskLevel);
  const total = data?.pagination?.total;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fraud control centre"
        title="Fraud alerts"
        description="Alerts open automatically when a payment scores medium or high risk. Resolve them by approving or rejecting the underlying transfer."
        actions={
          <Button as={Link} to="/admin/transactions" variant="secondary">
            All transactions
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 p-5">
          <Select
            label="Alert status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(changeEvent) => updateFilter('status', changeEvent.target.value)}
            className="w-full sm:w-48"
          />
          <Select
            label="Risk level"
            options={RISK_OPTIONS}
            value={filters.riskLevel}
            onChange={(changeEvent) =>
              updateFilter('riskLevel', changeEvent.target.value)
            }
            className="w-full sm:w-48"
          />
          {hasFilters ? (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetFilters}>
              Clear filters
            </Button>
          ) : null}
          <span className="ml-auto pb-2.5 text-xs text-slate-500">
            {total === undefined
              ? 'Loading alerts…'
              : `${formatNumber(total)} alert${total === 1 ? '' : 's'}`}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Alert queue"
          description="Newest alerts first. Click investigate to inspect all risk signals."
          action={
            <Badge tone={filters.status === 'RESOLVED' ? 'success' : 'warning'}>
              {filters.status === 'RESOLVED'
                ? 'Resolved view'
                : filters.status === 'OPEN'
                  ? 'Open only'
                  : 'All alerts'}
            </Badge>
          }
        />

        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3].map((row) => (
              <div key={row} className="space-y-3 p-5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            ))}
          </div>
        ) : !data?.items?.length ? (
          <EmptyState
            icon={hasFilters ? ShieldAlert : ShieldCheck}
            title={hasFilters ? 'No alerts match these filters' : 'No fraud alerts'}
            description={
              hasFilters
                ? 'Try clearing the filters to see the full alert queue.'
                : 'When a payment scores medium or high risk, an alert appears here for investigation.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data.items.map((alert) => {
                const transaction = alert.transaction;
                const transactionRef =
                  transaction?.transactionId || alert.transactionId;

                return (
                  <li key={alert.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/investigations/${transactionRef}`}
                            className="font-mono text-xs font-semibold text-navy-800 transition hover:text-blue-600"
                          >
                            {transactionRef}
                          </Link>
                          <RiskBadge
                            level={alert.riskLevel}
                            score={alert.riskScore}
                          />
                          <Badge
                            tone={alert.status === 'OPEN' ? 'warning' : 'success'}
                            dot
                          >
                            {alert.status}
                          </Badge>
                          {transaction ? (
                            <StatusBadge status={transaction.status} />
                          ) : null}
                          <span className="text-[11px] text-slate-400">
                            {formatDateTime(alert.createdAt)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <p className="text-lg font-semibold tracking-tight text-slate-900">
                            {transaction ? formatInr(transaction.amount) : '—'}
                          </p>
                          {transaction ? (
                            <p className="text-xs text-slate-500">
                              {transaction.sender?.name || 'Unknown sender'} →{' '}
                              {transaction.receiver?.name || 'Unknown receiver'}
                            </p>
                          ) : (
                            <p className="text-xs text-rose-600">
                              Linked transaction is missing.
                            </p>
                          )}
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {(alert.reasons || []).slice(0, 4).map((reason, index) => (
                            <span
                              key={`${reason.code}-${index}`}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                              title={reason.message}
                            >
                              {reasonLabel(reason.code)} · +{reason.weight}
                            </span>
                          ))}
                          {(alert.reasons || []).length > 4 ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              +{alert.reasons.length - 4} more
                            </span>
                          ) : null}
                        </div>

                        {alert.resolutionNote ? (
                          <p className="mt-2 text-xs text-emerald-700">
                            {alert.resolutionNote}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          as={Link}
                          to={`/admin/investigations/${transactionRef}`}
                          variant="secondary"
                          size="sm"
                          iconRight={ArrowRight}
                        >
                          Investigate
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              pagination={data.pagination}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
        )}
      </Card>
    </div>
  );
}
