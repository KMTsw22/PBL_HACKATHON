import { supabase } from '@/lib/supabase'
import type { UserCard } from '@/hooks/useUserCards'

async function getErrorMessageFromError(data: unknown, error: unknown): Promise<string> {
  const fromData = typeof data === 'object' && data !== null && 'message' in data ? (data as { message: string }).message : null
  if (fromData) return fromData
  const err = error as { context?: { json?: () => Promise<{ message?: string }> } } | null
  if (err?.context?.json) {
    try {
      const body = await err.context.json()
      if (body?.message) return body.message
    } catch {
      // ignore
    }
  }
  return (error as { message?: string })?.message ?? '에이전트 응답을 불러오지 못했어요.'
}

export type AskAgentMessage = { role: 'user' | 'assistant'; content: string }

export type AgentResponseBlock = { agent: string; content: string }

export type AgentStep =
  | { type: 'request'; to: string; requestText: string }
  | { type: 'response'; from: string; content: string }

export type AskAgentResponse = {
  message: string
  recommendations?: { card: UserCard; reason: string }[]
  agentsUsed?: string[]
  agentResponses?: AgentResponseBlock[]
  steps?: AgentStep[]
}

export async function askAgent(messages: AskAgentMessage[]): Promise<AskAgentResponse> {
  const { data, error } = await supabase.functions.invoke('ask-agent', {
    body: { messages: messages.map((m) => ({ role: m.role, content: String(m.content ?? '') })) },
  })

  if (error) {
    const errMsg = await getErrorMessageFromError(data, error)
    throw new Error(errMsg)
  }

  const json = (typeof data === 'object' && data !== null ? data : {}) as {
    message?: string
    recommendations?: { card: UserCard; reason: string }[]
    agentsUsed?: string[]
    agentResponses?: AgentResponseBlock[]
    steps?: AgentStep[]
  }

  return {
    message: json.message ?? '',
    recommendations: json.recommendations,
    agentsUsed: json.agentsUsed,
    agentResponses: json.agentResponses,
    steps: json.steps,
  }
}
