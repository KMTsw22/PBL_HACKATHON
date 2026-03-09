import { useState, useRef, useEffect } from 'react'
import { recommendFromCollected, type RecommendResult } from '@/lib/recommendFromCollected'
import CardDetailModal from '@/components/CardDetailModal'
import type { UserCard } from '@/hooks/useUserCards'

type Message = {
  id: string
  type: 'user' | 'agent'
  text: string
  recommendations?: RecommendResult[]
}

export default function Ask() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'agent',
      text: '안녕하세요! 수집한 명함 중에서 인재를 추천해드려요. 예: "프론트엔드 개발자가 필요해", "해커톤 팀원 구해요"',
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
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, type: 'user', text }])
    setLoading(true)

    try {
      const { recommendations, message } = await recommendFromCollected(text)
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          type: 'agent',
          text: message,
          recommendations,
        },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          type: 'agent',
          text: e instanceof Error ? e.message : '추천을 불러오지 못했어요.',
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
        <p className="text-center text-xs text-gray-400 mb-4">수집한 명함 기반 인재 추천</p>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 mb-4 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.type === 'agent' && (
              <div className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF9C8F] text-lg">🤖</span>
              </div>
            )}
            <div className={`flex-1 max-w-[85%] ${msg.type === 'user' ? 'flex flex-col items-end' : ''}`}>
              {msg.type === 'agent' && (
                <p className="text-xs font-medium text-[#FF9C8F] mb-1">Global Agent</p>
              )}
              {msg.type === 'user' && (
                <p className="text-xs text-gray-400 mb-1">You</p>
              )}
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.type === 'user' ? 'bg-[#FF9C8F] text-white' : 'bg-white text-gray-900 shadow-sm border border-gray-100'
                }`}
              >
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
                          {r.reason && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.reason}</p>
                          )}
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
        ))}
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
            placeholder="예: 프론트엔드 개발자가 필요해"
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
