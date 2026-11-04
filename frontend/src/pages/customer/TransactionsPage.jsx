import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Send, SlidersHorizontal } from 'lucide-react';
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

export default function TransactionsPage() {
  useDocumentTitle('Transactions');

  const { event } = useRealtime();
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterError, setFilterError] = useState('');
  const [page, setPage] = useState(1);

  const loadTransactions = useCallback(async () => {
    const params = { page, limit: 10 };

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

    const response = await api.get('/transactions', { params });
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
        eyebrow="Customer workspace"
        title="Transaction history"
        description="Every incoming and outgoing payment, including its fraud risk level and current settlement status."
        actions={
          <Button as={Link} to="/transfer" icon={Send}>
            Send money
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Filter transactions"
          description="Narrow the list by status, risk band, date or amount."
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
          title="Your transactions"
          description={
            total === undefined
              ? 'Loading payment records…'
              : `${formatNumber(total)} matching transaction${total === 1 ? '' : 's'}.`
          }
        />

        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <TableSkeleton rows={7} columns={6} />
        ) : (
          <>
            <TransactionTable
              transactions={data?.items || []}
              emptyTitle={
                hasActiveFilters ? 'No matching transactions' : 'No transactions yet'
              }
              emptyDescription={
                hasActiveFilters
                  ? 'Try widening the filters or resetting them.'
                  : 'Your first transfer will appear here with its risk score.'
              }
              emptyAction={
                hasActiveFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : (
                  <Button as={Link} to="/transfer" size="sm" icon={Send}>
                    Send money
                  </Button>
                )
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
