import { cn } from '../../utils/cn';

const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  navy: 'bg-navy-50 text-navy-700 ring-navy-600/20',
};

const DOT_TONES = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
  navy: 'bg-navy-500',
};

export default function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {dot ? (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            DOT_TONES[tone] || DOT_TONES.neutral
          )}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
