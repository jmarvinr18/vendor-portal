<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'
import { useReferenceDataStore } from '@/stores/referenceData'
import { ApiError, errorMessage } from '@/services/ApiService'
import InvoiceStepper from '@/components/InvoiceStepper.vue'
import InvoiceSummaryCard from '@/components/InvoiceSummaryCard.vue'
import InvoiceDetailsStep from '@/components/steps/InvoiceDetailsStep.vue'
import SupportingDocumentsStep from '@/components/steps/SupportingDocumentsStep.vue'
import ReviewSubmitStep from '@/components/steps/ReviewSubmitStep.vue'

const route = useRoute()
const router = useRouter()
const store = useInvoiceStore()
const referenceData = useReferenceDataStore()
const { step, saving, loadingDraft, submitPhase } = storeToRefs(store)

// Fields that live on step 1; anything else the API rejects belongs to step 2 (documents).
const DETAIL_FIELDS = new Set([
  'vendorName',
  'invoiceType',
  'invoiceNo',
  'invoiceDate',
  'description',
  'poPrNo',
  'drNo',
  'dateReceived',
  'creditTerms',
  'invoiceAmount',
  'vatableSales',
  'vat',
  'nonVat',
])

const toast = ref<{ message: string; variant: 'success' | 'danger' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string, variant: 'success' | 'danger' = 'success') {
  toast.value = { message, variant }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), variant === 'danger' ? 6000 : 3000)
}
onBeforeUnmount(() => clearTimeout(toastTimer))

// Until Save as Draft or Submit, the invoice only exists in this tab, so warn before a
// reload or tab close would lose it. (Navigating within the app keeps it in the store.)
function warnUnsaved(event: BeforeUnloadEvent) {
  const f = store.form
  const hasWork = f.invoiceNo || f.description || f.invoiceAmount != null || store.documents.length
  const unsavedFiles = store.documents.some((d) => d.file && !d.serverId)
  if (hasWork && (!store.draftId || unsavedFiles)) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnUnsaved))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnsaved))

watch(step, () => window.scrollTo({ top: 0, behavior: 'smooth' }))

onMounted(async () => {
  referenceData.load()
  const requested = typeof route.query.draft === 'string' ? route.query.draft : null
  if (requested) router.replace({ query: {} })
  try {
    // Open the requested draft, or pick up the one this browser was working on.
    if (requested) await store.resume(requested)
    else if (store.draftId) await store.resume()
  } catch (error) {
    showToast(errorMessage(error, 'The saved draft could not be loaded.'), 'danger')
  }
})

async function saveDraft() {
  try {
    await store.saveDraft()
    showToast('Your invoice has been saved as a draft.')
  } catch (error) {
    showToast(errorMessage(error, 'The draft could not be saved.'), 'danger')
  }
}

async function cancel() {
  // Unsaved work only lives in this browser; a saved draft is deleted from the server too.
  const message = store.draftId
    ? 'Discard this invoice? Your saved draft and its uploaded files will be deleted.'
    : 'Discard this invoice? The details and files you entered will be cleared.'
  if (!window.confirm(message)) return
  try {
    await store.discard()
  } catch (error) {
    showToast(errorMessage(error, 'The draft could not be discarded.'), 'danger')
  }
}

async function submit() {
  try {
    await store.submit()
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const fields = Object.keys(error.fieldErrors)
      step.value = fields.some((f) => DETAIL_FIELDS.has(f)) ? 1 : 2
    }
    showToast(errorMessage(error, 'The invoice could not be submitted.'), 'danger')
    return
  }
  await router.push({ name: 'submit-invoice-success' })
  store.reset()
}
</script>

<template>
  <div class="submit-invoice">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <h1 class="page-title">Submit Invoice</h1>
      <button
        type="button"
        class="btn btn-outline-vp"
        :disabled="saving || loadingDraft || submitPhase !== null"
        @click="saveDraft"
      >
        <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        <i v-else class="bi bi-floppy me-2"></i>Save as Draft
      </button>
    </div>

    <InvoiceStepper :current="step" @select="submitPhase === null && (step = $event)" />

    <div v-if="loadingDraft" class="vp-card text-center py-5 text-body-secondary" role="status">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading your
      draft…
    </div>

    <div v-else class="row g-4">
      <div class="col-xxl-9 col-xl-8">
        <InvoiceDetailsStep v-if="step === 1" @next="step = 2" @cancel="cancel" />
        <SupportingDocumentsStep v-else-if="step === 2" @back="step = 1" @next="step = 3" />
        <ReviewSubmitStep v-else @back="step = 2" @edit="step = $event" @submit="submit" />
      </div>

      <div class="col-xxl-3 col-xl-4">
        <div class="side-panel" :class="{ 'side-panel-offset': step === 3 }">
          <aside v-if="step === 2" class="vp-card">
            <h2 class="section-title mb-3">Required Documents</h2>
            <ul class="required-docs">
              <li>Invoice</li>
              <li>Purchase Order (PO) / Purchase Requisition (PR)</li>
              <li>Delivery Receipt (DR)</li>
            </ul>
            <hr />
            <p class="mb-0">You can upload up to {{ referenceData.uploadRules.maxFiles }} files.</p>
          </aside>
          <InvoiceSummaryCard v-else />
        </div>
      </div>
    </div>

    <div class="toast-container position-fixed bottom-0 end-0 p-3">
      <Transition name="fade">
        <div
          v-if="toast"
          class="toast show align-items-center border-0"
          :role="toast.variant === 'danger' ? 'alert' : 'status'"
          :aria-live="toast.variant === 'danger' ? 'assertive' : 'polite'"
        >
          <div class="d-flex">
            <div class="toast-body">
              <i
                class="bi me-2"
                :class="
                  toast.variant === 'danger'
                    ? 'bi-exclamation-circle-fill text-danger'
                    : 'bi-check-circle-fill text-success'
                "
              ></i
              >{{ toast.message }}
            </div>
            <button
              type="button"
              class="btn-close me-2 m-auto"
              aria-label="Close"
              @click="toast = null"
            ></button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.side-panel {
  position: sticky;
  top: calc(var(--vp-header-height) + 1.5rem);
}

@media (min-width: 1200px) {
  .side-panel-offset {
    margin-top: 5.25rem;
  }
}

.required-docs {
  padding-left: 1.25rem;
  margin-bottom: 0;
}

.required-docs li {
  margin-bottom: 0.625rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
