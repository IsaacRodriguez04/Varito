'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface CategoryPayload {
  name: string
  icon: string
  color: string
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

export async function createCategory(data: CategoryPayload) {
  const { supabase, user } = await getAuthenticatedUser()
  const { error } = await supabase
    .from('categories')
    .insert({ user_id: user.id, ...data, is_system: false })
  if (error) throw new Error(error.message)
  revalidatePath('/categories')
}

export async function updateCategory(id: string, data: CategoryPayload) {
  const { supabase, user } = await getAuthenticatedUser()
  const { error } = await supabase
    .from('categories')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/categories')
}

export async function deleteCategory(id: string) {
  const { supabase, user } = await getAuthenticatedUser()

  const { count } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    throw new Error(
      `Esta categoría tiene ${count} movimiento${count > 1 ? 's' : ''}. Reasígnalos antes de eliminarla.`
    )
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('is_system', false)
  if (error) throw new Error(error.message)
  revalidatePath('/categories')
}
