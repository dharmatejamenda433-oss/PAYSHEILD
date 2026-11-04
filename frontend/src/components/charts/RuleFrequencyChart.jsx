import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';

function readableCode(code) {
  return code
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export default function RuleFrequencyChart({ data = [], height = 280 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 18, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e2e8f0"
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="code"
            width={148}
            tickFormatter={readableCode}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
            content={
              <ChartTooltip
                labelFormatter={readableCode}
                valueFormatter={(value) => `${value} triggers`}
              />
            }
          />
          <Bar
            dataKey="count"
            name="Triggers"
            fill="#3b82f6"
            radius={[0, 6, 6, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
