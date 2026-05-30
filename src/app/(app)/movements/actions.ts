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
  notes: string | null
}

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
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

  revalidatePaths()
}

export async function updateMovement(id: string, data: MovementPayload) {
  const { supabase, user } = await getUser()

  const { error } = await supabase
    .from('movements')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

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
    // Keep paid installments — only delete unpaid ones, then soft-mark movement
    await supabase
      .from('installments')
      .delete()
      .eq('movement_id', id)
      .eq('is_paid', false)
    // Movement record stays for historical reference (paid installments still point to it)
    // For now just revalidate — a future "cancelled" flag can be added later
    revalidatePaths()
    return
  }

  const { error } = await supabase
    .from('movements')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePaths()
}

function revalidatePaths() {
  revalidatePath('/movements')
  revalidatePath('/calendar')
  revalidatePath('/dashboard')
}
