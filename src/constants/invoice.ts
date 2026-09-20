// Mirrors vendor-portal-api/app/constants.py. The API is the source of truth for the lists
// (GET /reference-data); these copies are used for display logic and as offline fallbacks.
import type { InvoiceListItem, InvoiceStatus, StageState, StageView, StatusInfo } from '@/schema'

export const INVOICE_STATUSES: InvoiceStatus[] = [
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

export const STATUS_INFO: Record<InvoiceStatus, StatusInfo> = {
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

const STAGE_COPY: Record<(typeof STAGES)[number], { done: string; current: string }> = {
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

/**
 * Per-stage state, same rules as stage_views() in the API. Used where only a list item is
 * loaded (the overview's mini timeline); the Status Timeline page uses GET /timeline.
 */
export function stagesFor(
  invoice: Pick<InvoiceListItem, 'currentStage' | 'status' | 'stageTimes'>,
): StageView[] {
  return STAGES.map((label, i) => {
    let state: StageState = 'pending'
    if (i < invoice.currentStage) state = 'done'
    else if (i === invoice.currentStage)
      state = invoice.status === 'Rejected' ? 'rejected' : 'current'
    const note =
      state === 'done'
        ? STAGE_COPY[label].done
        : state === 'current'
          ? STAGE_COPY[label].current
          : state === 'rejected'
            ? 'Invoice rejected by business unit.'
            : 'Pending'
    return { label, state, time: invoice.stageTimes[i] ?? null, note }
  })
}
