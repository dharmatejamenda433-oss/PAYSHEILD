import Skeleton from './Skeleton';
import { cn } from '../../utils/cn';

const TONES = {
  navy: 'bg-navy-50 text-navy-700',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
};

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'navy',
  loading = false,
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2.5 h-7 w-28" />
          ) : (
            <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-slate-900">
              {value}
            </p>
          )}
          {hint ? (
            <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              TONES[tone] || TONES.navy
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
