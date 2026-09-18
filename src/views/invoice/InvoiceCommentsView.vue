<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCurrentInvoice } from '@/composables/useCurrentInvoice'
import { useInvoicesStore } from '@/stores/invoices'
import { stagesFor } from '@/data/invoices'
import { formatIsoDateTime } from '@/utils/format'

const invoice = useCurrentInvoice()
const store = useInvoicesStore()

const tab = ref<'comments' | 'activity'>('comments')
const message = ref('')
const MAX_LENGTH = 1000

const comments = computed(() =>
  [...(invoice.value?.comments ?? [])].sort((a, b) => b.postedOn.localeCompare(a.postedOn)),
)

interface ActivityEntry {
  time: string
  actor: string
  action: string
  icon: string
}

// Derived from the stage history, uploaded documents and comments.
const activity = computed<ActivityEntry[]>(() => {
  const inv = invoice.value
  if (!inv) return []
  const entries: ActivityEntry[] = []
  for (const stage of stagesFor(inv)) {
    if (!stage.time || stage.state === 'pending') continue
    if (stage.label === 'Submitted') {
      entries.push({
        time: stage.time,
        actor: 'Vendor',
        action: 'Submitted the invoice',
        icon: 'bi-send',
      })
    } else {
      entries.push({
        time: stage.time,
        actor: 'System',
        action: `Moved to ${stage.label}`,
        icon: 'bi-arrow-right-circle',
      })
    }
  }
  for (const doc of inv.documents) {
    entries.push({
      time: doc.uploadedOn,
      actor: 'Vendor',
      action: `Uploaded ${doc.name}`,
      icon: 'bi-paperclip',
    })
  }
  for (const comment of inv.comments) {
    entries.push({
      time: comment.postedOn,
      actor: comment.author,
      action: 'Posted a comment',
      icon: 'bi-chat-left-text',
    })
  }
  return entries.sort((a, b) => b.time.localeCompare(a.time))
})

function post() {
  const text = message.value.trim()
  if (!text || !invoice.value) return
  store.addComment(invoice.value.id, text)
  message.value = ''
}
</script>

<template>
  <div v-if="invoice">
    <ul class="nav vp-tabs mb-4" role="tablist">
      <li class="nav-item" role="presentation">
        <button
          class="nav-link"
          :class="{ active: tab === 'comments' }"
          role="tab"
          :aria-selected="tab === 'comments'"
          @click="tab = 'comments'"
        >
          Comments
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button
          class="nav-link"
          :class="{ active: tab === 'activity' }"
          role="tab"
          :aria-selected="tab === 'activity'"
          @click="tab = 'activity'"
        >
          Activity Log
        </button>
      </li>
    </ul>

    <section v-if="tab === 'comments'" class="vp-card" role="tabpanel">
      <form class="comment-form" @submit.prevent="post">
        <label for="newComment" class="visually-hidden">Add a comment</label>
        <textarea
          id="newComment"
          v-model="message"
          class="form-control border-0 shadow-none"
          rows="3"
          :maxlength="MAX_LENGTH"
          placeholder="Add a comment (visible to AP and approvers)..."
          @keydown.ctrl.enter="post"
          @keydown.meta.enter="post"
        ></textarea>
        <div class="d-flex justify-content-between align-items-center px-2 pb-2">
          <span class="small text-body-secondary"> {{ message.length }}/{{ MAX_LENGTH }} </span>
          <button type="submit" class="btn btn-post" :disabled="!message.trim()">Post</button>
        </div>
      </form>

      <ul class="list-unstyled comment-list mb-4">
        <li v-for="comment in comments" :key="comment.id" class="comment">
          <span
            class="avatar"
            :class="comment.author === 'AP Team' ? 'avatar-ap' : 'avatar-vendor'"
          >
            <i class="bi" :class="comment.author === 'AP Team' ? 'bi-building' : 'bi-person'"></i>
          </span>
          <div class="min-w-0">
            <div class="fw-bold">{{ comment.author }}</div>
            <p class="comment-text">{{ comment.message }}</p>
            <div class="comment-time">{{ formatIsoDateTime(comment.postedOn) }}</div>
          </div>
        </li>
        <li v-if="!comments.length" class="text-body-secondary text-center py-4">
          No comments yet.
        </li>
      </ul>

      <div class="vp-info">
        <i class="bi bi-info-circle"></i>
        <span>For any inquiries, please contact Accounts Payable.</span>
      </div>
    </section>

    <section v-else class="vp-card" role="tabpanel">
      <ul class="list-unstyled activity-list mb-0">
        <li v-for="(entry, i) in activity" :key="i" class="activity">
          <span class="activity-icon"><i class="bi" :class="entry.icon"></i></span>
          <div class="flex-grow-1">
            <div>
              <span class="fw-semibold">{{ entry.actor }}</span>
              <span class="text-body-secondary"> &middot; </span>{{ entry.action }}
            </div>
            <div class="comment-time">{{ formatIsoDateTime(entry.time) }}</div>
          </div>
        </li>
        <li v-if="!activity.length" class="text-body-secondary text-center py-4">
          No activity yet.
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.vp-tabs {
  gap: 2rem;
  border-bottom: 1px solid var(--vp-border);
}

.vp-tabs .nav-link {
  padding: 0.75rem 0.25rem;
  color: var(--vp-text);
  font-weight: 600;
  font-size: 1.0625rem;
  border: 0;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  background: none;
}

.vp-tabs .nav-link.active {
  border-bottom-color: var(--vp-navy);
}

.vp-tabs .nav-link:not(.active) {
  color: var(--vp-muted);
}

.comment-form {
  border: 1px solid #cdd2d9;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.comment-form:focus-within {
  border-color: var(--vp-gold);
  box-shadow: 0 0 0 0.2rem rgba(244, 180, 58, 0.25);
}

.btn-post {
  --bs-btn-bg: #e7e9ec;
  --bs-btn-color: var(--vp-text);
  --bs-btn-border-color: #d4d8de;
  --bs-btn-hover-bg: var(--vp-gold);
  --bs-btn-hover-border-color: var(--vp-gold);
  --bs-btn-disabled-bg: #eef0f2;
  --bs-btn-disabled-border-color: #e0e3e7;
  --bs-btn-padding-x: 1.75rem;
}

.comment {
  display: flex;
  gap: 1rem;
  padding: 1.25rem 0.5rem;
  border-bottom: 1px solid var(--vp-border);
}

.avatar {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.375rem;
}

.avatar-ap {
  background: #2f6b34;
  color: var(--vp-gold);
}

.avatar-vendor {
  background: #eef0f3;
  color: var(--vp-text);
  border: 1px solid var(--vp-border);
}

.min-w-0 {
  min-width: 0;
}

.comment-text {
  margin: 0.25rem 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-time {
  font-size: 0.875rem;
  color: var(--vp-muted);
}

.activity {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem 0.25rem;
  border-bottom: 1px solid var(--vp-border);
}

.activity:last-child {
  border-bottom: 0;
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #eef2f8;
  color: var(--vp-timeline);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
</style>
