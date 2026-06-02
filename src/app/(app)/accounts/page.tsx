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

export default async function AccountsPage() {
  const supabase = await createClient()

  const [{ data: accounts }, { data: allMovements }, { data: unpaidInst }] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('movements').select('account_id, destination_account_id, type, amount'),
    supabase
      .from('installments')
      .select('amount, movement:movements!movement_id(account_id)')
      .eq('is_paid', false)
      .gte('due_date', todayISO()),
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

  return (
    <div>
      <PageHeader title="Cuentas y tarjetas" />
      <AccountsClient
        accounts={accs}
        balanceMap={balanceMap}
        creditDebtMap={creditDebtMap}
      />
    </div>
  )
}
