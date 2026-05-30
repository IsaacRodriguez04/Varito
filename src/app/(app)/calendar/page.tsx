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

  const { data: installments } = await supabase
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
    .order('amount', { ascending: false })

  return (
    <div>
      <PageHeader title="Calendario de pagos" />
      <CalendarClient
        installments={(installments ?? []) as InstallmentDetail[]}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}
