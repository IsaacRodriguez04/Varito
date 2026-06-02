import { format, addDays } from 'date-fns'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthSelector } from '@/components/MonthSelector'
import { PushSubscription } from '@/components/layout/PushSubscription'
import { SpendingChart } from './SpendingChart'
import { currentYearMonth, monthStart, monthEnd, todayISO, formatMonthYear } from '@/lib/date-utils'
import { formatMXN } from '@/lib/currency'
import { formatShortDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { Category, Account, Budget, Goal } from '@/types/app.types'

type MovementRow = {
  type: string
  amount: number
  category: Category | null
}

type MovementBalanceRow = {
  account_id: string | null
  destination_account_id: string | null
  type: string
  amount: number
}

type InstallmentDebtRow = {
  amount: number
  movement: { account: Pick<Account, 'id' | 'name' | 'color' | 'bank'> }
}

type InstallmentUpcomingRow = {
  id: string
  due_date: string
  amount: number
  installment_number: number
  movement: {
    description: string
    account: Pick<Account, 'id' | 'name' | 'color' | 'bank'>
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const selectedMonth = month ?? currentYearMonth()

  const supabase = await createClient()

  const todayStr = todayISO()
  const in15Days = format(addDays(new Date(), 15), 'yyyy-MM-dd')
  const monthLabel = formatMonthYear(
    new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]) - 1, 1)
  )

  const [
    { data: movements },
    { data: debtRows },
    { data: upcomingRows },
    { data: budgetRows },
    { data: accounts },
    { data: allMovements },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from('movements')
      .select('type, amount, category:categories(id, name, icon, color, is_system, user_id, created_at)')
      .gte('date', monthStart(selectedMonth))
      .lte('date', monthEnd(selectedMonth)),

    supabase
      .from('installments')
      .select('amount, movement:movements!movement_id(account:accounts!account_id(id, name, color, bank))')
      .eq('is_paid', false)
      .gte('due_date', todayStr),

    supabase
      .from('installments')
      .select('id, due_date, amount, installment_number, movement:movements!movement_id(description, account:accounts!account_id(id, name, color, bank))')
      .eq('is_paid', false)
      .gte('due_date', todayStr)
      .lte('due_date', in15Days)
      .order('due_date')
      .limit(8),

    supabase
      .from('budgets')
      .select('*')
      .eq('month', selectedMonth),

    supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    supabase
      .from('movements')
      .select('account_id, destination_account_id, type, amount'),

    supabase
      .from('goals')
      .select('*')
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const mvs = (movements ?? []) as unknown as MovementRow[]

  // ── Balance mensual ──────────────────────────────────────────────────────
  const income   = mvs.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0)
  const expenses = mvs.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0)
  const savings  = mvs.filter((m) => m.type === 'saving').reduce((s, m) => s + m.amount, 0)
  const net      = income - expenses - savings

  // ── Spending by category ─────────────────────────────────────────────────
  const budgetMap = new Map<string, number>()
  for (const b of (budgetRows ?? []) as Budget[]) {
    budgetMap.set(b.category_id, b.amount)
  }

  const catMap = new Map<string, { cat: Category; total: number }>()
  for (const m of mvs.filter((m) => m.type === 'expense')) {
    if (!m.category) continue
    const entry = catMap.get(m.category.id) ?? { cat: m.category, total: 0 }
    entry.total += m.amount
    catMap.set(m.category.id, entry)
  }
  const catList = [...catMap.values()].sort((a, b) => b.total - a.total).slice(0, 6)
  const othersTotal = [...catMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(6)
    .reduce((s, e) => s + e.total, 0)
  const spendingData = [
    ...catList.map((e) => ({
      name: e.cat.name,
      icon: e.cat.icon,
      color: e.cat.color,
      value: e.total,
      pct: expenses > 0 ? Math.round((e.total / expenses) * 100) : 0,
      budget: budgetMap.get(e.cat.id),
    })),
    ...(othersTotal > 0
      ? [{ name: 'Otros', icon: '📦', color: '#94a3b8', value: othersTotal, pct: expenses > 0 ? Math.round((othersTotal / expenses) * 100) : 0 }]
      : []),
  ]

  // ── Debt by card ─────────────────────────────────────────────────────────
  const debtMap = new Map<string, { account: Pick<Account, 'id' | 'name' | 'color' | 'bank'>; total: number }>()
  for (const inst of (debtRows ?? []) as unknown as InstallmentDebtRow[]) {
    const acc = inst.movement?.account
    if (!acc) continue
    const entry = debtMap.get(acc.id) ?? { account: acc, total: 0 }
    entry.total += inst.amount
    debtMap.set(acc.id, entry)
  }
  const debtList = [...debtMap.values()].sort((a, b) => b.total - a.total)
  const totalDebt = debtList.reduce((s, e) => s + e.total, 0)

  const upcoming = (upcomingRows ?? []) as unknown as InstallmentUpcomingRow[]

  // ── Account balances (debit/cash only) ───────────────────────────────────
  const accs = (accounts ?? []) as Account[]
  const allMvs = (allMovements ?? []) as MovementBalanceRow[]
  const accountBalances = accs
    .filter((a) => a.type !== 'credit')
    .map((acc) => {
      let balance = acc.initial_balance ?? 0
      for (const m of allMvs) {
        if (m.account_id === acc.id) {
          if (m.type === 'income') balance += m.amount
          else if (m.type === 'expense' || m.type === 'saving') balance -= m.amount
          else if (m.type === 'transfer') balance -= m.amount
        }
        if (m.destination_account_id === acc.id && m.type === 'transfer') {
          balance += m.amount
        }
      }
      return { account: acc, balance }
    })

  // ── Goals ─────────────────────────────────────────────────────────────────
  const activeGoals = (goals ?? []) as Goal[]

  return (
    <div>
      <PageHeader title="Inicio" subtitle={monthLabel} action={<PushSubscription />} />

      <div className="px-4 pb-3">
        <MonthSelector value={selectedMonth} allowFuture />
      </div>

      <div className="px-4 space-y-4 pb-6">

        {/* ── Balance mensual ── */}
        <section className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Balance del mes
            </h2>
            <Link href="/reports" className="flex items-center gap-0.5 text-xs text-primary font-medium">
              Reportes <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            <BalanceRow label="Ingresos" value={income}   color="text-green-600" sign="+" />
            <BalanceRow label="Gastos"   value={expenses} color="text-red-500"   sign="−" />
            <BalanceRow label="Ahorro"   value={savings}  color="text-teal-600"  sign="−" />
          </div>
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Neto</span>
            <span className={cn('text-lg font-bold tabular-nums', net >= 0 ? 'text-green-600' : 'text-red-500')}>
              {net >= 0 ? '' : '−'}{formatMXN(Math.abs(net))}
            </span>
          </div>
        </section>

        {/* ── Saldo por cuenta (débito/efectivo) ── */}
        {accountBalances.length > 0 && (
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saldo por cuenta
              </h2>
              <Link href="/accounts" className="flex items-center gap-0.5 text-xs text-primary font-medium">
                Ver todas <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {accountBalances.map(({ account: acc, balance }) => (
              <div key={acc.id} className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                <span className="flex-1 text-sm truncate">{acc.name}{acc.bank ? ` · ${acc.bank}` : ''}</span>
                <span className={cn('text-sm font-semibold tabular-nums', balance >= 0 ? 'text-green-600' : 'text-red-500')}>
                  {formatMXN(balance)}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* ── Spending by category ── */}
        {expenses > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Gastos por categoría
            </h2>
            <SpendingChart data={spendingData} />
          </section>
        )}

        {/* ── Metas de ahorro ── */}
        {activeGoals.length > 0 && (
          <section className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metas de ahorro
              </h2>
              <Link href="/goals" className="flex items-center gap-0.5 text-xs text-primary font-medium">
                Ver todas <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {activeGoals.map((goal) => {
              const pct =
                goal.target_amount > 0
                  ? Math.min(Math.round((goal.saved_amount / goal.target_amount) * 100), 100)
                  : 0
              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{goal.icon}</span>
                    <span className="text-sm flex-1 truncate font-medium">{goal.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatMXN(goal.saved_amount)} / {formatMXN(goal.target_amount)}
                    </span>
                    <span className="text-xs font-semibold w-8 text-right tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: goal.color }}
                    />
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ── Debt by card ── */}
        {debtList.length > 0 && (
          <section className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Deuda total por tarjeta
              </h2>
              <span className="text-xs font-semibold text-red-500 tabular-nums">
                {formatMXN(totalDebt)}
              </span>
            </div>
            {debtList.map(({ account: acc, total }) => (
              <div key={acc.id} className="flex items-center gap-2.5">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                <span className="flex-1 text-sm truncate">{acc.name}{acc.bank ? ` · ${acc.bank}` : ''}</span>
                <span className="text-sm font-semibold tabular-nums text-red-500">{formatMXN(total)}</span>
              </div>
            ))}
          </section>
        )}

        {/* ── Upcoming payments ── */}
        {upcoming.length > 0 && (
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próximos 15 días
              </h2>
              <Link
                href="/calendar"
                className="flex items-center gap-0.5 text-xs text-primary font-medium"
              >
                Ver todos <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {upcoming.map((inst) => {
              const acc = inst.movement.account
              return (
                <div key={inst.id} className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{inst.movement.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(inst.due_date)} · {acc.name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatMXN(inst.amount)}</span>
                </div>
              )
            })}
          </section>
        )}

        {/* Empty state */}
        {income === 0 && expenses === 0 && savings === 0 && debtList.length === 0 && upcoming.length === 0 && accountBalances.length === 0 && activeGoals.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-medium">Sin datos este mes</p>
            <p className="text-sm mt-1">Agrega movimientos para ver tu resumen</p>
          </div>
        )}

      </div>
    </div>
  )
}

function BalanceRow({
  label, value, color, sign,
}: {
  label: string
  value: number
  color: string
  sign: string
}) {
  if (value === 0) return null
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium tabular-nums', color)}>
        {sign}{formatMXN(value)}
      </span>
    </div>
  )
}
