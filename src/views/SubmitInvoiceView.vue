<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'
import { upload } from '@/config/brand'
import InvoiceStepper from '@/components/InvoiceStepper.vue'
import InvoiceSummaryCard from '@/components/InvoiceSummaryCard.vue'
import InvoiceDetailsStep from '@/components/steps/InvoiceDetailsStep.vue'
import SupportingDocumentsStep from '@/components/steps/SupportingDocumentsStep.vue'
import ReviewSubmitStep from '@/components/steps/ReviewSubmitStep.vue'

const router = useRouter()
const store = useInvoiceStore()
const { step } = storeToRefs(store)

const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 3000)
}
onBeforeUnmount(() => clearTimeout(toastTimer))

watch(step, () => window.scrollTo({ top: 0, behavior: 'smooth' }))

function saveDraft() {
  store.saveDraft()
  showToast('Your invoice has been saved as a draft.')
}

function cancel() {
  if (
    window.confirm('Discard this invoice? Any unsaved details and uploaded files will be cleared.')
  ) {
    store.reset()
  }
}

async function submit() {
  store.submit()
  await router.push({ name: 'submit-invoice-success' })
  store.reset()
}
</script>

<template>
  <div class="submit-invoice">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <h1 class="page-title">Submit Invoice</h1>
      <button type="button" class="btn btn-outline-vp" @click="saveDraft">
        <i class="bi bi-floppy me-2"></i>Save as Draft
      </button>
    </div>

    <InvoiceStepper :current="step" @select="step = $event" />

    <div class="row g-4">
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
            <p class="mb-0">You can upload up to {{ upload.maxFiles }} files.</p>
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
          role="status"
          aria-live="polite"
        >
          <div class="d-flex">
            <div class="toast-body">
              <i class="bi bi-check-circle-fill text-success me-2"></i>{{ toast }}
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
