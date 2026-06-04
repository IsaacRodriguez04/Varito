import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { AccountsClient } from './AccountsClient'
import { todayISO, currentYearMonth, monthStart, monthEnd } from '@/lib/date-utils'
import type { Account } from '@/types/app.types'

type MovementRow = {
  account_id: string | null
  destination_account_id: string | null
  type: string
  amount: number
}

type InstallmentRow = {
  amount: number
  movement: { account_id: string } | null
}

type BonifRow = {
  account_id: string | null
  amount: number
}

type OutflowRow = {
  account_id: string | null
  amount: number
  type: string
}

export default async function AccountsPage() {
  const supabase = await createClient()
  const currentMonth = currentYearMonth()
  const mStart = monthStart(currentMonth)
  const mEnd = monthEnd(currentMonth)

  const [
    { data: accounts },
    { data: allMovements },
    { data: unpaidInst },
    { data: bonifCategory },
  ] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('movements').select('account_id, destination_account_id, type, amount'),
    supabase
      .from('installments')
      .select('amount, movement:movements!movement_id(account_id)')
      .eq('is_paid', false)
      .gte('due_date', todayISO()),
    supabase
      .from('categories')
      .select('id')
      .eq('name', 'Bonificación bancaria')
      .eq('is_system', true)
      .maybeSingle(),
  ])

  const accs = (accounts ?? []) as Account[]
  const mvs = (allMovements ?? []) as MovementRow[]

  // Balance acumulado para cuentas débito/efectivo (todos los tiempos)
  const balanceMap: Record<string, number> = {}
  for (const acc of accs) {
    if (acc.type === 'credit') continue
    let balance = acc.initial_balance ?? 0
    for (const m of mvs) {
      if (m.account_id === acc.id) {
        if (m.type === 'income') balance += m.amount
        else if (m.type === 'expense' || m.type === 'saving') balance -= m.amount
        else if (m.type === 'transfer') balance -= m.amount
      }
      if (m.destination_account_id === acc.id && m.type === 'transfer') {
        balance += m.amount
      }
    }
    balanceMap[acc.id] = balance
  }

  // Deuda total de cuotas pendientes por tarjeta de crédito
  const creditDebtMap: Record<string, number> = {}
  for (const inst of (unpaidInst ?? []) as unknown as InstallmentRow[]) {
    const accId = inst.movement?.account_id
    if (!accId) continue
    creditDebtMap[accId] = (creditDebtMap[accId] ?? 0) + inst.amount
  }

  // Remanente de bonificaciones del mes por cuenta débito/efectivo
  const bonifRemainingMap: Record<string, number> = {}
  if (bonifCategory?.id) {
    const [{ data: bonifRows }, { data: outflowRows }] = await Promise.all([
      supabase
        .from('movements')
        .select('account_id, amount')
        .eq('type', 'income')
        .eq('category_id', bonifCategory.id)
        .gte('date', mStart)
        .lte('date', mEnd),
      supabase
        .from('movements')
        .select('account_id, amount, type')
        .in('type', ['expense', 'saving', 'transfer'])
        .gte('date', mStart)
        .lte('date', mEnd),
    ])

    const bonifByAccount: Record<string, number> = {}
    for (const row of (bonifRows ?? []) as BonifRow[]) {
      if (row.account_id) bonifByAccount[row.account_id] = (bonifByAccount[row.account_id] ?? 0) + row.amount
    }

    const outflowByAccount: Record<string, number> = {}
    for (const row of (outflowRows ?? []) as OutflowRow[]) {
      if (row.account_id) outflowByAccount[row.account_id] = (outflowByAccount[row.account_id] ?? 0) + row.amount
    }

    for (const [accId, bonif] of Object.entries(bonifByAccount)) {
      const remaining = bonif - (outflowByAccount[accId] ?? 0)
      if (remaining > 0) bonifRemainingMap[accId] = remaining
    }
  }

  return (
    <div>
      <PageHeader title="Cuentas y tarjetas" />
      <AccountsClient
        accounts={accs}
        balanceMap={balanceMap}
        creditDebtMap={creditDebtMap}
        bonifRemainingMap={bonifRemainingMap}
      />
    </div>
  )
}
