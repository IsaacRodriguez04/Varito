'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function PushSubscription() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
    )
  }, [])

  if (!supported) return null

  async function toggle() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()

      if (existing) {
        await existing.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        })
        setSubscribed(false)
        toast.success('Notificaciones desactivadas')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          toast.error('Permiso de notificaciones denegado')
          return
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        })
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
        })
        setSubscribed(true)
        toast.success('Notificaciones activadas — te avisaremos 3 días antes de cada pago')
      }
    } catch {
      toast.error('Error al configurar notificaciones')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={toggle}
      disabled={loading}
      aria-label={subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
    >
      {subscribed
        ? <Bell className="h-4 w-4 text-primary" />
        : <BellOff className="h-4 w-4 text-muted-foreground" />}
    </Button>
  )
}
