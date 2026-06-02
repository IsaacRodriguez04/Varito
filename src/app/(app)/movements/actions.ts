'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildInstallmentSchedule } from '@/lib/msi-calculator'
import type { MovementType, MSIOption } from '@/types/app.types'

interface MovementPayload {
  date: string
  description: string
  type: MovementType
  category_id: string
  account_id: string | null
  destination_account_id: string | null
  amount: number
  installments: MSIOption
  is_recurring: boolean
  notes: string | null
  goal_id: string | null
}

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

async function adjustGoalAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: string,
  delta: number
) {
  const { data: goal } = await supabase
    .from('goals')
    .select('saved_amount')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single()
  if (!goal) return
  await supabase
    .from('goals')
    .update({ saved_amount: Math.max(0, goal.saved_amount + delta) })
    .eq('id', goalId)
    .eq('user_id', userId)
}

async function generateInstallments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  movementId: string,
  userId: string,
  accountId: string,
  date: string,
  amount: number,
  installments: number
) {
  const { data: account } = await supabase
    .from('accounts')
    .select('type, cut_day, days_to_due')
    .eq('id', accountId)
    .single()

  if (account?.type !== 'credit' || !account.cut_day || !account.days_to_due) return

  const schedule = buildInstallmentSchedule(
    new Date(date + 'T12:00:00'),
    amount,
    installments,
    account.cut_day,
    account.days_to_due
  )

  const { error } = await supabase.from('installments').insert(
    schedule.map((item) => ({
      movement_id: movementId,
      user_id: userId,
      installment_number: item.installment_number,
      due_date: item.due_date,
      amount: item.amount,
    }))
  )
  if (error) throw new Error(error.message)
}

export async function createMovement(data: MovementPayload) {
  const { supabase, user } = await getUser()

  const { data: movement, error } = await supabase
    .from('movements')
    .insert({ user_id: user.id, ...data })
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (data.type === 'expense' && data.account_id) {
    await generateInstallments(
      supabase, movement.id, user.id,
      data.account_id, data.date, data.amount, data.installments
    )
  }

  if (data.type === 'saving' && data.goal_id) {
    await adjustGoalAmount(supabase, user.id, data.goal_id, data.amount)
  }

  revalidatePaths()
}

export async function updateMovement(id: string, data: MovementPayload) {
  const { supabase, user } = await getUser()

  const { data: old } = await supabase
    .from('movements')
    .select('type, amount, goal_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('movements')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  // Adjust goal saved_amounts for before/after
  if (old?.type === 'saving' && old.goal_id) {
    await adjustGoalAmount(supabase, user.id, old.goal_id, -old.amount)
  }
  if (data.type === 'saving' && data.goal_id) {
    await adjustGoalAmount(supabase, user.id, data.goal_id, data.amount)
  }

  // Remove unpaid installments and recalculate
  await supabase
    .from('installments')
    .delete()
    .eq('movement_id', id)
    .eq('is_paid', false)

  if (data.type === 'expense' && data.account_id) {
    await generateInstallments(
      supabase, id, user.id,
      data.account_id, data.date, data.amount, data.installments
    )
  }

  revalidatePaths()
}

export async function deleteMovement(id: string) {
  const { supabase, user } = await getUser()

  const { count: paidCount } = await supabase
    .from('installments')
    .select('*', { count: 'exact', head: true })
    .eq('movement_id', id)
    .eq('is_paid', true)

  if (paidCount && paidCount > 0) {
    await supabase
      .from('installments')
      .delete()
      .eq('movement_id', id)
      .eq('is_paid', false)
    revalidatePaths()
    return
  }

  const { data: mvData } = await supabase
    .from('movements')
    .select('type, amount, goal_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('movements')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  if (mvData?.type === 'saving' && mvData.goal_id) {
    await adjustGoalAmount(supabase, user.id, mvData.goal_id, -mvData.amount)
  }

  revalidatePaths()
}

export async function stopRecurring(id: string) {
  const { supabase, user } = await getUser()
  const { error } = await supabase
    .from('movements')
    .update({ is_recurring: false })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePaths()
}

function revalidatePaths() {
  revalidatePath('/movements')
  revalidatePath('/calendar')
  revalidatePath('/dashboard')
  revalidatePath('/goals')
}
