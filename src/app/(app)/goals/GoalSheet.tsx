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
import { createGoal, updateGoal } from './actions'
import type { Goal } from '@/types/app.types'

interface GoalSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: Goal
}

const DEFAULT_ICON = '🎯'
const DEFAULT_COLOR = '#6366f1'

export function GoalSheet({ open, onOpenChange, goal }: GoalSheetProps) {
  const isEdit = !!goal
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? DEFAULT_ICON)
  const [color, setColor] = useState(goal?.color ?? DEFAULT_COLOR)
  const [targetAmount, setTargetAmount] = useState(goal?.target_amount?.toString() ?? '')
  const [savedAmount, setSavedAmount] = useState(goal?.saved_amount?.toString() ?? '0')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [notes, setNotes] = useState(goal?.notes ?? '')

  function resetForm() {
    setName('')
    setIcon(DEFAULT_ICON)
    setColor(DEFAULT_COLOR)
    setTargetAmount('')
    setSavedAmount('0')
    setTargetDate('')
    setNotes('')
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isEdit) resetForm()
    onOpenChange(open)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('El nombre es requerido')
    const target = parseFloat(targetAmount)
    if (isNaN(target) || target <= 0) return toast.error('Ingresa un monto objetivo válido')
    const saved = parseFloat(savedAmount) || 0

    const payload = {
      name: name.trim(),
      icon,
      color,
      target_amount: target,
      saved_amount: saved,
      target_date: targetDate || null,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateGoal(goal.id, payload)
          toast.success('Meta actualizada')
        } else {
          await createGoal(payload)
          toast.success('Meta creada')
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
          <SheetTitle>{isEdit ? 'Editar meta' : 'Nueva meta de ahorro'}</SheetTitle>
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
            <span className="font-medium">{name || 'Nombre de meta'}</span>
          </div>

          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Fondo de emergencia"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Meta (MXN) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="10000"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ya ahorrado (MXN)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fecha objetivo</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Para qué es esta meta..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
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
