import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { CalendarClient } from './CalendarClient'
import { currentYearMonth, monthStart, monthEnd } from '@/lib/date-utils'
import type { Account, Installment, Movement } from '@/types/app.types'

export type InstallmentDetail = Installment & {
  movement: Pick<Movement, 'description'> & {
    account: Pick<Account, 'id' | 'name' | 'color' | 'bank'>
  }
}

type MovementRow = {
  account_id: string | null
  destination_account_id: string | null
  type: string
  amount: number
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const selectedMonth = month ?? currentYearMonth()

  const supabase = await createClient()

  const [{ data: installments }, { data: debitAccountsRaw }, { data: allMovements }] = await Promise.all([
    supabase
      .from('installments')
      .select(`
        *,
        movement:movements!movement_id(
          description,
          account:accounts!account_id(id, name, color, bank)
        )
      `)
      .gte('due_date', monthStart(selectedMonth))
      .lte('due_date', monthEnd(selectedMonth))
      .order('due_date')
      .order('amount', { ascending: false }),

    supabase
      .from('accounts')
      .select('id, name, bank, color, type, initial_balance')
      .in('type', ['debit', 'cash'])
      .eq('is_active', true)
      .order('created_at'),

    supabase
      .from('movements')
      .select('account_id, destination_account_id, type, amount'),
  ])

  const debitAccounts = (debitAccountsRaw ?? []) as Pick<Account, 'id' | 'name' | 'bank' | 'color' | 'type' | 'initial_balance'>[]
  const mvs = (allMovements ?? []) as MovementRow[]

  const balanceMap: Record<string, number> = {}
  for (const acc of debitAccounts) {
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

  return (
    <div>
      <PageHeader title="Calendario de pagos" />
      <CalendarClient
        installments={(installments ?? []) as InstallmentDetail[]}
        selectedMonth={selectedMonth}
        debitAccounts={debitAccounts}
        balanceMap={balanceMap}
      />
    </div>
  )
}
