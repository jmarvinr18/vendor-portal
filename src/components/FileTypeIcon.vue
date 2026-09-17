<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ extension: string; variant?: 'label' | 'glyph' }>()

const icon = computed(() => {
  const ext = props.extension.toLowerCase()
  if (props.variant === 'glyph') {
    return ext === 'pdf'
      ? { cls: 'bi-file-earmark-pdf', color: '#c0392b' }
      : { cls: 'bi-file-earmark-image', color: '#3f8a45' }
  }
  if (ext === 'pdf') return { cls: 'bi-filetype-pdf', color: '#c0392b' }
  if (ext === 'png') return { cls: 'bi-filetype-png', color: '#2f6fb3' }
  return { cls: 'bi-filetype-jpg', color: '#e08a1e' }
})
</script>

<template>
  <i
    class="bi file-type-icon"
    :class="icon.cls"
    :style="{ color: icon.color }"
    aria-hidden="true"
  ></i>
</template>

<style scoped>
.file-type-icon {
  font-size: 2rem;
  line-height: 1;
}
</style>
