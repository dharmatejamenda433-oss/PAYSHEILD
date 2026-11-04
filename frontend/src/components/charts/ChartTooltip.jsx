import { formatNumber } from '../../utils/format';

export default function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-700">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <p
            key={entry.dataKey || entry.name}
            className="flex items-center gap-2 text-xs text-slate-600"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || '#94a3b8' }}
            />
            <span>{entry.name}:</span>
            <span className="font-semibold text-slate-900">
              {valueFormatter
                ? valueFormatter(entry.value, entry)
                : formatNumber(entry.value)}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
