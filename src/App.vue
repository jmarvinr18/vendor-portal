<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import { useReferenceDataStore } from './stores/referenceData'

const referenceData = useReferenceDataStore()
onMounted(() => referenceData.load())
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <div class="app-body">
      <AppSidebar />
      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>
