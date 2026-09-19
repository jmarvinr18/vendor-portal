import type { ExtractableField } from '@/schema'
import { roundMoney } from './format'

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Reads dates as they appear on scanned invoices: "September 19, 2026", "OCTOBER 26,2019",
 * "19 Sept 2026", "2026-09-19" and numeric "09/11/2024" (month first, as on PH invoices).
 */
export function parseDate(raw: string): string | null {
  const text = raw.trim().toLowerCase()
  let m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return isoDate(+m[1]!, +m[2]!, +m[3]!)

  m = text.match(/([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})/)
  if (m && MONTHS[m[1]!.slice(0, 3)]) return isoDate(+m[3]!, MONTHS[m[1]!.slice(0, 3)]!, +m[2]!)

  m = text.match(/(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})/)
  if (m && MONTHS[m[2]!.slice(0, 3)]) return isoDate(+m[3]!, MONTHS[m[2]!.slice(0, 3)]!, +m[1]!)

  m = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) return isoDate(+m[3]!, +m[1]!, +m[2]!)
  return null
}

/** "₱13,384.00", "PHP 1,234.5", "(1,000.00)" → a non-negative number, or null. */
export function parseAmount(raw: string): number | null {
  const match = raw.replace(/\s/g, '').match(/\d[\d,]*(\.\d+)?/)
  if (!match) return null
  const value = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(value) ? roundMoney(Math.abs(value)) : null
}

/** The option a scanned value refers to, e.g. "Payment due within 15 days" → "15 Days Net". */
export function matchCreditTerms(raw: string, options: string[]): string | null {
  const text = raw.toLowerCase()
  const exact = options.find((o) => o.toLowerCase() === text.trim())
  if (exact) return exact
  if (/\b(cash|c\.?o\.?d\.?)\b/.test(text)) {
    return options.find((o) => /cash/i.test(o)) ?? null
  }
  const days = text.match(/(\d+)\s*days?/)
  if (days) return options.find((o) => o.startsWith(`${Number(days[1])} Days`)) ?? null
  return null
}

export function matchOption(raw: string, options: string[]): string | null {
  const text = raw.trim().toLowerCase()
  return (
    options.find((o) => o.toLowerCase() === text) ??
    options.find((o) => text.includes(o.toLowerCase()) || o.toLowerCase().includes(text)) ??
    null
  )
}

export type FieldValue = string | number

export interface ParsedValue {
  value: FieldValue | null
  /** Why the text couldn't be used for the field. */
  problem?: string
}

const AMOUNT_FIELDS: ExtractableField[] = ['invoiceAmount', 'vatableSales', 'vat', 'nonVat']
const DATE_FIELDS: ExtractableField[] = ['invoiceDate', 'dateReceived']
const MAX_LENGTH: Partial<Record<ExtractableField, number>> = {
  vendorName: 255,
  invoiceNo: 50,
  poPrNo: 50,
  drNo: 50,
  description: 500,
}

/** Converts an extracted (and possibly edited) value into what the form field expects. */
export function parseForField(
  field: ExtractableField,
  raw: string,
  options: { invoiceTypes: string[]; creditTerms: string[] },
): ParsedValue {
  const text = raw.trim()
  if (!text) return { value: null, problem: 'is empty' }

  if (AMOUNT_FIELDS.includes(field)) {
    const value = parseAmount(text)
    return value === null ? { value, problem: `"${text}" is not an amount` } : { value }
  }
  if (DATE_FIELDS.includes(field)) {
    const value = parseDate(text)
    return value === null ? { value, problem: `"${text}" is not a date` } : { value }
  }
  if (field === 'creditTerms') {
    const value = matchCreditTerms(text, options.creditTerms)
    return value === null
      ? { value, problem: `"${text}" doesn't match any credit terms` }
      : { value }
  }
  if (field === 'invoiceType') {
    const value = matchOption(text, options.invoiceTypes)
    return value === null
      ? { value, problem: `"${text}" doesn't match any invoice type` }
      : { value }
  }
  const max = MAX_LENGTH[field]
  return { value: max ? text.slice(0, max) : text }
}
