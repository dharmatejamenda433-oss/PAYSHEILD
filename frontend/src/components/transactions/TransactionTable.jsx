import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ReceiptText,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import RiskBadge from './RiskBadge';
import EmptyState from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Skeleton';
import {
  formatDateTime,
  formatInr,
  relativeTime,
  truncateMiddle,
} from '../../utils/format';
import { cn } from '../../utils/cn';

function DirectionIcon({ incoming }) {
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight;

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        incoming
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-blue-50 text-blue-600'
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default function TransactionTable({
  transactions = [],
  loading = false,
  variant = 'customer',
  emptyTitle,
  emptyDescription,
  emptyAction,
}) {
  if (loading) {
    return <TableSkeleton rows={5} columns={6} />;
  }

  if (!transactions.length) {
    return (
      <EmptyState
        icon={ReceiptText}
        title={emptyTitle || 'No transactions yet'}
        description={
          emptyDescription ||
          'Transfers you make or receive will appear here with their fraud risk score.'
        }
        action={emptyAction}
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3">Reference</th>
            <th className="px-3 py-3">
              {variant === 'admin' ? 'Payment flow' : 'Counterparty'}
            </th>
            <th className="px-3 py-3 text-right">Amount</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Risk</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3" aria-label="Open" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((transaction) => {
            const incoming = transaction.direction === 'INCOMING';
            const counterparty = incoming
              ? transaction.sender
              : transaction.receiver;
            const detailPath =
              variant === 'admin'
                ? `/admin/investigations/${transaction.transactionId}`
                : `/transactions/${transaction.transactionId}`;

            return (
              <tr
                key={transaction.id}
                className="group transition hover:bg-slate-50/80"
              >
                <td className="px-5 py-3.5">
                  <Link
                    to={detailPath}
                    className="font-mono text-xs font-semibold text-navy-800 transition hover:text-blue-600"
                    title={transaction.transactionId}
                  >
                    {truncateMiddle(transaction.transactionId, 20)}
                  </Link>
                  <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">
                    {transaction.description || 'Wallet transfer'}
                  </p>
                </td>

                <td className="px-3 py-3.5">
                  {variant === 'admin' ? (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="max-w-[120px] truncate font-medium">
                        {transaction.sender?.name || 'Unknown sender'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="max-w-[120px] truncate font-medium">
                        {transaction.receiver?.name || 'Unknown receiver'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <DirectionIcon incoming={incoming} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {counterparty?.name || 'PayShield customer'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {incoming ? 'Received from' : 'Sent to'}{' '}
                          {counterparty?.email || ''}
                        </p>
                      </div>
                    </div>
                  )}
                </td>

                <td className="px-3 py-3.5 text-right">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      variant === 'admin'
                        ? 'text-slate-900'
                        : incoming
                          ? 'text-emerald-600'
                          : 'text-slate-900'
                    )}
                  >
                    {variant === 'customer' && incoming ? '+' : ''}
                    {variant === 'customer' && !incoming ? '−' : ''}
                    {formatInr(transaction.amount)}
                  </span>
                </td>

                <td className="px-3 py-3.5">
                  <p className="text-sm text-slate-700">
                    {formatDateTime(transaction.createdAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {relativeTime(transaction.createdAt)}
                  </p>
                </td>

                <td className="px-3 py-3.5">
                  <RiskBadge
                    level={transaction.riskLevel}
                    score={transaction.riskScore}
                  />
                </td>

                <td className="px-3 py-3.5">
                  <StatusBadge status={transaction.status} />
                </td>

                <td className="px-3 py-3.5 text-right">
                  <Link
                    to={detailPath}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-navy-800 group-hover:text-slate-600"
                    aria-label={`Open transaction ${transaction.transactionId}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
