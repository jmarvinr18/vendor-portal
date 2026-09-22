<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { AI_UNAVAILABLE_MESSAGE, useAiChatStore } from '@/stores/aiChat'
import { errorMessage } from '@/services/ApiService'
import type { AiAgent, AiSession } from '@/schema'

const route = useRoute()
const router = useRouter()
const chat = useAiChatStore()
const {
  service,
  agents,
  sessions,
  sessionsLoading,
  current,
  currentLoading,
  currentError,
  draftAgentId,
  sending,
  failed,
  activeAgent,
  messages,
} = storeToRefs(chat)

const MAX_LENGTH = 4000
const draft = ref('')
const search = ref('')
const showSessions = ref(false)
const editingTitle = ref(false)
const titleInput = ref('')
const actionError = ref<string | null>(null)
const messageList = ref<HTMLElement>()
const composer = ref<HTMLTextAreaElement>()

const inConversation = computed(() => !!current.value || !!draftAgentId.value)
const composerDisabled = computed(() => service.value === 'unavailable' || sending.value)

const filteredSessions = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return sessions.value
  return sessions.value.filter(
    (s) =>
      s.title.toLowerCase().includes(term) ||
      (chat.agentById(s.agentId)?.name.toLowerCase().includes(term) ?? false),
  )
})

// ----- Route ↔ selection -----

function syncFromRoute() {
  const sessionId = typeof route.params.sessionId === 'string' ? route.params.sessionId : ''
  const agentId = typeof route.query.agent === 'string' ? route.query.agent : ''
  actionError.value = null
  editingTitle.value = false
  if (sessionId) chat.open(sessionId)
  else if (agentId && chat.agentById(agentId)) chat.startDraft(agentId)
  else chat.clearSelection()
}

watch(() => [route.params.sessionId, route.query.agent], syncFromRoute)

onMounted(async () => {
  syncFromRoute()
  await chat.init()
})

function startChat(agent: AiAgent) {
  showSessions.value = false
  router.push({ name: 'ai-assistant', query: { agent: agent.id } })
  nextTick(() => composer.value?.focus())
}

function openSession(session: AiSession) {
  showSessions.value = false
  router.push({ name: 'ai-assistant', params: { sessionId: session.id } })
}

// ----- Messages -----

function scrollToBottom() {
  nextTick(() => {
    const el = messageList.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(() => messages.value.length, scrollToBottom)
watch(sending, scrollToBottom)

function autosize() {
  const el = composer.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

async function send(text = draft.value) {
  if (!text.trim() || composerDisabled.value) return
  draft.value = ''
  nextTick(autosize)
  const wasDraft = !current.value
  const id = await chat.send(text)
  // A new chat now exists on the server: give it its own URL.
  if (wasDraft && id) router.replace({ name: 'ai-assistant', params: { sessionId: id } })
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    send()
  }
}

// ----- Session actions -----

function beginRename() {
  if (!current.value) return
  titleInput.value = current.value.title
  editingTitle.value = true
  nextTick(() => document.getElementById('sessionTitleInput')?.focus())
}

async function saveRename() {
  const id = current.value?.id
  const title = titleInput.value.trim()
  editingTitle.value = false
  if (!id || !title || title === current.value?.title) return
  try {
    await chat.rename(id, title)
  } catch (error) {
    actionError.value = errorMessage(error, 'The conversation could not be renamed.')
  }
}

async function removeCurrent() {
  const id = current.value?.id
  if (!id || !window.confirm('Delete this conversation? This cannot be undone.')) return
  try {
    await chat.remove(id)
    router.push({ name: 'ai-assistant' })
  } catch (error) {
    actionError.value = errorMessage(error, 'The conversation could not be deleted.')
  }
}

// ----- Formatting -----

function timeLabel(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
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
          Ask questions about submitting invoices, their status and payments.
        </p>
      </div>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-outline-vp d-lg-none"
          :aria-expanded="showSessions"
          aria-controls="aiSessions"
          @click="showSessions = !showSessions"
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
        id="aiSessions"
        class="vp-card ai-sessions p-0"
        :class="{ 'd-none d-lg-flex': !showSessions }"
        aria-label="Conversations"
      >
        <div class="p-3 border-bottom">
          <label for="sessionSearch" class="visually-hidden">Search conversations</label>
          <div class="search-box">
            <input
              id="sessionSearch"
              v-model="search"
              type="search"
              class="form-control form-control-sm"
              placeholder="Search conversations"
            />
            <i class="bi bi-search"></i>
          </div>
        </div>
        <ul class="list-unstyled session-list mb-0">
          <li v-for="session in filteredSessions" :key="session.id">
            <button
              type="button"
              class="session-item"
              :class="{ active: current?.id === session.id }"
              :aria-current="current?.id === session.id ? 'true' : undefined"
              @click="openSession(session)"
            >
              <i
                class="bi session-icon"
                :class="chat.agentById(session.agentId)?.icon ?? 'bi-robot'"
              ></i>
              <span class="min-w-0 flex-grow-1">
                <span class="session-title">{{ session.title }}</span>
                <span class="session-meta">
                  {{ chat.agentById(session.agentId)?.name ?? 'Assistant' }}
                </span>
              </span>
              <span class="session-time">{{ timeLabel(session.updatedAt) }}</span>
            </button>
          </li>
          <li v-if="sessionsLoading" class="session-empty">
            <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading…
          </li>
          <li v-else-if="!filteredSessions.length" class="session-empty">
            {{ search ? 'No conversations match your search.' : 'No conversations yet.' }}
          </li>
        </ul>
      </aside>

      <!-- Conversation / agent gallery -->
      <section class="vp-card ai-main p-0" aria-live="polite">
        <!-- Agent gallery -->
        <div v-if="!inConversation && !currentLoading && !currentError" class="p-4 gallery">
          <h2 class="section-title">Choose an assistant</h2>
          <p class="section-subtitle mb-4">
            Each agent specialises in one part of the invoice process.
          </p>
          <div class="agent-grid">
            <article v-for="agent in agents" :key="agent.id" class="agent-card">
              <div class="d-flex align-items-start gap-3 mb-2">
                <span class="agent-icon"><i class="bi" :class="agent.icon"></i></span>
                <div class="min-w-0">
                  <h3 class="agent-name">{{ agent.name }}</h3>
                  <span v-if="agent.status === 'preview'" class="badge preview-badge">Preview</span>
                </div>
              </div>
              <p class="agent-description">{{ agent.description }}</p>
              <button
                type="button"
                class="btn btn-outline-vp btn-sm mt-auto"
                @click="startChat(agent)"
              >
                Start Chat
              </button>
            </article>
          </div>
        </div>

        <div v-else-if="currentLoading" class="conversation-state" role="status">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading
          conversation…
        </div>

        <div v-else-if="currentError" class="conversation-state">
          <i class="bi bi-chat-left-dots fs-1 text-body-secondary"></i>
          <p class="mt-3 mb-3">{{ currentError }}</p>
          <RouterLink :to="{ name: 'ai-assistant' }" class="btn btn-gold btn-sm">
            Start a New Chat
          </RouterLink>
        </div>

        <!-- Conversation -->
        <template v-else>
          <header class="conversation-header">
            <span class="agent-icon agent-icon-sm">
              <i class="bi" :class="activeAgent?.icon ?? 'bi-robot'"></i>
            </span>
            <div class="min-w-0 flex-grow-1">
              <template v-if="editingTitle">
                <label for="sessionTitleInput" class="visually-hidden">Conversation title</label>
                <input
                  id="sessionTitleInput"
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
                <div class="small text-body-secondary text-truncate">{{ activeAgent?.name }}</div>
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
                title="Delete"
                aria-label="Delete conversation"
                @click="removeCurrent"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </header>

          <div v-if="actionError" class="alert alert-danger py-2 small m-3 mb-0">
            {{ actionError }}
          </div>

          <div ref="messageList" class="message-list">
            <!-- Empty conversation: suggested questions -->
            <div v-if="!messages.length && activeAgent" class="starter">
              <span class="agent-icon agent-icon-lg"
                ><i class="bi" :class="activeAgent.icon"></i
              ></span>
              <h2 class="section-title mt-3">{{ activeAgent.name }}</h2>
              <p class="section-subtitle mb-4">{{ activeAgent.description }}</p>
              <div class="d-flex flex-column gap-2 w-100 starter-prompts">
                <button
                  v-for="prompt in activeAgent.starterPrompts"
                  :key="prompt"
                  type="button"
                  class="btn starter-prompt"
                  :disabled="composerDisabled"
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
              <span v-if="message.role === 'assistant'" class="agent-icon agent-icon-sm">
                <i class="bi" :class="activeAgent?.icon ?? 'bi-robot'"></i>
              </span>
              <div class="message-body">
                <div class="bubble">{{ message.content }}</div>
                <div v-if="message.citations?.length" class="citations">
                  <RouterLink
                    v-for="citation in message.citations.filter((c) => c.type === 'invoice')"
                    :key="citation.id"
                    :to="{ name: 'invoice-details', params: { id: citation.id } }"
                    class="citation"
                  >
                    <i class="bi bi-receipt me-1"></i>{{ citation.label }}
                  </RouterLink>
                </div>
                <div class="message-time">{{ timeLabel(message.createdAt) }}</div>
              </div>
            </div>

            <div v-if="sending" class="message message-assistant" role="status">
              <span class="agent-icon agent-icon-sm">
                <i class="bi" :class="activeAgent?.icon ?? 'bi-robot'"></i>
              </span>
              <div class="bubble typing" aria-label="The assistant is typing">
                <span></span><span></span><span></span>
              </div>
            </div>

            <div v-if="failed" class="send-error" role="alert">
              <i class="bi bi-exclamation-circle me-1"></i>{{ failed.error }}
              <button
                v-if="service !== 'unavailable'"
                type="button"
                class="btn btn-link btn-sm p-0 ms-2 align-baseline"
                @click="chat.retry()"
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
              :disabled="composerDisabled && !sending"
              :placeholder="
                service === 'unavailable'
                  ? 'The AI service is not connected yet'
                  : `Message ${activeAgent?.name ?? 'the assistant'}…`
              "
              @input="autosize"
              @keydown="onComposerKeydown"
            ></textarea>
            <button
              type="submit"
              class="btn btn-gold send-button"
              :disabled="composerDisabled || !draft.trim()"
              aria-label="Send message"
            >
              <i class="bi bi-send"></i>
            </button>
          </form>
          <p class="disclaimer">
            AI can make mistakes. Check important details against your invoice records. The
            assistant can look things up but never submits, edits or comments for you.
          </p>
        </template>
      </section>

      <!-- Agent details -->
      <aside class="vp-card ai-agent d-none d-xl-block" aria-label="Agent details">
        <template v-if="activeAgent">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="agent-icon agent-icon-sm"
              ><i class="bi" :class="activeAgent.icon"></i
            ></span>
            <h2 class="section-title mb-0 fs-6">{{ activeAgent.name }}</h2>
          </div>
          <h3 class="panel-heading">What it can do</h3>
          <ul class="panel-list">
            <li v-for="item in activeAgent.capabilities" :key="item">{{ item }}</li>
          </ul>
          <h3 class="panel-heading">What it can see</h3>
          <ul class="panel-list">
            <li v-for="item in activeAgent.dataAccess" :key="item">{{ item }}</li>
          </ul>
          <hr />
          <h3 class="panel-heading">Other agents</h3>
          <ul class="list-unstyled mb-0">
            <li v-for="agent in agents.filter((a) => a.id !== activeAgent?.id)" :key="agent.id">
              <button type="button" class="other-agent" @click="startChat(agent)">
                <i class="bi" :class="agent.icon"></i>{{ agent.name }}
              </button>
            </li>
          </ul>
        </template>
        <template v-else>
          <h2 class="section-title fs-6 mb-3">How it works</h2>
          <ul class="panel-list">
            <li>Pick an agent for the task you need help with.</li>
            <li>Agents only read your own invoices, documents and AP policies.</li>
            <li>They never submit, edit or comment on invoices for you.</li>
            <li>Your conversations are listed on the left so you can pick them up later.</li>
          </ul>
        </template>
      </aside>
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

@media (min-width: 1200px) {
  .ai-layout {
    grid-template-columns: 280px minmax(0, 1fr) 280px;
  }
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
  padding: 0.625rem 0.625rem;
  color: var(--vp-text);
}

.session-item:hover {
  background: #f4f5f7;
}

.session-item.active {
  background: var(--vp-gold-soft);
}

.session-icon {
  font-size: 1.125rem;
  line-height: 1.3;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* ----- Main panel ----- */
.ai-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gallery {
  overflow-y: auto;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.agent-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-border);
  border-radius: 0.5rem;
  padding: 1.125rem;
  align-items: flex-start;
}

.agent-card:hover {
  border-color: #c9ced6;
}

.agent-name {
  font-size: 0.9375rem;
  font-weight: 700;
  margin: 0;
}

.agent-description {
  font-size: 0.8125rem;
  color: var(--vp-muted);
  flex: 1;
}

.preview-badge {
  background: #eceef1;
  color: var(--vp-muted);
  font-weight: 600;
  margin-top: 0.25rem;
}

.agent-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--vp-gold-soft);
  display: grid;
  place-items: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.agent-icon-sm {
  width: 32px;
  height: 32px;
  font-size: 0.9375rem;
}

.agent-icon-lg {
  width: 56px;
  height: 56px;
  font-size: 1.5rem;
}

.conversation-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--vp-muted);
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

.message-time {
  font-size: 0.6875rem;
  color: var(--vp-muted);
  margin-top: 0.25rem;
}

.message-user .message-time {
  text-align: right;
}

.citations {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

.citation {
  font-size: 0.75rem;
  border: 1px solid var(--vp-border);
  border-radius: 999px;
  padding: 0.125rem 0.625rem;
  text-decoration: none;
  color: var(--vp-text);
}

.citation:hover {
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
  .typing span {
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

/* ----- Agent panel ----- */
.ai-agent {
  overflow-y: auto;
}

.panel-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-muted);
  margin: 1rem 0 0.5rem;
}

.panel-list {
  padding-left: 1.125rem;
  font-size: 0.8125rem;
  margin-bottom: 0;
}

.panel-list li {
  margin-bottom: 0.375rem;
}

.other-agent {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  background: none;
  border: 0;
  text-align: left;
  font-size: 0.8125rem;
  padding: 0.375rem 0.25rem;
  border-radius: 0.25rem;
  color: var(--vp-text);
}

.other-agent:hover {
  background: #f4f5f7;
}
</style>
