import type { MSIScheduleItem } from '@/types/app.types'
import { addMonths, lastDayOfMonth, setDate } from 'date-fns'

function resolvedCutDate(year: number, month: number, cutDay: number): Date {
  const lastDay = lastDayOfMonth(new Date(year, month - 1, 1)).getDate()
  const day = Math.min(cutDay, lastDay)
  return new Date(year, month - 1, day)
}

function addMonthsPreserving(date: Date, months: number): Date {
  const result = addMonths(date, months)
  const lastDay = lastDayOfMonth(result).getDate()
  if (date.getDate() > lastDay) {
    return setDate(result, lastDay)
  }
  return result
}

export function calculateFirstDueDate(
  purchaseDate: Date,
  cutDay: number,
  daysTodue: number
): Date {
  const pYear = purchaseDate.getFullYear()
  const pMonth = purchaseDate.getMonth() + 1
  const pDay = purchaseDate.getDate()

  let cutDate: Date

  if (pDay < cutDay) {
    cutDate = resolvedCutDate(pYear, pMonth, cutDay)
  } else {
    const nextMonth = pMonth === 12 ? 1 : pMonth + 1
    const nextYear = pMonth === 12 ? pYear + 1 : pYear
    cutDate = resolvedCutDate(nextYear, nextMonth, cutDay)
  }

  const dueDate = new Date(cutDate)
  dueDate.setDate(dueDate.getDate() + daysTodue)
  return dueDate
}

export function buildInstallmentSchedule(
  purchaseDate: Date,
  amount: number,
  installments: number,
  cutDay: number,
  daysTodue: number
): MSIScheduleItem[] {
  const firstDue = calculateFirstDueDate(purchaseDate, cutDay, daysTodue)
  const baseAmount = Math.floor((amount / installments) * 100) / 100
  const remainder = Math.round((amount - baseAmount * installments) * 100) / 100

  return Array.from({ length: installments }, (_, i) => {
    const dueDate = addMonthsPreserving(firstDue, i)
    const installmentAmount = i === 0 ? baseAmount + remainder : baseAmount
    return {
      installment_number: i + 1,
      due_date: dueDate.toISOString().split('T')[0],
      amount: installmentAmount,
    }
  })
}

export function formatDueDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
