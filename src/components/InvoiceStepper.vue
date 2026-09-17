<script setup lang="ts">
import type { Step } from '@/stores/invoice'

defineProps<{ current: Step }>()
const emit = defineEmits<{ select: [step: Step] }>()

const steps: { number: Step; label: string }[] = [
  { number: 1, label: 'Invoice Details' },
  { number: 2, label: 'Supporting Documents' },
  { number: 3, label: 'Review & Submit' },
]
</script>

<template>
  <ol class="stepper" aria-label="Submission progress">
    <template v-for="(step, index) in steps" :key="step.number">
      <li
        class="stepper-step"
        :class="{ active: step.number === current, done: step.number < current }"
        :aria-current="step.number === current ? 'step' : undefined"
      >
        <button
          type="button"
          class="stepper-button"
          :disabled="step.number >= current"
          @click="emit('select', step.number)"
        >
          <span class="stepper-circle">
            <i v-if="step.number < current" class="bi bi-check-lg"></i>
            <template v-else>{{ step.number }}</template>
          </span>
          <span class="stepper-label">{{ step.label }}</span>
        </button>
      </li>
      <li v-if="index < steps.length - 1" class="stepper-line" aria-hidden="true"></li>
    </template>
  </ol>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  max-width: 820px;
}

.stepper-line {
  flex: 1;
  height: 1px;
  min-width: 1.5rem;
  background: #cfd3da;
  margin: 0 1rem;
}

.stepper-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: none;
  border: 0;
  padding: 0;
  color: var(--vp-text);
  font-weight: 500;
  font-size: 0.9375rem;
  white-space: nowrap;
}

.stepper-button:disabled {
  cursor: default;
  opacity: 1;
}

.stepper-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1.5px solid #c3c8cf;
  background: var(--vp-surface);
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.stepper-step.active .stepper-circle {
  background: var(--vp-gold);
  border-color: var(--vp-gold);
}

.stepper-step.active .stepper-label {
  font-weight: 700;
}

.stepper-step.done .stepper-circle {
  background: var(--vp-green);
  border-color: var(--vp-green);
  color: #fff;
  font-size: 1.125rem;
}

.stepper-step.done .stepper-button:hover .stepper-label {
  text-decoration: underline;
}

@media (max-width: 767.98px) {
  .stepper-step:not(.active) .stepper-label {
    display: none;
  }

  .stepper-line {
    margin: 0 0.5rem;
  }
}
</style>
