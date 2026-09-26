import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, errorMessage } from '@/services/ApiService'
import ChatApi from '@/services/api/ai/chat'
import type { AiConversation, AiMessage } from '@/schema'

/** connected: the assistant answered. unavailable: it isn't deployed or configured. */
export type AiServiceState = 'unknown' | 'connected' | 'unavailable'

export const AI_UNAVAILABLE_MESSAGE =
  "The AI assistant isn't available right now. Please try again later, or contact Accounts Payable directly."

// The API keeps its own transcript but has no endpoint to list conversations yet, so the
// portal remembers them per browser. Clearing site data clears this list, not the API's copy.
const STORAGE_KEY = 'vendor-portal:ai-conversations'
const MAX_CONVERSATIONS = 30

/** A question that couldn't be answered, kept so the vendor can retry it. */
export interface FailedMessage {
  message: AiMessage
  error: string
}

function load(): AiConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(conversations: AiConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)))
  } catch {
    // Storage unavailable or full: the conversation still works for this visit.
  }
}

function titleFrom(text: string) {
  return text.trim().split('\n')[0]!.slice(0, 60) || 'New conversation'
}

export const useAiChatStore = defineStore('aiChat', () => {
  const service = ref<AiServiceState>('unknown')
  const conversations = ref<AiConversation[]>(load())
  const currentId = ref<string | null>(null)
  const sending = ref(false)
  /** The question waiting for an answer, shown straight away. */
  const pending = ref<AiMessage | null>(null)
  /** The answer as it streams in, before it is stored. */
  const streaming = ref<AiMessage | null>(null)
  const failed = ref<FailedMessage | null>(null)

  let controller: AbortController | null = null

  watch(conversations, (value) => save(value), { deep: true })

  const current = computed(() => conversations.value.find((c) => c.id === currentId.value) ?? null)
  const messages = computed<AiMessage[]>(() => {
    const list = [...(current.value?.messages ?? [])]
    if (pending.value) list.push(pending.value)
    if (streaming.value) list.push(streaming.value)
    if (failed.value) list.push(failed.value.message)
    return list
  })

  function open(id: string) {
    if (currentId.value === id) return
    stop()
    currentId.value = conversations.value.some((c) => c.id === id) ? id : null
  }

  /** Clears the view for a new conversation; the API assigns its id on the first answer. */
  function startNew() {
    stop()
    currentId.value = null
  }

  /** Stops waiting for an answer (the API still stores it if the agent finishes). */
  function stop() {
    controller?.abort()
    controller = null
    pending.value = null
    streaming.value = null
    failed.value = null
    sending.value = false
  }

  function remember(id: string, userMessage: AiMessage, assistantMessage: AiMessage) {
    const now = assistantMessage.createdAt
    const existing = conversations.value.find((c) => c.id === id)
    if (existing) {
      existing.messages.push(userMessage, assistantMessage)
      existing.updatedAt = now
      conversations.value = [existing, ...conversations.value.filter((c) => c.id !== id)]
    } else {
      conversations.value = [
        {
          id,
          title: titleFrom(userMessage.content),
          createdAt: userMessage.createdAt,
          updatedAt: now,
          messages: [userMessage, assistantMessage],
        },
        ...conversations.value,
      ].slice(0, MAX_CONVERSATIONS)
    }
    currentId.value = id
  }

  /** Sends a question and streams the answer. Returns the conversation id. */
  async function send(content: string, context?: { invoiceId?: string }) {
    const text = content.trim()
    if (!text || sending.value) return null
    sending.value = true
    failed.value = null
    pending.value = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    streaming.value = null
    controller = new AbortController()
    let streamedText = false

    const sentSessionId = currentId.value
    try {
      const reply = await ChatApi.stream(
        {
          content: text,
          sessionId: sentSessionId,
          context: sentSessionId ? undefined : context,
        },
        {
          signal: controller.signal,
          onDelta: (delta) => {
            if (!streaming.value) {
              pending.value = null
              streaming.value = {
                id: 'streaming',
                role: 'assistant',
                content: '',
                createdAt: new Date().toISOString(),
              }
            }
            streaming.value.content += delta
            streamedText = true
          },
        },
      )
      remember(reply.sessionId, reply.userMessage, reply.assistantMessage)
      service.value = 'connected'
      return reply.sessionId
    } catch (error) {
      if (controller?.signal.aborted) return currentId.value // Stopped by the vendor.
      // 404 with a session id means that conversation is gone from the server, not that the
      // assistant is down: sending again starts a new one.
      const status = error instanceof ApiError ? error.status : -1
      const sessionGone = status === 404 && !!sentSessionId
      const unavailable = [0, 405, 501, 503].includes(status) || (status === 404 && !sentSessionId)
      service.value = unavailable ? 'unavailable' : 'connected'
      if (sessionGone) currentId.value = null
      failed.value = {
        message: pending.value ?? {
          id: `failed-${Date.now()}`,
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
        error: sessionGone
          ? 'This conversation is no longer on the server. Sending again starts a new one.'
          : unavailable
            ? errorMessage(error, AI_UNAVAILABLE_MESSAGE)
            : errorMessage(error, 'The assistant could not answer. Please try again.'),
      }
      // Keep what had already arrived, marked as incomplete.
      if (streamedText) {
        failed.value.error = `${failed.value.error} The answer above is incomplete.`
      }
      return currentId.value
    } finally {
      pending.value = null
      if (streaming.value && !failed.value) streaming.value = null
      controller = null
      sending.value = false
    }
  }

  function retry() {
    const question = failed.value?.message.content
    if (!question) return Promise.resolve(null)
    failed.value = null
    streaming.value = null
    return send(question)
  }

  function rename(id: string, title: string) {
    const conversation = conversations.value.find((c) => c.id === id)
    if (conversation) conversation.title = title.trim().slice(0, 120) || conversation.title
  }

  /** Removes the conversation from this browser's list (the API keeps its own transcript). */
  function remove(id: string) {
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (currentId.value === id) startNew()
  }

  return {
    service,
    conversations,
    currentId,
    current,
    messages,
    sending,
    streaming,
    failed,
    open,
    startNew,
    stop,
    send,
    retry,
    rename,
    remove,
  }
})
