// Mirrors vendor-portal-api/app/schema/invoice_document.py.

export type DocumentType = 'Invoice' | 'Purchase Order' | 'Delivery Receipt' | 'Other'

export interface InvoiceDocument {
  id: string
  name: string
  docType: DocumentType
  uploadedOn: string
  size: number
  extension: string
  contentType: string | null
  /** False when only the record exists (e.g. demo data) and there is nothing to download. */
  hasFile: boolean
}
