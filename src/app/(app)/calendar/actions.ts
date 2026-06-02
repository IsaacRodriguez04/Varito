'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/date-utils'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

export async function toggleInstallmentPaid(id: string, isPaid: boolean) {
  const { supabase, user } = await getUser()
  const { error } = await supabase
    .from('installments')
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/calendar')
  revalidatePath('/dashboard')
}

export async function payInstallments(
  ids: string[],
  sourceAccountId: string | null,
  creditAccountId: string,
  totalAmount: number,
  cardName: string
) {
  const { supabase, user } = await getUser()

  const { error } = await supabase
    .from('installments')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  if (sourceAccountId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Transferencia propia')
      .single()

    if (cat) {
      const { error: mvError } = await supabase
        .from('movements')
        .insert({
          user_id: user.id,
          date: todayISO(),
          description: `Pago tarjeta · ${cardName}`,
          type: 'transfer',
          category_id: cat.id,
          account_id: sourceAccountId,
          destination_account_id: creditAccountId,
          amount: totalAmount,
          installments: 1,
          is_recurring: false,
          goal_id: null,
        })
      if (mvError) throw new Error(mvError.message)
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  revalidatePath('/movements')
}
