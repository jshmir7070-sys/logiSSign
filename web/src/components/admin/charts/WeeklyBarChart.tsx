'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface WeeklyBarChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
  dataKey: string
  color?: string
  height?: number
  formatValue?: (value: number) => string
}

export default function WeeklyBarChart({
  data,
  dataKey,
  color = '#2563eb',
  height = 200,
  formatValue,
}: WeeklyBarChartProps) {
  const formatter = formatValue ?? ((v: number) => String(v))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatter(value)}
          />
          <Tooltip
            formatter={(value) => [formatter(Number(value)), dataKey]}
            contentStyle={{
              backgroundColor: '#fff',
              border: 'none',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
            }}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
