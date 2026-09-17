<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useInvoiceStore } from '@/stores/invoice'

const router = useRouter()
const store = useInvoiceStore()
const { submission } = storeToRefs(store)

if (!submission.value) router.replace({ name: 'submit-invoice' })

function submitAnother() {
  store.reset()
  submission.value = null
  router.push({ name: 'submit-invoice' })
}

// Decorative confetti around the check mark: [x%, y%, shape, rotation]
const confetti: [number, number, 'dot' | 'diamond', number][] = [
  [8, 30, 'diamond', 10],
  [20, 45, 'dot', 0],
  [14, 70, 'dot', 0],
  [26, 20, 'dot', 0],
  [30, 88, 'diamond', 25],
  [40, 5, 'diamond', 40],
  [62, 8, 'dot', 0],
  [72, 25, 'dot', 0],
  [80, 55, 'diamond', 15],
  [88, 22, 'dot', 0],
  [92, 42, 'dot', 0],
  [70, 92, 'diamond', 30],
  [85, 78, 'dot', 0],
]
</script>

<template>
  <div v-if="submission" class="success-page text-center">
    <div class="success-hero">
      <span
        v-for="([x, y, shape, rotate], i) in confetti"
        :key="i"
        class="confetti"
        :class="[shape, i % 3 === 0 ? 'gold' : 'dark']"
        :style="{ left: `${x}%`, top: `${y}%`, transform: `rotate(${rotate}deg)` }"
      ></span>
      <div class="success-check">
        <i class="bi bi-check-lg"></i>
      </div>
    </div>

    <h1 class="success-title">Invoice Submitted Successfully!</h1>
    <p class="success-subtitle">Your invoice has been submitted and is now under review.</p>

    <div class="vp-card success-details text-start">
      <dl class="mb-0">
        <dt>Invoice No.</dt>
        <dd>{{ submission.invoiceNo }}</dd>
        <dt>Invoice Date</dt>
        <dd>{{ submission.invoiceDate }}</dd>
        <dt>Submitted On</dt>
        <dd>{{ submission.submittedOn }}</dd>
        <dt>Reference No.</dt>
        <dd>{{ submission.referenceNo }}</dd>
      </dl>
    </div>

    <div class="vp-info success-note text-start">
      <i class="bi bi-info-circle"></i>
      <span>You will receive a notification once there is an update on your invoice status.</span>
    </div>

    <div class="success-actions">
      <RouterLink to="/my-invoices" class="btn btn-gold btn-lg">
        View My Invoices <i class="bi bi-arrow-right ms-3"></i>
      </RouterLink>
      <button type="button" class="btn btn-outline-vp btn-lg" @click="submitAnother">
        Submit Another Invoice
      </button>
    </div>
  </div>
</template>

<style scoped>
.success-page {
  max-width: 760px;
  margin: 0 auto;
  padding-top: 1rem;
}

.success-hero {
  position: relative;
  width: 320px;
  height: 180px;
  margin: 0 auto 1rem;
  display: grid;
  place-items: center;
}

.success-check {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: var(--vp-green);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 5.5rem;
  box-shadow: 0 8px 24px rgba(63, 154, 69, 0.3);
  animation: pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.confetti {
  position: absolute;
  display: block;
}

.confetti.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.confetti.diamond {
  width: 9px;
  height: 9px;
  border-radius: 1px;
}

.confetti.dark {
  background: #4a4f58;
}

.confetti.gold {
  background: var(--vp-gold);
}

.success-title {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.success-subtitle {
  font-size: 1.125rem;
  color: var(--vp-muted);
  margin-bottom: 2rem;
}

.success-details {
  padding: 1.75rem 2.5rem;
}

.success-details dl {
  display: grid;
  grid-template-columns: 40% 1fr;
  gap: 1rem;
  font-size: 1.0625rem;
}

.success-details dt {
  font-weight: 400;
  color: var(--vp-muted);
}

.success-details dd {
  margin: 0;
  font-weight: 500;
}

.success-note {
  margin: 1.5rem 0;
  font-size: 0.9375rem;
  align-items: center;
}

.success-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 575.98px) {
  .success-details {
    padding: 1.25rem;
  }

  .success-details dl {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .success-details dd {
    margin-bottom: 0.75rem;
  }

  .success-actions {
    grid-template-columns: 1fr;
  }

  .success-hero {
    width: 260px;
  }
}
</style>
