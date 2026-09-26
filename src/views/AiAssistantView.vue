<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { AI_UNAVAILABLE_MESSAGE, useAiChatStore } from '@/stores/aiChat'
import { messageParts, orderedCitations } from '@/utils/aiMessage'
import type { AiConversation } from '@/schema'

const route = useRoute()
const router = useRouter()
const chat = useAiChatStore()
const { service, conversations, current, messages, sending, streaming, failed } = storeToRefs(chat)

const MAX_LENGTH = 4000
const STARTER_PROMPTS = [
  'Where is my latest invoice?',
  'What documents do I need to submit an invoice?',
  'Why was one of my invoices rejected?',
  'When will my approved invoices be paid?',
]

const draft = ref('')
const search = ref('')
const showConversations = ref(false)
const editingTitle = ref(false)
const titleInput = ref('')
const messageList = ref<HTMLElement>()
const composer = ref<HTMLTextAreaElement>()

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return conversations.value
  return conversations.value.filter(
    (c) =>
      c.title.toLowerCase().includes(term) ||
      c.messages.some((m) => m.content.toLowerCase().includes(term)),
  )
})

// ----- Route ↔ selection -----

watch(
  () => route.params.sessionId,
  (id) => {
    editingTitle.value = false
    if (typeof id === 'string' && id) chat.open(id)
    else chat.startNew()
  },
  { immediate: true },
)

onBeforeUnmount(() => chat.stop())

function openConversation(conversation: AiConversation) {
  showConversations.value = false
  router.push({ name: 'ai-assistant', params: { sessionId: conversation.id } })
}

// ----- Messages -----

function scrollToBottom() {
  nextTick(() => {
    const el = messageList.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(() => messages.value.length, scrollToBottom)
// Keep the newest text in view while the answer is being written.
watch(() => streaming.value?.content, scrollToBottom)

function autosize() {
  const el = composer.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

async function retry() {
  const id = await chat.retry()
  // A retry after the conversation was lost starts a new one, with a new id.
  if (id && id !== route.params.sessionId) {
    router.replace({ name: 'ai-assistant', params: { sessionId: id } })
  }
}

async function send(text = draft.value) {
  if (!text.trim() || sending.value) return
  draft.value = ''
  nextTick(autosize)
  const started = !current.value
  const id = await chat.send(text)
  if (started && id) router.replace({ name: 'ai-assistant', params: { sessionId: id } })
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    send()
  }
}

// ----- Conversation actions -----

function beginRename() {
  if (!current.value) return
  titleInput.value = current.value.title
  editingTitle.value = true
  nextTick(() => document.getElementById('conversationTitle')?.focus())
}

function saveRename() {
  if (current.value && titleInput.value.trim()) chat.rename(current.value.id, titleInput.value)
  editingTitle.value = false
}

function removeCurrent() {
  const id = current.value?.id
  if (!id) return
  if (!window.confirm('Remove this conversation from this browser?')) return
  chat.remove(id)
  router.push({ name: 'ai-assistant' })
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  const sameDay = date.toDateString() === new Date().toDateString()
  return sameDay
    ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="ai-page">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <div>
        <h1 class="page-title">AI Assistant</h1>
        <p class="section-subtitle mb-0">
          Ask about submitting invoices, their status, documents and payments.
        </p>
      </div>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-outline-vp d-lg-none"
          :aria-expanded="showConversations"
          aria-controls="aiConversations"
          @click="showConversations = !showConversations"
        >
          <i class="bi bi-chat-left-text me-2"></i>Conversations
        </button>
        <RouterLink :to="{ name: 'ai-assistant' }" class="btn btn-gold">
          <i class="bi bi-plus-lg me-2"></i>New Chat
        </RouterLink>
      </div>
    </div>

    <div v-if="service === 'unavailable'" class="alert alert-warning d-flex gap-2" role="status">
      <i class="bi bi-plug"></i>
      <span>{{ AI_UNAVAILABLE_MESSAGE }}</span>
    </div>

    <div class="ai-layout">
      <!-- Conversations -->
      <aside
        id="aiConversations"
        class="vp-card ai-sessions p-0"
        :class="{ 'd-none d-lg-flex': !showConversations }"
        aria-label="Conversations"
      >
        <div class="p-3 border-bottom">
          <label for="conversationSearch" class="visually-hidden">Search conversations</label>
          <div class="search-box">
            <input
              id="conversationSearch"
              v-model="search"
              type="search"
              class="form-control form-control-sm"
              placeholder="Search conversations"
            />
            <i class="bi bi-search"></i>
          </div>
        </div>
        <ul class="list-unstyled session-list mb-0">
          <li v-for="conversation in filtered" :key="conversation.id">
            <button
              type="button"
              class="session-item"
              :class="{ active: current?.id === conversation.id }"
              :aria-current="current?.id === conversation.id ? 'true' : undefined"
              @click="openConversation(conversation)"
            >
              <i class="bi bi-chat-left-text session-icon"></i>
              <span class="min-w-0 flex-grow-1">
                <span class="session-title">{{ conversation.title }}</span>
                <span class="session-meta"> {{ conversation.messages.length }} messages </span>
              </span>
              <span class="session-time">{{ timeLabel(conversation.updatedAt) }}</span>
            </button>
          </li>
          <li v-if="!filtered.length" class="session-empty">
            {{ search ? 'No conversations match your search.' : 'No conversations yet.' }}
          </li>
        </ul>
        <p v-if="conversations.length" class="storage-note">
          Conversations are listed on this device only.
        </p>
      </aside>

      <!-- Conversation -->
      <section class="vp-card ai-main p-0">
        <header class="conversation-header">
          <span class="assistant-icon"><i class="bi bi-stars"></i></span>
          <div class="min-w-0 flex-grow-1">
            <template v-if="editingTitle">
              <label for="conversationTitle" class="visually-hidden">Conversation title</label>
              <input
                id="conversationTitle"
                v-model="titleInput"
                class="form-control form-control-sm"
                maxlength="120"
                @keydown.enter.prevent="saveRename"
                @keydown.esc="editingTitle = false"
                @blur="saveRename"
              />
            </template>
            <template v-else>
              <div class="conversation-title text-truncate">
                {{ current?.title ?? 'New conversation' }}
              </div>
              <div class="small text-body-secondary">AP Vendor Assistant</div>
            </template>
          </div>
          <div v-if="current" class="d-flex gap-1">
            <button
              type="button"
              class="btn btn-sm btn-link text-body"
              title="Rename"
              aria-label="Rename conversation"
              @click="beginRename"
            >
              <i class="bi bi-pencil"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-link text-body"
              title="Remove"
              aria-label="Remove conversation"
              @click="removeCurrent"
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </header>

        <div ref="messageList" class="message-list">
          <!-- Nothing asked yet -->
          <div v-if="!messages.length" class="starter">
            <span class="assistant-icon assistant-icon-lg"><i class="bi bi-stars"></i></span>
            <h2 class="section-title mt-3">How can I help?</h2>
            <p class="section-subtitle mb-4">
              I can look up your invoices, explain what AP needs, and help you fix and resubmit
              rejected invoices.
            </p>
            <div class="d-flex flex-column gap-2 w-100 starter-prompts">
              <button
                v-for="prompt in STARTER_PROMPTS"
                :key="prompt"
                type="button"
                class="btn starter-prompt"
                :disabled="sending"
                @click="send(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="message.role === 'user' ? 'message-user' : 'message-assistant'"
          >
            <span v-if="message.role === 'assistant'" class="assistant-icon assistant-icon-sm">
              <i class="bi bi-stars"></i>
            </span>
            <div class="message-body">
              <div class="bubble">
                <template
                  v-for="(part, index) in messageParts(message.content, message.citations)"
                  :key="index"
                >
                  <RouterLink
                    v-if="part.citation && part.citation.type === 'invoice'"
                    :to="{ name: 'invoice-details', params: { id: part.citation.id } }"
                    class="inline-citation"
                    :class="part.kind"
                    :title="`Open ${part.citation.label}`"
                    >{{ part.text }}</RouterLink
                  >
                  <span
                    v-else-if="part.citation"
                    class="inline-citation"
                    :class="part.kind"
                    :title="part.citation.label"
                    >{{ part.text }}</span
                  >
                  <template v-else>{{ part.text }}</template> </template
                ><span v-if="message.id === 'streaming'" class="caret" aria-hidden="true"></span>
              </div>
              <div v-if="message.citations?.length" class="citations">
                <span class="citations-label">Sources</span>
                <template
                  v-for="citation in orderedCitations(message.content, message.citations)"
                  :key="`${citation.type}:${citation.id}`"
                >
                  <RouterLink
                    v-if="citation.type === 'invoice'"
                    :to="{ name: 'invoice-details', params: { id: citation.id } }"
                    class="citation"
                  >
                    <i class="bi bi-receipt me-1"></i>{{ citation.label }}
                  </RouterLink>
                  <span v-else class="citation">
                    <i
                      class="bi me-1"
                      :class="citation.type === 'document' ? 'bi-paperclip' : 'bi-journal-text'"
                    ></i>
                    {{ citation.label }}
                  </span>
                </template>
              </div>
              <div v-if="message.id !== 'streaming'" class="message-time">
                {{ timeLabel(message.createdAt) }}
              </div>
            </div>
          </div>

          <!-- Waiting for the first words of the answer -->
          <div v-if="sending && !streaming" class="message message-assistant" role="status">
            <span class="assistant-icon assistant-icon-sm"><i class="bi bi-stars"></i></span>
            <div class="bubble typing" aria-label="The assistant is thinking">
              <span></span><span></span><span></span>
            </div>
          </div>

          <div v-if="failed" class="send-error" role="alert">
            <i class="bi bi-exclamation-circle me-1"></i>{{ failed.error }}
            <button
              type="button"
              class="btn btn-link btn-sm p-0 ms-2 align-baseline"
              @click="retry"
            >
              Try again
            </button>
          </div>
        </div>

        <form class="composer" @submit.prevent="send()">
          <label for="aiComposer" class="visually-hidden">Message</label>
          <textarea
            id="aiComposer"
            ref="composer"
            v-model="draft"
            class="form-control"
            rows="1"
            :maxlength="MAX_LENGTH"
            placeholder="Ask about an invoice, a document or a payment…"
            @input="autosize"
            @keydown="onComposerKeydown"
          ></textarea>
          <button
            v-if="sending"
            type="button"
            class="btn btn-outline-vp send-button"
            title="Stop"
            aria-label="Stop answering"
            @click="chat.stop()"
          >
            <i class="bi bi-stop-fill"></i>
          </button>
          <button
            v-else
            type="submit"
            class="btn btn-gold send-button"
            :disabled="!draft.trim()"
            aria-label="Send message"
          >
            <i class="bi bi-send"></i>
          </button>
        </form>
        <p class="disclaimer">
          AI can make mistakes. Check important details against your invoice records. The assistant
          can look things up but never submits, edits or comments for you.
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ai-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 1.25rem;
  height: calc(100vh - var(--vp-header-height) - 11rem);
  min-height: 520px;
}

@media (max-width: 991.98px) {
  .ai-layout {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .ai-sessions {
    max-height: 320px;
  }

  .ai-main {
    height: calc(100vh - var(--vp-header-height) - 9rem);
    min-height: 480px;
  }
}

.min-w-0 {
  min-width: 0;
}

/* ----- Conversations ----- */
.ai-sessions {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-box {
  position: relative;
}

.search-box .form-control {
  padding-right: 2rem;
}

.search-box .bi-search {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--vp-muted);
  font-size: 0.8125rem;
}

.session-list {
  overflow-y: auto;
  flex: 1;
  padding: 0.5rem;
}

.session-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 0.375rem;
  padding: 0.625rem;
  color: var(--vp-text);
}

.session-item:hover {
  background: #f4f5f7;
}

.session-item.active {
  background: var(--vp-gold-soft);
}

.session-icon {
  font-size: 1rem;
  line-height: 1.4;
  color: var(--vp-muted);
}

.session-title {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta,
.session-time {
  font-size: 0.75rem;
  color: var(--vp-muted);
}

.session-meta {
  display: block;
}

.session-time {
  white-space: nowrap;
}

.session-empty {
  padding: 1.5rem 0.75rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--vp-muted);
}

.storage-note {
  border-top: 1px solid var(--vp-border);
  margin: 0;
  padding: 0.625rem 0.875rem;
  font-size: 0.6875rem;
  color: var(--vp-muted);
}

/* ----- Conversation ----- */
.ai-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.conversation-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--vp-border);
}

.conversation-title {
  font-weight: 700;
}

.assistant-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--vp-gold-soft);
  display: grid;
  place-items: center;
  font-size: 0.9375rem;
  flex-shrink: 0;
}

.assistant-icon-sm {
  width: 28px;
  height: 28px;
  font-size: 0.8125rem;
}

.assistant-icon-lg {
  width: 56px;
  height: 56px;
  font-size: 1.5rem;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.starter {
  margin: auto;
  max-width: 520px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.starter-prompt {
  --bs-btn-bg: var(--vp-surface);
  --bs-btn-border-color: var(--vp-border);
  --bs-btn-hover-bg: var(--vp-gold-soft);
  --bs-btn-hover-border-color: #e9c77e;
  --bs-btn-font-weight: 500;
  text-align: left;
  font-size: 0.875rem;
}

.message {
  display: flex;
  gap: 0.625rem;
  max-width: 85%;
}

.message-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-body {
  min-width: 0;
}

.bubble {
  padding: 0.625rem 0.875rem;
  border-radius: 0.75rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.message-assistant .bubble {
  background: #f4f5f7;
  border-top-left-radius: 0.25rem;
}

.message-user .bubble {
  background: var(--vp-gold-soft);
  border-top-right-radius: 0.25rem;
}

/* Blinking cursor at the end of the answer being written. */
.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--vp-text);
  animation: blink-caret 1s step-end infinite;
}

@keyframes blink-caret {
  50% {
    opacity: 0;
  }
}

.message-time {
  font-size: 0.6875rem;
  color: var(--vp-muted);
  margin-top: 0.25rem;
}

.message-user .message-time {
  text-align: right;
}

/* A citation referenced inside the answer. */
.inline-citation {
  color: var(--bs-link-color);
  text-decoration: none;
}

.inline-citation.mention {
  font-weight: 600;
  border-bottom: 1px dotted currentColor;
}

a.inline-citation.mention:hover {
  border-bottom-style: solid;
}

/* A numbered marker: [1] in the text becomes a small superscript badge. */
.inline-citation.marker {
  display: inline-block;
  min-width: 1.1em;
  padding: 0 0.25em;
  margin-left: 0.15em;
  border-radius: 0.25rem;
  background: #e4e9f0;
  color: var(--bs-link-color);
  font-size: 0.6875em;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  vertical-align: super;
}

a.inline-citation.marker:hover {
  background: var(--vp-gold-soft);
}

.citations {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.citations-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-muted);
}

.citation {
  font-size: 0.75rem;
  border: 1px solid var(--vp-border);
  border-radius: 999px;
  padding: 0.125rem 0.625rem;
  text-decoration: none;
  color: var(--vp-text);
}

a.citation:hover {
  border-color: var(--vp-gold);
}

.typing {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  background: #f4f5f7;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9aa1ab;
  animation: blink 1.2s infinite ease-in-out;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing span,
  .caret {
    animation: none;
  }
}

.send-error {
  align-self: flex-end;
  font-size: 0.8125rem;
  color: var(--bs-danger);
  max-width: 85%;
  text-align: right;
}

.composer {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  padding: 0.875rem 1.25rem 0.5rem;
  border-top: 1px solid var(--vp-border);
}

.composer textarea {
  resize: none;
  min-height: 42px;
  max-height: 180px;
}

.send-button {
  --bs-btn-padding-x: 0.875rem;
  height: 42px;
}

.disclaimer {
  font-size: 0.6875rem;
  color: var(--vp-muted);
  padding: 0 1.25rem 0.75rem;
  margin: 0;
}
</style>
