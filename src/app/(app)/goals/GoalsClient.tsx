'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { GoalSheet } from './GoalSheet'
import { deleteGoal, toggleGoalCompleted } from './actions'
import { formatMXN } from '@/lib/currency'
import { formatFullDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { Goal } from '@/types/app.types'

interface GoalsClientProps {
  goals: Goal[]
}

export function GoalsClient({ goals }: GoalsClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>()
  const [deletingGoal, setDeletingGoal] = useState<Goal | undefined>()
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingGoal(undefined)
    setSheetOpen(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    setSheetOpen(true)
  }

  function handleDelete() {
    if (!deletingGoal) return
    startTransition(async () => {
      try {
        await deleteGoal(deletingGoal.id)
        toast.success('Meta eliminada')
        setDeletingGoal(undefined)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
        setDeletingGoal(undefined)
      }
    })
  }

  function handleToggleCompleted(goal: Goal) {
    startTransition(async () => {
      try {
        await toggleGoalCompleted(goal.id, !goal.is_completed)
        toast.success(goal.is_completed ? 'Meta reactivada' : '¡Meta completada! 🎉')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar')
      }
    })
  }

  const activeGoals = goals.filter((g) => !g.is_completed)
  const completedGoals = goals.filter((g) => g.is_completed)

  return (
    <>
      <div className="px-4 pb-4 flex justify-end">
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva meta
        </Button>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {activeGoals.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              En progreso
            </h2>
            <div className="space-y-3">
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => setDeletingGoal(goal)}
                  onToggleCompleted={() => handleToggleCompleted(goal)}
                />
              ))}
            </div>
          </section>
        )}

        {completedGoals.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Completadas
            </h2>
            <div className="space-y-3">
              {completedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => setDeletingGoal(goal)}
                  onToggleCompleted={() => handleToggleCompleted(goal)}
                />
              ))}
            </div>
          </section>
        )}

        {goals.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">🎯</div>
            <p className="font-medium">Sin metas aún</p>
            <p className="text-sm mt-1">Crea tu primera meta de ahorro</p>
          </div>
        )}
      </div>

      <GoalSheet
        key={editingGoal?.id ?? 'new'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        goal={editingGoal}
      />

      <Dialog open={!!deletingGoal} onOpenChange={(o) => !o && setDeletingGoal(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar meta</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deletingGoal?.name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingGoal(undefined)}>
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

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onToggleCompleted,
}: {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
  onToggleCompleted: () => void
}) {
  const pct =
    goal.target_amount > 0
      ? Math.min(Math.round((goal.saved_amount / goal.target_amount) * 100), 100)
      : 0
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0)

  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', goal.is_completed && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-xl"
          style={{ backgroundColor: goal.color + '22', border: `2px solid ${goal.color}` }}
        >
          {goal.icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{goal.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm font-medium tabular-nums" style={{ color: goal.color }}>
              {formatMXN(goal.saved_amount)}
            </span>
            <span className="text-xs text-muted-foreground">de {formatMXN(goal.target_amount)}</span>
            <span className="text-xs font-semibold text-muted-foreground ml-auto">{pct}%</span>
          </div>
        </div>

        <div className="flex gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCompleted}
            title={goal.is_completed ? 'Reactivar meta' : 'Marcar como completada'}
          >
            {goal.is_completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: goal.color }}
        />
      </div>

      {/* Details row */}
      {(remaining > 0 || goal.target_date || goal.notes) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {!goal.is_completed && remaining > 0 && (
            <span>Faltan {formatMXN(remaining)}</span>
          )}
          {goal.target_date && (
            <span>· Fecha: {formatFullDate(goal.target_date)}</span>
          )}
          {goal.notes && <span className="truncate">· {goal.notes}</span>}
        </div>
      )}
    </div>
  )
}
