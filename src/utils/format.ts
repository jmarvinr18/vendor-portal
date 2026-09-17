const numberFormat = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '' : numberFormat.format(value)
}

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? '—' : `PHP ${numberFormat.format(value)}`
}

/** Formats a `YYYY-MM-DD` string as e.g. "May 20, 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date): string {
  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
