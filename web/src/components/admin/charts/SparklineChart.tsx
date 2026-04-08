'use client'

import { ResponsiveContainer, AreaChart, Area } from 'recharts'

interface SparklineChartProps {
  data: number[]
  color?: string
  height?: number
}

export default function SparklineChart({
  data,
  color = '#2563eb',
  height = 40,
}: SparklineChartProps) {
  const chartData = data.map((value, index) => ({ index, value }))
  const gradientId = `sparkline-${color.replace('#', '')}`

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
