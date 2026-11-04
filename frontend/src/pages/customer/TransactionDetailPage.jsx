import { useCallback, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  Gavel,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/transactions/StatusBadge';
import RiskBadge from '../../components/transactions/RiskBadge';
import RiskScoreBar from '../../components/transactions/RiskScoreBar';
import RiskReasons from '../../components/transactions/RiskReasons';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData } from '../../services/api';
import { DECISION_META } from '../../utils/constants';
import {
  formatDateTime,
  formatInr,
  formatPercent,
  getInitials,
} from '../../utils/format';

const STATUS_EXPLANATIONS = {
  COMPLETED:
    'This transfer settled successfully. The ledger contains exactly one debit and one credit entry.',
  PENDING_REVIEW:
    'This payment is waiting for an administrator. No money has moved and balances are unchanged.',
  APPROVED:
    'An administrator approved the payment and the settlement is being finalised.',
  DECLINED:
    'The risk policy declined this payment. No money moved and no ledger entries were created.',
  FAILED:
    'The transfer failed before settlement. Balances and ledger records were left unchanged.',
};

const STATUS_ICONS = {
  COMPLETED: CheckCircle2,
  PENDING_REVIEW: Clock3,
  APPROVED: ShieldCheck,
  DECLINED: ShieldAlert,
  FAILED: AlertCircle,
};

const STATUS_STYLES = {
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  PENDING_REVIEW: 'bg-amber-50 text-amber-600',
  APPROVED: 'bg-blue-50 text-blue-600',
  DECLINED: 'bg-rose-50 text-rose-600',
  FAILED: 'bg-slate-100 text-slate-500',
};

function PartyRow({ title, party, directionIcon }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-700">
        {getInitials(party?.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p className="truncate text-sm font-medium text-slate-900">
          {party?.name || 'PayShield customer'}
        </p>
        <p className="truncate text-xs text-slate-500">{party?.email}</p>
      </div>
      {directionIcon}
    </div>
  );
}

export default function TransactionDetailPage() {
  const { id } = useParams();
  const { event } = useRealtime();
  const toast = useToast();

  const loadTransaction = useCallback(async () => {
    const response = await api.get(
      `/transactions/${encodeURIComponent(id)}/risk`
    );
    return apiData(response);
  }, [id]);

  const { data, loading, error, reload } = useAsyncData(loadTransaction, [id]);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  useDocumentTitle(
    data?.transaction?.transactionId
      ? `Transaction ${data.transaction.transactionId}`
      : 'Transaction'
  );

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(data.transaction.transactionId);
      toast.success('Reference copied', 'The transaction reference is on your clipboard.');
    } catch {
      toast.error('Could not copy', 'Please copy the reference manually.');
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <Button as={Link} to="/transactions" variant="ghost" size="sm" icon={ArrowLeft}>
          Back to transactions
        </Button>
        <Card>
          <ErrorState
            title={error.code === 'NOT_FOUND' ? 'Transaction not found' : 'Could not load transaction'}
            message={error.message}
            onRetry={reload}
          />
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { transaction, risk, review } = data;
  const incoming = transaction.direction === 'INCOMING';
  const StatusIcon = STATUS_ICONS[transaction.status] || AlertCircle;
  const decisionMeta = DECISION_META[transaction.decision] || {
    label: transaction.decision || 'Scored',
    tone: 'neutral',
  };

  return (
    <div className="space-y-6">
      <div>
        <Button as={Link} to="/transactions" variant="ghost" size="sm" icon={ArrowLeft}>
          Back to transactions
        </Button>
      </div>

      <PageHeader
        eyebrow={incoming ? 'Payment received' : 'Payment sent'}
        title={transaction.transactionId}
        description={transaction.description || 'Wallet transfer between PayShield customers.'}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Copy} onClick={copyReference}>
              Copy reference
            </Button>
            <Button as={Link} to="/transfer" size="sm" icon={Send}>
              Send money
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={transaction.status} />
        <RiskBadge level={transaction.riskLevel} score={transaction.riskScore} />
        <Badge tone={decisionMeta.tone}>{decisionMeta.label}</Badge>
        <span className="text-xs text-slate-400">
          Created {formatDateTime(transaction.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Payment summary"
              description="Amounts are displayed in rupees but stored as integer paise."
            />
            <CardBody>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Amount
                  </p>
                  <p
                    className={`mt-1 text-3xl font-semibold tracking-tight ${
                      incoming ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {incoming ? '+' : '−'}
                    {formatInr(transaction.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {transaction.currency} · no transfer fee
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Route
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {transaction.sender?.name || 'Unknown'} →{' '}
                    {transaction.receiver?.name || 'Unknown'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {incoming ? 'Into your wallet' : 'From your wallet'}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <PartyRow
                  title="Sender"
                  party={transaction.sender}
                  directionIcon={
                    incoming ? (
                      <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                    ) : null
                  }
                />
                <PartyRow
                  title="Receiver"
                  party={transaction.receiver}
                  directionIcon={
                    !incoming ? (
                      <ArrowUpRight className="h-4 w-4 text-blue-500" />
                    ) : null
                  }
                />
              </div>

              <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Transaction reference
                  </dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-slate-800">
                    {transaction.transactionId}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Client location signal
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {transaction.clientLocation || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Created
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {formatDateTime(transaction.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Last updated
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {formatDateTime(transaction.updatedAt)}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Risk explanation"
              description="The rule engine and model outputs behind this decision."
            />
            <CardBody className="space-y-5">
              <RiskScoreBar
                score={risk.riskScore}
                mediumThreshold={risk.thresholds?.medium}
                highThreshold={risk.thresholds?.high}
                showThresholds
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium text-slate-500">Rule score</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {risk.ruleScore}
                    <span className="text-sm font-normal text-slate-400"> / 100</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {(risk.reasons || []).length} rule
                    {(risk.reasons || []).length === 1 ? '' : 's'} triggered
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    ML fraud probability
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {risk.mlAvailable && risk.mlProbability !== null
                      ? formatPercent(risk.mlProbability * 100, 1)
                      : 'Unavailable'}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-slate-400">
                    {risk.mlAvailable
                      ? risk.mlModel || 'Trained model'
                      : 'Rule-only fallback was used'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Triggered reasons
                </h3>
                <RiskReasons reasons={risk.reasons} />
              </div>
            </CardBody>
          </Card>

          {review ? (
            <Card>
              <CardHeader
                title="Admin review decision"
                description="A human decision was recorded for this payment."
              />
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={review.decision === 'APPROVED' ? 'success' : 'danger'}
                    dot
                  >
                    {review.decision}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(review.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {review.reason}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <UserRound className="h-3.5 w-3.5" />
                  Reviewed by {review.admin?.name || 'PayShield admin'}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    STATUS_STYLES[transaction.status] || STATUS_STYLES.FAILED
                  }`}
                >
                  <StatusIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {transaction.status.replaceAll('_', ' ')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {STATUS_EXPLANATIONS[transaction.status]}
                  </p>
                </div>
              </div>

              <ol className="mt-6 space-y-4 border-t border-slate-100 pt-5">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Send className="h-3 w-3" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-800">
                      Payment created
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(transaction.createdAt)}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-800">
                      Risk scored · {transaction.riskLevel}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Rule score {risk.ruleScore}/100 · final {risk.riskScore}/100
                    </p>
                  </div>
                </li>
                {transaction.completedAt ? (
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        Funds settled
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(transaction.completedAt)}
                      </p>
                    </div>
                  </li>
                ) : null}
                {transaction.declinedAt ? (
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <ShieldAlert className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        Payment declined
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(transaction.declinedAt)}
                      </p>
                    </div>
                  </li>
                ) : null}
                {transaction.status === 'PENDING_REVIEW' ? (
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <Clock3 className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        Waiting for admin review
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Money has not moved yet
                      </p>
                    </div>
                  </li>
                ) : null}
                {transaction.reviewedAt ? (
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Gavel className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        Reviewed by {transaction.reviewedBy?.name || 'admin'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(transaction.reviewedAt)}
                      </p>
                    </div>
                  </li>
                ) : null}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What happens next" />
            <CardBody className="text-xs leading-relaxed text-slate-500">
              {transaction.status === 'PENDING_REVIEW'
                ? 'An administrator can approve or reject this payment in the admin console. Approval settles the transfer atomically; rejection leaves balances untouched.'
                : transaction.status === 'COMPLETED'
                  ? 'No further action is needed. The debit and credit ledger entries can be verified from your profile page.'
                  : 'No money moved for this transaction. You can start a new transfer whenever you are ready.'}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
