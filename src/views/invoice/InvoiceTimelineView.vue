<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useCurrentInvoice } from '@/composables/useCurrentInvoice'
import { STATUS_INFO, stagesFor } from '@/constants/invoice'
import InvoiceApi from '@/services/api/invoice/invoice'
import type { InvoiceTimeline } from '@/schema'
import { formatIsoDateTime } from '@/utils/format'
import StatusBadge from '@/components/StatusBadge.vue'

const invoice = useCurrentInvoice()
const timeline = ref<InvoiceTimeline | null>(null)

// GET /timeline is authoritative; until it arrives (or if it fails) the same view is
// derived locally from the loaded invoice so the page never flashes empty.
watch(
  () => invoice.value?.id,
  async (id, _, onCleanup) => {
    timeline.value = null
    if (!id) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      timeline.value = (await InvoiceApi.timeline(id, controller.signal)).data
    } catch {
      // Keep the locally derived timeline.
    }
  },
  { immediate: true },
)

const stages = computed(
  () => timeline.value?.stages ?? (invoice.value ? stagesFor(invoice.value) : []),
)
const info = computed(
  () =>
    timeline.value?.statusInfo ?? (invoice.value ? STATUS_INFO[invoice.value.status] : undefined),
)

const icons = {
  done: 'bi-check-lg',
  current: 'bi-clock',
  rejected: 'bi-x-lg',
  pending: '',
}
</script>

<template>
  <div v-if="invoice && info">
    <h1 class="page-title mb-4">Status Timeline</h1>

    <div class="row g-4">
      <div class="col-lg-7 col-xxl-8">
        <section class="vp-card p-0">
          <ol class="timeline" aria-label="Invoice status timeline">
            <li
              v-for="stage in stages"
              :key="stage.label"
              class="timeline-item"
              :class="stage.state"
              :aria-current="stage.state === 'current' ? 'step' : undefined"
            >
              <span class="timeline-dot">
                <i v-if="icons[stage.state]" class="bi" :class="icons[stage.state]"></i>
              </span>
              <div>
                <div class="timeline-title">{{ stage.label }}</div>
                <div class="timeline-note">{{ stage.note }}</div>
                <div v-if="stage.time && stage.state !== 'pending'" class="timeline-time">
                  {{ formatIsoDateTime(stage.time) }}
                </div>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <div class="col-lg-5 col-xxl-4 d-flex flex-column gap-4">
        <section class="vp-card">
          <h2 class="section-title mb-3">Current Status</h2>
          <StatusBadge :status="invoice.status" size="lg" />
          <p class="mt-3 mb-0">{{ info.message }}</p>
        </section>

        <section class="vp-card">
          <h2 class="section-title mb-3">Next Step</h2>
          <div class="d-flex gap-2 align-items-start">
            <i class="bi bi-arrow-right-square next-icon"></i>
            <div>
              <div class="fw-bold">{{ info.nextStep }}</div>
              <p class="small text-body-secondary mt-1 mb-0">{{ info.nextStepDetail }}</p>
            </div>
          </div>

          <template v-if="info.estimatedTime">
            <hr />
            <div class="small text-body-secondary mb-1">Estimated Time</div>
            <div class="fs-5 fw-semibold">{{ info.estimatedTime }}</div>
          </template>

          <div v-if="invoice.status === 'Rejected' || invoice.status === 'Draft'" class="mt-3">
            <RouterLink :to="{ name: 'submit-invoice' }" class="btn btn-gold btn-sm">
              Submit Invoice
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  list-style: none;
  margin: 0;
  padding: 0.75rem 0;
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 1.25rem;
  padding: 1.125rem 1.75rem;
}

/* Vertical connector between dots */
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: calc(1.75rem + 12px);
  top: calc(1.125rem + 26px);
  bottom: calc(-1.125rem + 2px);
  width: 2px;
  background: #d5d9df;
}

.timeline-item.done::before {
  background: var(--vp-timeline) !important;
}

.timeline-item.current {
  background: #eef2f8;
}

.timeline-dot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #c9ced6;
  background: var(--vp-surface);
  display: grid;
  place-items: center;
  font-size: 0.8125rem;
}

.done .timeline-dot {
  background: var(--vp-timeline);
  border-color: var(--vp-timeline);
  color: #fff;
  font-size: 0.9375rem;
}

.current .timeline-dot {
  border-color: var(--vp-timeline);
  color: var(--vp-timeline);
}

.rejected .timeline-dot {
  background: var(--bs-danger);
  border-color: var(--bs-danger);
  color: #fff;
}

.timeline-title {
  font-weight: 600;
}

.pending .timeline-title {
  color: var(--vp-muted);
  font-weight: 500;
}

.timeline-note {
  font-size: 0.875rem;
  color: var(--vp-muted);
  margin-top: 0.125rem;
}

.rejected .timeline-note {
  color: var(--bs-danger);
}

.timeline-time {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.next-icon {
  font-size: 1.25rem;
  line-height: 1.2;
}
</style>
