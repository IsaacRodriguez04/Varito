'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AccountType } from '@/types/app.types'

interface AccountPayload {
  name: string
  bank: string | null
  type: AccountType
  color: string
  credit_limit: number | null
  cut_day: number | null
  days_to_due: number | null
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

export async function createAccount(data: AccountPayload) {
  const { supabase, user } = await getAuthenticatedUser()
  const { error } = await supabase.from('accounts').insert({ user_id: user.id, ...data })
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}

export async function updateAccount(id: string, data: AccountPayload) {
  const { supabase, user } = await getAuthenticatedUser()
  const { error } = await supabase
    .from('accounts')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}

export async function deleteAccount(id: string) {
  const { supabase, user } = await getAuthenticatedUser()

  const { count } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
    .or(`account_id.eq.${id},destination_account_id.eq.${id}`)

  if (count && count > 0) {
    throw new Error(
      `Esta cuenta tiene ${count} movimiento${count > 1 ? 's' : ''}. Elimínalos primero para poder borrar la cuenta.`
    )
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/accounts')
}
