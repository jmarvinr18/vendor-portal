<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string | undefined) ?? 'Page')
</script>

<template>
  <div>
    <h1 class="page-title mb-4">{{ title }}</h1>
    <div class="vp-card text-center py-5">
      <i class="bi bi-tools fs-1 text-body-secondary"></i>
      <p class="mt-3 mb-4 text-body-secondary">This section is coming soon.</p>
      <RouterLink to="/submit-invoice" class="btn btn-gold">Submit an Invoice</RouterLink>
    </div>
  </div>
</template>
