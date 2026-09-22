// Proposed: /api/v1/ai/sessions (see docs/ai-assistant-api.md)
import ApiService, { apiPath } from '../../ApiService'
import type { AiReply, AiSession, AiSessionCreate, AiSessionDetail } from '@/schema'
import { mockAi } from './mock'

const MOCK = import.meta.env.VITE_AI_MOCK === 'true'
// The model may call several read-only tools before answering.
const REPLY_TIMEOUT_MS = 90_000

export default {
  /** GET /ai/sessions — the vendor's conversations, most recent first. */
  list(signal?: AbortSignal) {
    if (MOCK) return mockAi.sessions()
    return ApiService.get<AiSession[]>('ai/sessions', { signal })
  },

  /** POST /ai/sessions — start a conversation with an agent. */
  create(data: AiSessionCreate) {
    if (MOCK) return mockAi.create(data)
    return ApiService.post<AiSession>('ai/sessions', data)
  },

  /** GET /ai/sessions/{id} — a conversation with its messages, oldest first. */
  get(id: string, signal?: AbortSignal) {
    if (MOCK) return mockAi.get(id)
    return ApiService.get<AiSessionDetail>(apiPath('ai', 'sessions', id), { signal })
  },

  /** PATCH /ai/sessions/{id} — rename. */
  rename(id: string, title: string) {
    if (MOCK) return mockAi.rename(id, title)
    return ApiService.patch<AiSession>(apiPath('ai', 'sessions', id), { title })
  },

  /** DELETE /ai/sessions/{id} */
  remove(id: string) {
    if (MOCK) return mockAi.remove(id)
    return ApiService.delete(apiPath('ai', 'sessions', id))
  },

  /** POST /ai/sessions/{id}/messages — ask a question; resolves with the assistant's answer. */
  send(id: string, content: string) {
    if (MOCK) return mockAi.send(id, content)
    return ApiService.post<AiReply>(
      apiPath('ai', 'sessions', id, 'messages'),
      { content },
      { timeoutMs: REPLY_TIMEOUT_MS },
    )
  },
}
