import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { RISK_CHART_COLORS, RISK_META } from '../../utils/constants';
import { formatNumber } from '../../utils/format';

export default function RiskDistributionChart({ data = [], height = 200 }) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);
  const chartData = total
    ? data
    : [{ level: 'NO_DATA', count: 1, isPlaceholder: true }];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div
        className="relative shrink-0"
        style={{ width: height, height }}
        aria-hidden={total === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="level"
              innerRadius={height * 0.3}
              outerRadius={height * 0.44}
              paddingAngle={total ? 3 : 0}
              stroke="none"
            >
              {chartData.map((entry) =>
                entry.isPlaceholder ? (
                  <Cell key="placeholder" fill="#e2e8f0" />
                ) : (
                  <Cell
                    key={entry.level}
                    fill={RISK_CHART_COLORS[entry.level] || '#94a3b8'}
                  />
                )
              )}
            </Pie>
            {total > 0 ? (
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(value) => `${formatNumber(value)} payments`}
                  />
                }
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-slate-900">
            {formatNumber(total)}
          </span>
          <span className="text-xs text-slate-500">payments</span>
        </div>
      </div>

      <ul className="w-full flex-1 space-y-2.5">
        {data.map((entry) => {
          const meta = RISK_META[entry.level] || {
            label: entry.level,
            tone: 'neutral',
          };
          const share = total ? Math.round((entry.count / total) * 100) : 0;

          return (
            <li
              key={entry.level}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      RISK_CHART_COLORS[entry.level] || '#94a3b8',
                  }}
                />
                {meta.label}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {formatNumber(entry.count)}
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  {share}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
