import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoriesClient } from './CategoriesClient'
import { currentYearMonth, monthStart, monthEnd } from '@/lib/date-utils'
import type { Category, Budget } from '@/types/app.types'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const currentMonth = currentYearMonth()

  const [{ data: categories }, { data: budgets }, { data: spendingRows }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),

    supabase
      .from('budgets')
      .select('*')
      .eq('month', currentMonth),

    supabase
      .from('movements')
      .select('category_id, amount')
      .eq('type', 'expense')
      .gte('date', monthStart(currentMonth))
      .lte('date', monthEnd(currentMonth)),
  ])

  const spendingMap: Record<string, number> = {}
  for (const row of spendingRows ?? []) {
    if (row.category_id) {
      spendingMap[row.category_id] = (spendingMap[row.category_id] ?? 0) + row.amount
    }
  }

  return (
    <div>
      <PageHeader title="Categorías" />
      <CategoriesClient
        categories={(categories ?? []) as Category[]}
        budgets={(budgets ?? []) as Budget[]}
        currentMonth={currentMonth}
        spendingMap={spendingMap}
      />
    </div>
  )
}
