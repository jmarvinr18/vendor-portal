import { ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '@/services/ApiService'
import DocumentApi from '@/services/api/invoice/document'
import InvoiceApi from '@/services/api/invoice/invoice'
import type { DocumentType, Invoice, InvoiceDocument, InvoiceInput } from '@/schema'
import { formatDate, formatIsoDateTime } from '@/utils/format'
import { useReferenceDataStore } from './referenceData'
import { useInvoiceScanStore } from './invoiceScan'

export interface InvoiceForm {
  vendorName: string
  invoiceType: string
  invoiceNo: string
  invoiceDate: string
  description: string
  poPrNo: string
  drNo: string
  dateReceived: string
  creditTerms: string
  invoiceAmount: number | null
  vatableSales: number | null
  vat: number | null
  nonVat: number | null
}

/**
 * A supporting document in the wizard: either a file picked in this browser and not yet sent
 * (`file`), or one already stored on a saved draft (`serverId`).
 */
export interface WizardDocument {
  id: string
  name: string
  size: number
  extension: string
  file?: File
  serverId?: string
  /** Sent with the upload; otherwise the API guesses it from the file name. */
  docType?: DocumentType
  /** The scanned invoice used to auto-fill the details. */
  fromScan?: boolean
}

export interface Submission {
  id: string
  invoiceNo: string
  invoiceDate: string
  submittedOn: string
  referenceNo: string
}

export type Step = 1 | 2 | 3

export type SubmitPhase = 'saving' | 'uploading' | 'submitting' | null

// Only the id of an explicitly saved draft is kept in the browser.
const DRAFT_ID_KEY = 'vendor-portal:draft-id'

const INVOICE_FIELDS = [
  'vendorName',
  'invoiceType',
  'invoiceNo',
  'invoiceDate',
  'description',
  'poPrNo',
  'drNo',
  'dateReceived',
  'creditTerms',
  'invoiceAmount',
  'vatableSales',
  'vat',
  'nonVat',
] as const

function readDraftId() {
  try {
    return localStorage.getItem(DRAFT_ID_KEY)
  } catch {
    return null
  }
}

function writeDraftId(id: string | null) {
  try {
    if (id) localStorage.setItem(DRAFT_ID_KEY, id)
    else localStorage.removeItem(DRAFT_ID_KEY)
  } catch {
    // Storage unavailable (private mode): the draft still exists on the server.
  }
}

function emptyForm(vendorName: string): InvoiceForm {
  return {
    vendorName,
    invoiceType: 'Standard Invoice',
    invoiceNo: '',
    invoiceDate: '',
    description: '',
    poPrNo: '',
    drNo: '',
    dateReceived: '',
    creditTerms: '30 Days Net',
    invoiceAmount: null,
    vatableSales: null,
    vat: 0,
    nonVat: 0,
  }
}

/** Blank strings are sent as null so the API's date / choice validators accept them. */
function toInput(form: InvoiceForm): InvoiceInput {
  const input: Record<string, unknown> = {}
  for (const key of INVOICE_FIELDS) {
    const value = form[key]
    input[key] = typeof value === 'string' ? value.trim() || null : value
  }
  return input as InvoiceInput
}

function fromInvoice(invoice: Invoice, vendorName: string): InvoiceForm {
  return {
    vendorName: invoice.vendorName ?? vendorName,
    invoiceType: invoice.invoiceType ?? '',
    invoiceNo: invoice.invoiceNo ?? '',
    invoiceDate: invoice.invoiceDate ?? '',
    description: invoice.description ?? '',
    poPrNo: invoice.poPrNo ?? '',
    drNo: invoice.drNo ?? '',
    dateReceived: invoice.dateReceived ?? '',
    creditTerms: invoice.creditTerms ?? '',
    invoiceAmount: invoice.invoiceAmount,
    vatableSales: invoice.vatableSales,
    vat: invoice.vat,
    nonVat: invoice.nonVat,
  }
}

function fromServerDocument(doc: InvoiceDocument): WizardDocument {
  return { id: doc.id, name: doc.name, size: doc.size, extension: doc.extension, serverId: doc.id }
}

/**
 * State for the Submit Invoice wizard.
 *
 * Nothing is written to the API while the vendor fills in and reviews the invoice: the form
 * and picked files stay in the browser until Review & Submit. Submitting then runs
 * create/update draft → remove/upload documents → submit, and deletes a draft it created if
 * any of those calls fails, so a failed submission leaves nothing behind.
 * "Save as Draft" and discarding a saved draft are the only other writes, and only happen
 * when the vendor clicks them.
 */
export const useInvoiceStore = defineStore('invoice', () => {
  const referenceData = useReferenceDataStore()

  /** Set only once the vendor has explicitly saved a draft (or opened an existing one). */
  const draftId = ref<string | null>(readDraftId())
  const form = ref<InvoiceForm>(emptyForm(referenceData.vendorName))
  const documents = ref<WizardDocument[]>([])
  /** Documents removed from a saved draft; deleted on the server at the next save/submit. */
  const removedServerIds = ref<string[]>([])
  const step = ref<Step>(1)
  const submission = ref<Submission | null>(null)
  /** Field errors returned by the API, keyed like the form (plus `documents`). */
  const serverErrors = ref<Record<string, string>>({})
  const saving = ref(false)
  const submitPhase = ref<SubmitPhase>(null)
  const loadingDraft = ref(false)

  function setDraftId(id: string | null) {
    draftId.value = id
    writeDraftId(id)
  }

  function reset() {
    useInvoiceScanStore().reset()
    setDraftId(null)
    form.value = emptyForm(referenceData.vendorName)
    documents.value = []
    removedServerIds.value = []
    serverErrors.value = {}
    step.value = 1
  }

  /** Loads a saved draft into the wizard (a read-only request). */
  async function resume(id: string | null = draftId.value) {
    if (!id) return
    loadingDraft.value = true
    try {
      const { data: invoice } = await InvoiceApi.get(id)
      if (invoice.status !== 'Draft') {
        if (id === draftId.value) reset()
        throw new ApiError(409, `Invoice ${invoice.invoiceNo ?? ''} is no longer a draft.`)
      }
      setDraftId(invoice.id)
      form.value = fromInvoice(invoice, referenceData.vendorName)
      documents.value = invoice.documents.map(fromServerDocument)
      removedServerIds.value = []
      serverErrors.value = {}
      step.value = 1
    } catch (error) {
      // The draft was deleted or belongs to someone else: start fresh.
      if (error instanceof ApiError && error.status === 404) reset()
      throw error
    } finally {
      loadingDraft.value = false
    }
  }

  // ----- Local-only editing (no API calls) -----

  function addFiles(files: File[]) {
    for (const file of files) {
      documents.value.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        extension: file.name.split('.').pop()?.toLowerCase() ?? '',
        file,
      })
    }
    delete serverErrors.value.documents
  }

  /** Adds (or replaces) the scanned invoice as the Invoice document; null removes it. */
  function setScannedInvoice(file: File | null) {
    const previous = documents.value.find((d) => d.fromScan)
    if (previous) removeDocument(previous.id)
    if (!file) return
    documents.value.unshift({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      extension: file.name.split('.').pop()?.toLowerCase() ?? '',
      file,
      docType: 'Invoice',
      fromScan: true,
    })
    delete serverErrors.value.documents
  }

  function removeDocument(id: string) {
    const doc = documents.value.find((d) => d.id === id)
    if (doc?.serverId) removedServerIds.value.push(doc.serverId)
    documents.value = documents.value.filter((d) => d.id !== id)
  }

  // ----- Writes (only from Save as Draft, Submit and discarding a saved draft) -----

  /** Deletes a draft created during a failed save/submit, so nothing partial is left behind. */
  async function rollback(id: string) {
    try {
      await InvoiceApi.remove(id)
    } catch {
      // Best effort: it stays an unsubmitted draft and never reaches AP.
    }
  }

  /**
   * Pushes the wizard's state to the server: creates or updates the draft, deletes removed
   * documents and uploads new ones. Rolls back a draft it created if a later call fails.
   */
  async function sync(onPhase?: (phase: SubmitPhase) => void) {
    const input = toInput(form.value)
    let id = draftId.value
    let created = false

    onPhase?.('saving')
    if (id) {
      try {
        await InvoiceApi.update(id, input)
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error
        id = null // The saved draft is gone; create a new one below.
      }
    }
    if (!id) {
      id = (await InvoiceApi.create(input)).data.id
      created = true
    }

    try {
      if (!created) {
        for (const serverId of removedServerIds.value) {
          try {
            await DocumentApi.remove(id, serverId)
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 404)) throw error
          }
        }
        removedServerIds.value = []
      }

      // A newly created draft has none of the previously saved files, so send them all.
      const pending = documents.value.filter((d) => d.file && (created || !d.serverId))
      const uploadedIds = new Map<WizardDocument, string>()
      if (pending.length) {
        onPhase?.('uploading')
        const { data: uploaded } = await DocumentApi.upload(
          id,
          pending.map((d) => d.file!),
          pending.map((d) => d.docType ?? ('' as DocumentType)),
        )
        pending.forEach((doc, i) => {
          const serverId = uploaded[i]?.id
          if (serverId) uploadedIds.set(doc, serverId)
        })
        // On an existing draft the files are stored now, so a retry won't upload them twice.
        if (!created) markStored(uploadedIds)
      }
      return { id, created, uploadedIds }
    } catch (error) {
      if (created) await rollback(id)
      throw error
    }
  }

  function markStored(uploadedIds: Map<WizardDocument, string>) {
    for (const [doc, serverId] of uploadedIds) doc.serverId = serverId
  }

  function recordErrors(error: unknown) {
    if (!(error instanceof ApiError)) return
    serverErrors.value = { ...error.fieldErrors }
    // Upload problems come back as a list under `files`.
    if (error.fieldErrors.files) serverErrors.value.documents = error.messages.join(' ')
  }

  /** "Save as Draft": an explicit request to keep the invoice on the server, unsubmitted. */
  async function saveDraft() {
    saving.value = true
    try {
      const { id, uploadedIds } = await sync()
      setDraftId(id)
      markStored(uploadedIds)
      serverErrors.value = {}
    } catch (error) {
      recordErrors(error)
      throw error
    } finally {
      saving.value = false
    }
  }

  /** Review & Submit: the point at which a new invoice is written to the API. */
  async function submit() {
    let draft: Awaited<ReturnType<typeof sync>> | null = null
    try {
      draft = await sync((phase) => (submitPhase.value = phase))
      submitPhase.value = 'submitting'
      const { data: invoice } = await InvoiceApi.submit(draft.id)
      submission.value = {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo ?? '',
        invoiceDate: formatDate(invoice.invoiceDate),
        submittedOn: formatIsoDateTime(invoice.submittedOn),
        referenceNo: invoice.referenceNo ?? '',
      }
      return invoice
    } catch (error) {
      // A draft created just for this attempt is removed; an explicitly saved one is kept.
      if (draft?.created) await rollback(draft.id)
      recordErrors(error)
      throw error
    } finally {
      submitPhase.value = null
    }
  }

  /** Clears the wizard; deletes the server draft only if the vendor had saved one. */
  async function discard() {
    if (draftId.value) {
      try {
        await InvoiceApi.remove(draftId.value)
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error
      }
    }
    reset()
  }

  return {
    draftId,
    form,
    documents,
    step,
    submission,
    serverErrors,
    saving,
    submitPhase,
    loadingDraft,
    reset,
    resume,
    addFiles,
    setScannedInvoice,
    removeDocument,
    saveDraft,
    submit,
    discard,
  }
})
