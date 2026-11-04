import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Info,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton from '../../components/ui/Skeleton';
import RiskScoreBar from '../../components/transactions/RiskScoreBar';
import RiskReasons from '../../components/transactions/RiskReasons';
import StatusBadge from '../../components/transactions/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import api, { apiData, getApiError } from '../../services/api';
import { getClientLocation, getDeviceId } from '../../utils/device';
import { formatDateTime, formatInr, toPaise } from '../../utils/format';

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

function newIdempotencyKey() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ResultPanel({ result, onReset }) {
  const transaction = result.transaction;
  const status = transaction.status;
  const isCompleted = status === 'COMPLETED';
  const isPending = status === 'PENDING_REVIEW';

  const config = isCompleted
    ? {
        icon: CheckCircle2,
        wrapper: 'border-emerald-200 bg-emerald-50/70',
        iconClasses: 'bg-emerald-100 text-emerald-700',
        title: 'Transfer completed',
        description: 'The money has moved and both ledger entries were created.',
      }
    : isPending
      ? {
          icon: Clock3,
          wrapper: 'border-amber-200 bg-amber-50/70',
          iconClasses: 'bg-amber-100 text-amber-700',
          title: 'Payment is under review',
          description:
            'The risk engine asked for a human decision. No money moves until an admin approves this transfer.',
        }
      : status === 'DECLINED'
        ? {
            icon: ShieldAlert,
            wrapper: 'border-rose-200 bg-rose-50/70',
            iconClasses: 'bg-rose-100 text-rose-700',
            title: 'Payment declined',
            description:
              'The risk score crossed the automatic decline policy. No money left your wallet.',
          }
        : {
            icon: XCircle,
            wrapper: 'border-rose-200 bg-rose-50/70',
            iconClasses: 'bg-rose-100 text-rose-700',
            title: 'Transfer failed',
            description:
              'The payment could not be completed. No money left your wallet.',
          };

  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <Card className={`overflow-hidden border ${config.wrapper}`}>
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.iconClasses}`}
            >
              <Icon className="h-7 w-7" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  {config.title}
                </h2>
                <StatusBadge status={status} />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {config.description}
              </p>

              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {formatInr(transaction.amount)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                to {transaction.receiver?.name || 'recipient'} ·{' '}
                {transaction.receiver?.email}
              </p>

              {result.replay ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <RefreshCw className="h-3.5 w-3.5" />
                  This is the original result for a repeated request.
                </p>
              ) : null}

              <dl className="mt-6 grid gap-4 border-t border-slate-900/5 pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Transaction reference
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-slate-800">
                    {transaction.transactionId}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {formatDateTime(transaction.createdAt)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Risk decision
                  </dt>
                  <dd className="mt-2">
                    <RiskScoreBar score={transaction.riskScore} />
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  as={Link}
                  to={`/transactions/${transaction.transactionId}`}
                  variant="secondary"
                  size="sm"
                  iconRight={ArrowRight}
                >
                  View transaction
                </Button>
                <Button variant="ghost" size="sm" icon={Send} onClick={onReset}>
                  Make another transfer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Why this decision was made"
            description="Human-readable reasons generated by the rule engine."
          />
          <CardBody>
            <RiskReasons reasons={transaction.riskReasons} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Model signals"
            description="The ML probability is blended with the rule score."
          />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  ML fraud probability
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {transaction.mlAvailable
                    ? `Model: ${transaction.mlModel || 'trained model'}`
                    : 'Trained model unavailable — rule-based fallback used'}
                </p>
              </div>
              <span className="text-lg font-semibold tabular-nums text-slate-900">
                {transaction.mlProbability === null ||
                transaction.mlProbability === undefined
                  ? '—'
                  : `${Math.round(transaction.mlProbability * 100)}%`}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Final risk score
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {transaction.riskLevel} risk band
                </p>
              </div>
              <span className="text-lg font-semibold tabular-nums text-slate-900">
                {transaction.riskScore}/100
              </span>
            </div>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Machine-learning scores are probabilistic signals, not proof of
              fraud. This platform is a simulation.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function TransferPage() {
  useDocumentTitle('Send money');

  const { refreshProfile } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    receiverEmail: '',
    amount: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  const idempotencyKey = useRef(null);

  const loadAccount = useCallback(async () => {
    const response = await api.get('/accounts/me');
    return apiData(response).account;
  }, []);

  const {
    data: account,
    loading: accountLoading,
    error: accountError,
    reload: reloadAccount,
  } = useAsyncData(loadAccount);

  const availableBalance = account?.balance ?? 0;
  const accountActive = account?.status === 'active';

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
    // Any change to the request body invalidates the previous idempotency key.
    idempotencyKey.current = null;
  }

  function validate() {
    const nextErrors = {};
    const email = form.receiverEmail.trim();
    const amountPattern = /^\d+(\.\d{1,2})?$/;

    if (!email) {
      nextErrors.receiverEmail = 'Enter the receiver email address.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.receiverEmail = 'Enter a valid email address.';
    }

    if (!form.amount.trim()) {
      nextErrors.amount = 'Enter an amount.';
    } else if (!amountPattern.test(form.amount.trim())) {
      nextErrors.amount = 'Use rupees and paise, e.g. 1250.50.';
    } else {
      const paise = toPaise(form.amount);

      if (paise <= 0) {
        nextErrors.amount = 'Amount must be greater than zero.';
      } else if (paise > availableBalance) {
        nextErrors.amount = `You only have ${formatInr(availableBalance)} available.`;
      }
    }

    if (form.description.length > 140) {
      nextErrors.description = 'Keep the note under 140 characters.';
    }

    if (!accountActive) {
      nextErrors.form = 'This wallet is not active, so transfers are blocked.';
    }

    return nextErrors;
  }

  function handleReview(event) {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current = newIdempotencyKey();
    }

    setConfirmOpen(true);
  }

  async function handleConfirm() {
    setSubmitting(true);
    setFormError('');

    const amountPaise = toPaise(form.amount);

    try {
      const response = await api.post(
        '/transactions',
        {
          receiverEmail: form.receiverEmail.trim().toLowerCase(),
          amount: amountPaise,
          description: form.description.trim(),
          idempotencyKey: idempotencyKey.current,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey.current,
            'X-Device-Id': getDeviceId(),
            'X-Client-Location': getClientLocation(),
          },
        }
      );

      const payload = apiData(response);
      idempotencyKey.current = null;
      setConfirmOpen(false);
      setResult(payload);

      if (payload.transaction.status === 'COMPLETED') {
        toast.success(
          'Transfer completed',
          `${formatInr(payload.transaction.amount)} was sent successfully.`
        );
      } else if (payload.transaction.status === 'PENDING_REVIEW') {
        toast.warning(
          'Payment under review',
          'An administrator will review this transfer before money moves.'
        );
      } else {
        toast.error(
          'Payment declined',
          'The risk policy declined this transfer. No money was moved.'
        );
      }

      await Promise.allSettled([refreshProfile(), reloadAccount()]);
    } catch (error) {
      const apiError = getApiError(error);

      setFormError(apiError.message);
      setConfirmOpen(false);

      if (
        apiError.code === 'INSUFFICIENT_FUNDS' ||
        apiError.code === 'INVALID_TRANSFER'
      ) {
        setErrors((current) => ({ ...current, amount: apiError.message }));
      }

      toast.error('Transfer not completed', apiError.message);

      // Keep the key for network failures so a retry cannot double charge.
      if (error.response) {
        idempotencyKey.current = null;
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({ receiverEmail: '', amount: '', description: '' });
    setErrors({});
    setFormError('');
    setResult(null);
    idempotencyKey.current = null;
    reloadAccount();
    refreshProfile();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer workspace"
        title="Send money"
        description="Transfers are simulated. Each request is validated, scored by rules and ML, then approved, reviewed or declined."
        actions={
          <Button as={Link} to="/transactions" variant="secondary">
            Transaction history
          </Button>
        }
      />

      {accountError ? (
        <Card>
          <ErrorState
            message={accountError.message}
            onRetry={reloadAccount}
            title="Could not load your wallet"
          />
        </Card>
      ) : result ? (
        <ResultPanel result={result} onReset={resetForm} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Transfer details"
              description="Enter the receiver and the amount in rupees."
            />
            <CardBody>
              <form onSubmit={handleReview} className="space-y-5" noValidate>
                {formError || errors.form ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {formError || errors.form}
                  </div>
                ) : null}

                <Input
                  label="Receiver email"
                  type="email"
                  name="receiverEmail"
                  autoComplete="off"
                  placeholder="ravi@example.com"
                  value={form.receiverEmail}
                  onChange={(event) =>
                    updateField('receiverEmail', event.target.value)
                  }
                  error={errors.receiverEmail}
                  hint="The receiver must already have a PayShield customer account."
                  required
                />

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <Input
                      label="Amount"
                      name="amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      prefix="₹"
                      className="flex-1"
                      value={form.amount}
                      onChange={(event) =>
                        updateField('amount', event.target.value)
                      }
                      error={errors.amount}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mb-0.5"
                      onClick={() =>
                        updateField('amount', (availableBalance / 100).toFixed(2))
                      }
                      disabled={accountLoading || !availableBalance}
                    >
                      Send max
                    </Button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {QUICK_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => updateField('amount', String(amount))}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        ₹{amount.toLocaleString('en-IN')}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-slate-500">
                      Available:{' '}
                      {accountLoading ? (
                        <Skeleton className="inline-block h-3 w-16 align-middle" />
                      ) : (
                        <span className="font-semibold text-slate-800">
                          {formatInr(availableBalance)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="transfer-description"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Note <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="transfer-description"
                    rows={3}
                    maxLength={140}
                    className="field resize-none"
                    placeholder="Dinner split, rent share, freelance invoice…"
                    value={form.description}
                    onChange={(event) =>
                      updateField('description', event.target.value)
                    }
                    aria-invalid={Boolean(errors.description)}
                  />
                  <div className="mt-1.5 flex justify-between text-xs">
                    <span className="text-rose-600">{errors.description || ''}</span>
                    <span className="text-slate-400">
                      {form.description.length}/140
                    </span>
                  </div>
                </div>

                {!accountActive && !accountLoading ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    This wallet status is “{account?.status}”. Only active wallets
                    can send money.
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Protected by idempotency and double-entry ledger checks
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    icon={Send}
                    disabled={!accountActive || accountLoading}
                  >
                    Review transfer
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <div className="space-y-6">
            <Card className="overflow-hidden bg-gradient-to-br from-navy-900 to-navy-800 text-white">
              <CardBody>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-navy-200">
                  <Wallet className="h-3.5 w-3.5" />
                  Available balance
                </p>
                {accountLoading ? (
                  <div className="mt-3 h-9 w-40 animate-pulse rounded bg-white/10" />
                ) : (
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {formatInr(availableBalance)}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="success" dot>
                    {account?.status === 'active' ? 'Active' : account?.status || '—'}
                  </Badge>
                  <span className="text-xs text-navy-300">
                    {account?.currency || 'INR'} · simulated wallet
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="How this payment is checked"
                description="The same pipeline runs for every transfer."
              />
              <CardBody>
                <ol className="space-y-4">
                  {[
                    {
                      title: 'Validation and idempotency',
                      text: 'Balance, account status and duplicate keys are checked before scoring.',
                    },
                    {
                      title: 'Velocity and device rules',
                      text: 'Redis counts recent transfers, failed attempts and whether this browser is new.',
                    },
                    {
                      title: 'ML probability',
                      text: 'The Python service scores the payment with the trained Random Forest model.',
                    },
                    {
                      title: 'Final decision',
                      text: 'LOW approves, MEDIUM goes to admin review, HIGH follows the configured review-or-decline policy.',
                    },
                  ].map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                          {step.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  Declined payments never move money. Review payments only settle
                  when an admin approves them.
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={submitting ? undefined : () => setConfirmOpen(false)}
        title="Confirm this simulated transfer"
        description="Check the receiver and amount. This action starts risk scoring immediately."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Go back
            </Button>
            <Button onClick={handleConfirm} loading={submitting} icon={Send}>
              {submitting ? 'Scoring payment…' : 'Confirm transfer'}
            </Button>
          </>
        }
      >
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-sm text-slate-500">To</dt>
            <dd className="text-right text-sm font-medium text-slate-900">
              {form.receiverEmail}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-sm text-slate-500">Amount</dt>
            <dd className="text-right text-lg font-semibold text-slate-900">
              {form.amount ? formatInr(toPaise(form.amount)) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <dt className="text-sm text-slate-500">Fee</dt>
            <dd className="text-right text-sm font-medium text-emerald-600">
              ₹0.00
            </dd>
          </div>
          {form.description ? (
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-sm text-slate-500">Note</dt>
              <dd className="max-w-[70%] text-right text-sm text-slate-700">
                {form.description}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm font-medium text-slate-700">Total</dt>
            <dd className="text-right text-lg font-semibold text-slate-900">
              {form.amount ? formatInr(toPaise(form.amount)) : '—'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Medium-risk transfers are held for admin review. High-risk transfers
          may be declined. No real money is involved.
        </p>
      </Modal>
    </div>
  );
}
