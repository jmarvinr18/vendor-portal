// vendor-portal-api: app/routes/ai_chat.py
import ApiService, { ApiError } from '../../ApiService'
import type { AiMessageCreate, AiReply } from '@/schema'

// The agent may look things up before answering, so allow a long wait for the first token.
const REPLY_TIMEOUT_MS = 90_000

export interface StreamHandlers {
  /** A piece of the answer, as it is written. */
  onDelta: (text: string) => void
  signal?: AbortSignal
}

export default {
  /**
   * POST /ai/messages/stream — sends a message and streams the answer back.
   * Resolves with the stored question and answer once the assistant has finished.
   */
  async stream(message: AiMessageCreate, { onDelta, signal }: StreamHandlers): Promise<AiReply> {
    let reply: AiReply | null = null
    let failure: { code?: number; message?: string } | null = null
    let whole: unknown

    try {
      whole = await ApiService.postStream(
        'ai/messages/stream',
        message,
        (event, data) => {
          if (event === 'delta' && typeof (data as { text?: string })?.text === 'string') {
            onDelta((data as { text: string }).text)
          } else if (event === 'done') {
            reply = data as AiReply
          } else if (event === 'error') {
            failure = data as { code?: number; message?: string }
          }
        },
        { timeoutMs: REPLY_TIMEOUT_MS, signal },
      )
    } catch (error) {
      // An API without the streaming endpoint: ask for the answer in one piece instead.
      if (!(error instanceof ApiError && [404, 405].includes(error.status))) throw error
      const { data } = await this.send(message, signal)
      onDelta(data.assistantMessage.content)
      return data
    }

    if (failure) {
      const { code, message: text } = failure as { code?: number; message?: string }
      throw new ApiError(code ?? 503, text || 'The assistant could not finish answering.')
    }
    // The server answered with the whole body rather than a stream (e.g. a buffering proxy).
    if (!reply && whole && typeof whole === 'object' && 'assistantMessage' in whole) {
      reply = whole as AiReply
      onDelta(reply.assistantMessage.content)
    }
    if (!reply) {
      throw new ApiError(0, 'The assistant stopped before finishing. Please try again.')
    }
    return reply
  },

  /** POST /ai/messages — the same exchange, answered in one piece. */
  send(message: AiMessageCreate, signal?: AbortSignal) {
    return ApiService.post<AiReply>('ai/messages', message, {
      timeoutMs: REPLY_TIMEOUT_MS,
      signal,
    })
  },
}
