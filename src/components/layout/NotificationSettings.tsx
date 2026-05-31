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

type Mode = 'init' | 'push' | 'ios-guide' | 'unsupported'

export function NotificationSettings() {
  const [mode, setMode] = useState<Mode>('init')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as unknown as { standalone?: boolean }).standalone

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setMode('push')
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      )
    } else if (isIOS && !isPWA) {
      setMode('ios-guide')
    } else {
      setMode('unsupported')
    }
  }, [])

  if (mode === 'init' || mode === 'unsupported') return null

  if (mode === 'ios-guide') {
    return (
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Notificaciones</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Para recibir avisos de tus pagos próximos, instala VARITO en tu pantalla de inicio:
        </p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Toca el botón compartir <strong className="text-foreground">⎙</strong> en la barra de Safari</li>
          <li>Selecciona <strong className="text-foreground">"Agregar a pantalla de inicio"</strong></li>
          <li>Abre la app instalada y activa las notificaciones aquí</li>
        </ol>
      </section>
    )
  }

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
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {subscribed
            ? <Bell className="h-4 w-4 text-primary shrink-0" />
            : <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold">Notificaciones</p>
            <p className="text-xs text-muted-foreground">
              {subscribed
                ? 'Recibes avisos 3 días antes de cada pago'
                : 'Activa para recibir avisos de pagos próximos'}
            </p>
          </div>
        </div>
        <Button
          variant={subscribed ? 'outline' : 'default'}
          size="sm"
          onClick={toggle}
          disabled={loading}
          className="shrink-0"
        >
          {subscribed ? 'Desactivar' : 'Activar'}
        </Button>
      </div>
    </section>
  )
}
