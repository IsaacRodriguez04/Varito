import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { format, addDays } from 'date-fns'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = getAdminClient()
  const targetDate = format(addDays(new Date(), 3), 'yyyy-MM-dd')

  const { data: installments } = await supabase
    .from('installments')
    .select('user_id, amount, movement:movements!movement_id(description)')
    .eq('is_paid', false)
    .eq('due_date', targetDate)

  if (!installments?.length) return NextResponse.json({ sent: 0 })

  // Aggregate per user
  const byUser = new Map<string, { total: number; count: number; first: string }>()
  for (const inst of installments as unknown as { user_id: string; amount: number; movement: { description: string } }[]) {
    const e = byUser.get(inst.user_id) ?? { total: 0, count: 0, first: inst.movement?.description ?? '' }
    e.total += inst.amount
    e.count += 1
    byUser.set(inst.user_id, e)
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', [...byUser.keys()])

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  const expired: string[] = []

  for (const sub of subs) {
    const stats = byUser.get(sub.user_id)
    if (!stats) continue

    const body =
      stats.count === 1
        ? `"${stats.first}" vence en 3 días`
        : `${stats.count} pagos vencen en 3 días · $${stats.total.toFixed(2)} total`

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: 'VARITO · Pago próximo 🔔', body, url: '/calendar' })
      )
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 410 || status === 404) expired.push(sub.endpoint)
    }
  }

  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired)
  }

  return NextResponse.json({ sent, expired: expired.length, targetDate })
}
