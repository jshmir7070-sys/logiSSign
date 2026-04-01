'use client';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

const data = [
  { name: 'Free', value: 42 },
  { name: 'Basic', value: 35 },
  { name: 'Standard', value: 23 },
  { name: 'Enterprise', value: 12 },
];

const COLORS = ['#9ca3af', '#8b5cf6', '#2563eb', '#007d55'];
const TOTAL = data.reduce((sum, d) => sum + d.value, 0);

export default function PlanDistribution() {
  return (
    <div className="h-[200px] relative">
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
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number, name: string) => [`${value}개`, name]) as any}
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
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-data font-bold text-on-surface">{TOTAL}</p>
          <p className="text-[11px] font-body text-on-surface-variant">Total</p>
        </div>
      </div>
    </div>
  );
}
