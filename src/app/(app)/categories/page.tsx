import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoriesClient } from './CategoriesClient'
import type { Category } from '@/types/app.types'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('is_system', { ascending: false })
    .order('name', { ascending: true })

  return (
    <div>
      <PageHeader title="Categorías" />
      <CategoriesClient categories={(categories ?? []) as Category[]} />
    </div>
  )
}
