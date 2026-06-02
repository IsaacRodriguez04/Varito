import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoriesClient } from './CategoriesClient'
import { currentYearMonth } from '@/lib/date-utils'
import type { Category, Budget } from '@/types/app.types'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const currentMonth = currentYearMonth()

  const [{ data: categories }, { data: budgets }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),

    supabase
      .from('budgets')
      .select('*')
      .eq('month', currentMonth),
  ])

  return (
    <div>
      <PageHeader title="Categorías" />
      <CategoriesClient
        categories={(categories ?? []) as Category[]}
        budgets={(budgets ?? []) as Budget[]}
        currentMonth={currentMonth}
      />
    </div>
  )
}
