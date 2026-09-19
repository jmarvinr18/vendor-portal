// vendor-portal-api: app/routes/invoice_comments.py
import ApiService, { apiPath } from '../../ApiService'
import type { InvoiceComment, InvoiceCommentInput } from '@/schema'

export default {
  /** GET /invoices/{id}/comments — oldest first. */
  list(invoiceId: string, signal?: AbortSignal) {
    return ApiService.get<InvoiceComment[]>(apiPath('invoices', invoiceId, 'comments'), {
      signal,
    })
  },

  /** POST /invoices/{id}/comments — posted as the vendor. */
  create(invoiceId: string, data: InvoiceCommentInput) {
    return ApiService.post<InvoiceComment>(apiPath('invoices', invoiceId, 'comments'), data)
  },
}
