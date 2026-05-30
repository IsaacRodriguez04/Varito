const formatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatMXN(amount: number): string {
  return formatter.format(amount)
}

export function formatMXNCompact(amount: number): string {
  return compactFormatter.format(amount)
}

export function parseMXN(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '')
  return parseFloat(cleaned) || 0
}
