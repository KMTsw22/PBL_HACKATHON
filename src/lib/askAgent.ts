import { supabase, supabaseUrl } from '@/lib/supabase'
import type { UserCard } from '@/hooks/useUserCards'

export type AskAgentMessage = { role: 'user' | 'assistant'; content: string }

export type AgentResponseBlock = { agent: string; content: string }

export type AgentStep =
  | { type: 'request'; to: string; requestText: string }
  | { type: 'response'; from: string; content: string; stepMulti?: PersistedStepMulti }

/** 저장용: 두 에이전트 의견(parts) + 종합(synthesis) 기록 */
export type PersistedStepMulti = { to: string; parts: Record<string, string>; synthesis: string }

/** 병렬 에이전트(GPT-4o-mini/GPT-3.5) 단계용 스트림 이벤트 */
export type StepMultiStart = { type: 'step_multi_start'; to: string; parts: string[] }
export type StepPart = { type: 'step_part'; from: string; part: string; content: string }
export type StepSynthesis = { type: 'step_synthesis'; from: string; status?: 'thinking'; content?: string }

export type AskAgentResponse = {
  message: string
  recommendations?: { card: UserCard; reason: string }[]
  /** Contact 에이전트가 제안한 연락 메시지 초안 (DM에 채울 수 있음) */
  outreachTip?: string
  /** 카드별 맞춤 연락 메시지 (card_id → 메시지). 있으면 카드 클릭 시 해당 초안 사용 */
  outreachTips?: Record<string, string>
  /** 연락 메시지를 실제로 발송한 인원 수 (자동 일괄 발송) */
  contactSentCount?: number
  /** 발송 실패 시 서버 메시지 (예: RPC 없음) */
  contactSendError?: string
  agentsUsed?: string[]
  agentResponses?: AgentResponseBlock[]
  steps?: AgentStep[]
}

/** 스트리밍 전용. 총괄이 누구에게 물어볼지 정할 때 onDecision, 요청/응답 올 때 onStep. 완료 시 onDone 호출 후 resolve */
export async function askAgentStreaming(
  messages: AskAgentMessage[],
  callbacks: {
    onDecision?: (to: string) => void
    onStepRequest?: (request: AgentStep & { type: 'request' }) => void
    onStep: (request: AgentStep & { type: 'request' }, response: AgentStep & { type: 'response' } | null) => void
    onStepMultiStart?: (data: StepMultiStart) => void
    onStepPart?: (data: StepPart) => void
    onStepSynthesis?: (data: StepSynthesis) => void
    onDone: (result: AskAgentResponse) => void
  }
): Promise<AskAgentResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('로그인이 필요해요.')

  const res = await fetch(`${supabaseUrl}/functions/v1/ask-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: String(m.content ?? '') })),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? '에이전트 요청 실패')
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('스트리밍을 지원하지 않아요.')

  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: AskAgentResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
        const data = JSON.parse(jsonStr) as {
          type?: string
          to?: string
          request?: AgentStep
          response?: AgentStep | null
          message?: string
          recommendations?: { card: UserCard; reason: string }[]
          outreachTip?: string
          outreachTips?: Record<string, string>
          contactSentCount?: number
          contactSendError?: string
          agentsUsed?: string[]
          agentResponses?: { agent: string; content: string }[]
          steps?: AgentStep[]
          parts?: string[]
          from?: string
          part?: string
          content?: string
          status?: string
          level?: string
        }
        if (data.type === 'log') {
          // 서버 로그는 웹 콘솔에 찍지 않음
        } else if (data.type === 'decision' && data.to) {
          callbacks.onDecision?.(data.to)
        } else if (data.type === 'step_multi_start' && data.to && Array.isArray(data.parts)) {
          callbacks.onStepMultiStart?.({ type: 'step_multi_start', to: data.to, parts: data.parts })
        } else if (data.type === 'step_part' && data.from && data.part != null) {
          callbacks.onStepPart?.({ type: 'step_part', from: data.from, part: data.part, content: data.content ?? '' })
        } else if (data.type === 'step_synthesis' && data.from) {
          callbacks.onStepSynthesis?.({ type: 'step_synthesis', from: data.from, status: data.status as 'thinking' | undefined, content: data.content })
        } else if (data.type === 'step' && data.request) {
          if (data.response != null) {
            callbacks.onStep(data.request as AgentStep & { type: 'request' }, data.response as AgentStep & { type: 'response' })
          } else {
            callbacks.onStepRequest?.(data.request as AgentStep & { type: 'request' })
            callbacks.onStep(data.request as AgentStep & { type: 'request' }, null)
          }
        } else if (data.type === 'done' || (data.message != null && !data.type)) {
          const raw = data.message != null ? String(data.message).trim() : ''
          finalResult = {
            message: raw || '답변을 생성하지 못했어요.',
            recommendations: data.recommendations,
            outreachTip: data.outreachTip,
            outreachTips: data.outreachTips,
            contactSentCount: data.contactSentCount,
            contactSendError: data.contactSendError,
            agentsUsed: data.agentsUsed,
            agentResponses: data.agentResponses,
            steps: data.steps,
          }
          await callbacks.onDone(finalResult)
        } else if (data.type === 'error') {
          throw new Error((data as { message?: string }).message ?? '에이전트 오류')
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }

  if (!finalResult) throw new Error('에이전트 응답이 완료되지 않았어요.')
  return finalResult
}
