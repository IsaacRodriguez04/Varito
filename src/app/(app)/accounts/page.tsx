import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { AccountsClient } from './AccountsClient'
import { todayISO } from '@/lib/date-utils'
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
  date: string
}

type OutflowRow = {
  account_id: string | null
  amount: number
  date: string
}

export default async function AccountsPage() {
  const supabase = await createClient()

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

  // Remanente de bonificaciones por cuenta débito/efectivo.
  // Lógica: bonificación más reciente por cuenta vs. egresos de esa misma
  // cuenta con fecha posterior a la bonificación. El banner desaparece
  // cuando los egresos post-bonificación superan el monto bonificado.
  const bonifRemainingMap: Record<string, number> = {}
  if (bonifCategory?.id) {
    const { data: bonifRows } = await supabase
      .from('movements')
      .select('account_id, amount, date')
      .eq('type', 'income')
      .eq('category_id', bonifCategory.id)
      .order('date', { ascending: false })

    // Tomar solo la bonificación más reciente por cuenta
    const latestBonifByAccount: Record<string, { amount: number; date: string }> = {}
    for (const row of (bonifRows ?? []) as BonifRow[]) {
      if (row.account_id && !latestBonifByAccount[row.account_id]) {
        latestBonifByAccount[row.account_id] = { amount: row.amount, date: row.date }
      }
    }

    if (Object.keys(latestBonifByAccount).length > 0) {
      const earliestDate = Object.values(latestBonifByAccount)
        .map((b) => b.date)
        .sort()[0]

      // Egresos de cualquier cuenta débito/efectivo posteriores a la bonificación más antigua
      const { data: outflowRows } = await supabase
        .from('movements')
        .select('account_id, amount, date')
        .in('type', ['expense', 'saving', 'transfer'])
        .gt('date', earliestDate)

      for (const [accId, bonif] of Object.entries(latestBonifByAccount)) {
        const outflowsAfter = ((outflowRows ?? []) as OutflowRow[])
          .filter((m) => m.account_id === accId && m.date > bonif.date)
          .reduce((sum, m) => sum + m.amount, 0)
        const remaining = bonif.amount - outflowsAfter
        if (remaining > 0) bonifRemainingMap[accId] = remaining
      }
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
