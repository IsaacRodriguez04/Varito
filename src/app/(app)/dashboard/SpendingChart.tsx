'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMXN } from '@/lib/currency'

export interface SpendingItem {
  name: string
  icon: string
  color: string
  value: number
  pct: number
}

export function SpendingChart({ data }: { data: SpendingItem[] }) {
  if (data.length === 0) return null

  return (
    <div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={data.length > 1 ? 2 : 0}
            dataKey="value"
            stroke="none"
          >
            {data.map((item, i) => (
              <Cell key={i} fill={item.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatMXN(Number(value)), '']}
            labelFormatter={() => ''}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-sm flex-1 truncate">{item.icon} {item.name}</span>
            <span className="text-sm font-medium tabular-nums">{formatMXN(item.value)}</span>
            <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
