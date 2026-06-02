'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { AccountSheet } from './AccountSheet'
import { deleteAccount } from './actions'
import { formatMXN } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { Account, AccountType } from '@/types/app.types'

const TYPE_LABELS: Record<AccountType, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Efectivo',
}

const TYPE_ICONS: Record<AccountType, string> = {
  credit: '💳',
  debit: '🏦',
  cash: '💵',
}

const GROUPS: { type: AccountType; label: string }[] = [
  { type: 'credit', label: 'Tarjetas de crédito' },
  { type: 'debit', label: 'Cuentas de débito' },
  { type: 'cash', label: 'Efectivo' },
]

interface AccountsClientProps {
  accounts: Account[]
  balanceMap: Record<string, number>
  creditDebtMap: Record<string, number>
}

export function AccountsClient({ accounts, balanceMap, creditDebtMap }: AccountsClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | undefined>()
  const [deletingAccount, setDeletingAccount] = useState<Account | undefined>()
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingAccount(undefined)
    setSheetOpen(true)
  }

  function openEdit(account: Account) {
    setEditingAccount(account)
    setSheetOpen(true)
  }

  function handleDelete() {
    if (!deletingAccount) return
    startTransition(async () => {
      try {
        await deleteAccount(deletingAccount.id)
        toast.success('Cuenta eliminada')
        setDeletingAccount(undefined)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
        setDeletingAccount(undefined)
      }
    })
  }

  return (
    <>
      <div className="px-4 pb-4 flex justify-end">
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {GROUPS.map(({ type, label }) => {
          const group = accounts.filter((a) => a.type === type)
          if (group.length === 0) return null
          return (
            <section key={type}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {label}
              </h2>
              <div className="space-y-2">
                {group.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    balance={balanceMap[account.id]}
                    creditDebt={creditDebtMap[account.id]}
                    onEdit={() => openEdit(account)}
                    onDelete={() => setDeletingAccount(account)}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {accounts.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">💳</div>
            <p className="font-medium">Sin cuentas aún</p>
            <p className="text-sm">Agrega tu primera tarjeta o cuenta</p>
          </div>
        )}
      </div>

      <AccountSheet
        key={editingAccount?.id ?? 'new'}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        account={editingAccount}
      />

      <Dialog
        open={!!deletingAccount}
        onOpenChange={(o) => !o && setDeletingAccount(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deletingAccount?.name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingAccount(undefined)}>
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

function AccountCard({
  account,
  balance,
  creditDebt,
  onEdit,
  onDelete,
}: {
  account: Account
  balance?: number
  creditDebt?: number
  onEdit: () => void
  onDelete: () => void
}) {
  const isCredit = account.type === 'credit'
  const debt = creditDebt ?? 0
  const availableCredit = account.credit_limit ? account.credit_limit - debt : null
  const usedPct =
    account.credit_limit && account.credit_limit > 0
      ? Math.min(Math.round((debt / account.credit_limit) * 100), 100)
      : null

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-xl"
          style={{ backgroundColor: account.color + '22', border: `2px solid ${account.color}` }}
        >
          {TYPE_ICONS[account.type]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{account.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{TYPE_LABELS[account.type]}</span>
            {account.bank && <><span>·</span><span>{account.bank}</span></>}
            {isCredit && account.cut_day && (
              <><span>·</span><span>Corte día {account.cut_day}</span></>
            )}
          </div>
        </div>

        {/* Balance / debt badge */}
        <div className="text-right flex-shrink-0">
          {!isCredit && balance !== undefined && (
            <p className={cn('text-sm font-bold tabular-nums', balance >= 0 ? 'text-green-600' : 'text-red-500')}>
              {formatMXN(balance)}
            </p>
          )}
          {isCredit && debt > 0 && (
            <p className="text-sm font-bold tabular-nums text-red-500">
              −{formatMXN(debt)}
            </p>
          )}
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Credit utilization bar */}
      {isCredit && account.credit_limit && usedPct !== null && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>
              Disponible:{' '}
              <span className="font-medium text-foreground">
                {formatMXN(availableCredit ?? 0)}
              </span>
            </span>
            <span>Límite: {formatMXN(account.credit_limit)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-yellow-500' : 'bg-primary'
              )}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
