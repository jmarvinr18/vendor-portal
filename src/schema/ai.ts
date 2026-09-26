// Mirrors vendor-portal-api/app/schema/ai.py (POST /api/v1/ai/messages[/stream]).
// The agent itself runs on Bedrock AgentCore and decides which specialist handles a question,
// so the portal never picks one.

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

export interface AiMessageCreate {
  content: string
  /** Continue a conversation. Omit to start one; the reply carries the new id. */
  sessionId?: string | null
  /** What the vendor was looking at. Only used when starting a conversation. */
  context?: { invoiceId?: string } | null
}

/** The body of POST /ai/messages, and of the stream's `done` event. */
export interface AiReply {
  sessionId: string
  userMessage: AiMessage
  assistantMessage: AiMessage
}

/** A conversation as the portal keeps it in this browser (the API stores its own copy). */
export interface AiConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AiMessage[]
}
