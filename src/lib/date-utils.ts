import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: es })
}

export function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return format(new Date(year, month - 1, day), 'd MMM', { locale: es })
}

export function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return format(new Date(year, month - 1, day), "d 'de' MMMM yyyy", { locale: es })
}

export function toYearMonth(date: Date): string {
  return format(date, 'yyyy-MM')
}

export function monthStart(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  return `${year}-${month}-01`
}

export function monthEnd(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const last = endOfMonth(new Date(year, month - 1, 1))
  return format(last, 'yyyy-MM-dd')
}

export function prevMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return toYearMonth(subMonths(new Date(year, month - 1, 1), 1))
}

export function nextMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  return toYearMonth(addMonths(new Date(year, month - 1, 1), 1))
}

export function currentYearMonth(): string {
  return toYearMonth(new Date())
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
