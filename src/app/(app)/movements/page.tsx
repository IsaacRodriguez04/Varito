import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { MovementsClient } from './MovementsClient'
import { currentYearMonth, monthStart, monthEnd } from '@/lib/date-utils'
import type { Account, Category, Movement } from '@/types/app.types'

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const selectedMonth = month ?? currentYearMonth()

  const supabase = await createClient()

  const [{ data: movements }, { data: accounts }, { data: categories }] =
    await Promise.all([
      supabase
        .from('movements')
        .select(`
          *,
          category:categories(*),
          account:accounts!account_id(*),
          destination_account:accounts!destination_account_id(*)
        `)
        .gte('date', monthStart(selectedMonth))
        .lte('date', monthEnd(selectedMonth))
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at'),

      supabase
        .from('categories')
        .select('*')
        .order('name'),
    ])

  return (
    <div>
      <PageHeader title="Movimientos" />
      <MovementsClient
        movements={(movements ?? []) as Movement[]}
        accounts={(accounts ?? []) as Account[]}
        categories={(categories ?? []) as Category[]}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}
