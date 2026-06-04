'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MonthSelector } from '@/components/MonthSelector'
import { toggleInstallmentPaid, payInstallments } from './actions'
import { formatMXN, formatMXNCompact } from '@/lib/currency'
import { formatFullDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { Account } from '@/types/app.types'
import type { InstallmentDetail } from './page'

const DAY_HEADERS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

const GRID_7 = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' } as const

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface PayState {
  ids: string[]
  totalAmount: number
  creditAccountId: string
  cardName: string
}

interface CalendarClientProps {
  installments: InstallmentDetail[]
  selectedMonth: string
  debitAccounts: Pick<Account, 'id' | 'name' | 'bank' | 'color' | 'type' | 'initial_balance'>[]
  balanceMap: Record<string, number>
}

export function CalendarClient({ installments, selectedMonth, debitAccounts, balanceMap }: CalendarClientProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [paySheet, setPaySheet] = useState<PayState | null>(null)

  const [year, month] = selectedMonth.split('-').map(Number)
  const today = new Date().toISOString().split('T')[0]
  const calendarDays = buildCalendarDays(year, month)

  const byDate = new Map<string, InstallmentDetail[]>()
  for (const inst of installments) {
    const list = byDate.get(inst.due_date) ?? []
    list.push(inst)
    byDate.set(inst.due_date, list)
  }

  const totalPending = installments.filter((i) => !i.is_paid).reduce((s, i) => s + i.amount, 0)
  const totalPaid    = installments.filter((i) =>  i.is_paid).reduce((s, i) => s + i.amount, 0)
  const displayed    = selectedDate ? (byDate.get(selectedDate) ?? []) : installments

  // Group displayed list by date for "pay group" buttons
  const groupedDisplayed = useMemo(() => {
    const map = new Map<string, InstallmentDetail[]>()
    for (const inst of displayed) {
      const list = map.get(inst.due_date) ?? []
      list.push(inst)
      map.set(inst.due_date, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [displayed])

  function openPaySheet(insts: InstallmentDetail[]) {
    setPaySheet({
      ids: insts.map((i) => i.id),
      totalAmount: insts.reduce((s, i) => s + i.amount, 0),
      creditAccountId: insts[0].movement.account.id,
      cardName: insts[0].movement.account.name,
    })
  }

  function handleToggle(inst: InstallmentDetail) {
    if (inst.is_paid) {
      // Unmark: direct, no dialog
      startTransition(async () => {
        try {
          await toggleInstallmentPaid(inst.id, false)
          toast.success('Marcado como pendiente')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Error')
        }
      })
    } else if (debitAccounts.length > 0) {
      openPaySheet([inst])
    } else {
      startTransition(async () => {
        try {
          await toggleInstallmentPaid(inst.id, true)
          toast.success('Marcado como pagado')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Error')
        }
      })
    }
  }

  function handleGroupPay(insts: InstallmentDetail[]) {
    const unpaid = insts.filter((i) => !i.is_paid)
    if (unpaid.length === 0) return
    if (debitAccounts.length > 0) {
      openPaySheet(unpaid)
    } else {
      startTransition(async () => {
        try {
          await payInstallments(unpaid.map((i) => i.id), null, unpaid[0].movement.account.id, unpaid.reduce((s, i) => s + i.amount, 0), unpaid[0].movement.account.name)
          toast.success('Cuotas marcadas como pagadas')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Error')
        }
      })
    }
  }

  function handleConfirmPay(sourceAccountId: string | null) {
    if (!paySheet) return
    startTransition(async () => {
      try {
        await payInstallments(
          paySheet.ids,
          sourceAccountId,
          paySheet.creditAccountId,
          paySheet.totalAmount,
          paySheet.cardName
        )
        toast.success(sourceAccountId ? 'Pago registrado' : 'Cuotas marcadas como pagadas')
        setPaySheet(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <>
      <div className="px-4 pb-3">
        <MonthSelector value={selectedMonth} allowFuture />
      </div>

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
        <div style={GRID_7} className="border-b bg-muted/40">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

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

      {/* Installment list grouped by date */}
      <div className="px-4 pb-6 space-y-4">
        {installments.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">🗓️</div>
            <p className="font-medium">Sin pagos este mes</p>
            <p className="text-sm mt-1">
              Los vencimientos de MSI aparecen aquí según la fecha de corte de tu tarjeta
            </p>
          </div>
        ) : (
          groupedDisplayed.map(([date, insts]) => {
            const unpaid = insts.filter((i) => !i.is_paid)
            const allSameCard = unpaid.length > 1 &&
              new Set(unpaid.map((i) => i.movement.account.id)).size === 1

            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatFullDate(date)}
                  </h3>
                  {allSameCard && (
                    <button
                      className="text-xs text-primary font-medium disabled:opacity-50"
                      disabled={isPending}
                      onClick={() => handleGroupPay(insts)}
                    >
                      Pagar todo · {formatMXN(unpaid.reduce((s, i) => s + i.amount, 0))}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {insts.map((inst) => (
                    <InstallmentRow
                      key={inst.id}
                      installment={inst}
                      onToggle={() => handleToggle(inst)}
                      isPending={isPending}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pay dialog */}
      {paySheet && (
        <PayDialog
          state={paySheet}
          debitAccounts={debitAccounts}
          balanceMap={balanceMap}
          isPending={isPending}
          onClose={() => setPaySheet(null)}
          onConfirm={handleConfirmPay}
        />
      )}
    </>
  )
}

function PayDialog({
  state,
  debitAccounts,
  balanceMap,
  isPending,
  onClose,
  onConfirm,
}: {
  state: PayState
  debitAccounts: Pick<Account, 'id' | 'name' | 'bank' | 'color' | 'type' | 'initial_balance'>[]
  balanceMap: Record<string, number>
  isPending: boolean
  onClose: () => void
  onConfirm: (sourceAccountId: string | null) => void
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('')

  const selectedBalance = selectedAccountId ? (balanceMap[selectedAccountId] ?? 0) : null
  const insufficient = selectedBalance !== null && selectedBalance < state.totalAmount

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state.ids.length > 1 ? `Pagar ${state.ids.length} cuotas` : 'Pagar cuota'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-xl border bg-muted/40 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{state.cardName}</span>
            <span className="font-bold tabular-nums">{formatMXN(state.totalAmount)}</span>
          </div>

          <div className="space-y-1.5">
            <Label>Pagar desde</Label>
            <Select
              value={selectedAccountId}
              onValueChange={(v) => setSelectedAccountId(v ?? '')}
              items={[
                { value: '', label: 'Sin cuenta (solo marcar pagado)' },
                ...debitAccounts.map((a) => {
                  const bal = balanceMap[a.id] ?? 0
                  const hasEnough = bal >= state.totalAmount
                  return {
                    value: a.id,
                    label: `${a.name}${a.bank ? ` · ${a.bank}` : ''} — ${formatMXN(bal)}${!hasEnough ? ' ✕' : ''}`,
                  }
                }),
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin cuenta (solo marcar pagado)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin cuenta (solo marcar pagado)</SelectItem>
                {debitAccounts.map((a) => {
                  const bal = balanceMap[a.id] ?? 0
                  const hasEnough = bal >= state.totalAmount
                  return (
                    <SelectItem key={a.id} value={a.id} disabled={!hasEnough}>
                      <span className={cn(!hasEnough && 'text-muted-foreground')}>
                        {a.name}{a.bank ? ` · ${a.bank}` : ''}
                        <span className="ml-1.5 tabular-nums text-xs">
                          {formatMXN(bal)}
                        </span>
                        {!hasEnough && <span className="ml-1 text-destructive text-xs">· Saldo insuficiente</span>}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {insufficient && (
              <p className="text-xs text-destructive">
                Saldo disponible {formatMXN(selectedBalance!)} — faltan {formatMXN(state.totalAmount - selectedBalance!)} para completar el pago.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            disabled={isPending || insufficient}
            onClick={() => onConfirm(selectedAccountId || null)}
          >
            {isPending ? 'Guardando…' : 'Confirmar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: acc.color, minHeight: '2rem' }}
      />

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

      <span className="text-sm font-semibold tabular-nums flex-shrink-0">
        {formatMXN(installment.amount)}
      </span>

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
