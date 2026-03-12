import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useConversations } from '@/hooks/useConversations'
import { useCollectedCards } from '@/hooks/useCollectedCards'
import { getOrCreateDmConversation } from '@/lib/chat'

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60 * 1000) return 'NOW'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 48 * 60 * 60 * 1000) return 'Yesterday'
  return d.toLocaleDateString()
}

export default function Chats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { conversations, loading } = useConversations(user?.id ?? null)
  const { collected } = useCollectedCards(user?.id ?? null)
  const [search, setSearch] = useState('')

  const filteredConversations = search.trim()
    ? conversations.filter(
        (c) =>
          c.other_user.name?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  const suggestionUsers = collected
    .map((c) => c.user_cards?.user_id)
    .filter(Boolean) as string[]
  const uniqueSuggestionIds = Array.from(new Set(suggestionUsers)).filter(
    (id) => id !== user?.id && !conversations.some((c) => c.other_user.id === id)
  )

  const handleStartChat = async (otherUserId: string) => {
    const convId = await getOrCreateDmConversation(otherUserId)
    if (convId) navigate(`/chats/${convId}`)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F6] flex flex-col">
      <header className="sticky top-0 z-10 bg-[#FAF8F6] border-b border-gray-100 px-4 py-3 flex items-center gap-3">
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
        <h1 className="flex-1 text-lg font-bold text-gray-900">Messages</h1>
      </header>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-xl bg-[#FFE4E0]/50 px-4 py-3 text-gray-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder:text-gray-400 text-sm"
          />
        </div>

        {uniqueSuggestionIds.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">AI Agent Suggestions</h2>
              <span className="text-xs font-medium text-[#FF9C8F] bg-[#FFE4E0]/60 px-2 py-0.5 rounded-full">
                HIGH MATCH
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1">
              {collected
                .filter((c) => c.user_cards && uniqueSuggestionIds.includes(c.user_cards.user_id))
                .slice(0, 5)
                .map((c) => {
                  const card = c.user_cards!
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleStartChat(card.user_id)}
                      className="flex-shrink-0 flex flex-col items-center gap-2"
                    >
                      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-[#FFE4E0] border-2 border-white shadow-sm">
                        <img src={card.image_url} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" aria-hidden />
                      </div>
                      <span className="text-xs font-medium text-gray-800 max-w-[72px] truncate">
                        {card.card_name || 'Card'}
                      </span>
                    </button>
                  )
                })}
            </div>
          </section>
        )}

        <section className="mt-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Recent</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {search.trim() ? 'No conversations match your search.' : 'No messages yet. Start a chat from a card or Ask.'}
            </div>
          ) : (
            <ul className="space-y-0">
              {filteredConversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chats/${conv.id}`)}
                    className="w-full flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-[#FFE4E0]/30 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#FFE4E0] flex-shrink-0">
                      {conv.other_user.photo_url ? (
                        <img src={conv.other_user.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#FF9C8F] font-bold text-lg">
                          {(conv.other_user.name || '?').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{conv.other_user.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {conv.last_message?.content ?? 'No messages yet'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      {conv.last_message && conv.last_message.sender_id !== user?.id ? (
                        <>
                          <span className="text-xs font-semibold text-[#FF9C8F]">{formatTime(conv.updated_at)}</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF9C8F] flex-shrink-0" aria-hidden />
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">{formatTime(conv.updated_at)}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
