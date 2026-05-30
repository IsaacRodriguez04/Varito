'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
