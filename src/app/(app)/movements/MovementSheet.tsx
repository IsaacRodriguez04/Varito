'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createMovement, updateMovement } from './actions'
import { todayISO } from '@/lib/date-utils'
import type { Account, Category, Movement, MovementType } from '@/types/app.types'
import { cn } from '@/lib/utils'

const MSI_OPTIONS = [1, 3, 6, 9, 12, 18, 24]

const TYPES: { value: MovementType; label: string; icon: string }[] = [
  { value: 'expense',  label: 'Gasto',          icon: '💸' },
  { value: 'income',   label: 'Ingreso',         icon: '💰' },
  { value: 'saving',   label: 'Ahorro',          icon: '🏦' },
  { value: 'transfer', label: 'Transferencia',   icon: '🔄' },
]

interface MovementSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  categories: Category[]
  movement?: Movement
}

export function MovementSheet({
  open, onOpenChange, accounts, categories, movement,
}: MovementSheetProps) {
  const isEdit = !!movement
  const [isPending, startTransition] = useTransition()

  const [type, setType] = useState<MovementType>(movement?.type ?? 'expense')
  const [date, setDate] = useState(movement?.date ?? todayISO())
  const [description, setDescription] = useState(movement?.description ?? '')
  const [amount, setAmount] = useState(movement?.amount?.toString() ?? '')
  const [categoryId, setCategoryId] = useState(movement?.category_id ?? '')
  const [accountId, setAccountId] = useState(movement?.account_id ?? '')
  const [destAccountId, setDestAccountId] = useState(movement?.destination_account_id ?? '')
  const [installments, setInstallments] = useState<number>(movement?.installments ?? 1)
  const [customInstallments, setCustomInstallments] = useState(
    movement?.installments && !MSI_OPTIONS.includes(movement.installments)
      ? String(movement.installments)
      : ''
  )
  const [notes, setNotes] = useState(movement?.notes ?? '')

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const isCredit = selectedAccount?.type === 'credit'
  const needsAccount = type === 'expense' || type === 'transfer'
  const needsDest = type === 'transfer'
  const needsMSI = type === 'expense' && isCredit

  function handleTypeChange(t: MovementType) {
    setType(t)
    if (t !== 'expense') { setInstallments(1); setCustomInstallments('') }
    if (t === 'income' || t === 'saving') setAccountId('')
  }

  function handleAccountChange(id: string | null) {
    const safeId = id ?? ''
    setAccountId(safeId)
    const acc = accounts.find((a) => a.id === safeId)
    if (acc?.type !== 'credit') { setInstallments(1); setCustomInstallments('') }
  }

  function resetForm() {
    setType('expense'); setDate(todayISO()); setDescription(''); setAmount('')
    setCategoryId(''); setAccountId(''); setDestAccountId('')
    setInstallments(1); setCustomInstallments(''); setNotes('')
  }

  function handleOpenChange(v: boolean) {
    if (!v && !isEdit) resetForm()
    onOpenChange(v)
  }

  function validate() {
    if (!description.trim()) { toast.error('Agrega una descripción'); return false }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast.error('Monto inválido'); return false
    }
    if (!categoryId) { toast.error('Selecciona una categoría'); return false }
    if (needsAccount && !accountId) { toast.error('Selecciona una cuenta'); return false }
    return true
  }

  function buildPayload() {
    return {
      date,
      description: description.trim(),
      type,
      category_id: categoryId,
      account_id: needsAccount ? accountId || null : null,
      destination_account_id: needsDest ? destAccountId || null : null,
      amount: parseFloat(amount),
      installments: needsMSI ? installments : 1,
      notes: notes.trim() || null,
    }
  }

  function submit(andNew = false) {
    if (!validate()) return
    startTransition(async () => {
      try {
        const payload = buildPayload()
        if (isEdit) {
          await updateMovement(movement.id, payload)
          toast.success('Movimiento actualizado')
          onOpenChange(false)
        } else {
          await createMovement(payload)
          toast.success('Movimiento guardado')
          if (andNew) {
            resetForm()
          } else {
            onOpenChange(false)
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[96svh] overflow-y-auto rounded-t-2xl px-4">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-6">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-colors',
                  type === t.value
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="text-xl">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Date + Amount row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={todayISO()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Monto (MXN)</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input
              placeholder={type === 'expense' ? 'Ej. Súper, Netflix, Gasolina' : 'Ej. Quincena'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId(v ?? '')}
              items={categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account (expense / transfer) */}
          {needsAccount && (
            <div className="space-y-1.5">
              <Label>{type === 'transfer' ? 'Cuenta origen' : 'Cuenta'}</Label>
              <Select
                value={accountId}
                onValueChange={handleAccountChange}
                items={accounts.filter((a) => a.is_active).map((a) => ({ value: a.id, label: `${a.name}${a.bank ? ` · ${a.bank}` : ''}` }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.is_active).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{a.bank ? ` · ${a.bank}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* MSI chips (credit expenses only) */}
          {needsMSI && (
            <div className="space-y-2">
              <Label>Plazo</Label>
              <div className="flex flex-wrap gap-2">
                {MSI_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setInstallments(m); setCustomInstallments('') }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                      installments === m && !customInstallments
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {m === 1 ? 'Contado' : `${m} MSI`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Otro plazo…"
                  value={customInstallments}
                  onChange={(e) => {
                    const raw = e.target.value
                    setCustomInstallments(raw)
                    const num = parseInt(raw, 10)
                    if (!isNaN(num) && num >= 1) setInstallments(num)
                    if (raw === '') setInstallments(1)
                  }}
                  className="w-36"
                />
                {customInstallments && <span className="text-sm text-muted-foreground">meses sin intereses</span>}
              </div>
            </div>
          )}

          {/* Destination account (transfer) */}
          {needsDest && (
            <div className="space-y-1.5">
              <Label>Cuenta destino <span className="text-muted-foreground">(opcional — vacío = tercero)</span></Label>
              <Select
                value={destAccountId}
                onValueChange={(v) => setDestAccountId(v ?? '')}
                items={[
                  { value: '', label: '— Tercero / externo —' },
                  ...accounts
                    .filter((a) => a.is_active && a.id !== accountId)
                    .map((a) => ({ value: a.id, label: `${a.name}${a.bank ? ` · ${a.bank}` : ''}` })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Transferencia a tercero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Tercero / externo —</SelectItem>
                  {accounts
                    .filter((a) => a.is_active && a.id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}{a.bank ? ` · ${a.bank}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input
              placeholder="Nota adicional…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => submit(true)}
              >
                Guardar y nuevo
              </Button>
            )}
            <Button
              type="button"
              className="flex-1"
              disabled={isPending}
              onClick={() => submit(false)}
            >
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
