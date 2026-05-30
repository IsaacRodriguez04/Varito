'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { createCategory, updateCategory } from './actions'
import type { Category } from '@/types/app.types'

interface CategorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category
}

const DEFAULT_ICON = '📦'
const DEFAULT_COLOR = '#6366f1'

export function CategorySheet({ open, onOpenChange, category }: CategorySheetProps) {
  const isEdit = !!category
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_ICON)
  const [color, setColor] = useState(category?.color ?? DEFAULT_COLOR)

  function resetForm() {
    setName(''); setIcon(DEFAULT_ICON); setColor(DEFAULT_COLOR)
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isEdit) resetForm()
    onOpenChange(open)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('El nombre es requerido')

    const payload = { name: name.trim(), icon, color }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateCategory(category.id, payload)
          toast.success('Categoría actualizada')
        } else {
          await createCategory(payload)
          toast.success('Categoría creada')
          resetForm()
        }
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[92svh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {isEdit ? 'Editar categoría' : 'Nueva categoría'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: color + '33' }}
            >
              {icon}
            </div>
            <span className="font-medium">{name || 'Nombre de categoría'}</span>
          </div>

          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Suscripciones"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Ícono</Label>
            <EmojiPicker value={icon} onChange={setIcon} />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <SheetFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
