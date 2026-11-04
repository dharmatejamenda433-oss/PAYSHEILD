import { useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  KeyRound,
  Landmark,
  LogOut,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import api, { apiData } from '../services/api';
import {
  formatDate,
  formatDateTime,
  formatInr,
  getInitials,
} from '../utils/format';

export default function ProfilePage() {
  useDocumentTitle('Profile');

  const { isCustomer, isAdmin, logout } = useAuth();
  const { event } = useRealtime();
  const toast = useToast();
  const navigate = useNavigate();

  const loadProfile = useCallback(async () => {
    const [profileResponse, ledgerResponse] = await Promise.all([
      api.get('/auth/profile'),
      isCustomer
        ? api.get('/accounts/me/ledger', { params: { limit: 10 } })
        : Promise.resolve(null),
    ]);

    return {
      user: apiData(profileResponse).user,
      account: apiData(profileResponse).account,
      ledger: ledgerResponse ? apiData(ledgerResponse).items : [],
    };
  }, [isCustomer]);

  const { data, loading, error, reload } = useAsyncData(loadProfile, [
    isCustomer,
  ]);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  function handleLogout() {
    logout();
    toast.info('Signed out', 'Your PayShield session has ended.');
    navigate('/login', { replace: true });
  }

  if (error && !data) {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={reload} />
      </Card>
    );
  }

  const user = data?.user;
  const account = data?.account;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile & security"
        description="Your PayShield identity, wallet details and ledger history."
        actions={
          isAdmin ? (
            <Button as={Link} to="/admin" variant="secondary">
              Admin console
            </Button>
          ) : (
            <Button as={Link} to="/transfer">
              Send money
            </Button>
          )
        }
      />

      {loading && !data ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardBody>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-navy-800 to-navy-950 text-2xl font-semibold text-white">
                    {getInitials(user?.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900">
                        {user?.name}
                      </h2>
                      <Badge tone={isAdmin ? 'navy' : 'info'} dot>
                        {user?.role}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Joined {formatDate(user?.createdAt)}
                      </span>
                      {user?.lastLoginAt ? (
                        <span className="flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" />
                          Last login {formatDateTime(user.lastLoginAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Account type
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {isAdmin ? 'Administrator' : 'Customer'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Authentication
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      JWT + bcrypt
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Environment
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      Simulation
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {isCustomer ? (
              <Card className="overflow-hidden">
                <CardHeader
                  title="Ledger history"
                  description="The double-entry records behind your wallet balance."
                  action={
                    <Badge tone="neutral">{data?.ledger?.length || 0} recent</Badge>
                  }
                />
                {data?.ledger?.length ? (
                  <ul className="divide-y divide-slate-100">
                    {data.ledger.map((entry) => {
                      const isCredit = entry.entryType === 'CREDIT';

                      return (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
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
                            <p className="text-sm font-medium text-slate-800">
                              {isCredit ? 'Credit' : 'Debit'} ·{' '}
                              {entry.transaction?.transactionId || 'transfer'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDateTime(entry.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-semibold tabular-nums ${
                                isCredit ? 'text-emerald-600' : 'text-slate-900'
                              }`}
                            >
                              {isCredit ? '+' : '−'}
                              {formatInr(entry.amount)}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Balance {formatInr(entry.balanceAfter)}
                            </p>
                          </div>
                          {entry.transaction?.transactionId ? (
                            <Link
                              to={`/transactions/${entry.transaction.transactionId}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              Open
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Landmark}
                    title="No ledger entries yet"
                    description="Completed transfers create one debit and one credit entry."
                    className="py-9"
                  />
                )}
              </Card>
            ) : (
              <Card>
                <CardHeader title="Administrator access" />
                <CardBody className="space-y-3 text-sm leading-relaxed text-slate-600">
                  <p>
                    This account can review payments, inspect fraud alerts and
                    approve or reject transfers that are waiting for a manual
                    decision.
                  </p>
                  <Button as={Link} to="/admin/alerts" variant="subtle" size="sm">
                    Open fraud alerts
                  </Button>
                </CardBody>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {isCustomer ? (
              <Card>
                <CardHeader title="Wallet" description="Simulated INR balance." />
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Wallet className="h-3.5 w-3.5" />
                        Available
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                        {formatInr(account?.balance)}
                      </p>
                    </div>
                    <Badge tone="success" dot>
                      {account?.status}
                    </Badge>
                  </div>

                  <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Currency</dt>
                      <dd className="font-medium text-slate-800">
                        {account?.currency}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Wallet ID</dt>
                      <dd className="font-mono text-xs font-medium text-slate-800">
                        {account?.id
                          ? `•••• ${account.id.slice(-8).toUpperCase()}`
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Created</dt>
                      <dd className="text-xs font-medium text-slate-800">
                        {formatDate(account?.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Security" description="How this demo protects access." />
              <CardBody>
                <ul className="space-y-3 text-xs leading-relaxed text-slate-600">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    Passwords are hashed with bcrypt and never returned by the
                    API.
                  </li>
                  <li className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    JWTs authorise requests, and the server reloads your role
                    from the database for every protected route.
                  </li>
                  <li className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Admin APIs are protected by role middleware — hiding UI is
                    never the only check.
                  </li>
                </ul>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <Button
                    variant="outlineDanger"
                    size="sm"
                    icon={LogOut}
                    onClick={handleLogout}
                  >
                    Sign out of PayShield
                  </Button>
                </div>
              </CardBody>
            </Card>

            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] leading-relaxed text-slate-500">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              This is a portfolio simulation. No real identity documents, bank
              accounts or payment credentials are involved.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
