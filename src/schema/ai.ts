// Proposed contract for the AI assistant API (/api/v1/ai/*). Not implemented by
// vendor-portal-api yet; see docs/ai-assistant-api.md.

export type AiAgentStatus = 'available' | 'preview'

/** An assistant specialised in one part of AP invoice processing. */
export interface AiAgent {
  id: string
  name: string
  description: string
  /** Bootstrap icon name, e.g. "bi-receipt". */
  icon: string
  status: AiAgentStatus
  /** What the agent can do, shown on the agent card. */
  capabilities: string[]
  /** What the agent may read on the vendor's behalf (always read-only). */
  dataAccess: string[]
  /** Suggested first questions. */
  starterPrompts: string[]
}

export type AiMessageRole = 'user' | 'assistant'

/** A record the assistant used to answer, e.g. an invoice it looked up. */
export interface AiCitation {
  type: 'invoice' | 'document' | 'policy'
  id: string
  label: string
}

export interface AiMessage {
  id: string
  role: AiMessageRole
  content: string
  createdAt: string
  citations?: AiCitation[]
}

export interface AiSession {
  id: string
  agentId: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  /** First line of the latest message, for the conversation list. */
  preview: string | null
}

export interface AiSessionDetail extends AiSession {
  messages: AiMessage[]
}

export interface AiSessionCreate {
  agentId: string
  title?: string
  /** Optional context, e.g. the invoice the vendor was looking at. */
  context?: { invoiceId?: string }
}

export interface AiMessageCreate {
  content: string
}

/** POST /ai/sessions/{id}/messages returns the stored question and the assistant's answer. */
export interface AiReply {
  userMessage: AiMessage
  assistantMessage: AiMessage
  session: AiSession
}
