// vendor-portal-api: app/routes/invoice_documents.py
import ApiService, { apiPath } from '../../ApiService'
import type { DocumentType, InvoiceDocument } from '@/schema'

// Uploads can be up to 10 x 10MB, so allow more time than a normal request.
const FILE_TIMEOUT_MS = 5 * 60_000

export default {
  /** GET /invoices/{id}/documents */
  list(invoiceId: string, signal?: AbortSignal) {
    return ApiService.get<InvoiceDocument[]>(apiPath('invoices', invoiceId, 'documents'), {
      signal,
    })
  },

  /**
   * POST /invoices/{id}/documents (multipart `files`, optional `docType` in the same order).
   * The API validates every file first and saves none if one fails (422 with `errors.files`).
   */
  upload(invoiceId: string, files: File[], docTypes?: DocumentType[]) {
    const form = new FormData()
    // The API pairs docType parts with files by position, so send one per file (blank =
    // guess from the file name) whenever any type is given.
    const sendTypes = docTypes?.some(Boolean) ?? false
    files.forEach((file, i) => {
      form.append('files', file, file.name)
      if (sendTypes) form.append('docType', docTypes?.[i] ?? '')
    })
    return ApiService.post<InvoiceDocument[]>(apiPath('invoices', invoiceId, 'documents'), form, {
      timeoutMs: FILE_TIMEOUT_MS,
    })
  },

  /** DELETE /invoices/{id}/documents/{docId} */
  remove(invoiceId: string, documentId: string) {
    return ApiService.delete(apiPath('invoices', invoiceId, 'documents', documentId))
  },

  /** GET /invoices/{id}/documents/{docId}/file — the file contents as a Blob. */
  file(invoiceId: string, documentId: string, download = false) {
    return ApiService.get<Blob>(apiPath('invoices', invoiceId, 'documents', documentId, 'file'), {
      params: { download },
      responseType: 'blob',
      timeoutMs: FILE_TIMEOUT_MS,
    })
  },
}
