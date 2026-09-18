import type { InvoiceDocument, InvoiceRecord } from '@/data/invoices'
import { useInvoicesStore } from '@/stores/invoices'
import { buildPdf, downloadBlob, openBlob } from '@/utils/files'
import { formatCurrency, formatDate, formatIsoDateTime } from '@/utils/format'

export function useInvoiceFiles() {
  const store = useInvoicesStore()

  /** The uploaded file if still in memory, otherwise a generated placeholder PDF. */
  function documentBlob(
    invoice: InvoiceRecord,
    doc: InvoiceDocument,
  ): { blob: Blob; name: string } {
    const file = store.fileFor(doc.id)
    if (file) return { blob: file, name: doc.name }
    const blob = buildPdf([
      doc.docType,
      `File: ${doc.name}`,
      `Invoice No.: ${invoice.invoiceNo}`,
      `Vendor: ${invoice.vendorName}`,
      '',
      'Sample document generated for demonstration purposes.',
    ])
    return { blob, name: doc.name.replace(/\.[^.]+$/, '') + '.pdf' }
  }

  function viewDocument(invoice: InvoiceRecord, doc: InvoiceDocument) {
    openBlob(documentBlob(invoice, doc).blob)
  }

  function downloadDocuments(invoice: InvoiceRecord) {
    invoice.documents.forEach((doc, i) => {
      const { blob, name } = documentBlob(invoice, doc)
      // Stagger downloads so browsers don't drop them.
      setTimeout(() => downloadBlob(blob, name), i * 300)
    })
  }

  function downloadSummary(invoice: InvoiceRecord) {
    const blob = buildPdf([
      `Invoice Summary - ${invoice.invoiceNo}`,
      `Status: ${invoice.status}`,
      '',
      `Invoice No.: ${invoice.invoiceNo}`,
      `Invoice Date: ${formatDate(invoice.invoiceDate)}`,
      `Vendor: ${invoice.vendorName}`,
      `PO/PR No.: ${invoice.poPrNo || '-'}`,
      `DR No.: ${invoice.drNo || '-'}`,
      `Description: ${invoice.description}`,
      `Credit Terms: ${invoice.creditTerms}`,
      `Date Received: ${formatDate(invoice.dateReceived)}`,
      `Submitted On: ${formatIsoDateTime(invoice.submittedOn)}`,
      '',
      `Invoice Amount: ${formatCurrency(invoice.invoiceAmount)}`,
      `Vatable Sales: ${formatCurrency(invoice.vatableSales)}`,
      `VAT: ${formatCurrency(invoice.vat)}`,
      `Non-Vat: ${formatCurrency(invoice.nonVat)}`,
    ])
    downloadBlob(blob, `${invoice.invoiceNo}-summary.pdf`)
  }

  return { viewDocument, downloadDocuments, downloadSummary }
}
