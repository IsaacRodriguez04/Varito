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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const selectedMonth = month ?? currentYearMonth()

  const supabase = await createClient()

  const [{ data: installments }, { data: debitAccounts }] = await Promise.all([
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
      .select('id, name, bank, color, type')
      .in('type', ['debit', 'cash'])
      .eq('is_active', true)
      .order('created_at'),
  ])

  return (
    <div>
      <PageHeader title="Calendario de pagos" />
      <CalendarClient
        installments={(installments ?? []) as InstallmentDetail[]}
        selectedMonth={selectedMonth}
        debitAccounts={(debitAccounts ?? []) as Pick<Account, 'id' | 'name' | 'bank' | 'color' | 'type'>[]}
      />
    </div>
  )
}
