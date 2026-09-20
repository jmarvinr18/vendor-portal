import { ref } from 'vue'
import { defineStore } from 'pinia'
import { creditTerms, currentVendor, invoiceTypes, upload } from '@/config/brand'
import { INVOICE_STATUSES } from '@/constants/invoice'
import ReferenceApi from '@/services/api/reference/reference'
import VendorApi from '@/services/api/user/vendor'
import type { ExtractableField, InvoiceStatus, UploadRules, Vendor } from '@/schema'

const EXTRACTABLE_FIELDS: { key: ExtractableField; label: string }[] = [
  { key: 'vendorName', label: 'Vendor Name' },
  { key: 'invoiceType', label: 'Invoice Type' },
  { key: 'invoiceNo', label: 'Invoice No.' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'description', label: 'Description' },
  { key: 'poPrNo', label: 'PO/PR #' },
  { key: 'drNo', label: 'DR#' },
  { key: 'dateReceived', label: 'Date Received' },
  { key: 'creditTerms', label: 'Credit Terms' },
  { key: 'invoiceAmount', label: 'Invoice Amount' },
  { key: 'vatableSales', label: 'Vatable Sales' },
  { key: 'vat', label: 'VAT' },
  { key: 'nonVat', label: 'Non-Vat' },
]

/**
 * Lookup values from GET /reference-data and the current vendor from GET /vendors/me.
 * Starts with the local defaults so the forms work before (or without) the API.
 */
export const useReferenceDataStore = defineStore('referenceData', () => {
  const invoiceTypeOptions = ref<string[]>([...invoiceTypes])
  const creditTermOptions = ref<string[]>([...creditTerms])
  const statuses = ref<InvoiceStatus[]>([...INVOICE_STATUSES])
  const vatRate = ref(0.12)
  const extractableFields = ref([...EXTRACTABLE_FIELDS])
  const uploadRules = ref<UploadRules>({ ...upload })
  const vendor = ref<Vendor | null>(null)
  const vendorName = ref(currentVendor.name)
  const loaded = ref(false)

  let pending: Promise<void> | null = null

  /** Loads once; later calls reuse the same request. Failures keep the defaults. */
  function load() {
    pending ??= Promise.allSettled([
      ReferenceApi.get().then((r) => r.data),
      VendorApi.me().then((r) => r.data),
    ]).then(([data, me]) => {
      if (data.status === 'fulfilled') {
        invoiceTypeOptions.value = data.value.invoiceTypes
        creditTermOptions.value = data.value.creditTerms
        statuses.value = data.value.invoiceStatuses
        vatRate.value = data.value.vatRate
        if (data.value.extractableFields?.length) {
          extractableFields.value = data.value.extractableFields
        }
        uploadRules.value = data.value.upload
      }
      if (me.status === 'fulfilled') {
        vendor.value = me.value
        vendorName.value = me.value.name
      }
      loaded.value = data.status === 'fulfilled' && me.status === 'fulfilled'
      if (!loaded.value) pending = null // Allow a retry on the next call.
    })
    return pending
  }

  return {
    invoiceTypeOptions,
    creditTermOptions,
    statuses,
    vatRate,
    extractableFields,
    uploadRules,
    vendor,
    vendorName,
    loaded,
    load,
  }
})
