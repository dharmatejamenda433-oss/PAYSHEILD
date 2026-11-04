import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card, { CardHeader } from '../../components/ui/Card';
import Pagination from '../../components/ui/Pagination';
import ErrorState from '../../components/ui/ErrorState';
import { TableSkeleton } from '../../components/ui/Skeleton';
import TransactionTable from '../../components/transactions/TransactionTable';
import { useRealtime } from '../../context/RealtimeContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData } from '../../services/api';
import { RISK_OPTIONS, STATUS_OPTIONS } from '../../utils/constants';
import { formatNumber, toPaise } from '../../utils/format';

const EMPTY_FILTERS = {
  status: '',
  riskLevel: '',
  from: '',
  to: '',
  minAmount: '',
  maxAmount: '',
};

export default function AdminTransactionsPage() {
  useDocumentTitle('All transactions');

  const { event } = useRealtime();
  const [searchParams] = useSearchParams();

  const initialStatus = searchParams.get('status') || '';
  const initialRisk = searchParams.get('riskLevel') || '';

  const [draftFilters, setDraftFilters] = useState({
    ...EMPTY_FILTERS,
    status: STATUS_OPTIONS.some((option) => option.value === initialStatus)
      ? initialStatus
      : '',
    riskLevel: RISK_OPTIONS.some((option) => option.value === initialRisk)
      ? initialRisk
      : '',
  });
  const [filters, setFilters] = useState(draftFilters);
  const [filterError, setFilterError] = useState('');
  const [page, setPage] = useState(1);

  const loadTransactions = useCallback(async () => {
    const params = { page, limit: 12 };

    if (filters.status) params.status = filters.status;
    if (filters.riskLevel) params.riskLevel = filters.riskLevel;
    if (filters.minAmount) params.minAmount = toPaise(filters.minAmount);
    if (filters.maxAmount) params.maxAmount = toPaise(filters.maxAmount);
    if (filters.from) {
      params.from = new Date(`${filters.from}T00:00:00`).toISOString();
    }
    if (filters.to) {
      params.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
    }

    const response = await api.get('/admin/transactions', { params });
    return apiData(response);
  }, [page, filters]);

  const { data, loading, error, reload } = useAsyncData(loadTransactions, [
    page,
    filters,
  ]);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  function updateDraft(field, value) {
    setDraftFilters((current) => ({ ...current, [field]: value }));
    setFilterError('');
  }

  function applyFilters(submitEvent) {
    submitEvent?.preventDefault();

    if (
      draftFilters.minAmount &&
      draftFilters.maxAmount &&
      Number(draftFilters.minAmount) > Number(draftFilters.maxAmount)
    ) {
      setFilterError('Minimum amount cannot be greater than maximum amount.');
      return;
    }

    if (
      draftFilters.from &&
      draftFilters.to &&
      draftFilters.from > draftFilters.to
    ) {
      setFilterError('The start date must be before the end date.');
      return;
    }

    setFilterError('');
    setPage(1);
    setFilters({ ...draftFilters });
  }

  function resetFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setFilterError('');
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const total = data?.pagination?.total;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fraud control centre"
        title="All transactions"
        description="Every payment across the platform. Open a row to inspect its rule findings, ML score and review history."
      />

      <Card>
        <CardHeader
          title="Filter payments"
          description="Use the same filters available to the fraud investigation queue."
        />
        <form onSubmit={applyFilters} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={draftFilters.status}
              onChange={(changeEvent) =>
                updateDraft('status', changeEvent.target.value)
              }
            />
            <Select
              label="Risk level"
              options={RISK_OPTIONS}
              value={draftFilters.riskLevel}
              onChange={(changeEvent) =>
                updateDraft('riskLevel', changeEvent.target.value)
              }
            />
            <Input
              label="From date"
              type="date"
              value={draftFilters.from}
              max={draftFilters.to || undefined}
              onChange={(changeEvent) => updateDraft('from', changeEvent.target.value)}
            />
            <Input
              label="To date"
              type="date"
              value={draftFilters.to}
              min={draftFilters.from || undefined}
              onChange={(changeEvent) => updateDraft('to', changeEvent.target.value)}
            />
            <Input
              label="Min amount"
              type="number"
              min="0"
              step="0.01"
              prefix="₹"
              placeholder="0.00"
              value={draftFilters.minAmount}
              onChange={(changeEvent) =>
                updateDraft('minAmount', changeEvent.target.value)
              }
            />
            <Input
              label="Max amount"
              type="number"
              min="0"
              step="0.01"
              prefix="₹"
              placeholder="Any"
              value={draftFilters.maxAmount}
              onChange={(changeEvent) =>
                updateDraft('maxAmount', changeEvent.target.value)
              }
            />
          </div>

          {filterError ? (
            <p className="text-xs font-medium text-rose-600">{filterError}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" icon={SlidersHorizontal}>
              Apply filters
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={resetFilters}
            >
              Reset
            </Button>
            {hasActiveFilters ? (
              <span className="ml-auto text-xs text-slate-500">
                Filters are active
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Payment ledger"
          description={
            total === undefined
              ? 'Loading transactions…'
              : `${formatNumber(total)} matching transaction${total === 1 ? '' : 's'}.`
          }
        />

        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <>
            <TransactionTable
              transactions={data?.items || []}
              variant="admin"
              emptyTitle={
                hasActiveFilters ? 'No matching payments' : 'No payments yet'
              }
              emptyDescription={
                hasActiveFilters
                  ? 'Try widening the filters or resetting them.'
                  : 'Customer transfers will appear here as soon as they are created.'
              }
              emptyAction={
                hasActiveFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : null
              }
            />
            <Pagination
              pagination={data?.pagination}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
        )}
      </Card>
    </div>
  );
}
