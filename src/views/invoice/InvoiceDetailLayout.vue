<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useCurrentInvoice } from '@/composables/useCurrentInvoice'

const invoice = useCurrentInvoice()

const sections = [
  { name: 'invoice-details', label: 'Details', icon: 'bi-file-earmark-text' },
  { name: 'invoice-timeline', label: 'Timeline', icon: 'bi-clock-history' },
  { name: 'invoice-comments', label: 'Comments', icon: 'bi-chat-left-text' },
]
</script>

<template>
  <div>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <RouterLink :to="{ name: 'invoice-status' }" class="back-link">
        <i class="bi bi-chevron-left"></i>Back to Invoice Status
      </RouterLink>

      <nav v-if="invoice" class="section-nav" aria-label="Invoice sections">
        <span class="section-nav-invoice">{{ invoice.invoiceNo }}</span>
        <RouterLink
          v-for="section in sections"
          :key="section.name"
          :to="{ name: section.name, params: { id: invoice.id } }"
          class="section-nav-link"
          exact-active-class="active"
        >
          <i class="bi" :class="section.icon"></i>{{ section.label }}
        </RouterLink>
      </nav>
    </div>

    <RouterView v-if="invoice" />

    <div v-else class="vp-card text-center py-5">
      <i class="bi bi-search fs-1 text-body-secondary"></i>
      <p class="mt-3 mb-4 text-body-secondary">We couldn't find that invoice.</p>
      <RouterLink :to="{ name: 'invoice-status' }" class="btn btn-gold">
        Back to Invoice Status
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.back-link:hover {
  color: var(--vp-text);
}

.section-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--vp-surface);
  border: 1px solid var(--vp-border);
  border-radius: 0.5rem;
  padding: 0.25rem;
  font-size: 0.8125rem;
}

.section-nav-invoice {
  font-weight: 600;
  padding: 0 0.625rem;
  border-right: 1px solid var(--vp-border);
  margin-right: 0.25rem;
}

.section-nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.75rem;
  border-radius: 0.375rem;
  color: var(--vp-text);
  text-decoration: none;
  font-weight: 500;
}

.section-nav-link:hover {
  background: #f1f3f6;
}

.section-nav-link.active {
  background: var(--vp-gold);
  font-weight: 600;
}

@media (max-width: 575.98px) {
  .section-nav-invoice {
    display: none;
  }
}
</style>
