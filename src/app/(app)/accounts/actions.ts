'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildInstallmentSchedule } from '@/lib/msi-calculator'
import type { AccountType } from '@/types/app.types'

interface AccountPayload {
  name: string
  bank: string | null
  type: AccountType
  color: string
  credit_limit: number | null
  cut_day: number | null
  days_to_due: number | null
  initial_balance: number
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
  revalidatePath('/dashboard')
}

export async function updateAccount(id: string, data: AccountPayload) {
  const { supabase, user } = await getAuthenticatedUser()
  const { error } = await supabase
    .from('accounts')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  if (data.type === 'credit' && data.cut_day && data.days_to_due) {
    await recalculateUnpaidInstallments(supabase, user.id, id, data.cut_day, data.days_to_due)
  }

  revalidatePath('/accounts')
  revalidatePath('/calendar')
  revalidatePath('/dashboard')
}

async function recalculateUnpaidInstallments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
  cutDay: number,
  daysTodue: number
) {
  const { data: movements } = await supabase
    .from('movements')
    .select('id, date, amount, installments')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('type', 'expense')

  if (!movements?.length) return

  for (const mv of movements) {
    const { data: paidRows } = await supabase
      .from('installments')
      .select('installment_number')
      .eq('movement_id', mv.id)
      .eq('is_paid', true)

    await supabase
      .from('installments')
      .delete()
      .eq('movement_id', mv.id)
      .eq('is_paid', false)

    const paidNumbers = new Set((paidRows ?? []).map((r) => r.installment_number))
    const schedule = buildInstallmentSchedule(
      new Date(mv.date + 'T12:00:00'),
      mv.amount,
      mv.installments,
      cutDay,
      daysTodue
    )

    const toInsert = schedule
      .filter((item) => !paidNumbers.has(item.installment_number))
      .map((item) => ({
        movement_id: mv.id,
        user_id: userId,
        installment_number: item.installment_number,
        due_date: item.due_date,
        amount: item.amount,
      }))

    if (toInsert.length > 0) {
      await supabase.from('installments').insert(toInsert)
    }
  }
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
  revalidatePath('/dashboard')
}
