import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  primary:
    'bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-950',
  secondary:
    'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100',
  subtle: 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
  success:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
  outlineDanger:
    'border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50 active:bg-rose-100',
};

const SIZES = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  disabled = false,
  type,
  ...props
}) {
  const isButton = Component === 'button';
  const isDisabled = disabled || loading;

  return (
    <Component
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className
      )}
      {...(isButton ? { type: type || 'button', disabled: isDisabled } : {})}
      aria-disabled={isDisabled || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
      {IconRight && !loading ? (
        <IconRight className="h-4 w-4" aria-hidden="true" />
      ) : null}
    </Component>
  );
}
