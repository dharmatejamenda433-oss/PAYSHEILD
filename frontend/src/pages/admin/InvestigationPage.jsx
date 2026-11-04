import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Gavel,
  LockKeyhole,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
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
import api, { apiData, getApiError } from '../../services/api';
import { DECISION_META } from '../../utils/constants';
import {
  formatDateTime,
  formatInr,
  formatPercent,
  getInitials,
} from '../../utils/format';

const ACTION_COPY = {
  approve: {
    title: 'Approve this payment?',
    description:
      'Approval atomically debits the sender, credits the receiver and writes both ledger entries.',
    confirmLabel: 'Approve & settle',
    variant: 'success',
    endpoint: 'approve',
  },
  reject: {
    title: 'Reject this payment?',
    description:
      'Rejection declines the transfer. No balance changes or ledger entries are created.',
    confirmLabel: 'Reject payment',
    variant: 'danger',
    endpoint: 'reject',
  },
};

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-sm text-slate-800 ${
          mono ? 'font-mono text-xs font-semibold' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function InvestigationPage() {
  const { id } = useParams();
  const { event } = useRealtime();
  const toast = useToast();

  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);

  const loadInvestigation = useCallback(async () => {
    const response = await api.get(
      `/transactions/${encodeURIComponent(id)}/risk`
    );
    return apiData(response);
  }, [id]);

  const { data, loading, error, reload } = useAsyncData(loadInvestigation, [id]);

  useEffect(() => {
    if (event) reload();
  }, [event, reload]);

  useDocumentTitle(
    data?.transaction?.transactionId
      ? `Investigate ${data.transaction.transactionId}`
      : 'Investigation'
  );

  const transaction = data?.transaction;
  const risk = data?.risk;
  const alert = data?.alert;
  const review = data?.review;

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(transaction.transactionId);
      toast.success('Reference copied', 'The payment reference is on your clipboard.');
    } catch {
      toast.error('Could not copy', 'Please copy the reference manually.');
    }
  }

  function openAction(action) {
    setReasonTouched(true);

    if (reason.trim().length < 3) {
      return;
    }

    setActionError('');
    setPendingAction(action);
  }

  async function confirmAction() {
    if (!pendingAction) return;

    const copy = ACTION_COPY[pendingAction];
    setSubmitting(true);
    setActionError('');

    try {
      await api.post(
        `/admin/reviews/${encodeURIComponent(transaction.transactionId)}/${copy.endpoint}`,
        { reason: reason.trim() }
      );

      toast.success(
        pendingAction === 'approve' ? 'Payment approved' : 'Payment rejected',
        pendingAction === 'approve'
          ? 'The transfer settled atomically and both ledger entries were written.'
          : 'The transfer was declined. No money moved.'
      );

      setPendingAction(null);
      setReason('');
      setReasonTouched(false);
      reload();
    } catch (caught) {
      const apiError = getApiError(caught);
      setActionError(apiError.message);
      toast.error('Review could not be recorded', apiError.message);

      if (apiError.code === 'REVIEW_ALREADY_PROCESSED') {
        setPendingAction(null);
        reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <Button
          as={Link}
          to="/admin/alerts"
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
        >
          Back to fraud alerts
        </Button>
        <Card>
          <ErrorState
            title={
              error.code === 'NOT_FOUND'
                ? 'Transaction not found'
                : 'Could not load investigation'
            }
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
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const isPending = transaction.status === 'PENDING_REVIEW';
  const decisionMeta = DECISION_META[transaction.decision] || {
    label: transaction.decision || 'Scored',
    tone: 'neutral',
  };
  const reasonTooShort = reason.trim().length < 3;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button as={Link} to="/admin/alerts" variant="ghost" size="sm" icon={ArrowLeft}>
          Fraud alerts
        </Button>
        <span className="text-xs text-slate-300">/</span>
        <Link
          to="/admin/transactions"
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          All transactions
        </Link>
      </div>

      <PageHeader
        eyebrow="Fraud investigation"
        title={transaction.transactionId}
        description={
          transaction.description ||
          'Inspect the rule findings, model score and settlement state before making a decision.'
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={Copy}
            onClick={copyReference}
          >
            Copy reference
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={transaction.status} />
        <RiskBadge level={transaction.riskLevel} score={transaction.riskScore} />
        <Badge tone={decisionMeta.tone}>{decisionMeta.label}</Badge>
        {alert ? (
          <Badge tone={alert.status === 'OPEN' ? 'warning' : 'success'} dot>
            Alert {alert.status.toLowerCase()}
          </Badge>
        ) : null}
        <span className="text-xs text-slate-400">
          Created {formatDateTime(transaction.createdAt)}
        </span>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Payment under investigation"
              description="The transaction snapshot captured when risk scoring ran."
            />
            <CardBody>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Amount
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                    {formatInr(transaction.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {transaction.currency} · reference {transaction.transactionId}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Direction
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {transaction.sender?.name || 'Unknown'}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-400 sm:justify-end">
                    to <ArrowRight className="h-3 w-3" />{' '}
                    {transaction.receiver?.name || 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-700">
                    {getInitials(transaction.sender?.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Sender
                    </p>
                    <p className="truncate text-sm font-medium text-slate-900">
                      {transaction.sender?.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {transaction.sender?.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50 text-sm font-semibold text-navy-700">
                    {getInitials(transaction.receiver?.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Receiver
                    </p>
                    <p className="truncate text-sm font-medium text-slate-900">
                      {transaction.receiver?.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {transaction.receiver?.email}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <DetailRow label="Created" value={formatDateTime(transaction.createdAt)} />
                <DetailRow
                  label="Client location signal"
                  value={transaction.clientLocation || 'Not provided'}
                />
                <DetailRow label="Payment note" value={transaction.description || '—'} />
                <DetailRow
                  label="ML model"
                  value={
                    risk.mlAvailable
                      ? risk.mlModel || 'Trained model'
                      : 'Unavailable — rule fallback'
                  }
                />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Risk analysis"
              description="Rules and model output that produced this decision."
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
                  <p className="mt-1 text-[11px] text-slate-400">
                    {risk.mlAvailable
                      ? `Thresholds: review ≥ ${risk.thresholds?.medium}, high ≥ ${risk.thresholds?.high}`
                      : 'Deterministic rule fallback was used'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Triggered rules
                </h3>
                <RiskReasons reasons={risk.reasons} />
              </div>
            </CardBody>
          </Card>

          {alert ? (
            <Card>
              <CardHeader
                title="Fraud alert"
                description="The alert record linked to this payment."
                action={
                  <Badge tone={alert.status === 'OPEN' ? 'warning' : 'success'} dot>
                    {alert.status}
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(alert.reasons || []).map((item, index) => (
                    <span
                      key={`${item.code}-${index}`}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {item.code} · +{item.weight}
                    </span>
                  ))}
                </div>
                {alert.resolutionNote ? (
                  <p className="text-sm text-emerald-700">{alert.resolutionNote}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    This alert is still open. Approving or rejecting the payment
                    resolves it automatically.
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Opened {formatDateTime(alert.createdAt)}
                  {alert.resolvedAt
                    ? ` · Resolved ${formatDateTime(alert.resolvedAt)}`
                    : ''}
                </p>
              </CardBody>
            </Card>
          ) : null}

          {review ? (
            <Card>
              <CardHeader
                title="Recorded review"
                description="The final human decision for this payment."
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
                  {review.admin?.name || 'PayShield admin'} ·{' '}
                  {review.admin?.email || ''}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {isPending ? (
            <Card className="border-amber-200">
              <CardHeader
                title="Admin decision"
                description="No money moves until you record a decision."
                action={<Badge tone="warning">Action required</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <Clock3 className="h-3.5 w-3.5" />
                    Awaiting manual review
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-700">
                    This payment scored in the review band. Verify the sender,
                    receiver and rule findings before deciding.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="review-reason"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Review note
                  </label>
                  <textarea
                    id="review-reason"
                    rows={4}
                    maxLength={500}
                    className={`field resize-none ${
                      reasonTouched && reasonTooShort
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
                        : ''
                    }`}
                    placeholder="Explain why you are approving or rejecting this payment…"
                    value={reason}
                    onChange={(changeEvent) => {
                      setReason(changeEvent.target.value);
                      setActionError('');
                    }}
                    onBlur={() => setReasonTouched(true)}
                  />
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className="text-rose-600">
                      {reasonTouched && reasonTooShort
                        ? 'Add at least 3 characters so the decision is auditable.'
                        : ''}
                    </span>
                    <span className="text-slate-400">{reason.length}/500</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="success"
                    icon={ShieldCheck}
                    onClick={() => openAction('approve')}
                    disabled={reasonTooShort || submitting}
                  >
                    Approve & settle payment
                  </Button>
                  <Button
                    variant="outlineDanger"
                    icon={XCircle}
                    onClick={() => openAction('reject')}
                    disabled={reasonTooShort || submitting}
                  >
                    Reject payment
                  </Button>
                  {reasonTooShort ? (
                    <p className="text-center text-[11px] text-slate-400">
                      A review note is required before a decision can be recorded.
                    </p>
                  ) : null}
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Approval and rejection run inside a MongoDB transaction. A
                  payment cannot be reviewed twice.
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Decision status" />
              <CardBody>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      transaction.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-600'
                        : transaction.status === 'DECLINED'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {transaction.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : transaction.status === 'DECLINED' ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <Gavel className="h-5 w-5" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {transaction.status.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {transaction.status === 'COMPLETED'
                        ? 'This transfer has settled. The sender was debited and the receiver credited.'
                        : transaction.status === 'DECLINED'
                          ? 'This transfer was declined. No money moved and the alert was resolved.'
                          : 'This payment is no longer in the review queue.'}
                    </p>
                    {transaction.reviewedBy ? (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Reviewed by {transaction.reviewedBy.name} ·{' '}
                        {formatDateTime(transaction.reviewedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Button
                    as={Link}
                    to="/admin/alerts"
                    variant="secondary"
                    size="sm"
                    iconRight={ArrowRight}
                  >
                    Back to alert queue
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Investigation checklist" />
            <CardBody>
              <ul className="space-y-3 text-xs leading-relaxed text-slate-600">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  Compare the amount with the sender&apos;s usual transfer size.
                </li>
                <li className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  Check the velocity reasons for bursts or repeated failures.
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  Confirm the device and location signals look plausible.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  High-risk transfers should normally be rejected unless you can
                  verify the customer.
                </li>
              </ul>
            </CardBody>
          </Card>

          {transaction.clientLocation ? (
            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] leading-relaxed text-slate-500">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              Client location signal: {transaction.clientLocation}. This value
              comes from the browser time zone at payment time.
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(pendingAction)}
        onClose={submitting ? undefined : () => setPendingAction(null)}
        title={pendingAction ? ACTION_COPY[pendingAction].title : ''}
        description={
          pendingAction ? ACTION_COPY[pendingAction].description : ''
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPendingAction(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction ? ACTION_COPY[pendingAction].variant : 'primary'}
              onClick={confirmAction}
              loading={submitting}
            >
              {submitting ? 'Recording decision…' : ACTION_COPY[pendingAction]?.confirmLabel}
            </Button>
          </>
        }
      >
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-sm text-slate-500">Reference</dt>
            <dd className="font-mono text-xs font-semibold text-slate-800">
              {transaction.transactionId}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-sm text-slate-500">Amount</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {formatInr(transaction.amount)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-sm text-slate-500">Route</dt>
            <dd className="text-right text-sm text-slate-700">
              {transaction.sender?.name} → {transaction.receiver?.name}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Review note</dt>
            <dd className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {reason}
            </dd>
          </div>
        </dl>

        {pendingAction === 'approve' ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Approval will move money immediately and update the fraud alert to
            resolved.
          </p>
        ) : (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Rejection is final for this transaction. No money will move.
          </p>
        )}
      </Modal>
    </div>
  );
}
