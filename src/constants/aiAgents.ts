import type { AiAgent } from '@/schema'

/**
 * The AI agents proposed for AP invoice processing and submission. The API's GET /ai/agents
 * is the source of truth once it exists; this catalogue is shown until then.
 *
 * Every agent is read-only on the vendor's own data: it can look things up and draft text,
 * but submitting, editing or commenting always stays a button the vendor presses.
 */
export const AI_AGENTS: AiAgent[] = [
  {
    id: 'submission-assistant',
    name: 'Invoice Submission Assistant',
    description:
      'Helps you prepare an invoice before you submit it: checks that every required field is filled in, the VAT breakdown adds up, and the right supporting documents are attached.',
    icon: 'bi-file-earmark-check',
    status: 'available',
    capabilities: [
      'Explain each invoice field and what AP expects in it',
      'Check Vatable Sales + VAT + Non-Vat against the invoice amount',
      'List missing supporting documents (Invoice, PO/PR, DR)',
      'Warn about invoice numbers you have already submitted',
    ],
    dataAccess: ['Your draft invoices', 'Reference data (invoice types, credit terms, VAT rate)'],
    starterPrompts: [
      'What documents do I need to submit an invoice?',
      'How is VAT computed on a PHP 125,000.00 invoice?',
      'Check my latest draft before I submit it.',
    ],
  },
  {
    id: 'status-tracker',
    name: 'Invoice Status Tracker',
    description:
      'Answers “where is my invoice?”: current stage, what happens next, how long it usually takes, and what AP said in the comments.',
    icon: 'bi-clock-history',
    status: 'available',
    capabilities: [
      'Look up any of your invoices by invoice, PO/PR or reference number',
      'Explain the current stage and the estimated time to the next one',
      'Summarise AP comments and the activity log',
      'List invoices that have been waiting unusually long',
    ],
    dataAccess: ['Your invoices, status timeline and comments'],
    starterPrompts: [
      'Where is invoice INV-2026-0524?',
      'Which of my invoices are still under review?',
      'Summarise what AP said about my rejected invoices.',
    ],
  },
  {
    id: 'document-checker',
    name: 'Document Compliance Checker',
    description:
      'Reviews supporting documents against AP and BIR requirements before submission so invoices aren’t rejected for missing or mismatched paperwork.',
    icon: 'bi-shield-check',
    status: 'preview',
    capabilities: [
      'Check that the invoice shows TIN, BIR Authority to Print and serial number',
      'Match invoice, PO/PR and delivery receipt numbers and amounts',
      'Flag unreadable scans and documents from the wrong period',
      'Spot possible duplicates of invoices already on file',
    ],
    dataAccess: ['Documents you attach to a draft', 'OCR text of scanned invoices'],
    starterPrompts: [
      'What must a BIR-compliant sales invoice show?',
      'Does my delivery receipt match the invoice amount?',
      'Why would AP reject a scanned invoice?',
    ],
  },
  {
    id: 'payment-assistant',
    name: 'Payment & Remittance Assistant',
    description:
      'Explains when and how much you will be paid: due dates from credit terms, scheduled payments, withholding tax and remittance details.',
    icon: 'bi-cash-coin',
    status: 'preview',
    capabilities: [
      'Estimate payment dates from invoice date and credit terms',
      'List invoices scheduled for payment or already paid',
      'Explain expanded withholding tax and BIR Form 2307 deductions',
      'Reconcile a payment against the invoices it covers',
    ],
    dataAccess: ['Your approved and paid invoices', 'Payment schedule and remittance records'],
    starterPrompts: [
      'When will my approved invoices be paid?',
      'Why is my payment lower than the invoice amount?',
      'Which invoices were covered by the last payment?',
    ],
  },
  {
    id: 'discrepancy-resolver',
    name: 'Rejection & Discrepancy Resolver',
    description:
      'Helps you fix rejected or held invoices: explains the reason in plain language, lists what to correct, and drafts your reply to AP.',
    icon: 'bi-arrow-repeat',
    status: 'preview',
    capabilities: [
      'Explain why an invoice was rejected, from AP’s comments',
      'List the corrections needed before resubmitting',
      'Draft a reply to AP for you to review and post',
      'Compare a corrected invoice with the rejected one',
    ],
    dataAccess: ['Your rejected invoices and their comments'],
    starterPrompts: [
      'Why was INV-2026-0519 rejected?',
      'What do I need to change before resubmitting?',
      'Draft a reply to AP about the amount mismatch.',
    ],
  },
  {
    id: 'ap-help',
    name: 'AP Policy & Help Desk',
    description:
      'Answers questions about Accounts Payable policies: submission cut-offs, accepted formats, vendor accreditation and who to contact.',
    icon: 'bi-question-circle',
    status: 'available',
    capabilities: [
      'Answer questions from the AP vendor guidelines',
      'Explain submission cut-offs and processing times',
      'Guide you through updating vendor or bank details',
      'Point you to the right AP contact',
    ],
    dataAccess: ['Published AP policies and FAQs (no account data)'],
    starterPrompts: [
      'What is the monthly cut-off for invoice submission?',
      'Which file formats can I upload?',
      'How do I update my bank account details?',
    ],
  },
]
