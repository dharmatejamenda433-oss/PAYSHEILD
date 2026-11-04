import { ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Brand({ dark = false, className }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            'block text-[15px] font-semibold tracking-tight',
            dark ? 'text-navy-900' : 'text-white'
          )}
        >
          PayShield
        </span>
        <span
          className={cn(
            'block text-[10px] font-medium uppercase tracking-[0.16em]',
            dark ? 'text-slate-400' : 'text-navy-200/80'
          )}
        >
          Fraud intelligence
        </span>
      </span>
    </div>
  );
}
