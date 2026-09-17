import { ref } from 'vue'
import { defineStore } from 'pinia'
import { currentVendor } from '@/config/brand'
import { formatDate, formatDateTime } from '@/utils/format'

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

export interface SupportingDocument {
  id: string
  name: string
  size: number
  extension: string
  file?: File
}

export interface Submission {
  invoiceNo: string
  invoiceDate: string
  submittedOn: string
  referenceNo: string
}

export type Step = 1 | 2 | 3

const DRAFT_KEY = 'vendor-portal:invoice-draft'

function emptyForm(): InvoiceForm {
  return {
    vendorName: currentVendor.name,
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

function loadDraft(): { form: InvoiceForm; documents: SupportingDocument[] } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    return { form: { ...emptyForm(), ...draft.form }, documents: draft.documents ?? [] }
  } catch {
    return null
  }
}

export const useInvoiceStore = defineStore('invoice', () => {
  const draft = loadDraft()
  const form = ref<InvoiceForm>(draft?.form ?? emptyForm())
  const documents = ref<SupportingDocument[]>(draft?.documents ?? [])
  const step = ref<Step>(1)
  const submission = ref<Submission | null>(null)

  function saveDraft() {
    const serializableDocs = documents.value.map(({ file: _file, ...doc }) => doc)
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form: form.value, documents: serializableDocs }),
    )
  }

  function reset() {
    localStorage.removeItem(DRAFT_KEY)
    form.value = emptyForm()
    documents.value = []
    step.value = 1
  }

  function addDocument(file: File) {
    documents.value.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      extension: file.name.split('.').pop()?.toLowerCase() ?? '',
      file,
    })
  }

  function removeDocument(id: string) {
    documents.value = documents.value.filter((doc) => doc.id !== id)
  }

  function submit() {
    // Replace with an API call once the backend is available.
    const now = new Date()
    const sequence = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    submission.value = {
      invoiceNo: form.value.invoiceNo,
      invoiceDate: formatDate(form.value.invoiceDate),
      submittedOn: formatDateTime(now),
      referenceNo: `SUB-${now.getFullYear()}-${sequence}`,
    }
  }

  return {
    form,
    documents,
    step,
    submission,
    saveDraft,
    reset,
    addDocument,
    removeDocument,
    submit,
  }
})
