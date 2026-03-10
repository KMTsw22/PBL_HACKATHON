import { useState, useRef, useEffect } from 'react'
import { askAgent, type AskAgentMessage, type AgentStep } from '@/lib/askAgent'
import type { RecommendResult } from '@/lib/recommendFromCollected'
import CardDetailModal from '@/components/CardDetailModal'
import type { UserCard } from '@/hooks/useUserCards'

type AgentResponseBlock = { agent: string; content: string }

type Message = {
  id: string
  type: 'user' | 'agent'
  text: string
  recommendations?: RecommendResult[]
  agentsUsed?: string[]
  agentResponses?: AgentResponseBlock[]
  steps?: AgentStep[]
}

export default function Ask() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'agent',
      text: '안녕하세요! 저는 상위 에이전트예요. "어떤 앱을 만들고 싶다", "팀원 구해요", "기술 스택 추천해줘"처럼 말씀해주시면 하위 에이전트(인재 추천·기획·기술)가 함께 답해드려요.',
    },
  ])
  const [loading, setLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    const userMsg: Message = { id: `u-${Date.now()}`, type: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const history: AskAgentMessage[] = messages.map((m) =>
        m.type === 'user' ? { role: 'user' as const, content: m.text } : { role: 'assistant' as const, content: m.text }
      )
      history.push({ role: 'user', content: text })

      const { message, recommendations, agentsUsed, agentResponses, steps } = await askAgent(history)
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          type: 'agent',
          text: message,
          recommendations,
          agentsUsed,
          agentResponses,
          steps,
        },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          type: 'agent',
          text: e instanceof Error ? e.message : '에이전트 응답을 불러오지 못했어요.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-[#FAF8F6] flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Ask</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-center text-xs text-gray-400 mb-4">오케스트레이터 + 하위 에이전트 (인재·기획·기술·컨택)</p>
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

          const hasSteps = msg.steps && msg.steps.length > 0
          const hasDiscussion = msg.agentResponses && msg.agentResponses.length > 0
          const agentCount = msg.agentsUsed?.length ?? 0

          return (
            <div key={msg.id} className="mb-6">
              {(hasSteps || hasDiscussion) && agentCount > 0 && (
                <div className="flex flex-col items-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {[...Array(agentCount)].map((_, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center flex-shrink-0 border-2 border-[#FF9C8F]"
                      >
                        <svg className="w-5 h-5 text-[#FF9C8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="4" y="10" width="16" height="10" rx="1" />
                          <path d="M12 6V4M8 8h2M14 8h2" />
                          <path d="M12 14v4M9 18h6" />
                        </svg>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-[#FF9C8F] text-center px-4 py-2 rounded-full bg-[#FFE4E0]/60">
                    {agentCount}명의 에이전트가 참여했어요. 총괄 에이전트가 순서대로 요청하고 답을 받았어요.
                  </p>
                </div>
              )}

              {hasSteps ? (
                <div className="space-y-3">
                  {msg.steps!.map((step, i) =>
                    step.type === 'request' ? (
                      <div key={i} className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FF9C8F] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">총괄</span>
                        </div>
                        <div className="flex-1 min-w-0 max-w-[85%]">
                          <p className="text-xs font-semibold text-[#FF9C8F] mb-1">총괄 에이전트 → {step.to} 에이전트에게 요청</p>
                          <div className="rounded-2xl px-4 py-3 bg-[#FFE4E0]/50 text-gray-800 border border-[#FF9C8F]/30">
                            <p className="text-sm whitespace-pre-wrap">{step.requestText}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FFE4E0] flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[#FF9C8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="4" y="10" width="16" height="10" rx="1" />
                            <path d="M12 6V4M8 8h2M14 8h2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0 max-w-[85%]">
                          <p className="text-xs font-semibold text-[#FF9C8F] uppercase tracking-wide mb-1">{step.from} 에이전트 답변</p>
                          <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 shadow-sm border border-gray-100">
                            <p className="text-sm whitespace-pre-wrap">{step.content}</p>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  <div className="flex gap-3 mt-4">
                    <div className="w-9 h-9 rounded-full bg-[#FF9C8F] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">O</span>
                    </div>
                    <div className="flex-1 min-w-0 max-w-[85%]">
                      <p className="text-xs font-semibold text-[#FF9C8F] uppercase tracking-wide mb-1">총괄 에이전트 최종 정리</p>
                      <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 shadow-sm border border-[#FFE4E0]">
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </div>
                  </div>

                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-4 pl-12 space-y-2">
                      {msg.recommendations.map((r) => (
                        <button
                          key={r.card.id}
                          type="button"
                          onClick={() => setSelectedCard(r.card)}
                          className="w-full flex items-center gap-3 p-3 bg-white hover:bg-[#FFE4E0]/30 rounded-xl text-left transition-colors border border-gray-100"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FFE4E0] flex-shrink-0">
                            <img src={r.card.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{r.card.card_name || 'My Card'}</p>
                            <p className="text-xs text-[#FF9C8F] truncate">{r.card.custom_title || 'Professional'}</p>
                            {r.reason && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.reason}</p>}
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : hasDiscussion ? (
                <div className="space-y-3">
                  {msg.agentResponses!.map((block, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#FFE4E0] flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#FF9C8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="4" y="10" width="16" height="10" rx="1" />
                          <path d="M12 6V4M8 8h2M14 8h2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 max-w-[85%]">
                        <p className="text-xs font-semibold text-[#FF9C8F] uppercase tracking-wide mb-1">{block.agent} 에이전트</p>
                        <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 shadow-sm border border-gray-100">
                          <p className="text-sm whitespace-pre-wrap">{block.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-4">
                    <div className="w-9 h-9 rounded-full bg-[#FF9C8F] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">O</span>
                    </div>
                    <div className="flex-1 min-w-0 max-w-[85%]">
                      <p className="text-xs font-semibold text-[#FF9C8F] uppercase tracking-wide mb-1">오케스트레이터 정리</p>
                      <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 shadow-sm border border-[#FFE4E0]">
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-4 pl-12 space-y-2">
                      {msg.recommendations.map((r) => (
                        <button
                          key={r.card.id}
                          type="button"
                          onClick={() => setSelectedCard(r.card)}
                          className="w-full flex items-center gap-3 p-3 bg-white hover:bg-[#FFE4E0]/30 rounded-xl text-left transition-colors border border-gray-100"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FFE4E0] flex-shrink-0">
                            <img src={r.card.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{r.card.card_name || 'My Card'}</p>
                            <p className="text-xs text-[#FF9C8F] truncate">{r.card.custom_title || 'Professional'}</p>
                            {r.reason && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.reason}</p>}
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FF9C8F] text-lg">🤖</span>
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <p className="text-xs font-medium text-[#FF9C8F] mb-1">오케스트레이터</p>
                    <div className="rounded-2xl px-4 py-3 bg-white text-gray-900 shadow-sm border border-gray-100">
                      <p className="text-sm">{msg.text}</p>
                      {msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.recommendations.map((r) => (
                            <button
                              key={r.card.id}
                              type="button"
                              onClick={() => setSelectedCard(r.card)}
                              className="w-full flex items-center gap-3 p-3 bg-[#FAF8F6] hover:bg-[#FFE4E0]/50 rounded-xl text-left transition-colors"
                            >
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FFE4E0] flex-shrink-0">
                                <img src={r.card.image_url} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{r.card.card_name || 'My Card'}</p>
                                <p className="text-xs text-[#FF9C8F] truncate">{r.card.custom_title || 'Professional'}</p>
                                {r.reason && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.reason}</p>}
                              </div>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {loading && (
          <div className="flex gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center flex-shrink-0">
              <span className="text-[#FF9C8F] text-lg">🤖</span>
            </div>
            <div className="rounded-2xl px-4 py-3 bg-white shadow-sm border border-gray-100">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#FF9C8F] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#FF9C8F] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#FF9C8F] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex gap-2 bg-gray-100 rounded-xl px-4 py-3">
          <input
            type="text"
            placeholder="예: 어떤 앱을 만들고 싶다 / 팀원 구해요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
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
          onClose={() => setSelectedCard(null)}
          showShareIconOnly
        />
      )}
    </div>
  )
}
