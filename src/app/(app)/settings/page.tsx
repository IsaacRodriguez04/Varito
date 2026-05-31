import Link from 'next/link'
import { Tag, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { NotificationSettings } from '@/components/layout/NotificationSettings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name   = user?.user_metadata?.full_name as string | undefined
  const email  = user?.email
  const avatar = user?.user_metadata?.avatar_url as string | undefined

  return (
    <div>
      <PageHeader title="Perfil" />

      <div className="px-4 space-y-4 pb-6">

        {/* ── User info ── */}
        <section className="rounded-xl border bg-card p-4 flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name ?? 'avatar'}
              width={56}
              height={56}
              className="rounded-full"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground select-none">
              {(name ?? email ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {name && <p className="font-semibold truncate">{name}</p>}
            {email && <p className="text-sm text-muted-foreground truncate">{email}</p>}
          </div>
        </section>

        {/* ── App sections ── */}
        <section className="rounded-xl border bg-card divide-y">
          <Link
            href="/categories"
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Categorías</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>

        {/* ── Notifications ── */}
        <NotificationSettings />

        {/* ── Sign out ── */}
        <section className="rounded-xl border bg-card p-4">
          <SignOutButton />
        </section>

      </div>
    </div>
  )
}
