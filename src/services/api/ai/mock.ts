/**
 * In-browser stand-in for the proposed /ai/* API, for building the UI before the backend
 * exists. Only used when VITE_AI_MOCK=true (never in production builds by default). Replies
 * are canned and clearly labelled; they are not AI output.
 */
import { ApiError, type ApiResponse } from '../../ApiService'
import { AI_AGENTS } from '@/constants/aiAgents'
import type {
  AiAgent,
  AiMessage,
  AiReply,
  AiSession,
  AiSessionCreate,
  AiSessionDetail,
} from '@/schema'

const sessions = new Map<string, AiSessionDetail>()

function ok<T>(data: T, status = 200): Promise<ApiResponse<T>> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ data, status, headers: new Headers() }), 300),
  )
}

function summary(detail: AiSessionDetail): AiSession {
  const { messages: _messages, ...session } = detail
  return session
}

function notFound(): never {
  throw new ApiError(404, 'Conversation not found.')
}

export const mockAi = {
  agents: () => ok<AiAgent[]>(AI_AGENTS),

  sessions: () =>
    ok([...sessions.values()].map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),

  create: (input: AiSessionCreate) => {
    const now = new Date().toISOString()
    const detail: AiSessionDetail = {
      id: crypto.randomUUID(),
      agentId: input.agentId,
      title: input.title || 'New conversation',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      preview: null,
      messages: [],
    }
    sessions.set(detail.id, detail)
    return ok(summary(detail), 201)
  },

  get: (id: string) => ok(structuredClone(sessions.get(id) ?? notFound())),

  rename: (id: string, title: string) => {
    const detail = sessions.get(id) ?? notFound()
    detail.title = title
    return ok(summary(detail))
  },

  remove: (id: string) => {
    sessions.delete(id)
    return ok(undefined, 204)
  },

  send: (id: string, content: string) => {
    const detail = sessions.get(id) ?? notFound()
    const agent = AI_AGENTS.find((a) => a.id === detail.agentId)
    const now = new Date().toISOString()
    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: now,
    }
    const assistantMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      createdAt: new Date(Date.now() + 1).toISOString(),
      content:
        `[Mock reply — VITE_AI_MOCK is on, no AI service is connected]\n\n` +
        `${agent?.name ?? 'The assistant'} received: “${content}”.\n\n` +
        `When the /api/v1/ai endpoints are live, this answer will come from Claude on ` +
        `AWS Bedrock, using read-only lookups of your invoices where needed.`,
    }
    if (detail.messages.length === 0) detail.title = content.slice(0, 60)
    detail.messages.push(userMessage, assistantMessage)
    detail.messageCount = detail.messages.length
    detail.updatedAt = assistantMessage.createdAt
    detail.preview = assistantMessage.content.split('\n')[0] ?? null
    return new Promise<ApiResponse<AiReply>>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: { userMessage, assistantMessage, session: summary(detail) },
            status: 201,
            headers: new Headers(),
          }),
        900,
      ),
    )
  },
}
