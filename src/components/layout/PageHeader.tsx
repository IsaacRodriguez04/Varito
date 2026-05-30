import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  className?: string
  action?: React.ReactNode
}

export function PageHeader({ title, subtitle, className, action }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 pt-6 pb-4',
        className
      )}
    >
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </header>
  )
}
