import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { GoalsClient } from './GoalsClient'
import type { Goal } from '@/types/app.types'

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .order('is_completed', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Metas de ahorro" />
      <GoalsClient goals={(goals ?? []) as Goal[]} />
    </div>
  )
}
