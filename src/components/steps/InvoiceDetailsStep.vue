<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'
import { useReferenceDataStore } from '@/stores/referenceData'
import { useInvoiceScanStore, type EntryMode } from '@/stores/invoiceScan'
import type { ExtractableField } from '@/schema'
import type { FieldValue } from '@/utils/extraction'
import { formatCurrency, roundMoney } from '@/utils/format'
import MoneyInput from '@/components/MoneyInput.vue'
import InvoiceScanPanel from './InvoiceScanPanel.vue'

const emit = defineEmits<{ next: []; cancel: [] }>()

const store = useInvoiceStore()
const { form, serverErrors } = storeToRefs(store)
const referenceData = useReferenceDataStore()
const scan = useInvoiceScanStore()
const { mode } = storeToRefs(scan)
const showErrors = ref(false)

const entryModes: { value: EntryMode; icon: string; title: string; text: string }[] = [
  {
    value: 'manual',
    icon: 'bi-pencil-square',
    title: 'Enter manually',
    text: 'Type the invoice details yourself.',
  },
  {
    value: 'scan',
    icon: 'bi-upc-scan',
    title: 'Scan invoice',
    text: 'Upload a scanned invoice and we’ll fill in the details for you to check.',
  },
]

/** Splits the invoice amount into vatable sales and VAT (12% by default), net of non-VAT sales. */
function recomputeVat() {
  const amount = form.value.invoiceAmount
  if (amount == null) return
  const taxable = Math.max(amount - (form.value.nonVat ?? 0), 0)
  const vatable = roundMoney(taxable / (1 + referenceData.vatRate))
  form.value.vatableSales = vatable
  form.value.vat = roundMoney(taxable - vatable)
}

const breakdownTotal = computed(
  () => (form.value.vatableSales ?? 0) + (form.value.vat ?? 0) + (form.value.nonVat ?? 0),
)

const errors = computed(() => {
  const f = form.value
  const e: Partial<Record<keyof typeof f, string>> = {}
  if (!f.vendorName.trim()) e.vendorName = 'Vendor name is required.'
  if (!f.invoiceType) e.invoiceType = 'Select an invoice type.'
  if (!f.invoiceNo.trim()) e.invoiceNo = 'Invoice number is required.'
  if (!f.invoiceDate) e.invoiceDate = 'Invoice date is required.'
  if (!f.description.trim()) e.description = 'Description is required.'
  if (!f.dateReceived) e.dateReceived = 'Date received is required.'
  else if (f.invoiceDate && f.dateReceived < f.invoiceDate)
    e.dateReceived = 'Date received cannot be earlier than the invoice date.'
  if (!f.creditTerms) e.creditTerms = 'Select credit terms.'
  if (f.invoiceAmount == null || f.invoiceAmount <= 0)
    e.invoiceAmount = 'Enter an amount greater than zero.'
  if (f.vatableSales == null) e.vatableSales = 'Vatable sales is required.'
  if (f.vat == null) e.vat = 'VAT is required.'
  if (f.nonVat == null) e.nonVat = 'Non-VAT is required.'
  if (
    !e.invoiceAmount &&
    !e.vatableSales &&
    !e.vat &&
    !e.nonVat &&
    Math.abs(breakdownTotal.value - (f.invoiceAmount ?? 0)) > 0.01
  ) {
    e.invoiceAmount = `Vatable Sales + VAT + Non-Vat (${formatCurrency(breakdownTotal.value)}) must equal the invoice amount.`
  }
  return e
})

/** Copies tagged scan values into the form, then fills in the VAT breakdown if needed. */
function applyScan(values: Partial<Record<ExtractableField, FieldValue>>) {
  const f = form.value
  Object.assign(f, values)
  const amount = values.invoiceAmount as number | undefined
  const vatable = values.vatableSales as number | undefined
  const vat = values.vat as number | undefined
  if (amount != null && vatable == null && vat == null) {
    recomputeVat()
  } else if (amount == null && vatable != null && vat != null) {
    f.invoiceAmount = roundMoney(vatable + vat + (f.nonVat ?? 0))
  } else if (amount != null && vatable != null && vat != null && values.nonVat == null) {
    // Whatever the total has beyond vatable sales + VAT is non-VAT.
    f.nonVat = roundMoney(Math.max(amount - vatable - vat, 0))
  }
  showErrors.value = false
  requestAnimationFrame(() =>
    document.getElementById('invoiceDetailsForm')?.scrollIntoView({ behavior: 'smooth' }),
  )
}

// A server error stays on a field until that field is edited.
watch(
  () => ({ ...form.value }),
  (now, before) => {
    for (const key of Object.keys(now) as (keyof typeof now)[]) {
      if (now[key] !== before[key]) delete serverErrors.value[key]
    }
  },
)

function err(field: keyof typeof form.value) {
  return (showErrors.value ? errors.value[field] : undefined) ?? serverErrors.value[field]
}

function next() {
  showErrors.value = true
  if (Object.keys(errors.value).length === 0) {
    emit('next')
    return
  }
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('.is-invalid')?.focus()
  })
}
</script>

<template>
  <div>
    <div class="entry-modes mb-4" role="radiogroup" aria-label="How to enter the invoice">
      <button
        v-for="option in entryModes"
        :key="option.value"
        type="button"
        role="radio"
        class="entry-mode"
        :class="{ active: mode === option.value }"
        :aria-checked="mode === option.value"
        @click="mode = option.value"
      >
        <i class="bi entry-mode-icon" :class="option.icon"></i>
        <span>
          <span class="entry-mode-title">{{ option.title }}</span>
          <span class="entry-mode-text">{{ option.text }}</span>
        </span>
        <i
          class="bi entry-mode-check"
          :class="mode === option.value ? 'bi-check-circle-fill' : 'bi-circle'"
        ></i>
      </button>
    </div>

    <InvoiceScanPanel v-if="mode === 'scan'" @apply="applyScan" @manual="mode = 'manual'" />

    <form id="invoiceDetailsForm" class="vp-card" novalidate @submit.prevent="next">
      <h2 class="section-title">Invoice Details</h2>
      <p class="section-subtitle mb-4">
        Please provide accurate invoice information. Fields with * are required.
      </p>
      <div v-if="scan.appliedFields.length" class="vp-info mb-4">
        <i class="bi bi-upc-scan"></i>
        <span>
          Some details were filled from your scanned invoice. Check every field against the invoice
          before continuing — scanned text can be misread.
        </span>
      </div>

      <div class="row g-3">
        <div class="col-md-6 col-xl-3">
          <label for="vendorName" class="form-label"
            >Vendor Name <span class="required">*</span></label
          >
          <input
            id="vendorName"
            v-model="form.vendorName"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': err('vendorName') }"
            required
          />
          <div class="invalid-feedback">{{ err('vendorName') }}</div>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="invoiceType" class="form-label"
            >Invoice Type <span class="required">*</span></label
          >
          <select
            id="invoiceType"
            v-model="form.invoiceType"
            class="form-select"
            :class="{ 'is-invalid': err('invoiceType') }"
            required
          >
            <option value="" disabled>Select type</option>
            <option v-for="type in referenceData.invoiceTypeOptions" :key="type">{{ type }}</option>
          </select>
          <div class="invalid-feedback">{{ err('invoiceType') }}</div>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="invoiceNo" class="form-label"
            >Invoice No. <span class="required">*</span></label
          >
          <input
            id="invoiceNo"
            v-model="form.invoiceNo"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': err('invoiceNo') }"
            placeholder="e.g. INV-2026-0528"
            required
          />
          <div class="invalid-feedback">{{ err('invoiceNo') }}</div>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="invoiceDate" class="form-label"
            >Invoice Date <span class="required">*</span></label
          >
          <input
            id="invoiceDate"
            v-model="form.invoiceDate"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': err('invoiceDate') }"
            required
          />
          <div class="invalid-feedback">{{ err('invoiceDate') }}</div>
        </div>

        <div class="col-xl-6">
          <label for="description" class="form-label"
            >Description <span class="required">*</span></label
          >
          <textarea
            id="description"
            v-model="form.description"
            class="form-control"
            :class="{ 'is-invalid': err('description') }"
            rows="2"
            maxlength="500"
            placeholder="e.g. Office supplies and stationery - May 2026"
            required
          ></textarea>
          <div class="invalid-feedback">{{ err('description') }}</div>
        </div>

        <div class="w-100 d-none d-xl-block m-0"></div>

        <div class="col-md-6 col-xl-3">
          <label for="poPrNo" class="form-label">PO/PR #</label>
          <input
            id="poPrNo"
            v-model="form.poPrNo"
            type="text"
            class="form-control"
            placeholder="e.g. PO-2026-0158"
          />
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="drNo" class="form-label">DR#</label>
          <input
            id="drNo"
            v-model="form.drNo"
            type="text"
            class="form-control"
            placeholder="e.g. DR-2026-0487"
          />
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="dateReceived" class="form-label"
            >Date Received <span class="required">*</span></label
          >
          <input
            id="dateReceived"
            v-model="form.dateReceived"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': err('dateReceived') }"
            required
          />
          <div class="invalid-feedback">{{ err('dateReceived') }}</div>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="creditTerms" class="form-label"
            >Credit Terms <span class="required">*</span></label
          >
          <select
            id="creditTerms"
            v-model="form.creditTerms"
            class="form-select"
            :class="{ 'is-invalid': err('creditTerms') }"
            required
          >
            <option value="" disabled>Select terms</option>
            <option v-for="term in referenceData.creditTermOptions" :key="term">{{ term }}</option>
          </select>
          <div class="invalid-feedback">{{ err('creditTerms') }}</div>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="invoiceAmount" class="form-label"
            >Invoice Amount <span class="required">*</span></label
          >
          <MoneyInput
            id="invoiceAmount"
            v-model="form.invoiceAmount"
            :invalid="!!err('invoiceAmount')"
            required
            @edited="recomputeVat"
          >
            <div class="invalid-feedback">{{ err('invoiceAmount') }}</div>
          </MoneyInput>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="vatableSales" class="form-label"
            >Vatable Sales <span class="required">*</span></label
          >
          <MoneyInput
            id="vatableSales"
            v-model="form.vatableSales"
            :invalid="!!err('vatableSales')"
            required
          >
            <div class="invalid-feedback">{{ err('vatableSales') }}</div>
          </MoneyInput>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="vat" class="form-label">VAT <span class="required">*</span></label>
          <MoneyInput id="vat" v-model="form.vat" :invalid="!!err('vat')" required>
            <div class="invalid-feedback">{{ err('vat') }}</div>
          </MoneyInput>
        </div>

        <div class="col-md-6 col-xl-3">
          <label for="nonVat" class="form-label">Non-Vat <span class="required">*</span></label>
          <MoneyInput
            id="nonVat"
            v-model="form.nonVat"
            :invalid="!!err('nonVat')"
            required
            @edited="recomputeVat"
          >
            <div class="invalid-feedback">{{ err('nonVat') }}</div>
          </MoneyInput>
        </div>
      </div>

      <p class="form-text mt-2 mb-0">
        Vatable Sales and VAT (12%) are calculated automatically from the Invoice Amount and
        Non-Vat. You may adjust them if needed.
      </p>

      <hr class="my-4" />

      <div class="d-flex justify-content-between">
        <button type="button" class="btn btn-outline-vp" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="btn btn-gold px-4">
          Next <i class="bi bi-arrow-right ms-2"></i>
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.entry-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.entry-mode {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  text-align: left;
  background: var(--vp-surface);
  border: 1.5px solid var(--vp-border);
  border-radius: 0.5rem;
  padding: 1rem 1.125rem;
  color: var(--vp-text);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.entry-mode:hover:not(:disabled) {
  border-color: #c3c8cf;
}

.entry-mode:focus-visible {
  outline: none;
  box-shadow: 0 0 0 0.2rem rgba(244, 180, 58, 0.35);
}

.entry-mode.active {
  border-color: var(--vp-gold);
  background: #fffaf0;
}

.entry-mode:disabled {
  opacity: 0.6;
}

.entry-mode-icon {
  font-size: 1.5rem;
  line-height: 1.2;
}

.entry-mode-title {
  display: block;
  font-weight: 700;
}

.entry-mode-text {
  display: block;
  font-size: 0.8125rem;
  color: var(--vp-muted);
}

.entry-mode-check {
  margin-left: auto;
  font-size: 1.125rem;
  color: #c3c8cf;
}

.entry-mode.active .entry-mode-check {
  color: var(--vp-gold-hover);
}
</style>
