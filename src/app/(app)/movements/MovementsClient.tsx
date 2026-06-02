'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { MovementSheet } from './MovementSheet'
import { MonthSelector } from '@/components/MonthSelector'
import { deleteMovement, stopRecurring } from './actions'
import { formatMXN } from '@/lib/currency'
import { formatShortDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { Account, Category, Goal, Movement, MovementType } from '@/types/app.types'

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

const TYPE_LABEL: Record<MovementType, string> = {
  expense:  'Gasto',
  income:   'Ingreso',
  saving:   'Ahorro',
  transfer: 'Transfer',
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
  goals: Goal[]
  selectedMonth: string
  suggestions: Movement[]
}

export function MovementsClient({
  movements, accounts, categories, goals, selectedMonth, suggestions,
}: MovementsClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | undefined>()
  const [prefillData, setPrefillData] = useState<Partial<Movement> | undefined>()
  const [deletingMovement, setDeletingMovement] = useState<Movement | undefined>()
  const [isPending, startTransition] = useTransition()

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<MovementType | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')

  // Stopped suggestions (optimistic: removed from list immediately after stopping)
  const [stoppedIds, setStoppedIds] = useState<Set<string>>(new Set())
  const visibleSuggestions = suggestions.filter((s) => !stoppedIds.has(s.id))

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (searchQuery && !m.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (typeFilter !== 'all' && m.type !== typeFilter) return false
      if (categoryFilter && m.category_id !== categoryFilter) return false
      if (accountFilter && m.account_id !== accountFilter) return false
      return true
    })
  }, [movements, searchQuery, typeFilter, categoryFilter, accountFilter])

  const hasActiveFilter = searchQuery || typeFilter !== 'all' || categoryFilter || accountFilter
  const groups = groupByDate(filtered)

  function openCreate(prefill?: Partial<Movement>) {
    setEditingMovement(undefined)
    setPrefillData(prefill)
    setSheetOpen(true)
  }

  function openEdit(m: Movement) {
    setPrefillData(undefined)
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

  function clearFilters() {
    setSearchQuery('')
    setTypeFilter('all')
    setCategoryFilter('')
    setAccountFilter('')
  }

  return (
    <>
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 pb-3">
        <MonthSelector value={selectedMonth} />
      </div>

      {/* Recurring suggestions */}
      {visibleSuggestions.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
            ↻ Recurrentes sin agregar ({visibleSuggestions.length})
          </p>
          {visibleSuggestions.map((s) => {
            const cat = s.category as Category | undefined
            const acc = s.account as Account | undefined
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-base"
                  style={cat ? { backgroundColor: cat.color + '22' } : undefined}
                >
                  {cat?.icon ?? TYPE_ICON[s.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.description}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cat?.name}{acc ? ` · ${acc.name}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums flex-shrink-0">
                  {formatMXN(s.amount)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs flex-shrink-0"
                  onClick={() => openCreate({ ...s, date: undefined as unknown as string, id: undefined as unknown as string })}
                >
                  Agregar
                </Button>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
                  title="Detener recurrencia"
                  onClick={async () => {
                    setStoppedIds((prev) => new Set(prev).add(s.id))
                    try {
                      await stopRecurring(s.id)
                    } catch {
                      setStoppedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n })
                      toast.error('Error al detener recurrencia')
                    }
                  }}
                >
                  Detener
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Search & filters */}
      <div className="px-4 space-y-2 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por descripción…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type chips */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'expense', 'income', 'saving', 'transfer'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === t
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {t === 'all' ? 'Todos' : `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`}
            </button>
          ))}
        </div>

        {/* Category & account selects */}
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''}</option>
            ))}
          </select>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filtered.length} de {movements.length} movimientos
            </span>
            <button onClick={clearFilters} className="text-xs text-primary font-medium">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <MovementsSummary movements={filtered} />
      )}

      {/* Grouped list */}
      <div className="px-4 space-y-5 pb-4">
        {groups.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">{hasActiveFilter ? '🔍' : '📭'}</div>
            <p className="font-medium">{hasActiveFilter ? 'Sin resultados' : 'Sin movimientos'}</p>
            <p className="text-sm">
              {hasActiveFilter ? 'Prueba con otros filtros' : 'Toca + para agregar el primero'}
            </p>
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
        onClick={() => openCreate()}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label="Nuevo movimiento"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add / Edit sheet */}
      <MovementSheet
        key={editingMovement?.id ?? prefillData?.id ?? 'new'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        accounts={accounts}
        categories={categories}
        goals={goals}
        movement={editingMovement}
        prefill={prefillData}
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
          {movement.is_recurring && (
            <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
              ↻
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
