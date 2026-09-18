import { currentVendor } from '@/config/brand'
import { roundMoney } from '@/utils/format'

export type InvoiceStatus =
  'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected'

export const invoiceStatuses: InvoiceStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Paid',
  'Rejected',
]

export const STAGES = [
  'Submitted',
  'AP Validation',
  'Business Approval',
  'Ariba Processing',
  'S/4HANA Transfer',
  'Payment Scheduled',
  'Paid',
] as const

export type DocumentType = 'Invoice' | 'Purchase Order' | 'Delivery Receipt' | 'Other'

export interface InvoiceDocument {
  id: string
  name: string
  docType: DocumentType
  uploadedOn: string
  size: number
  extension: string
}

export type CommentAuthor = 'AP Team' | 'Vendor'

export interface InvoiceComment {
  id: string
  author: CommentAuthor
  message: string
  postedOn: string
}

export interface InvoiceRecord {
  id: string
  invoiceNo: string
  invoiceType: string
  invoiceDate: string
  poPrNo: string
  drNo: string
  description: string
  vendorName: string
  creditTerms: string
  dateReceived: string
  invoiceAmount: number
  vatableSales: number
  vat: number
  nonVat: number
  status: InvoiceStatus
  submittedOn: string | null
  /** Index into STAGES of the stage in progress; STAGES.length once paid, -1 for drafts. */
  currentStage: number
  /** Start time (ISO) of each stage reached so far, aligned with STAGES. */
  stageTimes: string[]
  documents: InvoiceDocument[]
  comments: InvoiceComment[]
}

/** Which stage each status sits at. Rejected invoices stop at Business Approval. */
export const stageForStatus: Record<InvoiceStatus, number> = {
  Draft: -1,
  Submitted: 1,
  'Under Review': 2,
  Approved: 3,
  Rejected: 2,
  Paid: STAGES.length,
}

// Hours after submission at which each stage starts (mock data only).
const STAGE_OFFSETS_HOURS = [0, 25 / 60, 26, 50, 52, 75, 240]

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

type Seed = [
  no: string,
  date: string,
  po: string,
  description: string,
  amount: number,
  status: InvoiceStatus,
]

const seeds: Seed[] = [
  ['0524', '2026-05-20', '0158', 'Office supplies and stationery - May 2026', 125000, 'Submitted'],
  ['0523', '2026-05-17', '0145', 'IT accessories - May 2026', 98750, 'Under Review'],
  ['0522', '2026-05-14', '0130', 'Office furniture - May 2026', 250000, 'Approved'],
  ['0521', '2026-05-10', '0127', 'Printing services - Apr 2026', 75300, 'Paid'],
  ['0520', '2026-05-05', '0108', 'Maintenance services - Apr 2026', 120000, 'Paid'],
  ['0519', '2026-04-30', '0099', 'Consulting services - Apr 2026', 180000, 'Rejected'],
  ['0518', '2026-04-28', '0098', 'Software license renewal - Apr 2026', 89000, 'Draft'],
  ['0517', '2026-04-25', '0096', 'Janitorial services - Apr 2026', 64500, 'Paid'],
  ['0516', '2026-04-22', '0093', 'Courier services - Apr 2026', 18750, 'Paid'],
  ['0515', '2026-04-18', '0090', 'Printer toner cartridges - Apr 2026', 42300, 'Paid'],
  ['0514', '2026-04-15', '0087', 'Network cabling works - Apr 2026', 156000, 'Paid'],
  ['0513', '2026-04-11', '0084', 'Pantry supplies - Apr 2026', 22480, 'Paid'],
  ['0512', '2026-04-08', '0081', 'Security guard services - Mar 2026', 210000, 'Paid'],
  ['0511', '2026-04-03', '0078', 'Laptop repair services - Mar 2026', 35600, 'Rejected'],
  ['0510', '2026-03-30', '0075', 'Office chairs - Mar 2026', 97500, 'Paid'],
  ['0509', '2026-03-26', '0072', 'Aircon maintenance - Mar 2026', 48000, 'Paid'],
  ['0508', '2026-03-21', '0069', 'Event venue rental - Mar 2026', 185000, 'Paid'],
  ['0507', '2026-03-17', '0066', 'Stationery restock - Mar 2026', 15920, 'Paid'],
  ['0506', '2026-03-12', '0063', 'Cloud hosting - Feb 2026', 132750, 'Paid'],
  ['0505', '2026-03-06', '0060', 'Team building catering - Feb 2026', 58400, 'Paid'],
  ['0504', '2026-03-02', '0057', 'Pest control services - Feb 2026', 12500, 'Paid'],
  ['0503', '2026-02-25', '0054', 'Signage printing - Feb 2026', 27300, 'Paid'],
  ['0502', '2026-02-19', '0051', 'Water dispenser rental - Feb 2026', 9800, 'Paid'],
  ['0501', '2026-02-12', '0048', 'Training services - Jan 2026', 145000, 'Paid'],
]

function buildSeedInvoice([no, date, po, description, amount, status]: Seed, index: number) {
  const invoiceNo = `INV-2026-${no}`
  const drNo = `DR-2026-${String(487 - index * 7).padStart(4, '0')}`
  const vatableSales = roundMoney(amount / 1.12)
  const submittedOn = status === 'Draft' ? null : new Date(`${date}T14:45:00`).toISOString()
  const currentStage = stageForStatus[status]
  const reached = Math.min(currentStage + 1, STAGES.length)
  const stageTimes = submittedOn
    ? STAGE_OFFSETS_HOURS.slice(0, reached).map((h) => addHours(submittedOn, h))
    : []

  const uploadedOn = submittedOn ?? new Date(`${date}T10:00:00`).toISOString()
  const documents: InvoiceDocument[] = [
    { name: `Invoice_2026-${no}.pdf`, docType: 'Invoice' as const, size: 245 * 1024 },
    { name: `PO-2026-${po}.pdf`, docType: 'Purchase Order' as const, size: 198 * 1024 },
    { name: `${drNo}.pdf`, docType: 'Delivery Receipt' as const, size: 176 * 1024 },
  ].map((doc, i) => ({ ...doc, id: `${invoiceNo}-doc-${i}`, uploadedOn, extension: 'pdf' }))

  const comments: InvoiceComment[] = []
  if (submittedOn) {
    if (no === '0524') {
      comments.push({
        id: `${invoiceNo}-c0`,
        author: 'Vendor',
        message: 'Please let us know if you need additional documents.',
        postedOn: addHours(submittedOn, 3 / 60),
      })
    }
    comments.push({
      id: `${invoiceNo}-c1`,
      author: 'AP Team',
      message: 'Invoice received and is now under AP validation.',
      postedOn: stageTimes[1] ?? submittedOn,
    })
    if (status === 'Rejected') {
      comments.push({
        id: `${invoiceNo}-c2`,
        author: 'AP Team',
        message:
          'Invoice rejected: the invoice amount does not match the approved PO amount. Please coordinate with your requestor and resubmit.',
        postedOn: addHours(stageTimes[2]!, 4),
      })
    }
    if (status === 'Paid') {
      comments.push({
        id: `${invoiceNo}-c3`,
        author: 'AP Team',
        message: 'Payment has been released. Please allow 1 - 2 banking days for crediting.',
        postedOn: stageTimes[STAGES.length - 1]!,
      })
    }
  }

  return {
    id: invoiceNo,
    invoiceNo,
    invoiceType: 'Standard Invoice',
    invoiceDate: date,
    poPrNo: `PO-2026-${po}`,
    drNo,
    description,
    vendorName: currentVendor.name,
    creditTerms: '30 Days Net',
    dateReceived: date,
    invoiceAmount: amount,
    vatableSales,
    vat: roundMoney(amount - vatableSales),
    nonVat: 0,
    status,
    submittedOn,
    currentStage,
    stageTimes,
    documents,
    comments,
  } satisfies InvoiceRecord
}

export function seedInvoices(): InvoiceRecord[] {
  return seeds.map(buildSeedInvoice)
}

// ---------- Status copy ----------

export interface StatusInfo {
  message: string
  nextStep: string
  nextStepDetail: string
  estimatedTime: string | null
}

export const statusInfo: Record<InvoiceStatus, StatusInfo> = {
  Draft: {
    message: 'This invoice has not been submitted yet.',
    nextStep: 'Submit Invoice',
    nextStepDetail: 'Complete the invoice details and submit it for AP validation.',
    estimatedTime: null,
  },
  Submitted: {
    message: 'Your invoice has been submitted and is now with AP for validation.',
    nextStep: 'AP Validation',
    nextStepDetail: 'The AP team is reviewing your invoice for accuracy and completeness.',
    estimatedTime: '1 - 2 Business Days',
  },
  'Under Review': {
    message: 'Your invoice passed AP validation and is awaiting business approval.',
    nextStep: 'Business Approval',
    nextStepDetail: 'The requesting business unit is reviewing and approving your invoice.',
    estimatedTime: '2 - 3 Business Days',
  },
  Approved: {
    message: 'Your invoice has been approved and is being processed for payment.',
    nextStep: 'Ariba Processing',
    nextStepDetail: 'Your invoice is being processed in the procurement system.',
    estimatedTime: '1 - 2 Business Days',
  },
  Paid: {
    message: 'Payment has been released for this invoice.',
    nextStep: 'Completed',
    nextStepDetail: 'No further action is required.',
    estimatedTime: null,
  },
  Rejected: {
    message: 'Your invoice was rejected during business approval. Please see the comments.',
    nextStep: 'Resubmit Invoice',
    nextStepDetail: 'Review the comments, correct the issue and submit a new invoice.',
    estimatedTime: null,
  },
}

type StageCopy = { done: string; current: string }

export const stageCopy: Record<(typeof STAGES)[number], StageCopy> = {
  Submitted: { done: 'Invoice submitted by vendor.', current: 'Invoice submitted by vendor.' },
  'AP Validation': {
    done: 'Invoice validated by AP team.',
    current: 'Invoice is under validation by AP team.',
  },
  'Business Approval': {
    done: 'Invoice approved by business unit.',
    current: 'Awaiting approval from business unit.',
  },
  'Ariba Processing': {
    done: 'Invoice processed in Ariba.',
    current: 'Invoice is being processed in Ariba.',
  },
  'S/4HANA Transfer': {
    done: 'Invoice posted to S/4HANA.',
    current: 'Invoice is being transferred to S/4HANA.',
  },
  'Payment Scheduled': {
    done: 'Payment scheduled for release.',
    current: 'Payment is being scheduled.',
  },
  Paid: { done: 'Payment released to vendor.', current: 'Payment is being released.' },
}

export type StageState = 'done' | 'current' | 'rejected' | 'pending'

export interface StageView {
  label: (typeof STAGES)[number]
  state: StageState
  time: string | null
  note: string
}

export function stagesFor(invoice: InvoiceRecord): StageView[] {
  return STAGES.map((label, i) => {
    let state: StageState = 'pending'
    if (i < invoice.currentStage) state = 'done'
    else if (i === invoice.currentStage)
      state = invoice.status === 'Rejected' ? 'rejected' : 'current'
    const note =
      state === 'done'
        ? stageCopy[label].done
        : state === 'current'
          ? stageCopy[label].current
          : state === 'rejected'
            ? 'Invoice rejected by business unit.'
            : 'Pending'
    return { label, state, time: invoice.stageTimes[i] ?? null, note }
  })
}
