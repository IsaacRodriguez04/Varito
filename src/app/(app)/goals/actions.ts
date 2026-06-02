'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface GoalPayload {
  name: string
  icon: string
  color: string
  target_amount: number
  saved_amount: number
  target_date: string | null
  notes: string | null
}

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

export async function createGoal(data: GoalPayload) {
  const { supabase, user } = await getUser()
  const { error } = await supabase.from('goals').insert({ user_id: user.id, ...data })
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/dashboard')
}

export async function updateGoal(id: string, data: GoalPayload) {
  const { supabase, user } = await getUser()
  const { error } = await supabase
    .from('goals')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/dashboard')
}

export async function toggleGoalCompleted(id: string, is_completed: boolean) {
  const { supabase, user } = await getUser()
  const { error } = await supabase
    .from('goals')
    .update({ is_completed })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/dashboard')
}

export async function deleteGoal(id: string) {
  const { supabase, user } = await getUser()
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/goals')
  revalidatePath('/dashboard')
}
