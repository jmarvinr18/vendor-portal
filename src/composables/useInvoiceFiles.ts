import { ref } from 'vue'
import { errorMessage } from '@/services/ApiService'
import DocumentApi from '@/services/api/invoice/document'
import type { Invoice, InvoiceDocument, InvoiceListItem } from '@/schema'
import { buildPdf, downloadBlob, openBlob } from '@/utils/files'
import { formatCurrency, formatDate, formatIsoDateTime } from '@/utils/format'

// Files are shown with a type derived from their extension, never the uploader-supplied
// Content-Type, so a file that is really HTML can't run as a page on this origin.
const VIEWABLE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/** Viewing and downloading invoice documents through the API. */
export function useInvoiceFiles() {
  const busyId = ref<string | null>(null)
  const error = ref<string | null>(null)

  async function viewDocument(invoice: Invoice, doc: InvoiceDocument) {
    if (!doc.hasFile) return
    const type = VIEWABLE_TYPES[doc.extension.toLowerCase()]
    busyId.value = doc.id
    error.value = null
    // Open the tab synchronously so popup blockers allow it, then point it at the file.
    const tab = type ? window.open('', '_blank') : null
    if (tab) tab.opener = null
    try {
      const { data: raw } = await DocumentApi.file(invoice.id, doc.id, !type)
      if (!type) {
        downloadBlob(new Blob([raw], { type: 'application/octet-stream' }), doc.name)
        return
      }
      const blob = new Blob([raw], { type })
      if (tab) {
        const url = URL.createObjectURL(blob)
        tab.location.href = url
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        openBlob(blob)
      }
    } catch (e) {
      tab?.close()
      error.value = errorMessage(e, `Could not open ${doc.name}.`)
    } finally {
      busyId.value = null
    }
  }

  async function downloadDocuments(invoice: Invoice) {
    busyId.value = 'all'
    error.value = null
    try {
      for (const doc of invoice.documents.filter((d) => d.hasFile)) {
        const { data: blob } = await DocumentApi.file(invoice.id, doc.id, true)
        downloadBlob(new Blob([blob], { type: 'application/octet-stream' }), doc.name)
      }
    } catch (e) {
      error.value = errorMessage(e, 'Could not download the documents.')
    } finally {
      busyId.value = null
    }
  }

  /** A one-page PDF summary generated in the browser from the invoice fields. */
  function downloadSummary(invoice: InvoiceListItem) {
    const blob = buildPdf([
      `Invoice Summary - ${invoice.invoiceNo ?? 'Draft'}`,
      `Status: ${invoice.status}`,
      `Reference No.: ${invoice.referenceNo ?? '-'}`,
      '',
      `Invoice No.: ${invoice.invoiceNo ?? '-'}`,
      `Invoice Date: ${formatDate(invoice.invoiceDate)}`,
      `Vendor: ${invoice.vendorName ?? '-'}`,
      `PO/PR No.: ${invoice.poPrNo || '-'}`,
      `DR No.: ${invoice.drNo || '-'}`,
      `Description: ${invoice.description ?? '-'}`,
      `Credit Terms: ${invoice.creditTerms ?? '-'}`,
      `Date Received: ${formatDate(invoice.dateReceived)}`,
      `Submitted On: ${formatIsoDateTime(invoice.submittedOn)}`,
      '',
      `Invoice Amount: ${formatCurrency(invoice.invoiceAmount)}`,
      `Vatable Sales: ${formatCurrency(invoice.vatableSales)}`,
      `VAT: ${formatCurrency(invoice.vat)}`,
      `Non-Vat: ${formatCurrency(invoice.nonVat)}`,
    ])
    downloadBlob(blob, `${invoice.invoiceNo ?? invoice.id}-summary.pdf`)
  }

  return { busyId, error, viewDocument, downloadDocuments, downloadSummary }
}
