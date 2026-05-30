'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MonthSelector } from '@/components/MonthSelector'
import { toggleInstallmentPaid } from './actions'
import { formatMXN, formatMXNCompact } from '@/lib/currency'
import { formatFullDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { InstallmentDetail } from './page'

const DAY_HEADERS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

const GRID_7 = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' } as const

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface CalendarClientProps {
  installments: InstallmentDetail[]
  selectedMonth: string
}

export function CalendarClient({ installments, selectedMonth }: CalendarClientProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [year, month] = selectedMonth.split('-').map(Number)
  const today = new Date().toISOString().split('T')[0]
  const calendarDays = buildCalendarDays(year, month)

  // Group by date
  const byDate = new Map<string, InstallmentDetail[]>()
  for (const inst of installments) {
    const list = byDate.get(inst.due_date) ?? []
    list.push(inst)
    byDate.set(inst.due_date, list)
  }

  const totalPending = installments.filter((i) => !i.is_paid).reduce((s, i) => s + i.amount, 0)
  const totalPaid    = installments.filter((i) =>  i.is_paid).reduce((s, i) => s + i.amount, 0)
  const displayed    = selectedDate ? (byDate.get(selectedDate) ?? []) : installments

  function handleToggle(id: string, currentPaid: boolean) {
    startTransition(async () => {
      try {
        await toggleInstallmentPaid(id, !currentPaid)
        toast.success(currentPaid ? 'Marcado como pendiente' : 'Marcado como pagado')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <>
      {/* Month nav — allowFuture because MSI payments are in upcoming months */}
      <div className="px-4 pb-3">
        <MonthSelector value={selectedMonth} allowFuture />
      </div>

      {/* Summary */}
      {installments.length > 0 && (
        <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-red-50 p-3">
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="font-bold text-red-600">{formatMXN(totalPending)}</p>
          </div>
          <div className="rounded-xl border bg-green-50 p-3">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-bold text-green-700">{formatMXN(totalPaid)}</p>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="mx-4 mb-4 rounded-xl border overflow-hidden">
        {/* Weekday headers */}
        <div style={GRID_7} className="border-b bg-muted/40">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={GRID_7}>
          {calendarDays.map((day, idx) => {
            if (!day) {
              return (
                <div
                  key={`e-${idx}`}
                  className="border-b border-r bg-muted/20"
                  style={{ minHeight: '3.5rem' }}
                />
              )
            }

            const dateStr   = toDateStr(year, month, day)
            const dayInsts  = byDate.get(dateStr) ?? []
            const hasInsts  = dayInsts.length > 0
            const allPaid   = hasInsts && dayInsts.every((i) => i.is_paid)
            const isToday   = dateStr === today
            const isSelected = dateStr === selectedDate
            const colors    = [...new Set(dayInsts.map((i) => i.movement.account.color))].slice(0, 3)
            const dayTotal  = dayInsts.reduce((s, i) => s + i.amount, 0)

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => hasInsts && setSelectedDate(isSelected ? null : dateStr)}
                className={cn(
                  'flex flex-col items-center justify-start pt-1.5 pb-1 border-b border-r transition-colors',
                  isSelected ? 'bg-primary/10' : hasInsts ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default bg-background'
                )}
                style={{ minHeight: '3.5rem' }}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && isSelected && 'font-bold text-primary'
                  )}
                >
                  {day}
                </span>

                {hasInsts && (
                  <div className="flex gap-0.5 mt-0.5">
                    {colors.map((color, i) => (
                      <span
                        key={i}
                        className="block rounded-full"
                        style={{ width: '6px', height: '6px', backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}

                {hasInsts && (
                  <span
                    className={cn(
                      'text-[9px] font-semibold leading-tight mt-0.5',
                      allPaid ? 'text-green-600' : 'text-red-500'
                    )}
                  >
                    {formatMXNCompact(dayTotal)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Installment list */}
      <div className="px-4 pb-6 space-y-2">
        {installments.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">🗓️</div>
            <p className="font-medium">Sin pagos este mes</p>
            <p className="text-sm mt-1">
              Los vencimientos de MSI aparecen aquí según la fecha de corte de tu tarjeta
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {selectedDate
                ? formatFullDate(selectedDate)
                : `Todos los pagos · ${installments.length} cuota${installments.length !== 1 ? 's' : ''}`}
            </h3>
            {displayed.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin pagos este día</p>
            )}
            {displayed.map((inst) => (
              <InstallmentRow
                key={inst.id}
                installment={inst}
                onToggle={() => handleToggle(inst.id, inst.is_paid)}
                isPending={isPending}
              />
            ))}
          </>
        )}
      </div>
    </>
  )
}

function InstallmentRow({
  installment,
  onToggle,
  isPending,
}: {
  installment: InstallmentDetail
  onToggle: () => void
  isPending: boolean
}) {
  const acc = installment.movement.account
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5',
        installment.is_paid && 'opacity-60'
      )}
    >
      {/* Account color stripe */}
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: acc.color, minHeight: '2rem' }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{installment.movement.description}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <span className="truncate">{acc.name}{acc.bank ? ` · ${acc.bank}` : ''}</span>
          <span>·</span>
          <span className="whitespace-nowrap">cuota {installment.installment_number}</span>
          {installment.is_paid && (
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
              Pagado
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <span className="text-sm font-semibold tabular-nums flex-shrink-0">
        {formatMXN(installment.amount)}
      </span>

      {/* Paid toggle */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          'h-7 w-7 flex-shrink-0 transition-colors',
          installment.is_paid
            ? 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:border-green-600'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={onToggle}
        disabled={isPending}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
