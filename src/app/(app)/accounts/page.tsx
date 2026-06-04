import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { AccountsClient } from './AccountsClient'
import { todayISO } from '@/lib/date-utils'
import { subDays, parseISO, format } from 'date-fns'
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

type PaidInstRow = {
  amount: number
  due_date: string
  movement: { account: { days_to_due: number | null } | null } | null
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

      // Solo cuotas cuya fecha de corte (due_date - days_to_due) sea posterior
      // a la bonificación restan el saldo. Gastos normales NO consumen el bono.
      const { data: paidInst } = await supabase
        .from('installments')
        .select('amount, due_date, movement:movements!movement_id(account:accounts!account_id(days_to_due))')
        .eq('is_paid', true)
        .gt('due_date', earliestDate)

      for (const [accId, bonif] of Object.entries(latestBonifByAccount)) {
        const paidAfter = ((paidInst ?? []) as unknown as PaidInstRow[])
          .filter((i) => {
            const daysTodue = i.movement?.account?.days_to_due ?? 0
            const cutDate = format(subDays(parseISO(i.due_date), daysTodue), 'yyyy-MM-dd')
            return cutDate > bonif.date
          })
          .reduce((sum, i) => sum + i.amount, 0)
        const remaining = bonif.amount - paidAfter
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
