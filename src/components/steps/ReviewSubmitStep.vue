<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInvoiceStore, type Step } from '@/stores/invoice'
import { formatCurrency, formatDate } from '@/utils/format'
import FileTypeIcon from '@/components/FileTypeIcon.vue'

const emit = defineEmits<{ back: []; edit: [step: Step]; submit: [] }>()

const store = useInvoiceStore()
const { form, documents } = storeToRefs(store)
const submitting = ref(false)

async function submit() {
  submitting.value = true
  // Simulated network latency; replace with the real API call.
  await new Promise((resolve) => setTimeout(resolve, 600))
  emit('submit')
}
</script>

<template>
  <div>
    <h2 class="page-title mb-1">Review &amp; Submit</h2>
    <p class="section-subtitle fs-6 mb-4">Please review your invoice details before submission.</p>

    <div class="vp-card">
      <section class="review-section">
        <div class="review-heading">
          <h3 class="section-title">Vendor Details</h3>
          <button type="button" class="btn btn-link edit-link" @click="emit('edit', 1)">
            Edit
          </button>
        </div>
        <dl class="review-list">
          <dt>Vendor Name</dt>
          <dd>{{ form.vendorName }}</dd>
          <dt>PO/PR #</dt>
          <dd>{{ form.poPrNo || '—' }}</dd>
          <dt>Invoice Type</dt>
          <dd>{{ form.invoiceType }}</dd>
          <dt>DR#</dt>
          <dd>{{ form.drNo || '—' }}</dd>
          <dt>Invoice No.</dt>
          <dd>{{ form.invoiceNo }}</dd>
          <dt>Date Received</dt>
          <dd>{{ formatDate(form.dateReceived) }}</dd>
          <dt>Invoice Date</dt>
          <dd>{{ formatDate(form.invoiceDate) }}</dd>
          <dt>Credit Terms</dt>
          <dd>{{ form.creditTerms }}</dd>
          <dt>Description</dt>
          <dd class="review-span">{{ form.description }}</dd>
        </dl>
      </section>

      <section class="review-section">
        <div class="review-heading">
          <h3 class="section-title">Financial Summary</h3>
          <button type="button" class="btn btn-link edit-link" @click="emit('edit', 1)">
            Edit
          </button>
        </div>
        <div class="row gy-3 px-md-3">
          <div class="col-6 col-md-3">
            <div class="fin-label">Invoice Amount</div>
            <div class="fin-value">{{ formatCurrency(form.invoiceAmount) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="fin-label">Vatable Sales</div>
            <div class="fin-value">{{ formatCurrency(form.vatableSales) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="fin-label">VAT</div>
            <div class="fin-value">{{ formatCurrency(form.vat) }}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="fin-label">Non-Vat</div>
            <div class="fin-value">{{ formatCurrency(form.nonVat) }}</div>
          </div>
        </div>
      </section>

      <section class="review-section">
        <div class="review-heading">
          <h3 class="section-title">Supporting Documents ({{ documents.length }})</h3>
          <button type="button" class="btn btn-link edit-link" @click="emit('edit', 2)">
            Edit
          </button>
        </div>
        <ul class="list-unstyled d-flex flex-wrap gap-4 mb-0">
          <li v-for="doc in documents" :key="doc.id" class="d-flex align-items-center gap-2">
            <FileTypeIcon :extension="doc.extension" variant="glyph" />
            <span>{{ doc.name }}</span>
          </li>
        </ul>
      </section>

      <div class="d-flex justify-content-between pt-2">
        <button
          type="button"
          class="btn btn-outline-vp"
          :disabled="submitting"
          @click="emit('back')"
        >
          <i class="bi bi-arrow-left me-2"></i>Back
        </button>
        <button type="button" class="btn btn-gold px-4" :disabled="submitting" @click="submit">
          <span
            v-if="submitting"
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
          <i v-else class="bi bi-send me-2"></i>
          {{ submitting ? 'Submitting…' : 'Submit Invoice' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-section {
  padding-bottom: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--vp-border);
}

.review-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.edit-link {
  --bs-btn-padding-x: 0;
  --bs-btn-padding-y: 0;
  font-weight: 600;
  text-decoration: none;
}

.review-list {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) 1.5fr minmax(110px, 1fr) 1.5fr;
  gap: 0.75rem 1rem;
  margin: 0;
}

.review-span {
  grid-column: span 3;
}

.review-list dt {
  font-weight: 400;
  color: var(--vp-muted);
}

.review-list dd {
  margin: 0;
  word-break: break-word;
}

.fin-label {
  color: var(--vp-muted);
  margin-bottom: 0.375rem;
}

.fin-value {
  font-weight: 600;
}

@media (max-width: 767.98px) {
  .review-list {
    grid-template-columns: minmax(110px, 40%) 1fr;
  }

  .review-span {
    grid-column: auto;
  }
}
</style>
