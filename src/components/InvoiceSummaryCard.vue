<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'
import { formatCurrency, formatDate } from '@/utils/format'

const { form } = storeToRefs(useInvoiceStore())
</script>

<template>
  <aside class="vp-card summary-card">
    <div class="d-flex align-items-center gap-3 mb-4">
      <span class="summary-icon"><i class="bi bi-file-earmark-text"></i></span>
      <h2 class="section-title mb-0">Invoice Summary</h2>
    </div>

    <dl class="summary-list">
      <dt>Invoice No.</dt>
      <dd>{{ form.invoiceNo || '—' }}</dd>
      <dt>Invoice Date</dt>
      <dd>{{ formatDate(form.invoiceDate) }}</dd>
      <dt>Vendor</dt>
      <dd>{{ form.vendorName || '—' }}</dd>
      <dt>Invoice Type</dt>
      <dd>{{ form.invoiceType || '—' }}</dd>
      <dt>Credit Terms</dt>
      <dd>{{ form.creditTerms || '—' }}</dd>
    </dl>

    <hr class="my-3" />

    <dl class="summary-list">
      <dt class="fw-semibold text-body">Invoice Amount</dt>
      <dd class="fw-bold">{{ formatCurrency(form.invoiceAmount) }}</dd>
      <dt>Vatable Sales</dt>
      <dd>{{ formatCurrency(form.vatableSales) }}</dd>
      <dt>VAT</dt>
      <dd>{{ formatCurrency(form.vat) }}</dd>
      <dt>Non-Vat</dt>
      <dd>{{ formatCurrency(form.nonVat) }}</dd>
    </dl>

    <div class="vp-info mt-4">
      <i class="bi bi-info-circle"></i>
      <span>Please ensure all details are correct before submitting your invoice.</span>
    </div>
  </aside>
</template>

<style scoped>
.summary-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--vp-gold-soft);
  display: grid;
  place-items: center;
  font-size: 1.375rem;
}

.summary-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.625rem 1rem;
  margin: 0;
  font-size: 0.875rem;
}

.summary-list dt {
  font-weight: 400;
  color: var(--vp-muted);
}

.summary-list dd {
  margin: 0;
  text-align: right;
  word-break: break-word;
}
</style>
