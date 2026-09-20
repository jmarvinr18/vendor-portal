// vendor-portal-api: app/routes/invoices.py
import ApiService, { apiPath } from '../../ApiService'
import type {
  Invoice,
  InvoiceInput,
  InvoiceListQuery,
  InvoicePage,
  InvoiceSummary,
  InvoiceTimeline,
} from '@/schema'

export default {
  /** GET /invoices — filtered, paginated list (newest invoice date first). */
  list(query: InvoiceListQuery, signal?: AbortSignal) {
    return ApiService.query<InvoicePage>('invoices', { params: { ...query }, signal })
  },

  /** GET /invoices/summary — counts and totals per status. */
  summary(signal?: AbortSignal) {
    return ApiService.get<InvoiceSummary>('invoices/summary', { signal })
  },

  /** POST /invoices — create a draft. */
  create(data: InvoiceInput) {
    return ApiService.post<Invoice>('invoices', data)
  },

  /** GET /invoices/{id} — full record with documents and comments. */
  get(id: string, signal?: AbortSignal) {
    return ApiService.get<Invoice>(apiPath('invoices', id), { signal })
  },

  /** PATCH /invoices/{id} — update a draft. */
  update(id: string, data: InvoiceInput) {
    return ApiService.patch<Invoice>(apiPath('invoices', id), data)
  },

  /** DELETE /invoices/{id} — discard a draft and its files. */
  remove(id: string) {
    return ApiService.delete(apiPath('invoices', id))
  },

  /** POST /invoices/{id}/submit — 422 carries per-field errors, 409 a duplicate / non-draft. */
  submit(id: string) {
    return ApiService.post<Invoice>(apiPath('invoices', id, 'submit'))
  },

  /** GET /invoices/{id}/timeline — status message, next step and stage progress. */
  timeline(id: string, signal?: AbortSignal) {
    return ApiService.get<InvoiceTimeline>(apiPath('invoices', id, 'timeline'), { signal })
  },
}
