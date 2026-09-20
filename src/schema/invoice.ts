// Mirrors vendor-portal-api/app/schema/invoice.py (JSON is camelCase).
import type { InvoiceComment } from './invoiceComment'
import type { InvoiceDocument } from './invoiceDocument'

export type InvoiceStatus =
  'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected'

/** Form fields accepted by POST/PATCH /invoices. Everything is optional until submit. */
export interface InvoiceInput {
  vendorName?: string | null
  invoiceType?: string | null
  invoiceNo?: string | null
  invoiceDate?: string | null
  description?: string | null
  poPrNo?: string | null
  drNo?: string | null
  dateReceived?: string | null
  creditTerms?: string | null
  invoiceAmount?: number | null
  vatableSales?: number | null
  vat?: number | null
  nonVat?: number | null
}

export interface InvoiceListQuery {
  search?: string
  status?: InvoiceStatus | ''
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

/** InvoiceListItemSchema. Drafts may have most fields empty. */
export interface InvoiceListItem {
  id: string
  referenceNo: string | null
  invoiceNo: string | null
  invoiceType: string | null
  invoiceDate: string | null
  poPrNo: string | null
  drNo: string | null
  description: string | null
  vendorName: string | null
  creditTerms: string | null
  dateReceived: string | null
  invoiceAmount: number | null
  vatableSales: number | null
  vat: number | null
  nonVat: number | null
  status: InvoiceStatus
  submittedOn: string | null
  /** Index into STAGES of the stage in progress; STAGES.length once paid, -1 for drafts. */
  currentStage: number
  /** Start time (ISO) of each stage reached so far, aligned with STAGES. */
  stageTimes: string[]
  commentCount: number
  createdAt: string
  updatedAt: string
}

/** InvoiceSchema: the full record with documents and comments. */
export interface Invoice extends InvoiceListItem {
  documents: InvoiceDocument[]
  comments: InvoiceComment[]
}

export interface InvoicePage {
  items: InvoiceListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface InvoiceStatusSummary {
  status: InvoiceStatus
  count: number
  totalAmount: number
}

export interface InvoiceSummary {
  total: number
  byStatus: InvoiceStatusSummary[]
}

export type StageState = 'done' | 'current' | 'rejected' | 'pending'

export interface StageView {
  label: string
  state: StageState
  time: string | null
  note: string
}

export interface StatusInfo {
  message: string
  nextStep: string
  nextStepDetail: string
  estimatedTime: string | null
}

export interface InvoiceTimeline {
  status: InvoiceStatus
  statusInfo: StatusInfo
  stages: StageView[]
}
