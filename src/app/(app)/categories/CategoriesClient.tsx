'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { CategorySheet } from './CategorySheet'
import { deleteCategory } from './actions'
import type { Category } from '@/types/app.types'

interface CategoriesClientProps {
  categories: Category[]
}

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>()
  const [deletingCategory, setDeletingCategory] = useState<Category | undefined>()
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingCategory(undefined)
    setSheetOpen(true)
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat)
    setSheetOpen(true)
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
                  onEdit={() => openEdit(cat)}
                  onDelete={() => setDeletingCategory(cat)}
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
                  onEdit={() => openEdit(cat)}
                  onDelete={undefined}
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

      {/* Add/Edit sheet — key fuerza remount al cambiar categoría */}
      <CategorySheet
        key={editingCategory?.id ?? 'new'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        category={editingCategory}
      />

      {/* Delete confirmation */}
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
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: () => void
  onDelete?: () => void
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

      {/* Name */}
      <span className="flex-1 font-medium">{category.name}</span>

      {/* Actions */}
      <div className="flex gap-1">
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
    </div>
  )
}
