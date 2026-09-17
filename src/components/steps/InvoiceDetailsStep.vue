<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'
import { creditTerms, invoiceTypes } from '@/config/brand'
import { formatCurrency, roundMoney } from '@/utils/format'
import MoneyInput from '@/components/MoneyInput.vue'

const emit = defineEmits<{ next: []; cancel: [] }>()

const store = useInvoiceStore()
const { form } = storeToRefs(store)
const showErrors = ref(false)

const VAT_RATE = 0.12

/** Splits the invoice amount into vatable sales and VAT (12%), net of non-VAT sales. */
function recomputeVat() {
  const amount = form.value.invoiceAmount
  if (amount == null) return
  const taxable = Math.max(amount - (form.value.nonVat ?? 0), 0)
  const vatable = roundMoney(taxable / (1 + VAT_RATE))
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

function err(field: keyof typeof form.value) {
  return showErrors.value ? errors.value[field] : undefined
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
  <form class="vp-card" novalidate @submit.prevent="next">
    <h2 class="section-title">Invoice Details</h2>
    <p class="section-subtitle mb-4">
      Please provide accurate invoice information. Fields with * are required.
    </p>

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
          <option v-for="type in invoiceTypes" :key="type">{{ type }}</option>
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
          <option v-for="term in creditTerms" :key="term">{{ term }}</option>
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
      Vatable Sales and VAT (12%) are calculated automatically from the Invoice Amount and Non-Vat.
      You may adjust them if needed.
    </p>

    <hr class="my-4" />

    <div class="d-flex justify-content-between">
      <button type="button" class="btn btn-outline-vp" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="btn btn-gold px-4">
        Next <i class="bi bi-arrow-right ms-2"></i>
      </button>
    </div>
  </form>
</template>
