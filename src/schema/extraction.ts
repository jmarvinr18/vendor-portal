// Mirrors vendor-portal-api/app/schema/extraction.py.

export type ExtractionStatus = 'pending' | 'completed' | 'failed'

/** Invoice form fields an extracted value can be tagged as (keys match the form). */
export type ExtractableField =
  | 'vendorName'
  | 'invoiceType'
  | 'invoiceNo'
  | 'invoiceDate'
  | 'description'
  | 'poPrNo'
  | 'drNo'
  | 'dateReceived'
  | 'creditTerms'
  | 'invoiceAmount'
  | 'vatableSales'
  | 'vat'
  | 'nonVat'

export interface ExtractionEntity {
  type: string
  text: string
  score: number | null
}

/** A value found by OCR, with the form field it most likely belongs to. */
export interface ExtractionCandidate {
  id: string
  value: string
  /** The label it was found next to (e.g. "TOTAL:") or the entity type (e.g. "DATE"). */
  source: string
  entityType: string | null
  score: number | null
  suggestedField: ExtractableField | null
}

export interface Extraction {
  id: string
  status: ExtractionStatus
  fileName: string
  extension: string
  contentType: string
  size: number
  text: string | null
  entities: ExtractionEntity[] | null
  candidates: ExtractionCandidate[]
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}
