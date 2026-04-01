'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const data = [
  { month: '10월', 매출: 8200000, 지출: 5100000, 수익: 3100000 },
  { month: '11월', 매출: 9400000, 지출: 5600000, 수익: 3800000 },
  { month: '12월', 매출: 11200000, 지출: 6200000, 수익: 5000000 },
  { month: '1월', 매출: 10800000, 지출: 6000000, 수익: 4800000 },
  { month: '2월', 매출: 12100000, 지출: 6500000, 수익: 5600000 },
  { month: '3월', 매출: 12840000, 지출: 6900000, 수익: 5940000 },
];

const formatKRW = (value: number) => `\u20A9${value.toLocaleString()}`;

export default function RevenueChart() {
  return (
    <div className="mt-6 h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number, name: string) => [formatKRW(value), name]) as any}
            contentStyle={{
              backgroundColor: '#fff',
              border: 'none',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
            }}
          />
          <Legend
            wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="매출"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="지출"
            stroke="#ba1a1a"
            strokeWidth={2}
            dot={{ r: 4, fill: '#ba1a1a', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="수익"
            stroke="#007d55"
            strokeWidth={2}
            dot={{ r: 4, fill: '#007d55', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
