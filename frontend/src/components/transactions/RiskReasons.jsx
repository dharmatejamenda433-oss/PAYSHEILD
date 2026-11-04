import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function RiskReasons({
  reasons = [],
  emptyMessage = 'No fraud rules were triggered for this payment.',
}) {
  if (!reasons.length) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-sm text-emerald-800">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {reasons.map((reason, index) => (
        <li
          key={`${reason.code}-${index}`}
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-slate-800">
              {reason.message}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {reason.code.replaceAll('_', ' ')} · +{reason.weight} risk points
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
