import { cn } from '../../utils/cn';

export default function RiskScoreBar({
  score,
  mediumThreshold = 30,
  highThreshold = 70,
  showThresholds = false,
  size = 'md',
}) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const tone =
    safeScore >= highThreshold
      ? 'bg-rose-500'
      : safeScore >= mediumThreshold
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  const textTone =
    safeScore >= highThreshold
      ? 'text-rose-600'
      : safeScore >= mediumThreshold
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">Risk score</span>
        <span className={cn('text-sm font-semibold tabular-nums', textTone)}>
          {safeScore}
          <span className="text-xs font-medium text-slate-400"> / 100</span>
        </span>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-slate-100',
          size === 'sm' ? 'h-1.5' : 'h-2.5'
        )}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeScore}
        aria-label="Fraud risk score"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', tone)}
          style={{ width: `${safeScore}%` }}
        />
      </div>

      {showThresholds ? (
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
          <span>Low · 0–{mediumThreshold - 1}</span>
          <span>Medium · {mediumThreshold}–{highThreshold - 1}</span>
          <span>High · {highThreshold}–100</span>
        </div>
      ) : null}
    </div>
  );
}
