import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Landmark,
  ReceiptText,
  Send,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import { CardsSkeleton, TableSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import TransactionTable from '../../components/transactions/TransactionTable';
import RiskScoreBar from '../../components/transactions/RiskScoreBar';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData } from '../../services/api';
import {
  formatDateTime,
  formatInr,
  formatNumber,
} from '../../utils/format';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');

  const { user } = useAuth();
  const { event } = useRealtime();

  const loadDashboard = useCallback(async () => {
    const [
      accountResponse,
      allResponse,
      completedResponse,
      pendingResponse,
      recentResponse,
      ledgerResponse,
    ] = await Promise.all([
      api.get('/accounts/me'),
      api.get('/transactions', { params: { limit: 1 } }),
      api.get('/transactions', {
        params: { limit: 1, status: 'COMPLETED' },
      }),
      api.get('/transactions', {
        params: { limit: 1, status: 'PENDING_REVIEW' },
      }),
      api.get('/transactions', { params: { limit: 5 } }),
      api.get('/accounts/me/ledger', { params: { limit: 4 } }),
    ]);

    const accountData = apiData(accountResponse);

    return {
      account: accountData.account,
      totalTransactions: apiData(allResponse).pagination.total,
      completedTransactions: apiData(completedResponse).pagination.total,
      pendingTransactions: apiData(pendingResponse).pagination.total,
      recentTransactions: apiData(recentResponse).items,
      recentLedger: apiData(ledgerResponse).items,
    };
  }, []);

  const { data, loading, error, reload } = useAsyncData(loadDashboard);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const latestTransaction = data?.recentTransactions?.[0];
  const account = data?.account;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer workspace"
        title={`${greeting()}, ${firstName}`}
        description="Monitor your simulated wallet, send payments and see how each transfer is scored before it settles."
        actions={
          <>
            <Button as={Link} to="/transactions" variant="secondary" icon={ReceiptText}>
              View history
            </Button>
            <Button as={Link} to="/transfer" icon={Send}>
              Send money
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
          {loading && !data ? (
            <CardsSkeleton count={4} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-navy-800 p-5 text-white shadow-lifted sm:col-span-2">
                <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-20 right-20 h-40 w-40 rounded-full bg-blue-400/10 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-navy-200">
                      <Wallet className="h-3.5 w-3.5" />
                      Available balance
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                      {formatInr(account?.balance)}
                    </p>
                    <p className="mt-2 text-xs text-navy-200/80">
                      {account?.currency || 'INR'} wallet ·{' '}
                      {account?.id ? `•••• ${account.id.slice(-6).toUpperCase()}` : '—'}
                    </p>
                  </div>
                  <Badge tone="success" dot>
                    {account?.status === 'active' ? 'Active' : account?.status || '—'}
                  </Badge>
                </div>

                <div className="relative mt-6 flex flex-wrap items-center gap-2">
                  <Button
                    as={Link}
                    to="/transfer"
                    size="sm"
                    className="bg-white text-navy-900 hover:bg-slate-100 active:bg-slate-200"
                    icon={Send}
                  >
                    Send money
                  </Button>
                  <Button
                    as={Link}
                    to="/profile"
                    size="sm"
                    variant="ghost"
                    className="text-navy-100 hover:bg-white/10 hover:text-white"
                  >
                    Wallet details
                  </Button>
                </div>

                <p className="relative mt-4 flex items-center gap-1.5 text-[11px] text-navy-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Simulated funds · protected by PayShield risk scoring
                </p>
              </div>

              <StatCard
                label="Total transactions"
                value={formatNumber(data?.totalTransactions)}
                hint="Incoming and outgoing"
                icon={ReceiptText}
                tone="blue"
              />
              <StatCard
                label="Completed"
                value={formatNumber(data?.completedTransactions)}
                hint="Funds successfully settled"
                icon={CheckCircle2}
                tone="emerald"
              />
              <StatCard
                label="In review"
                value={formatNumber(data?.pendingTransactions)}
                hint="Awaiting an admin decision"
                icon={Clock3}
                tone="amber"
              />
              <StatCard
                label="Wallet status"
                value={account?.status === 'active' ? 'Active' : account?.status || '—'}
                hint="Account ready for transfers"
                icon={Landmark}
                tone="navy"
              />
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2">
              <CardHeader
                title="Recent transactions"
                description="Your latest wallet activity with live risk decisions."
                action={
                  <Link
                    to="/transactions"
                    className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    View all
                  </Link>
                }
              />

              {loading && !data ? (
                <TableSkeleton rows={4} columns={5} />
              ) : (
                <TransactionTable
                  transactions={data?.recentTransactions || []}
                  emptyAction={
                    <Button as={Link} to="/transfer" size="sm" icon={Send}>
                      Make your first transfer
                    </Button>
                  }
                />
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Latest risk assessment"
                  description="How the engine scored your most recent payment."
                />
                <CardBody>
                  {loading && !data ? (
                    <div className="space-y-3">
                      <div className="skeleton-shimmer h-3 w-24 rounded" />
                      <div className="skeleton-shimmer h-8 w-32 rounded" />
                      <div className="skeleton-shimmer h-2 w-full rounded-full" />
                    </div>
                  ) : latestTransaction ? (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <Badge
                          tone={
                            latestTransaction.riskLevel === 'HIGH'
                              ? 'danger'
                              : latestTransaction.riskLevel === 'MEDIUM'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {latestTransaction.riskLevel} risk
                        </Badge>
                        <span className="font-mono text-[11px] text-slate-400">
                          {latestTransaction.transactionId}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-600">
                        {latestTransaction.description ||
                          `${latestTransaction.direction === 'INCOMING' ? 'Received from' : 'Sent to'} ${
                            latestTransaction.direction === 'INCOMING'
                              ? latestTransaction.sender?.name
                              : latestTransaction.receiver?.name
                          }`}
                      </p>

                      <div className="mt-4">
                        <RiskScoreBar
                          score={latestTransaction.riskScore}
                          showThresholds
                        />
                      </div>

                      <Link
                        to={`/transactions/${latestTransaction.transactionId}`}
                        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Open transaction
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-500">
                      Your first transfer will show a risk score, the rules that
                      fired and whether the payment was approved automatically.
                    </p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Account activity"
                  description="Latest ledger movements in your wallet."
                />
                {loading && !data ? (
                  <div className="space-y-3 p-5">
                    <div className="skeleton-shimmer h-10 w-full rounded-xl" />
                    <div className="skeleton-shimmer h-10 w-full rounded-xl" />
                  </div>
                ) : data?.recentLedger?.length ? (
                  <ul className="divide-y divide-slate-100 px-5">
                    {data.recentLedger.map((entry) => {
                      const isCredit = entry.entryType === 'CREDIT';

                      return (
                        <li key={entry.id} className="flex items-center gap-3 py-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              isCredit
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800">
                              {isCredit ? 'Money received' : 'Money sent'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatDateTime(entry.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              isCredit ? 'text-emerald-600' : 'text-slate-800'
                            }`}
                          >
                            {isCredit ? '+' : '−'}
                            {formatInr(entry.amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Wallet}
                    title="No ledger movement"
                    description="Completed transfers create double-entry ledger records here."
                    className="py-8"
                  />
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
