<script setup lang="ts">
import { computed } from 'vue'
import { useCurrentInvoice } from '@/composables/useCurrentInvoice'
import { useInvoiceFiles } from '@/composables/useInvoiceFiles'
import { formatCurrency, formatDate, formatFileSize, formatIsoDate } from '@/utils/format'
import StatusBadge from '@/components/StatusBadge.vue'

const invoice = useCurrentInvoice()
const { busyId, error: fileError, viewDocument, downloadDocuments } = useInvoiceFiles()
const downloadable = computed(() => invoice.value?.documents.filter((d) => d.hasFile) ?? [])
</script>

<template>
  <div v-if="invoice">
    <div class="d-flex align-items-center gap-3 mb-4">
      <h1 class="page-title">Invoice Details</h1>
      <StatusBadge :status="invoice.status" size="lg" />
    </div>

    <div class="row g-4 mb-4">
      <div class="col-lg-7">
        <section class="vp-card h-100">
          <h2 class="section-title mb-4">Invoice Information</h2>
          <dl class="info-list">
            <dt>Invoice No.</dt>
            <dd>{{ invoice.invoiceNo || '—' }}</dd>
            <dt>Invoice Date</dt>
            <dd>{{ formatDate(invoice.invoiceDate) }}</dd>
            <dt>Invoice Type</dt>
            <dd>{{ invoice.invoiceType || '—' }}</dd>
            <dt>Vendor</dt>
            <dd>{{ invoice.vendorName || '—' }}</dd>
            <dt>PO/PR No.</dt>
            <dd>{{ invoice.poPrNo || '—' }}</dd>
            <dt>DR No.</dt>
            <dd>{{ invoice.drNo || '—' }}</dd>
            <dt>Description</dt>
            <dd>{{ invoice.description || '—' }}</dd>
            <dt>Credit Terms</dt>
            <dd>{{ invoice.creditTerms || '—' }}</dd>
            <dt>Date Received</dt>
            <dd>{{ formatDate(invoice.dateReceived) }}</dd>
          </dl>
        </section>
      </div>

      <div class="col-lg-5">
        <section class="vp-card h-100">
          <h2 class="section-title mb-4">Financial Summary</h2>
          <dl class="finance-list">
            <dt>Invoice Amount</dt>
            <dd>{{ formatCurrency(invoice.invoiceAmount) }}</dd>
            <dt>Vatable Sales</dt>
            <dd>{{ formatCurrency(invoice.vatableSales) }}</dd>
            <dt>VAT</dt>
            <dd>{{ formatCurrency(invoice.vat) }}</dd>
            <dt>Non-Vat</dt>
            <dd>{{ formatCurrency(invoice.nonVat) }}</dd>
          </dl>
        </section>
      </div>
    </div>

    <section class="vp-card">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="section-title mb-0">Supporting Documents ({{ invoice.documents.length }})</h2>
        <button
          type="button"
          class="btn btn-outline-vp btn-sm"
          :disabled="!downloadable.length || busyId === 'all'"
          :title="downloadable.length ? undefined : 'No files available to download'"
          @click="downloadDocuments(invoice)"
        >
          <span
            v-if="busyId === 'all'"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-download me-1"></i>Download All
        </button>
      </div>

      <div v-if="fileError" class="alert alert-danger py-2 small" role="alert">
        {{ fileError }}
      </div>

      <div class="table-responsive">
        <table class="table doc-table mb-0">
          <tbody>
            <tr v-for="doc in invoice.documents" :key="doc.id">
              <td class="doc-name">
                <i
                  class="bi"
                  :class="doc.extension === 'pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image'"
                ></i>
                {{ doc.name }}
              </td>
              <td>{{ doc.docType }}</td>
              <td class="text-nowrap">{{ formatIsoDate(doc.uploadedOn) }}</td>
              <td class="text-nowrap">{{ formatFileSize(doc.size) }}</td>
              <td class="text-end">
                <button
                  type="button"
                  class="btn btn-link view-btn"
                  :aria-label="`View ${doc.name}`"
                  :title="doc.hasFile ? 'View' : 'File not available'"
                  :disabled="!doc.hasFile || busyId === doc.id"
                  @click="viewDocument(invoice, doc)"
                >
                  <span
                    v-if="busyId === doc.id"
                    class="spinner-border spinner-border-sm"
                    aria-hidden="true"
                  ></span>
                  <i v-else class="bi" :class="doc.hasFile ? 'bi-eye' : 'bi-eye-slash'"></i>
                </button>
              </td>
            </tr>
            <tr v-if="!invoice.documents.length">
              <td class="text-body-secondary text-center py-4">No documents uploaded.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.info-list,
.finance-list {
  display: grid;
  gap: 0.875rem 1.5rem;
  margin: 0;
}

.info-list {
  grid-template-columns: minmax(120px, 35%) 1fr;
}

.finance-list {
  grid-template-columns: 1fr auto;
}

.info-list dt,
.finance-list dt {
  font-weight: 400;
  color: var(--vp-muted);
}

.info-list dd,
.finance-list dd {
  margin: 0;
}

.finance-list dd {
  text-align: right;
  font-weight: 700;
}

.doc-table {
  --bs-table-bg: transparent;
  font-size: 0.875rem;
}

.doc-table td {
  padding: 0.875rem 0.75rem;
  vertical-align: middle;
  border-bottom-color: var(--vp-border);
}

.doc-table tr:last-child td {
  border-bottom: 0;
}

.doc-name {
  font-weight: 500;
  white-space: nowrap;
}

.doc-name .bi {
  font-size: 1.5rem;
  color: #c0392b;
  margin-right: 0.75rem;
  vertical-align: middle;
}

.doc-name .bi-file-earmark-image {
  color: #3f8a45;
}

.view-btn {
  --bs-btn-padding-x: 0.5rem;
  color: var(--vp-text);
  font-size: 1.25rem;
}

.view-btn:hover {
  color: var(--bs-link-color);
}
</style>
