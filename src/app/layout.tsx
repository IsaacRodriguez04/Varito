import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'VARITO',
  description: 'Controla tus gastos, tarjetas y pagos MSI',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VARITO',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={geist.variable}>
      <body className="bg-background text-foreground min-h-svh antialiased">
        {children}
        <ServiceWorkerRegistration />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
