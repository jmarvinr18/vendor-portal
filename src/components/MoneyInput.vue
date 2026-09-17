<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatNumber } from '@/utils/format'

const model = defineModel<number | null>({ required: true })
defineProps<{ id: string; invalid?: boolean; required?: boolean }>()
const emit = defineEmits<{ edited: [] }>()

const focused = ref(false)
const text = ref('')

// Show the raw number while editing and a formatted value (e.g. 125,000.00) otherwise.
const displayValue = computed(() => (focused.value ? text.value : formatNumber(model.value)))

function onFocus() {
  text.value = model.value == null ? '' : String(model.value)
  focused.value = true
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  let raw = input.value.replace(/[^0-9.]/g, '')
  const [whole, ...rest] = raw.split('.')
  if (rest.length) raw = `${whole}.${rest.join('').slice(0, 2)}`
  input.value = raw
  text.value = raw
  model.value = raw === '' || raw === '.' ? null : Number(raw)
  emit('edited')
}
</script>

<template>
  <div class="input-group has-validation">
    <span class="input-group-text">PHP</span>
    <input
      :id
      type="text"
      inputmode="decimal"
      class="form-control"
      :class="{ 'is-invalid': invalid }"
      :value="displayValue"
      :required
      placeholder="0.00"
      autocomplete="off"
      @focus="onFocus"
      @blur="focused = false"
      @input="onInput"
    />
    <slot />
  </div>
</template>
