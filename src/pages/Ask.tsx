import { useState, useRef, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { askAgentStreaming, type AskAgentMessage, type AgentStep, type PersistedStepMulti, type StepMultiStart, type StepPart, type StepSynthesis } from '@/lib/askAgent'
import {
  listAskConversations,
  getAskConversationWithMessages,
  createAskConversation,
  appendAskMessage,
  updateAskMessage,
  type AskConversationSummary,
  type AskMessagePayload,
} from '@/lib/askConversations'
import type { RecommendResult } from '@/lib/recommendFromCollected'
import CardDetailModal from '@/components/CardDetailModal'
import { CardImage } from '@/components/CardImage'
import { getOrCreateDmConversation, getOrCreateDmAndSendMessage } from '@/lib/chat'
import type { UserCard } from '@/hooks/useUserCards'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

type AgentResponseBlock = { agent: string; content: string }

type Message = {
  id: string
  type: 'user' | 'agent'
  text: string
  recommendations?: RecommendResult[]
  outreachTip?: string
  /** 카드별 맞춤 연락 초안 (card_id → 메시지) */
  outreachTips?: Record<string, string>
  contactSentCount?: number
  contactSendError?: string
  agentsUsed?: string[]
  agentResponses?: AgentResponseBlock[]
  steps?: (AgentStep | { type: 'decision'; to: string })[]
  streaming?: boolean
}

/** 백엔드 combine 형식(## 라벨 (GPT-4o-mini) / ## 라벨 (Gemini/GPT-3.5)) 파싱 → 구분해 표시 */
function parseOpenAiGeminiBlocks(raw: string): { blocks: { type: 'openai' | 'gemini'; label: string; content: string }[]; useBlocks: boolean } {
  if (!raw || typeof raw !== 'string') return { blocks: [], useBlocks: false }
  const blocks: { type: 'openai' | 'gemini'; label: string; content: string }[] = []
  const parts = raw.split(/##\s+/).filter((p) => p.trim().length > 0)
  for (const part of parts) {
    const firstNewline = part.indexOf('\n')
    const header = (firstNewline >= 0 ? part.slice(0, firstNewline) : part).trim()
    const content = (firstNewline >= 0 ? part.slice(firstNewline + 1) : '').trim()
    if (header.endsWith(' (GPT-4o-mini)') || header.endsWith(' (OpenAI)')) {
      blocks.push({ type: 'openai', label: header.replace(/\s*\((?:GPT-4o-mini|OpenAI)\)$/, '').trim(), content })
    } else if (header.endsWith(' (Gemini)') || header.endsWith(' (GPT-3.5)')) {
      blocks.push({ type: 'gemini', label: header.replace(/\s*\((?:Gemini|GPT-3.5)\)$/, '').trim(), content })
    }
  }
  return { blocks, useBlocks: blocks.length >= 1 }
}

/** 에이전트 응답에서 사용자에게 보이면 안 되는 내부 지시·card_ids·UUID 배열 제거, JSON은 읽기 쉽게 정리 */
function formatAgentDisplayText(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw
  const uuidArrayLine = /^\s*\[(?:"[a-f0-9-]+"\s*,?\s*)+\]\s*$/
  const lines = raw.split('\n').filter((line) => {
    if (/message_architect\s*호출\s*시|card_ids\s*인자에/i.test(line)) return false
    if (uuidArrayLine.test(line.trim())) return false
    return true
  })
  let out = lines.join('\n').trim()
  try {
    const trimmed = out.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed).map(([k, v]) => `${k}: ${String(v)}`).join('\n')
      }
    }
  } catch {
    /* leave as is */
  }
  return out
}

/** 병렬(GPT-4o-mini/GPT-3.5) 단계 라이브 상태 */
type StepMultiState = { to: string; parts: Record<string, 'thinking' | string>; synthesis: 'idle' | 'thinking' | string }

/** 저장된 stepMulti를 말풍선에서 쓸 수 있도록 동일 형태로 (synthesis는 이미 문자열) */
function toStepMultiState(p: PersistedStepMulti): StepMultiState {
  return { to: p.to, parts: p.parts, synthesis: p.synthesis }
}

type Bubble = {
  from: string
  isThinking: boolean
  text: string
  multi?: StepMultiState
  /** 별도 말풍선용: GPT-4o-mini / GPT-3.5 등 */
  part?: string
  partContent?: 'thinking' | string
  /** 종합 단계 말풍선 */
  synthesis?: 'idle' | 'thinking' | string
}

/** 에이전트·파트별 "생각중" 문구 (이미지 느낌) */
function getPartThinkingLabel(agentName: string, part: string): string {
  const isFirst = part === 'GPT-4o-mini' || part === 'OpenAI'
  if (agentName.includes('기획')) {
    return isFirst ? '새로운 아이디어를 제안합니다...' : '기획안 초안을 작성 중입니다...'
  }
  if (agentName.includes('기술')) {
    return isFirst ? '기술 스택을 검토합니다...' : '추천 스택 초안을 작성 중입니다...'
  }
  return '생각중...'
}

/** parts 키 정렬: GPT-4o-mini 먼저, 그다음 GPT-3.5/Gemini */
function orderedPartKeys(parts: Record<string, unknown>): string[] {
  const keys = Object.keys(parts)
  const first = keys.filter((k) => k === 'GPT-4o-mini' || k === 'OpenAI')
  const second = keys.filter((k) => k === 'GPT-3.5' || k === 'Gemini')
  return [...first, ...second].length ? [...first, ...second] : keys
}

/** steps를 핑퐁 순서로 말풍선 변환. stepMulti(라이브 또는 저장된 기록) 있으면 OpenAI·GPT-3.5 각각 + 종합 말풍선 유지 */
function buildChatBubbles(
  steps: (AgentStep | { type: 'decision'; to: string })[],
  finalText: string,
  isStreaming: boolean,
  stepMulti: StepMultiState | null = null,
  stepMultiRefCurrent: StepMultiState | null = null,
  completedByAgent: Record<string, StepMultiState> = {}
): Bubble[] {
  const bubbles: Bubble[] = []
  if (steps.length === 0) {
    if (isStreaming) bubbles.push({ from: '총괄', isThinking: true, text: '총괄 에이전트가 구조를 파악중입니다.' })
    return bubbles
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.type === 'decision') continue
    if (step.type === 'request') {
      bubbles.push({
        from: '총괄',
        isThinking: false,
        text: `${step.to} 에이전트에게 물어봅니다.\n\n질문: ${step.requestText}`,
      })
      const next = steps[i + 1]
      const savedMulti = next?.type === 'response' && next.from === step.to && 'stepMulti' in next && next.stepMulti ? toStepMultiState(next.stepMulti) : null
      const multi =
        (savedMulti?.to === step.to ? savedMulti : null) ??
        (completedByAgent[step.to] ?? null) ??
        (stepMulti?.to === step.to ? stepMulti : null) ??
        (stepMultiRefCurrent?.to === step.to ? stepMultiRefCurrent : null)
      const hasMulti = multi && multi.to === step.to
      if (hasMulti && multi) {
        // 에이전트당 하나의 통합 말풍선: 두 의견(parts) + 조율자 종합(synthesis)을 한 카드 안에 표시
        bubbles.push({
          from: step.to,
          isThinking: false,
          text: '',
          multi,
        })
      } else if (next?.type === 'response' && next.from === step.to) {
        bubbles.push({
          from: step.to,
          isThinking: false,
          text: `총괄 에이전트에게 생각을 전합니다.\n\n${formatAgentDisplayText(next.content)}`,
        })
      } else {
        bubbles.push({
          from: step.to,
          isThinking: true,
          text: `${step.to} 에이전트가 생각중입니다.`,
        })
      }
      continue
    }
    if (step.type === 'response') continue
  }
  if (finalText.trim()) bubbles.push({ from: '총괄', isThinking: false, text: finalText })
  return bubbles
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  type: 'agent',
  text: '안녕하세요. 저는 네 위 에이전트예요. "어떤 앱을 만들고 싶다", "팀원 구해요", "기술 스택 추천해줘"처럼 말해주시면 네 위 에이전트(총괄 추천·기획·기술)가 함께 도와드릴게요.',
}

function rowToMessage(row: { id: string; role: string; content: string; payload?: AskMessagePayload }): Message {
  const payload = row.payload ?? {}
  return {
    id: row.id,
    type: row.role === 'user' ? 'user' : 'agent',
    text: row.content,
    recommendations: payload.recommendations as RecommendResult[] | undefined,
    outreachTip: payload.outreachTip,
    outreachTips: payload.outreachTips,
    contactSentCount: payload.contactSentCount,
    contactSendError: payload.contactSendError,
    agentsUsed: payload.agentsUsed,
    agentResponses: payload.agentResponses,
    steps: payload.steps as Message['steps'],
  }
}

export default function Ask() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<AskConversationSummary[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [assistantSaveFailed, setAssistantSaveFailed] = useState(false)
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<string | undefined>(undefined)
  const [stepMulti, setStepMulti] = useState<StepMultiState | null>(null)
  /** 두 에이전트 의견+종합 기록 유지: onStep 시 response에 붙여 저장 (setState 비동기이므로 ref로 최신값 참조) */
  const stepMultiRef = useRef<StepMultiState | null>(null)
  /** 에이전트별로 완료된 stepMulti 보관 (기술 스택 step_multi_start로 ref 덮어써져도 기획 말풍선 유지) */
  const completedStepMultiRef = useRef<Record<string, StepMultiState>>({})
  /** onDone에서 DB 저장 시 stepMulti 포함된 steps 사용 (result.steps는 stepMulti 없음) */
  const latestStepsRef = useRef<(AgentStep | { type: 'decision'; to: string })[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  /** 방금 전송한 대화 id; 이 경우 DB 재조회로 덮어쓰지 않음 (onDone 저장 완료 전 race 방지) */
  const skipLoadConversationRef = useRef<string | null>(null)
  /** 스트리밍 중인 assistant 메시지의 DB row id (부분 저장·최종 업데이트용) */
  const assistantMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user?.id) return
    listAskConversations(user.id).then(setConversations)
  }, [user?.id])

  useEffect(() => {
    if (sidebarOpen && user?.id) {
      listAskConversations(user.id).then(setConversations)
    }
  }, [sidebarOpen, user?.id])

  useEffect(() => {
    if (!currentConversationId || !user?.id || loading) {
      if (!currentConversationId || loading) setLoadingMessages(false)
      return
    }
    if (skipLoadConversationRef.current === currentConversationId) {
      setLoadingMessages(false)
      return
    }
    setLoadingMessages(true)
    getAskConversationWithMessages(currentConversationId).then((conv) => {
      setLoadingMessages(false)
      if (!conv) return
      if (conv.messages.length === 0) {
        setMessages([WELCOME_MESSAGE])
        return
      }
      setMessages(conv.messages.map(rowToMessage))
    })
  }, [currentConversationId, user?.id, loading])

  const openNewConversation = () => {
    skipLoadConversationRef.current = null
    setLoadingMessages(false)
    setAssistantSaveFailed(false)
    setCurrentConversationId(null)
    setMessages([WELCOME_MESSAGE])
    setSidebarOpen(false)
  }

  const selectConversation = (id: string) => {
    skipLoadConversationRef.current = null
    setAssistantSaveFailed(false)
    setLoadingMessages(true)
    setCurrentConversationId(id)
    setMessages([WELCOME_MESSAGE])
    setSidebarOpen(false)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading || !user?.id) return

    setInput('')
    let convId = currentConversationId
    if (!convId) {
      convId = await createAskConversation(user.id, text.slice(0, 30) || '새 대화')
      if (!convId) {
        console.error('[Ask] 대화 생성 실패. 마이그레이션 015 적용 여부와 RLS를 확인하세요.')
        setInput(text)
        return
      }
      setCurrentConversationId(convId)
      setConversations((prev) => [{ id: convId!, title: text.slice(0, 30) || '새 대화', updated_at: new Date().toISOString(), created_at: new Date().toISOString() }, ...prev])
    }
    skipLoadConversationRef.current = convId
    const appendUserOk = await appendAskMessage(convId, 'user', text)
    if (!appendUserOk) console.error('[Ask] 사용자 메시지 저장 실패')

    const userMsg: Message = { id: `u-${Date.now()}`, type: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    stepMultiRef.current = null
    completedStepMultiRef.current = {}
    latestStepsRef.current = []
    setStepMulti(null)
    const agentMsgId = `a-${Date.now()}`
    const placeholder: Message = {
      id: agentMsgId,
      type: 'agent',
      text: '',
      steps: [],
      streaming: true,
    }
    setMessages((prev) => [...prev, placeholder])

    assistantMessageIdRef.current = null
    if (convId) {
      const dbId = await appendAskMessage(convId, 'assistant', '', {})
      if (dbId) assistantMessageIdRef.current = dbId
    }

    try {
      const history: AskAgentMessage[] = messages.map((m) =>
        m.type === 'user' ? { role: 'user' as const, content: m.text } : { role: 'assistant' as const, content: m.text }
      )
      history.push({ role: 'user', content: text })

      await askAgentStreaming(history, {
        onDecision: (to) => {
          setMessages((prev) => {
            const next = [...prev]
            const idx = next.findIndex((m) => m.id === agentMsgId)
            if (idx === -1) return prev
            const cur = next[idx]
            if (cur.type !== 'agent' || !Array.isArray(cur.steps)) return prev
            const newSteps = [...cur.steps, { type: 'decision' as const, to }]
            next[idx] = { ...cur, steps: newSteps }
            if (assistantMessageIdRef.current) {
              updateAskMessage(assistantMessageIdRef.current, '', { steps: newSteps }).catch(() => {})
            }
            return next
          })
        },
        onStepMultiStart: (data: StepMultiStart) => {
          const next = { to: data.to, parts: Object.fromEntries(data.parts.map((p) => [p, 'thinking'])), synthesis: 'idle' as const }
          stepMultiRef.current = next
          setStepMulti(next)
          console.log('[Ask:step_multi_start]', { to: data.to, parts: data.parts })
        },
        onStepPart: (data: StepPart) => {
          setStepMulti((prev) => {
            const next = prev && prev.to === data.from ? { ...prev, parts: { ...prev.parts, [data.part]: data.content } } : prev
            if (next) stepMultiRef.current = next
            return next ?? null
          })
        },
        onStepSynthesis: (data: StepSynthesis) => {
          setStepMulti((prev) => {
            if (!prev || prev.to !== data.from) return prev
            const next = data.status === 'thinking' ? { ...prev, synthesis: 'thinking' as const } : data.content != null ? { ...prev, synthesis: data.content } : prev
            if (next) stepMultiRef.current = next
            return next
          })
          console.log('[Ask:step_synthesis]', { from: data.from, status: data.status, hasContent: data.content != null, contentLen: data.content?.length ?? 0 })
        },
        onStep: (request, response) => {
          const multi = response !== null ? stepMultiRef.current : null
          if (response !== null) {
            stepMultiRef.current = null
            // stepMulti는 비우지 않음 → 한번 나온 말풍선(의견·종합)이 사라지지 않고 유지. 다음 step_multi_start에서 덮어씀.
          }
          if (response === null) {
            setMessages((prev) => {
              const next = [...prev]
              const idx = next.findIndex((m) => m.id === agentMsgId)
              if (idx === -1) return prev
              const cur = next[idx]
              if (cur.type !== 'agent' || !Array.isArray(cur.steps)) return prev
              const newSteps = [...cur.steps, request]
              latestStepsRef.current = newSteps
              next[idx] = { ...cur, steps: newSteps }
              if (assistantMessageIdRef.current) {
                updateAskMessage(assistantMessageIdRef.current, '', { steps: newSteps }).catch(() => {})
              }
              return next
            })
            return
          }
          if (multi?.to === response.from) {
            completedStepMultiRef.current = { ...completedStepMultiRef.current, [response.from]: multi }
          }
          // 서버에서 stepMulti를 보낸 경우(조율자 결과 포함) 그대로 사용. 이벤트 순서에 따라 로컬 multi.synthesis가 아직 'thinking'일 수 있어 덮어쓰면 조율자 결과가 사라짐.
          const hasServerStepMulti =
            response.stepMulti &&
            typeof response.stepMulti.synthesis === 'string' &&
            response.stepMulti.synthesis !== 'thinking'
          const responseToPersist: AgentStep & { type: 'response' } = hasServerStepMulti
            ? response
            : multi?.to === response.from
              ? {
                  ...response,
                  stepMulti: {
                    to: multi.to,
                    parts: { ...multi.parts },
                    synthesis: typeof multi.synthesis === 'string' && multi.synthesis !== 'thinking' ? multi.synthesis : '',
                  },
                }
              : response
          setMessages((prev) => {
            const next = [...prev]
            const idx = next.findIndex((m) => m.id === agentMsgId)
            if (idx === -1) return prev
            const cur = next[idx]
            if (cur.type !== 'agent' || !Array.isArray(cur.steps)) return prev
            const steps = cur.steps
            const requestAlreadyInSteps = steps.some((s) => s.type === 'request' && s.to === request.to && (s as AgentStep & { type: 'request' }).requestText === request.requestText)
            const insertResponseAfterRequest = (steps: (AgentStep | { type: 'decision'; to: string })[], req: AgentStep & { type: 'request' }, resp: AgentStep & { type: 'response' }) => {
              const i = steps.findIndex((s) => s.type === 'request' && s.to === req.to && (s as AgentStep & { type: 'request' }).requestText === req.requestText)
              if (i === -1) return [...steps, resp]
              return [...steps.slice(0, i + 1), resp, ...steps.slice(i + 1)]
            }
            const newSteps = requestAlreadyInSteps
              ? insertResponseAfterRequest(steps, request, responseToPersist)
              : insertResponseAfterRequest([...steps, request], request, responseToPersist)
            latestStepsRef.current = newSteps
            const respStepMulti = responseToPersist.stepMulti
            console.log('[Ask:step] steps 반영', {
              requestTo: request.to,
              requestAlreadyInSteps,
              stepsBeforeLen: steps.length,
              newStepsLen: newSteps.length,
              newStepsTypes: newSteps.map((s) => (s.type === 'decision' ? 'decision' : s.type === 'request' ? `req:${(s as AgentStep & { type: 'request' }).to}` : `res:${(s as AgentStep & { type: 'response' }).from}`)),
              responseHasStepMulti: !!respStepMulti,
              persistedPartsKeys: respStepMulti ? Object.keys(respStepMulti.parts) : [],
              persistedPartsLen: respStepMulti ? Object.fromEntries(Object.entries(respStepMulti.parts).map(([k, v]) => [k, (v as string)?.length ?? 0])) : {},
              persistedSynthesisLen: respStepMulti?.synthesis?.length ?? 0,
            })
            if (assistantMessageIdRef.current) {
              updateAskMessage(assistantMessageIdRef.current, '', { steps: newSteps }).catch(() => {})
            }
            next[idx] = { ...cur, steps: newSteps }
            return next
          })
        },
        onDone: async (result) => {
          stepMultiRef.current = null
          completedStepMultiRef.current = {}
          setStepMulti(null)
          setMessages((prev) => {
            const next = [...prev]
            const idx = next.findIndex((m) => m.id === agentMsgId)
            if (idx === -1) return prev
            const cur = next[idx] as Message
            const stepsFromState = latestStepsRef.current?.length ? latestStepsRef.current : (cur.type === 'agent' && cur.steps?.length ? cur.steps : (result.steps ?? []))
            next[idx] = {
              ...cur,
              type: 'agent',
              text: result.message,
              recommendations: result.recommendations,
              outreachTip: result.outreachTip,
              outreachTips: result.outreachTips,
              contactSentCount: result.contactSentCount,
              contactSendError: result.contactSendError,
              agentsUsed: result.agentsUsed,
              agentResponses: result.agentResponses,
              steps: stepsFromState,
              streaming: false,
            }
            return next
          })
          if (convId) {
            const stepsToSave = latestStepsRef.current?.length ? latestStepsRef.current : (result.steps ?? [])
            const payload: AskMessagePayload = {
              steps: stepsToSave,
              recommendations: result.recommendations,
              outreachTip: result.outreachTip,
              outreachTips: result.outreachTips,
              contactSentCount: result.contactSentCount,
              contactSendError: result.contactSendError,
              agentsUsed: result.agentsUsed,
              agentResponses: result.agentResponses ?? [],
            }
            setAssistantSaveFailed(false)
            const dbId = assistantMessageIdRef.current
            if (dbId) {
              const ok = await updateAskMessage(dbId, result.message, payload)
              if (!ok) {
                console.error('[Ask] 에이전트 최종 응답 업데이트 실패')
                setAssistantSaveFailed(true)
              }
            } else {
              const saved = await appendAskMessage(convId, 'assistant', result.message, payload)
              if (!saved) {
                console.error('[Ask] 에이전트 응답 저장 실패 (본문만 재시도도 실패했을 수 있음)')
                setAssistantSaveFailed(true)
              }
            }
            const now = new Date().toISOString()
            setConversations((prev) =>
              prev.map((c) => (c.id === convId ? { ...c, updated_at: now } : c)).sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
            )
            listAskConversations(user!.id).then(setConversations)
          }
        },
      })
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev]
        const idx = next.findIndex((m) => m.id === agentMsgId)
        if (idx === -1) return prev
        next[idx] = {
          ...next[idx],
          type: 'agent',
          text: e instanceof Error ? e.message : '에이전트 응답 불러오기 못했어요.',
          streaming: false,
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-full bg-gray-50 flex flex-col relative">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="w-72 max-w-[85vw] bg-white border-r border-gray-100 shadow-lg flex flex-col z-50">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-900">대화 기록</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="p-2 text-gray-500 hover:text-gray-800">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <button
              type="button"
              onClick={openNewConversation}
              className="m-3 py-2.5 px-3 rounded-xl border border-[#FF9C8F]/50 text-[#FF9C8F] text-sm font-medium hover:bg-[#FFE4E0]/30 transition-colors"
            >
              + 새 대화
            </button>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">아직 저장된 대화가 없어요</p>
              ) : (
                <ul className="space-y-1">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(c.id)}
                        className={`w-full text-left py-2.5 px-3 rounded-xl text-sm transition-colors ${
                          currentConversationId === c.id ? 'bg-[#FFE4E0]/50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <p className="truncate">{c.title || '새 대화'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.updated_at)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button type="button" onClick={() => setSidebarOpen(true)} className="w-10 h-10 flex items-center justify-center text-gray-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Ask</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-4xl mx-auto w-full">
        <p className="text-center text-xs text-gray-500 mb-5">에이전트 (총괄 · 기획 · 기술 · 컨택)</p>
        {assistantSaveFailed && (
          <div className="mb-4 py-2.5 px-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center justify-between gap-2">
            <span>답변 저장에 실패했어요. 이 대화를 나가면 방금 답변이 보이지 않을 수 있어요.</span>
            <button type="button" onClick={() => setAssistantSaveFailed(false)} className="text-amber-600 hover:underline shrink-0">닫기</button>
          </div>
        )}
        {loadingMessages && currentConversationId ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-gray-500">대화 불러오는 중...</span>
          </div>
        ) : (
        <>
        {messages.map((msg) => {
          if (msg.type === 'user') {
            return (
              <div key={msg.id} className="flex gap-3 mb-4 flex-row-reverse">
                <div className="flex-1 max-w-[85%] flex flex-col items-end">
                  <p className="text-xs text-gray-400 mb-1">You</p>
                  <div className="rounded-2xl px-4 py-3 bg-[#FF9C8F] text-white">
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              </div>
            )
          }

          const steps = msg.steps ?? []
          const isStreaming = msg.streaming === true
          const bubbles = buildChatBubbles(steps, msg.text, isStreaming, stepMulti, stepMultiRef.current, completedStepMultiRef.current)
          const isTotal = (from: string) => from === '총괄'

          return (
            <div key={msg.id} className="mb-6">
              <div className="space-y-3">
                  {bubbles.map((b, i) => {
                    const isUnifiedMulti = b.multi != null
                    const isPartBubble = b.part != null
                    const isSynthesisBubble = b.synthesis != null && b.synthesis !== 'idle'
                    const isResponseWithContent = !isUnifiedMulti && !isPartBubble && !isSynthesisBubble && !isTotal(b.from) && !b.isThinking && b.text.startsWith('총괄 에이전트에게 생각을 전합니다.')
                    const contentOnly = isResponseWithContent ? b.text.replace(/^총괄 에이전트에게 생각을 전합니다\.\n\n/, '') : b.text
                    const { blocks: openAiGeminiBlocks, useBlocks } = parseOpenAiGeminiBlocks(contentOnly)
                    const showOpenAiGemini = !isUnifiedMulti && !isPartBubble && !isSynthesisBubble && isResponseWithContent && useBlocks && openAiGeminiBlocks.length >= 1
                    const ThinkingDots = () => (
                      <span className="inline-flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9C8F] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9C8F] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9C8F] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )
                    return (
                    <div key={i} className="flex gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isTotal(b.from) ? 'bg-[#FF9C8F]' : 'bg-[#FFE4E0]'}`}>
                        {isTotal(b.from) ? (
                          <span className="text-white text-xs font-bold">총괄</span>
                        ) : (
                          <span className="text-[#FF9C8F] text-xs font-bold truncate max-w-[2.25rem]" title={b.from}>
                            {b.from.includes('·') ? b.from.split('·')[0] : b.from.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 max-w-[85%] ${isTotal(b.from) ? 'bg-[#FFE4E0]/50 border border-[#FF9C8F]/30' : isUnifiedMulti ? 'bg-white border border-gray-100 shadow-sm flex flex-col gap-3' : isPartBubble ? (b.part === 'GPT-4o-mini' || b.part === 'OpenAI' ? 'bg-[#E3F2FD] border-[#2196F3]/40' : 'bg-[#E8F5E9] border-[#4CAF50]/40') : isSynthesisBubble ? 'bg-[#FFF8F6] border border-[#FF9C8F]/40' : b.isThinking ? 'bg-[#FFE4E0]/40 border border-[#FF9C8F]/20' : 'bg-white border border-gray-100 shadow-sm'} ${showOpenAiGemini ? 'flex flex-col gap-3' : ''}`}>
                        {isUnifiedMulti && b.multi ? (
                          <>
                            <p className="text-xs font-semibold text-[#FF9C8F] mb-0.5">{b.from}</p>
                            <div className="space-y-3">
                              {orderedPartKeys(b.multi.parts).map((pk) => {
                                const partContent = b.multi!.parts[pk] ?? 'thinking'
                                const isOpenAi = pk === 'GPT-4o-mini' || pk === 'OpenAI'
                                return (
                                  <div
                                    key={pk}
                                    className={`rounded-xl px-3 py-2.5 border text-sm ${
                                      isOpenAi ? 'bg-[#E3F2FD] border-[#2196F3]/50' : 'bg-[#E8F5E9] border-[#4CAF50]/50'
                                    }`}
                                  >
                                    <p className={`text-xs font-bold mb-1.5 ${isOpenAi ? 'text-[#1976D2]' : 'text-[#2E7D32]'}`}>
                                      {b.from} ({pk})
                                    </p>
                                    {partContent === 'thinking' ? (
                                      <p className="text-gray-600">{getPartThinkingLabel(b.from, pk)}</p>
                                    ) : (
                                      <p className="whitespace-pre-wrap text-gray-900">{formatAgentDisplayText(partContent)}</p>
                                    )}
                                  </div>
                                )
                              })}
                              {(b.multi.synthesis !== 'idle' && b.multi.synthesis !== undefined) && (
                                <div className="rounded-xl px-3 py-2.5 border border-[#FF9C8F]/40 bg-[#FFF8F6]">
                                  <p className="text-xs font-bold mb-1.5 text-[#FF9C8F]">두 의견 종합 → 총괄 에이전트에게 전달</p>
                                  {b.multi.synthesis === 'thinking' ? (
                                    <p className="text-gray-600 inline-flex items-center gap-2">
                                      <ThinkingDots />
                                      문제점·해결점·타협점을 찾아 정리하는 중...
                                    </p>
                                  ) : (
                                    <div className="space-y-3 text-sm text-gray-900">
                                      {b.multi.synthesis.split(/\n##\s+/).filter(Boolean).map((block, idx) => {
                                        const firstLine = block.indexOf('\n')
                                        const title = firstLine >= 0 ? block.slice(0, firstLine).trim() : block.trim()
                                        const body = firstLine >= 0 ? block.slice(firstLine + 1).trim() : ''
                                        return (
                                          <div key={idx}>
                                            <p className="font-semibold text-[#FF9C8F] mb-0.5">{title}</p>
                                            <p className="whitespace-pre-wrap">{formatAgentDisplayText(body)}</p>
                                          </div>
                                        )
                                      })}
                                      {!b.multi.synthesis.includes('## ') && (
                                        <p className="whitespace-pre-wrap">{formatAgentDisplayText(b.multi.synthesis)}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        ) : !isUnifiedMulti && !isTotal(b.from) && !isPartBubble && !isSynthesisBubble && (
                          <p className="text-xs font-semibold text-[#FF9C8F] mb-1">{b.from} 에이전트</p>
                        )}
                        {!isUnifiedMulti && isPartBubble && b.part ? (
                          <>
                            <p className={`text-xs font-bold mb-1.5 ${b.part === 'GPT-4o-mini' || b.part === 'OpenAI' ? 'text-[#1976D2]' : 'text-[#2E7D32]'}`}>
                              {b.from} ({b.part})
                            </p>
                            {b.partContent === 'thinking' ? (
                              <p className="text-gray-600">
                                {getPartThinkingLabel(b.from, b.part)}
                              </p>
                            ) : (
                              <p className="whitespace-pre-wrap text-gray-900 text-sm">{formatAgentDisplayText(b.partContent ?? '')}</p>
                            )}
                          </>
                        ) : !isUnifiedMulti && isSynthesisBubble && b.synthesis ? (
                          <>
                            <p className="text-xs font-bold mb-1.5 text-[#FF9C8F]">두 의견 종합 → 총괄 에이전트에게 전달</p>
                            {b.synthesis === 'thinking' ? (
                              <p className="text-gray-600 inline-flex items-center gap-2">
                                <ThinkingDots />
                                문제점·해결점·타협점을 찾아 정리하는 중...
                              </p>
                            ) : (
                              <div className="space-y-3 text-sm text-gray-900">
                                {b.synthesis.split(/\n##\s+/).filter(Boolean).map((block, idx) => {
                                  const firstLine = block.indexOf('\n')
                                  const title = firstLine >= 0 ? block.slice(0, firstLine).trim() : block.trim()
                                  const body = firstLine >= 0 ? block.slice(firstLine + 1).trim() : ''
                                  return (
                                    <div key={idx}>
                                      <p className="font-semibold text-[#FF9C8F] mb-0.5">{title}</p>
                                      <p className="whitespace-pre-wrap">{formatAgentDisplayText(body)}</p>
                                    </div>
                                  )
                                })}
                                {!b.synthesis.includes('## ') && (
                                  <p className="whitespace-pre-wrap">{formatAgentDisplayText(b.synthesis)}</p>
                                )}
                              </div>
                            )}
                          </>
                        ) : !isUnifiedMulti && showOpenAiGemini ? (
                          <div className="space-y-3">
                            {openAiGeminiBlocks.map((block, j) => (
                              <div
                                key={j}
                                className={`rounded-xl px-3 py-2.5 border text-sm whitespace-pre-wrap text-gray-900 ${
                                  block.type === 'openai'
                                    ? 'bg-[#E3F2FD] border-[#2196F3]/50'
                                    : 'bg-[#E8F5E9] border-[#4CAF50]/50'
                                }`}
                              >
                                <p className={`text-xs font-bold mb-1.5 ${block.type === 'openai' ? 'text-[#1976D2]' : 'text-[#2E7D32]'}`}>
                                  {block.type === 'openai' ? 'GPT-4o-mini' : 'GPT-3.5'}
                                  {block.label ? ` · ${block.label}` : ''}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{formatAgentDisplayText(block.content)}</p>
                              </div>
                            ))}
                          </div>
                        ) : !isUnifiedMulti ? (
                          <p className="text-sm whitespace-pre-wrap text-gray-900">
                            {b.isThinking ? (
                              <span className="inline-flex items-center gap-2 text-gray-600">
                                <ThinkingDots />
                                {formatAgentDisplayText(b.text)}
                              </span>
                            ) : (
                              formatAgentDisplayText(b.text)
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    )
                  })}
                </div>
              {!isStreaming && msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-4 pl-12 space-y-2">
                  {msg.recommendations.map((r) => (
                    <Fragment key={r.card?.id ?? r.reason}>
                      <button
                        type="button"
                        onClick={() => { setSelectedCard(r.card as UserCard); setSelectedDraft((r.card?.id && msg.outreachTips?.[r.card.id]) ?? msg.outreachTip) }}
                        className="w-full flex items-center gap-3 p-3 bg-white hover:bg-[#FFE4E0]/30 rounded-xl text-left transition-colors border border-gray-100"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FFE4E0] flex-shrink-0">
                          <CardImage imageUrl={r.card?.image_url ?? ''} name={r.card?.card_name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{r.card?.card_name || 'My Card'}</p>
                          <p className="text-xs text-[#FF9C8F] truncate">{r.card?.custom_title || 'Professional'}</p>
                          {r.reason && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.reason}</p>}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </Fragment>
                  ))}
                  {(msg.outreachTip != null || (msg.contactSentCount ?? 0) > 0 || msg.contactSendError) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {msg.contactSendError && (
                        <p className="text-sm text-amber-700 mb-2">연락 자동 발송 실패: {msg.contactSendError}
                          {msg.contactSendError?.includes('does not exist') || msg.contactSendError?.includes('function') ? ' Supabase에 마이그레이션 014_send_dm_as_user.sql 을 적용한 뒤 다시 시도해 주세요.' : ''}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">
                        {(msg.contactSentCount ?? 0) > 0
                          ? `연락 메시지를 ${msg.contactSentCount}명에게 발송했어요. 채팅 탭에서 확인해 보세요.`
                          : msg.contactSendError
                            ? '채팅 탭에서 자동으로 연락해 보세요.'
                            : '채팅 탭에서 발송한 연락을 확인해 보세요.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/chats')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF9C8F] text-white text-sm font-medium hover:bg-[#f08a7d] transition-colors"
                      >
                        채팅에서 확인하기
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={scrollRef} />
        </>
        )}
      </div>

      <div className="fixed left-0 right-0 bottom-[56px] p-4 bg-white border-t border-gray-100 shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex gap-2 bg-gray-100 rounded-xl px-4 py-3">
          <input
            id="ask-message-input"
            name="askMessage"
            type="text"
            placeholder="예: 어떤 앱을 만들고 싶다 / 팀원 구해요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            aria-label="에이전트에게 보낼 메시지"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full bg-[#FF9C8F] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          isOpen={true}
          onClose={() => { setSelectedCard(null); setSelectedDraft(undefined) }}
          contactDraft={selectedDraft}
          onMessage={async (card) => {
            const otherUserId = card.user_id
            if (!otherUserId) {
              alert('연락할 수 있는 사용자 정보가 없어요')
              return
            }
            let convId: string | null = null
            const rpcResult = await getOrCreateDmAndSendMessage(otherUserId, selectedDraft)
            if (rpcResult.convId) {
              convId = rpcResult.convId
            } else {
              convId = await getOrCreateDmConversation(otherUserId)
              if (convId && selectedDraft?.trim() && user?.id) {
                const { error } = await supabase.from('messages').insert({
                  conversation_id: convId,
                  sender_id: user.id,
                  content: selectedDraft.trim(),
                })
                if (error) {
                  console.error('[Ask] 메시지 발송 실패', error.message, error.details)
                  alert('메시지 발송에 실패했어요. 다시 시도해 주세요.')
                  return
                }
              }
            }
            if (!convId) {
              alert(rpcResult.error ? `연락 작업 실패: ${rpcResult.error}` : '연락 작업을 못했어요. 다시 시도해 주세요.')
              return
            }
            setSelectedCard(null)
            setSelectedDraft(undefined)
            navigate(`/chats/${convId}`)
          }}
          onNavigateToChat={(card: UserCard) => {
            getOrCreateDmConversation(card.user_id).then((convId) => {
              if (convId) {
                setSelectedCard(null)
                setSelectedDraft(undefined)
                navigate(`/chats/${convId}`, { state: { draft: selectedDraft } })
              }
            })
          }}
          showShareIconOnly
        />
      )}
    </div>
  )
}
