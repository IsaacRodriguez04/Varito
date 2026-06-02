import { subMonths, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReportsClient } from './ReportsClient'
import { monthStart } from '@/lib/date-utils'
import type { Category } from '@/types/app.types'

type MovementRow = {
  type: string
  amount: number
  date: string
  category: Category | null
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const startDate = monthStart(format(subMonths(new Date(), 11), 'yyyy-MM'))

  const { data } = await supabase
    .from('movements')
    .select('type, amount, date, category:categories(id, name, icon, color, is_system, user_id, created_at)')
    .gte('date', startDate)
    .neq('type', 'transfer')
    .order('date')

  const movements: MovementRow[] = (data ?? []).map((m) => ({
    type: m.type,
    amount: m.amount,
    date: m.date,
    category: Array.isArray(m.category) ? (m.category[0] ?? null) : null,
  }))

  return (
    <div>
      <PageHeader title="Reportes" />
      <ReportsClient movements={movements} />
    </div>
  )
}
