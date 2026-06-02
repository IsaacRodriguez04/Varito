'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Lock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { CategorySheet } from './CategorySheet'
import { deleteCategory } from './actions'
import { upsertBudget, deleteBudget } from '@/app/(app)/budgets/actions'
import { formatMXN } from '@/lib/currency'
import { formatMonthYear } from '@/lib/date-utils'
import type { Category, Budget } from '@/types/app.types'

interface CategoriesClientProps {
  categories: Category[]
  budgets: Budget[]
  currentMonth: string
}

export function CategoriesClient({ categories, budgets, currentMonth }: CategoriesClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>()
  const [deletingCategory, setDeletingCategory] = useState<Category | undefined>()
  const [isPending, startTransition] = useTransition()

  const [budgetingCat, setBudgetingCat] = useState<{ cat: Category; budget?: Budget } | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [isBudgetPending, startBudgetTransition] = useTransition()

  const budgetMap = new Map<string, Budget>(budgets.map((b) => [b.category_id, b]))

  const monthLabel = formatMonthYear(
    new Date(Number(currentMonth.split('-')[0]), Number(currentMonth.split('-')[1]) - 1, 1)
  )

  function openCreate() {
    setEditingCategory(undefined)
    setSheetOpen(true)
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat)
    setSheetOpen(true)
  }

  function openBudget(cat: Category) {
    const budget = budgetMap.get(cat.id)
    setBudgetingCat({ cat, budget })
    setBudgetInput(budget ? String(budget.amount) : '')
  }

  function handleDelete() {
    if (!deletingCategory) return
    startTransition(async () => {
      try {
        await deleteCategory(deletingCategory.id)
        toast.success('Categoría eliminada')
        setDeletingCategory(undefined)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
        setDeletingCategory(undefined)
      }
    })
  }

  function handleSaveBudget() {
    if (!budgetingCat) return
    const amount = parseFloat(budgetInput)
    if (isNaN(amount) || amount <= 0) { toast.error('Ingresa un monto válido'); return }
    startBudgetTransition(async () => {
      try {
        await upsertBudget(budgetingCat.cat.id, currentMonth, amount)
        toast.success('Presupuesto guardado')
        setBudgetingCat(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  function handleClearBudget() {
    if (!budgetingCat?.budget) return
    startBudgetTransition(async () => {
      try {
        await deleteBudget(budgetingCat.budget!.id)
        toast.success('Presupuesto eliminado')
        setBudgetingCat(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      }
    })
  }

  const systemCats = categories.filter((c) => c.is_system)
  const userCats = categories.filter((c) => !c.is_system)

  return (
    <>
      {/* Header action */}
      <div className="px-4 pb-4 flex justify-end">
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      <div className="px-4 space-y-6">
        {/* User categories */}
        {userCats.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Mis categorías
            </h2>
            <div className="space-y-2">
              {userCats.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  budget={budgetMap.get(cat.id)}
                  onEdit={() => openEdit(cat)}
                  onDelete={() => setDeletingCategory(cat)}
                  onBudget={() => openBudget(cat)}
                />
              ))}
            </div>
          </section>
        )}

        {/* System categories */}
        {systemCats.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Predeterminadas
            </h2>
            <div className="space-y-2">
              {systemCats.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  budget={budgetMap.get(cat.id)}
                  onEdit={() => openEdit(cat)}
                  onDelete={undefined}
                  onBudget={() => openBudget(cat)}
                />
              ))}
            </div>
          </section>
        )}

        {categories.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">🏷️</div>
            <p className="font-medium">Sin categorías</p>
            <p className="text-sm">Agrega tu primera categoría</p>
          </div>
        )}
      </div>

      {/* Add/Edit category sheet */}
      <CategorySheet
        key={editingCategory?.id ?? 'new'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={editingCategory}
      />

      {/* Budget dialog */}
      <Dialog open={!!budgetingCat} onOpenChange={(o) => !o && setBudgetingCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {budgetingCat?.cat.icon} {budgetingCat?.cat.name} — Presupuesto
            </DialogTitle>
            <DialogDescription>
              Límite de gasto para {monthLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Monto límite (MXN)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              min="0.01"
              step="0.01"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveBudget()}
            />
          </div>
          <DialogFooter className="gap-2">
            {budgetingCat?.budget && (
              <Button variant="outline" disabled={isBudgetPending} onClick={handleClearBudget}>
                Quitar límite
              </Button>
            )}
            <Button disabled={isBudgetPending} onClick={handleSaveBudget}>
              {isBudgetPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete category confirmation */}
      <Dialog
        open={!!deletingCategory}
        onOpenChange={(o) => !o && setDeletingCategory(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar categoría</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deletingCategory?.name}</strong>?{' '}
              Los movimientos con esta categoría quedarán sin categoría válida.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingCategory(undefined)}>
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

function CategoryRow({
  category, budget, onEdit, onDelete, onBudget,
}: {
  category: Category
  budget?: Budget
  onEdit: () => void
  onDelete?: () => void
  onBudget: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      {/* Icon chip */}
      <div
        className="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-xl"
        style={{ backgroundColor: category.color + '22', border: `2px solid ${category.color}` }}
      >
        {category.icon}
      </div>

      {/* Name + budget */}
      <div className="flex-1 min-w-0">
        <p className="font-medium">{category.name}</p>
        {budget && (
          <p className="text-xs text-muted-foreground">{formatMXN(budget.amount)} / mes</p>
        )}
      </div>

      {/* Budget button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBudget}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Establecer presupuesto"
      >
        <Wallet className="h-4 w-4" />
      </Button>

      {/* Edit/Delete */}
      <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
        <Pencil className="h-4 w-4" />
      </Button>
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <div className="h-8 w-8 flex items-center justify-center text-muted-foreground/40">
          <Lock className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
}
