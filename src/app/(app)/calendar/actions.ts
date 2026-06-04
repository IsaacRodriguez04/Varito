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

  if (!isPaid) {
    // Al desmarcar, borrar el movimiento de pago vinculado si existe.
    // ON DELETE SET NULL limpia payment_movement_id de todas las cuotas que lo referenciaban.
    const { data: inst } = await supabase
      .from('installments')
      .select('payment_movement_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (inst?.payment_movement_id) {
      await supabase
        .from('movements')
        .delete()
        .eq('id', inst.payment_movement_id)
        .eq('user_id', user.id)
    }
  }

  const { error } = await supabase
    .from('installments')
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/calendar')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  revalidatePath('/movements')
}

export async function payInstallments(
  ids: string[],
  sourceAccountId: string | null,
  creditAccountId: string,
  totalAmount: number,
  cardName: string
) {
  const { supabase, user } = await getUser()

  if (sourceAccountId) {
    const [{ data: acc }, { data: mvs }] = await Promise.all([
      supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', sourceAccountId)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('movements')
        .select('account_id, destination_account_id, type, amount')
        .eq('user_id', user.id),
    ])

    let balance = (acc?.initial_balance as number | null) ?? 0
    for (const m of (mvs ?? []) as { account_id: string | null; destination_account_id: string | null; type: string; amount: number }[]) {
      if (m.account_id === sourceAccountId) {
        if (m.type === 'income') balance += m.amount
        else if (m.type === 'expense' || m.type === 'saving' || m.type === 'transfer') balance -= m.amount
      }
      if (m.destination_account_id === sourceAccountId && m.type === 'transfer') {
        balance += m.amount
      }
    }

    if (balance < totalAmount) {
      throw new Error(
        `Saldo insuficiente. Disponible: $${balance.toFixed(2)}, necesario: $${totalAmount.toFixed(2)}.`
      )
    }
  }

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
      const { data: movement, error: mvError } = await supabase
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
          is_calendar_payment: true,
          goal_id: null,
        })
        .select('id')
        .single()
      if (mvError) throw new Error(mvError.message)

      // Vincular el movimiento a cada cuota pagada para poder borrarlo al desmarcar
      if (movement) {
        await supabase
          .from('installments')
          .update({ payment_movement_id: movement.id })
          .in('id', ids)
          .eq('user_id', user.id)
      }
    }
  }

  revalidatePath('/calendar')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  revalidatePath('/movements')
}
