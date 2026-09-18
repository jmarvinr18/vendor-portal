import { reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  seedInvoices,
  stageForStatus,
  type DocumentType,
  type InvoiceRecord,
  type InvoiceStatus,
} from '@/data/invoices'
import type { InvoiceForm, SupportingDocument } from './invoice'

const STORAGE_KEY = 'vendor-portal:invoices:v1'

function load(): InvoiceRecord[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as InvoiceRecord[]) : null
  } catch {
    return null
  }
}

function guessDocType(name: string): DocumentType {
  const upper = name.toUpperCase()
  if (upper.startsWith('INV')) return 'Invoice'
  if (upper.startsWith('PO') || upper.startsWith('PR')) return 'Purchase Order'
  if (upper.startsWith('DR')) return 'Delivery Receipt'
  return 'Other'
}

export interface ListFilters {
  search: string
  status: InvoiceStatus | ''
  dateFrom: string
  dateTo: string
}

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<InvoiceRecord[]>(load() ?? seedInvoices())
  // Uploaded File objects can't be persisted; they're kept for the current session only.
  const files = new Map<string, File>()

  // UI state for the Invoice Status list, kept here so it survives visiting a detail page.
  const listState = reactive({
    filters: { search: '', status: '', dateFrom: '', dateTo: '' } as ListFilters,
    page: 1,
    pageSize: 10,
    selectedId: null as string | null,
  })

  watch(invoices, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), {
    deep: true,
  })

  function getById(id: string) {
    return invoices.value.find((invoice) => invoice.id === id)
  }

  function addFromSubmission(
    id: string,
    form: InvoiceForm,
    documents: SupportingDocument[],
    submittedOn: string,
  ) {
    for (const doc of documents) if (doc.file) files.set(doc.id, doc.file)
    invoices.value.unshift({
      id,
      invoiceNo: form.invoiceNo,
      invoiceType: form.invoiceType,
      invoiceDate: form.invoiceDate,
      poPrNo: form.poPrNo,
      drNo: form.drNo,
      description: form.description,
      vendorName: form.vendorName,
      creditTerms: form.creditTerms,
      dateReceived: form.dateReceived,
      invoiceAmount: form.invoiceAmount ?? 0,
      vatableSales: form.vatableSales ?? 0,
      vat: form.vat ?? 0,
      nonVat: form.nonVat ?? 0,
      status: 'Submitted',
      submittedOn,
      currentStage: stageForStatus.Submitted,
      stageTimes: [submittedOn],
      documents: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        docType: guessDocType(doc.name),
        uploadedOn: submittedOn,
        size: doc.size,
        extension: doc.extension,
      })),
      comments: [],
    })
    listState.selectedId = id
    listState.page = 1
  }

  function addComment(id: string, message: string) {
    getById(id)?.comments.push({
      id: crypto.randomUUID(),
      author: 'Vendor',
      message,
      postedOn: new Date().toISOString(),
    })
  }

  function fileFor(docId: string) {
    return files.get(docId)
  }

  return { invoices, listState, getById, addFromSubmission, addComment, fileFor }
})
