'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, BarChart2, Target, CreditCard, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Inicio',      Icon: LayoutDashboard },
  { href: '/movements', label: 'Movimientos', Icon: List },
  { href: '/reports',   label: 'Reportes',    Icon: BarChart2 },
  { href: '/goals',     label: 'Metas',       Icon: Target },
  { href: '/accounts',  label: 'Cuentas',     Icon: CreditCard },
  { href: '/settings',  label: 'Perfil',      Icon: UserCircle },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <div className="flex h-16 items-center justify-around px-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[9px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon
                className={cn('h-5 w-5', active && 'text-primary')}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
