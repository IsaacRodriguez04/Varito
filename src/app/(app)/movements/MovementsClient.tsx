'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { MovementSheet } from './MovementSheet'
import { MonthSelector } from '@/components/MonthSelector'
import { deleteMovement } from './actions'
import { formatMXN } from '@/lib/currency'
import { formatShortDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { Account, Category, Movement, MovementType } from '@/types/app.types'

const TYPE_COLOR: Record<MovementType, string> = {
  expense:  'text-red-500',
  income:   'text-green-600',
  saving:   'text-teal-600',
  transfer: 'text-muted-foreground',
}

const TYPE_SIGN: Record<MovementType, string> = {
  expense:  '−',
  income:   '+',
  saving:   '−',
  transfer: '±',
}

const TYPE_ICON: Record<MovementType, string> = {
  expense:  '💸',
  income:   '💰',
  saving:   '🏦',
  transfer: '🔄',
}

function groupByDate(movements: Movement[]): { date: string; items: Movement[] }[] {
  const map = new Map<string, Movement[]>()
  for (const m of movements) {
    const list = map.get(m.date) ?? []
    list.push(m)
    map.set(m.date, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
}

function dateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'
  return formatShortDate(dateStr)
}

interface MovementsClientProps {
  movements: Movement[]
  accounts: Account[]
  categories: Category[]
  selectedMonth: string
}

export function MovementsClient({
  movements, accounts, categories, selectedMonth,
}: MovementsClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | undefined>()
  const [deletingMovement, setDeletingMovement] = useState<Movement | undefined>()
  const [isPending, startTransition] = useTransition()

  const groups = groupByDate(movements)

  function openCreate() {
    setEditingMovement(undefined)
    setSheetOpen(true)
  }

  function openEdit(m: Movement) {
    setEditingMovement(m)
    setSheetOpen(true)
  }

  function handleDelete() {
    if (!deletingMovement) return
    startTransition(async () => {
      try {
        await deleteMovement(deletingMovement.id)
        toast.success('Movimiento eliminado')
        setDeletingMovement(undefined)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
        setDeletingMovement(undefined)
      }
    })
  }

  return (
    <>
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 pb-3">
        <MonthSelector value={selectedMonth} />
      </div>

      {/* Summary bar */}
      {movements.length > 0 && (
        <MovementsSummary movements={movements} />
      )}

      {/* Grouped list */}
      <div className="px-4 space-y-5 pb-4">
        {groups.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">Sin movimientos</p>
            <p className="text-sm">Toca + para agregar el primero</p>
          </div>
        )}

        {groups.map(({ date, items }) => (
          <section key={date}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {dateLabel(date)}
            </h3>
            <div className="space-y-1.5">
              {items.map((m) => (
                <MovementRow
                  key={m.id}
                  movement={m}
                  onEdit={() => openEdit(m)}
                  onDelete={() => setDeletingMovement(m)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={openCreate}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label="Nuevo movimiento"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add / Edit sheet */}
      <MovementSheet
        key={editingMovement?.id ?? 'new'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accounts={accounts}
        categories={categories}
        movement={editingMovement}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deletingMovement} onOpenChange={(o) => !o && setDeletingMovement(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deletingMovement?.description}</strong>?
              Si tiene cuotas pendientes, también se eliminarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingMovement(undefined)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MovementsSummary({ movements }: { movements: Movement[] }) {
  const income = movements
    .filter((m) => m.type === 'income')
    .reduce((s, m) => s + m.amount, 0)
  const expenses = movements
    .filter((m) => m.type === 'expense' || m.type === 'saving')
    .reduce((s, m) => s + m.amount, 0)

  return (
    <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
      <div className="rounded-xl border bg-green-50 p-3">
        <p className="text-xs text-muted-foreground">Ingresos</p>
        <p className="font-bold text-green-700">{formatMXN(income)}</p>
      </div>
      <div className="rounded-xl border bg-red-50 p-3">
        <p className="text-xs text-muted-foreground">Gastos</p>
        <p className="font-bold text-red-600">{formatMXN(expenses)}</p>
      </div>
    </div>
  )
}

function MovementRow({
  movement, onEdit, onDelete,
}: {
  movement: Movement
  onEdit: () => void
  onDelete: () => void
}) {
  const cat = movement.category as Category | undefined
  const account = movement.account as Account | undefined
  const isMSI = movement.type === 'expense' && movement.installments > 1

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      {/* Icon */}
      <div
        className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-lg"
        style={cat ? { backgroundColor: cat.color + '22' } : undefined}
      >
        {cat?.icon ?? TYPE_ICON[movement.type]}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{movement.description}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {cat && <span>{cat.name}</span>}
          {account && <><span>·</span><span>{account.name}</span></>}
          {isMSI && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {movement.installments} MSI
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <span className={cn('text-sm font-semibold tabular-nums', TYPE_COLOR[movement.type])}>
        {TYPE_SIGN[movement.type]}{formatMXN(movement.amount)}
      </span>

      {/* Actions */}
      <div className="flex gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
