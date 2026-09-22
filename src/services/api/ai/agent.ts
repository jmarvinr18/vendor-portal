// Proposed: GET /api/v1/ai/agents (see docs/ai-assistant-api.md)
import ApiService from '../../ApiService'
import type { AiAgent } from '@/schema'
import { mockAi } from './mock'

const MOCK = import.meta.env.VITE_AI_MOCK === 'true'

export default {
  /** The agents this vendor can chat with. */
  list(signal?: AbortSignal) {
    if (MOCK) return mockAi.agents()
    return ApiService.get<AiAgent[]>('ai/agents', { signal })
  },
}
