'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface MrrChartProps {
  data: { month: string; mrr: number }[]
}

const formatKRW = (value: number) => `\u20A9${value.toLocaleString()}`

export default function MrrChart({ data }: MrrChartProps) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={(value: number) => `${(value / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            formatter={(value) => [formatKRW(Number(value)), 'MRR']}
            contentStyle={{
              backgroundColor: '#fff',
              border: 'none',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="mrr"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#mrrGradient)"
            dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
