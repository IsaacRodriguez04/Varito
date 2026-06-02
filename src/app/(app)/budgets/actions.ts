'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function upsertBudget(categoryId: string, month: string, amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: user.id, category_id: categoryId, month, amount },
      { onConflict: 'user_id,category_id,month' }
    )
  if (error) throw new Error(error.message)
  revalidatePath('/categories')
  revalidatePath('/dashboard')
}

export async function deleteBudget(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/categories')
  revalidatePath('/dashboard')
}
