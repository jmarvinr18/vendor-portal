// Mirrors vendor-portal-api/app/schema/reference_data.py and vendor.py.
import type { InvoiceStatus } from './invoice'
import type { DocumentType } from './invoiceDocument'
import type { ExtractableField } from './extraction'

export interface UploadRules {
  acceptedExtensions: string[]
  maxFileSize: number
  maxFiles: number
}

export interface ReferenceData {
  invoiceTypes: string[]
  creditTerms: string[]
  invoiceStatuses: InvoiceStatus[]
  stages: string[]
  documentTypes: DocumentType[]
  vatRate: number
  /** Invoice fields an OCR value can be tagged as, in form order. */
  extractableFields: { key: ExtractableField; label: string }[]
  upload: UploadRules
}

export interface Vendor {
  id: string
  name: string
  vendorCode: string
  email: string | null
}
