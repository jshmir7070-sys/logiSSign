'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

interface PlanDistributionDatum {
  name: string
  value: number
}

interface PlanDistributionProps {
  data: PlanDistributionDatum[]
}

const COLORS = ['#9ca3af', '#8b5cf6', '#2563eb', '#007d55', '#d97706', '#0ea5e9']

export default function PlanDistribution({ data }: PlanDistributionProps) {
  const total = data.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="relative h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value}개`, name]}
            contentStyle={{
              backgroundColor: '#fff',
              border: 'none',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="font-data text-2xl font-bold text-on-surface">{total}</p>
          <p className="text-[11px] font-body text-on-surface-variant">Total</p>
        </div>
      </div>
    </div>
  )
}
