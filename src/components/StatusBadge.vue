<script setup lang="ts">
import type { InvoiceStatus } from '@/data/invoices'

defineProps<{ status: InvoiceStatus; size?: 'lg' }>()

const variants: Record<InvoiceStatus, string> = {
  Draft: 'draft',
  Submitted: 'submitted',
  'Under Review': 'review',
  Approved: 'approved',
  Paid: 'paid',
  Rejected: 'rejected',
}
</script>

<template>
  <span
    class="status-badge"
    :class="[`status-${variants[status]}`, { 'status-lg': size === 'lg' }]"
  >
    {{ status }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 0.1875rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.4;
}

.status-lg {
  padding: 0.375rem 0.875rem;
  font-size: 1rem;
}

.status-draft {
  background: #eceef1;
  color: #4f5663;
}

.status-submitted {
  background: #dfe8f4;
  color: #26508a;
}

.status-review {
  background: #fdefcf;
  color: #8a5d00;
}

.status-approved,
.status-paid {
  background: #e0f1e1;
  color: #2d7a33;
}

.status-rejected {
  background: #fbe0de;
  color: #b0302a;
}
</style>
