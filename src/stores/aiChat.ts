import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, errorMessage } from '@/services/ApiService'
import AgentApi from '@/services/api/ai/agent'
import SessionApi from '@/services/api/ai/session'
import { AI_AGENTS } from '@/constants/aiAgents'
import type { AiAgent, AiMessage, AiSession, AiSessionDetail } from '@/schema'

/** connected: the /ai API answered. unavailable: it isn't deployed (or can't be reached). */
export type AiServiceState = 'unknown' | 'connected' | 'unavailable'

export const AI_UNAVAILABLE_MESSAGE =
  "The AI assistant isn't connected yet. You can browse the agents, but they can't answer until the AI service is available."

/** The endpoints don't exist (404/405/501) or the API can't be reached. */
function serviceMissing(error: unknown) {
  return error instanceof ApiError && [0, 404, 405, 501].includes(error.status)
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** A question that couldn't be answered, kept so the vendor can retry it. */
export interface FailedMessage {
  message: AiMessage
  error: string
}

export const useAiChatStore = defineStore('aiChat', () => {
  const service = ref<AiServiceState>('unknown')
  const agents = ref<AiAgent[]>(AI_AGENTS)
  const sessions = ref<AiSession[]>([])
  const sessionsLoading = ref(false)
  const current = ref<AiSessionDetail | null>(null)
  const currentLoading = ref(false)
  const currentError = ref<string | null>(null)
  /** A new conversation that is only created on the server when its first message is sent. */
  const draftAgentId = ref<string | null>(null)
  const sending = ref(false)
  /** The question being answered, shown immediately while waiting for the reply. */
  const pending = ref<AiMessage | null>(null)
  const failed = ref<FailedMessage | null>(null)

  const activeAgentId = computed(() => current.value?.agentId ?? draftAgentId.value)
  const activeAgent = computed(() => agents.value.find((a) => a.id === activeAgentId.value) ?? null)
  const messages = computed<AiMessage[]>(() => {
    const list = [...(current.value?.messages ?? [])]
    if (pending.value) list.push(pending.value)
    if (failed.value) list.push(failed.value.message)
    return list
  })

  function agentById(id: string) {
    return agents.value.find((a) => a.id === id) ?? null
  }

  function markService(error?: unknown) {
    if (error === undefined) service.value = 'connected'
    else if (serviceMissing(error)) service.value = 'unavailable'
  }

  async function loadAgents() {
    try {
      const { data } = await AgentApi.list()
      if (data.length) agents.value = data
      markService()
    } catch (error) {
      markService(error) // Keep the built-in catalogue.
    }
  }

  async function loadSessions() {
    sessionsLoading.value = true
    try {
      const { data } = await SessionApi.list()
      sessions.value = data
      markService()
    } catch (error) {
      markService(error)
    } finally {
      sessionsLoading.value = false
    }
  }

  function init() {
    return Promise.all([loadAgents(), loadSessions()])
  }

  let openController: AbortController | null = null

  async function open(id: string) {
    if (current.value?.id === id) return
    openController?.abort()
    const controller = (openController = new AbortController())
    draftAgentId.value = null
    failed.value = null
    currentError.value = null
    currentLoading.value = true
    try {
      const { data } = await SessionApi.get(id, controller.signal)
      current.value = data
      markService()
    } catch (error) {
      if (isAbort(error)) return
      markService(error)
      current.value = null
      currentError.value =
        error instanceof ApiError && error.status === 404 && service.value === 'connected'
          ? 'This conversation no longer exists.'
          : errorMessage(error, 'The conversation could not be loaded.')
    } finally {
      if (openController === controller) currentLoading.value = false
    }
  }

  /** Starts a new conversation with an agent (nothing is sent until the first message). */
  function startDraft(agentId: string) {
    openController?.abort()
    current.value = null
    currentError.value = null
    failed.value = null
    draftAgentId.value = agentId
  }

  function clearSelection() {
    openController?.abort()
    current.value = null
    currentError.value = null
    failed.value = null
    draftAgentId.value = null
  }

  function upsertSession(session: AiSession) {
    sessions.value = [session, ...sessions.value.filter((s) => s.id !== session.id)]
  }

  /** Sends a question; creates the conversation first if this is a new chat. Returns its id. */
  async function send(content: string): Promise<string | null> {
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
    try {
      if (!current.value) {
        if (!draftAgentId.value) throw new Error('Choose an agent first.')
        const { data: session } = await SessionApi.create({
          agentId: draftAgentId.value,
          title: text.slice(0, 60),
        })
        current.value = { ...session, messages: [] }
        draftAgentId.value = null
        upsertSession(session)
      }
      const { data } = await SessionApi.send(current.value.id, text)
      current.value.messages.push(data.userMessage, data.assistantMessage)
      Object.assign(current.value, data.session)
      upsertSession(data.session)
      markService()
      return current.value.id
    } catch (error) {
      markService(error)
      failed.value = {
        message: pending.value,
        error:
          service.value === 'unavailable'
            ? AI_UNAVAILABLE_MESSAGE
            : errorMessage(error, 'The assistant could not answer. Please try again.'),
      }
      return current.value?.id ?? null
    } finally {
      pending.value = null
      sending.value = false
    }
  }

  function retry() {
    const question = failed.value?.message.content
    if (question) return send(question)
    return Promise.resolve(null)
  }

  async function rename(id: string, title: string) {
    const { data } = await SessionApi.rename(id, title.trim().slice(0, 120))
    upsertSession(data)
    if (current.value?.id === id) Object.assign(current.value, data)
  }

  async function remove(id: string) {
    await SessionApi.remove(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (current.value?.id === id) clearSelection()
  }

  return {
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
    agentById,
    init,
    open,
    startDraft,
    clearSelection,
    send,
    retry,
    rename,
    remove,
  }
})
