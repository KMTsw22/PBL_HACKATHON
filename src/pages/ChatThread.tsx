import { useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CardImage } from '@/components/CardImage'
import { useAuth } from '@/hooks/useAuth'
import { useMessages } from '@/hooks/useMessages'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type OtherUser = { id: string; name: string | null; photo_url: string | null }

export default function ChatThread() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { messages, loading, loadingOlder, hasMoreOlder, loadMoreOlder, sendMessage } = useMessages(conversationId ?? null, user?.id ?? null)
  const draftFromState = (location.state as { draft?: string } | null)?.draft
  const [input, setInput] = useState(() => draftFromState ?? '')
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollRef = useRef<{ height: number; top: number } | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleLoadMoreOlder = useCallback(() => {
    if (!hasMoreOlder || loadingOlder) return
    const el = scrollContainerRef.current
    if (el) prevScrollRef.current = { height: el.scrollHeight, top: el.scrollTop }
    loadMoreOlder()
  }, [hasMoreOlder, loadingOlder, loadMoreOlder])

  useEffect(() => {
    if (prevScrollRef.current && scrollContainerRef.current && !loadingOlder) {
      const prev = prevScrollRef.current
      prevScrollRef.current = null
      const el = scrollContainerRef.current
      const newHeight = el.scrollHeight
      el.scrollTop = Math.max(0, newHeight - prev.height + prev.top)
    }
  }, [messages.length, loadingOlder])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el || !hasMoreOlder || loadingOlder) return
    if (el.scrollTop < 250) handleLoadMoreOlder()
  }, [hasMoreOlder, loadingOlder, handleLoadMoreOlder])

  useEffect(() => {
    if (!conversationId || !user?.id) return
    const load = async () => {
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
      if (participantsError) {
        console.error('[ChatThread] participants', participantsError.message, participantsError.details)
        return
      }
      const otherId = (participants ?? []).find((p) => p.user_id !== user.id)?.user_id
      if (!otherId) return
      const { data: profile, error: profileError } = await supabase.from('profiles').select('id, name, photo_url').eq('id', otherId).single()
      if (profileError) {
        console.error('[ChatThread] profile', profileError.message, profileError.details)
        return
      }
      if (profile) setOtherUser({ id: profile.id, name: profile.name, photo_url: profile.photo_url })
    }
    load()
  }, [conversationId, user?.id])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }

  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid conversation.</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#FAF8F6]">
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-700"
          aria-label="Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#FFE4E0] flex-shrink-0 relative">
          <CardImage
            imageUrl={otherUser?.photo_url ?? ''}
            name={otherUser?.name}
            className="w-full h-full object-cover rounded-full"
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{otherUser?.name || 'Loading...'}</p>
          <p className="text-xs text-gray-500">Active 5m ago</p>
        </div>
        <button type="button" className="p-2 rounded-full hover:bg-gray-100 text-gray-600" aria-label="Video call">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>
        <button type="button" className="p-2 rounded-full hover:bg-gray-100 text-gray-600" aria-label="More">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </header>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {hasMoreOlder && (
              <div className="flex justify-center py-2">
                {loadingOlder ? (
                  <div className="w-6 h-6 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <button
                    type="button"
                    onClick={handleLoadMoreOlder}
                    className="text-xs text-gray-500 hover:text-[#FF9C8F]"
                  >
                    이전 메시지 더 보기
                  </button>
                )}
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#FFE4E0] flex-shrink-0 mt-1">
                    {isMe ? (
                      <CardImage
                        imageUrl={(user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture) as string ?? ''}
                        name={(user?.user_metadata?.full_name as string) ?? 'U'}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <CardImage
                        imageUrl={otherUser?.photo_url ?? ''}
                        name={otherUser?.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    )}
                  </div>
                  <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        isMe ? 'bg-[#FF9C8F] text-white rounded-br-md' : 'bg-gray-200 text-gray-900 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
            {messages.length >= 2 && (
              <div className="rounded-2xl bg-[#FFE4E0]/80 border border-[#FF9C8F]/25 shadow-sm p-4 my-4 flex gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#FF9C8F] uppercase tracking-wider flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded bg-[#FF9C8F]/25 flex items-center justify-center text-[#FF9C8F] text-[10px]">◆</span>
                    Agent Insights
                  </p>
                  <p className="text-sm text-gray-700 mb-3">
                    Keep the conversation going. Ask about their work or suggest a coffee chat.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#FF9C8F] text-white text-sm font-medium shadow-sm hover:bg-[#f08a7d] transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Suggest Meetup
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      Details
                    </button>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-[#FF9C8F]/30 to-[#FFE4E0] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#FF9C8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <footer className="fixed bottom-[56px] left-0 right-0 flex items-center gap-2 px-4 py-3 bg-white border-t border-gray-100 shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          aria-label="Attach"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <input
          id="chat-message-input"
          name="chatMessage"
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#FF9C8F]/30 focus:bg-white placeholder:text-gray-400 transition-shadow"
          aria-label="메시지 입력"
        />
        <button
          type="button"
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Emoji"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full bg-[#FF9C8F] flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f08a7d] transition-colors"
          aria-label="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </footer>
    </div>
  )
}
