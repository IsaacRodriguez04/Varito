import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { AccountsClient } from './AccountsClient'
import type { Account } from '@/types/app.types'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div>
      <PageHeader title="Cuentas y tarjetas" />
      <AccountsClient accounts={(accounts ?? []) as Account[]} />
    </div>
  )
}
