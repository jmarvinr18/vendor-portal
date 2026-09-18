<script setup lang="ts">
import { computed } from 'vue'
import { stagesFor, type InvoiceRecord } from '@/data/invoices'
import { formatIsoDate } from '@/utils/format'

const props = defineProps<{ invoice: InvoiceRecord }>()
const stages = computed(() => stagesFor(props.invoice))

const icons = {
  done: 'bi-check-lg',
  current: 'bi-clock',
  rejected: 'bi-x-lg',
  pending: 'bi-circle',
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <ol class="mini-timeline" aria-label="Status timeline">
    <li v-for="stage in stages" :key="stage.label" class="mini-stage" :class="stage.state">
      <span class="mini-dot"><i class="bi" :class="icons[stage.state]"></i></span>
      <span class="mini-label">{{ stage.label }}</span>
      <span v-if="stage.time && stage.state !== 'pending'" class="mini-time">
        {{ formatIsoDate(stage.time) }}<br />{{ timeOf(stage.time) }}
      </span>
    </li>
  </ol>
</template>

<style scoped>
.mini-timeline {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  list-style: none;
  padding: 0;
  margin: 0;
}

.mini-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--vp-muted);
}

/* Connector to the next stage */
.mini-stage:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 11px;
  left: calc(50% + 13px);
  right: calc(-50% + 13px);
  height: 2px;
  background: #d5d9df;
}

.mini-stage.done:not(:last-child)::after {
  background: var(--vp-timeline);
}

.mini-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #c9ced6;
  background: var(--vp-surface);
  color: #b2b8c1;
  display: grid;
  place-items: center;
  font-size: 0.625rem;
  margin-bottom: 0.375rem;
}

.mini-stage.done .mini-dot {
  background: var(--vp-timeline);
  border-color: var(--vp-timeline);
  color: #fff;
  font-size: 0.8125rem;
}

.mini-stage.current .mini-dot {
  border-color: var(--vp-timeline);
  color: var(--vp-timeline);
  font-size: 0.75rem;
}

.mini-stage.rejected .mini-dot {
  background: var(--bs-danger);
  border-color: var(--bs-danger);
  color: #fff;
}

.mini-stage.done .mini-label,
.mini-stage.current .mini-label,
.mini-stage.rejected .mini-label {
  color: var(--vp-text);
  font-weight: 500;
}

.mini-label {
  line-height: 1.3;
}

.mini-time {
  margin-top: 0.25rem;
  font-size: 0.625rem;
  line-height: 1.35;
}
</style>
