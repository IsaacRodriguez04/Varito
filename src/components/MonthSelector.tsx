'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { prevMonth, nextMonth, formatMonthYear, currentYearMonth } from '@/lib/date-utils'

interface MonthSelectorProps {
  value: string
  allowFuture?: boolean
}

export function MonthSelector({ value, allowFuture = false }: MonthSelectorProps) {
  const router = useRouter()
  const [year, month] = value.split('-').map(Number)
  const label = formatMonthYear(new Date(year, month - 1, 1))
  const isCurrentMonth = value === currentYearMonth()

  function go(ym: string) {
    router.push(`?month=${ym}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(prevMonth(value))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-semibold capitalize">{label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => go(nextMonth(value))}
        disabled={!allowFuture && isCurrentMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
