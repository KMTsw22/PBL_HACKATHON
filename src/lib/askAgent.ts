import { supabase } from '@/lib/supabase'
import type { UserCard } from '@/hooks/useUserCards'

export type AskAgentMessage = { role: 'user' | 'assistant'; content: string }

export type AskAgentResponse = {
  message: string
  recommendations?: { card: UserCard; reason: string }[]
  agentsUsed?: string[]
}

export async function askAgent(messages: AskAgentMessage[]): Promise<AskAgentResponse> {
  const { data, error } = await supabase.functions.invoke('ask-agent', {
    body: { messages: messages.map((m) => ({ role: m.role, content: m.content })) },
  })

  if (error) {
    const errMsg = typeof data === 'object' && data !== null && 'message' in data ? (data as { message: string }).message : null
    throw new Error(errMsg ?? error.message ?? '에이전트 응답을 불러오지 못했어요.')
  }

  const json = (typeof data === 'object' && data !== null ? data : {}) as {
    message?: string
    recommendations?: { card: UserCard; reason: string }[]
    agentsUsed?: string[]
  }

  return {
    message: json.message ?? '',
    recommendations: json.recommendations,
    agentsUsed: json.agentsUsed,
  }
}
