'use client'

import { useMemo } from 'react'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatMXN, formatMXNCompact } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/app.types'

type MovementRow = {
  type: string
  amount: number
  date: string
  category: Category | null
}

interface MonthData {
  month: string
  label: string
  income: number
  expenses: number
  savings: number
  net: number
}

interface CategoryData {
  id: string
  name: string
  icon: string
  color: string
  total: number
  pct: number
}

export function ReportsClient({ movements }: { movements: MovementRow[] }) {
  const { monthlyData, categoryData, totals } = useMemo(() => {
    const monthMap = new Map<string, MonthData>()

    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      d.setDate(1)
      const key = format(d, 'yyyy-MM')
      monthMap.set(key, {
        month: key,
        label: format(d, "MMM ''yy", { locale: es }),
        income: 0,
        expenses: 0,
        savings: 0,
        net: 0,
      })
    }

    for (const m of movements) {
      const key = m.date.substring(0, 7)
      const entry = monthMap.get(key)
      if (!entry) continue
      if (m.type === 'income') entry.income += m.amount
      else if (m.type === 'expense') entry.expenses += m.amount
      else if (m.type === 'saving') entry.savings += m.amount
    }

    for (const entry of monthMap.values()) {
      entry.net = entry.income - entry.expenses - entry.savings
    }

    const monthlyData = [...monthMap.values()]

    const totals = monthlyData.reduce(
      (acc, m) => ({
        income: acc.income + m.income,
        expenses: acc.expenses + m.expenses,
        savings: acc.savings + m.savings,
        net: acc.net + m.net,
      }),
      { income: 0, expenses: 0, savings: 0, net: 0 }
    )

    const catMap = new Map<string, CategoryData>()
    for (const m of movements.filter((m) => m.type === 'expense')) {
      if (!m.category) continue
      const entry = catMap.get(m.category.id) ?? {
        id: m.category.id,
        name: m.category.name,
        icon: m.category.icon,
        color: m.category.color,
        total: 0,
        pct: 0,
      }
      entry.total += m.amount
      catMap.set(m.category.id, entry)
    }

    const categoryData = [...catMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((cat) => ({
        ...cat,
        pct: totals.expenses > 0 ? Math.round((cat.total / totals.expenses) * 100) : 0,
      }))

    return { monthlyData, categoryData, totals }
  }, [movements])

  const hasData = movements.length > 0

  const tooltipStyle = {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    fontSize: '12px',
    backgroundColor: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
  }

  return (
    <div className="px-4 space-y-4 pb-6">
      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-3">
        <SummaryCard label="Ingresos (12 meses)" value={totals.income} color="text-green-600" />
        <SummaryCard label="Gastos (12 meses)" value={totals.expenses} color="text-red-500" />
        <SummaryCard label="Ahorros (12 meses)" value={totals.savings} color="text-teal-600" />
        <SummaryCard
          label="Neto (12 meses)"
          value={totals.net}
          color={totals.net >= 0 ? 'text-green-600' : 'text-red-500'}
        />
      </section>

      {!hasData && (
        <div className="py-16 text-center text-muted-foreground">
          <div className="text-4xl mb-3">📈</div>
          <p className="font-medium">Sin datos aún</p>
          <p className="text-sm mt-1">Agrega movimientos para ver tus reportes</p>
        </div>
      )}

      {hasData && (
        <>
          {/* Income vs Expenses */}
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Ingresos vs Gastos
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMXNCompact(v)}
                />
                <Tooltip
                  formatter={(value, name) => [formatMXN(Number(value)), name]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Bar dataKey="income" name="Ingresos" fill="#22c55e" radius={[2, 2, 0, 0]} maxBarSize={16} />
                <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Savings per month */}
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Ahorro mensual
            </h2>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMXNCompact(v)}
                />
                <Tooltip
                  formatter={(value) => [formatMXN(Number(value)), 'Ahorro']}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Bar dataKey="savings" name="Ahorro" fill="#14b8a6" radius={[2, 2, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Top categories */}
          {categoryData.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Top categorías (últimos 12 meses)
              </h2>
              <div className="space-y-3">
                {categoryData.map((cat) => (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-sm flex-1 truncate">
                        {cat.icon} {cat.name}
                      </span>
                      <span className="text-sm font-medium tabular-nums">{formatMXN(cat.total)}</span>
                      <span className="text-xs text-muted-foreground w-8 text-right">{cat.pct}%</span>
                    </div>
                    <div className="ml-4 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className={cn('text-base font-bold tabular-nums mt-1', color)}>
        {formatMXN(value)}
      </p>
    </div>
  )
}
