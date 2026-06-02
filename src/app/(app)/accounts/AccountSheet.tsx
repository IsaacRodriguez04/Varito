'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { createAccount, updateAccount } from './actions'
import type { Account, AccountType } from '@/types/app.types'

interface AccountSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account
}

const DEFAULT_COLOR = '#6366f1'

export function AccountSheet({ open, onOpenChange, account }: AccountSheetProps) {
  const isEdit = !!account
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(account?.name ?? '')
  const [bank, setBank] = useState(account?.bank ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'credit')
  const [color, setColor] = useState(account?.color ?? DEFAULT_COLOR)
  const [creditLimit, setCreditLimit] = useState(account?.credit_limit?.toString() ?? '')
  const [cutDay, setCutDay] = useState(account?.cut_day?.toString() ?? '')
  const [daysToDue, setDaysToDue] = useState(account?.days_to_due?.toString() ?? '')
  const [initialBalance, setInitialBalance] = useState(
    account?.initial_balance != null && account.initial_balance !== 0
      ? account.initial_balance.toString()
      : ''
  )

  const isCredit = type === 'credit'

  function resetForm() {
    setName(''); setBank(''); setType('credit'); setColor(DEFAULT_COLOR)
    setCreditLimit(''); setCutDay(''); setDaysToDue(''); setInitialBalance('')
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isEdit) resetForm()
    onOpenChange(open)
  }

  function handleTypeChange(val: AccountType) {
    setType(val)
    if (val !== 'credit') {
      setCreditLimit(''); setCutDay(''); setDaysToDue('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('El nombre es requerido')
    if (isCredit && (!cutDay || !daysToDue)) {
      return toast.error('El día de corte y días al límite son requeridos para tarjetas de crédito')
    }

    const payload = {
      name: name.trim(),
      bank: bank.trim() || null,
      type,
      color,
      credit_limit: isCredit && creditLimit ? parseFloat(creditLimit) : null,
      cut_day: isCredit && cutDay ? parseInt(cutDay) : null,
      days_to_due: isCredit && daysToDue ? parseInt(daysToDue) : null,
      initial_balance: !isCredit && initialBalance ? parseFloat(initialBalance) : 0,
    }

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateAccount(account.id, payload)
          toast.success('Cuenta actualizada')
        } else {
          await createAccount(payload)
          toast.success('Cuenta creada')
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
          <SheetTitle>{isEdit ? 'Editar cuenta' : 'Nueva cuenta'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => handleTypeChange(v as AccountType)}
              items={[
                { value: 'credit', label: '💳 Tarjeta de crédito' },
                { value: 'debit', label: '🏦 Débito / cuenta bancaria' },
                { value: 'cash', label: '💵 Efectivo' },
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">💳 Tarjeta de crédito</SelectItem>
                <SelectItem value="debit">🏦 Débito / cuenta bancaria</SelectItem>
                <SelectItem value="cash">💵 Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCredit ? 'BBVA Azul' : type === 'debit' ? 'Nómina HSBC' : 'Cartera'}
              required
            />
          </div>

          {type !== 'cash' && (
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="BBVA, HSBC, Banorte…"
              />
            </div>
          )}

          {isCredit && (
            <>
              <div className="space-y-2">
                <Label>Límite de crédito (MXN)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="20000"
                  min="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Día de corte *</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={cutDay}
                    onChange={(e) => setCutDay(e.target.value)}
                    placeholder="11"
                    min="1"
                    max="31"
                    required={isCredit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Días al límite *</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={daysToDue}
                    onChange={(e) => setDaysToDue(e.target.value)}
                    placeholder="20"
                    min="1"
                    required={isCredit}
                  />
                </div>
              </div>
            </>
          )}

          {!isCredit && (
            <div className="space-y-2">
              <Label>Saldo inicial (MXN)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          )}

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
