<script setup lang="ts">
import { brand } from '@/config/brand'
</script>

<template>
  <div class="brand-logo">
    <!-- Generic placeholder mark; swap for your organization's logo. -->
    <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 2 35.6 11v18L20 38 4.4 29V11Z" fill="#161d2b" />
      <path d="M20 10 29 20 20 30 11 20Z" fill="#f4b43a" />
      <path d="M20 15.5 24.2 20 20 24.5 15.8 20Z" fill="#161d2b" />
    </svg>
    <span class="brand-name">{{ brand.companyName }}</span>
  </div>
</template>

<style scoped>
.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.brand-mark {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}

.brand-name {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--vp-navy);
  white-space: nowrap;
}
</style>
