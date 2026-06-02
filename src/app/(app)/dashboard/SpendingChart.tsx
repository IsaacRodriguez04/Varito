'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMXN } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface SpendingItem {
  name: string
  icon: string
  color: string
  value: number
  pct: number
  budget?: number
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

      <div className="space-y-2.5">
        {data.map((item) => {
          const budgetPct = item.budget ? Math.min(Math.round((item.value / item.budget) * 100), 100) : null
          const overBudget = item.budget ? item.value > item.budget : false
          return (
            <div key={item.name}>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-sm flex-1 truncate">{item.icon} {item.name}</span>
                <span className="text-sm font-medium tabular-nums">{formatMXN(item.value)}</span>
                {item.budget ? (
                  <span className={cn('text-xs tabular-nums w-20 text-right', overBudget ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                    {overBudget ? '⚠ ' : ''}/{formatMXN(item.budget)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{item.pct}%</span>
                )}
              </div>
              {budgetPct !== null && (
                <div className="ml-4 mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', overBudget ? 'bg-red-500' : budgetPct >= 80 ? 'bg-yellow-500' : 'bg-green-500')}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
