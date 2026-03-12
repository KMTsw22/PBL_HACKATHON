import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNavVisibility } from '@/contexts/NavVisibilityContext'
import { useCollectedCards, type CollectedCard } from '@/hooks/useCollectedCards'
import CardDetailModal from '@/components/CardDetailModal'
import { CardImage } from '@/components/CardImage'
import RateCollectModal from '@/components/RateCollectModal'
import { getOrCreateDmConversation } from '@/lib/chat'

export default function Collect() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { collected, loading, loadingMore, hasMore, fetchMore, removeCollect, updateRatings } = useCollectedCards(user?.id ?? null)
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<CollectedCard | null>(null)
  const [showEditRatings, setShowEditRatings] = useState(false)
  const { setHideNav } = useNavVisibility()

  useEffect(() => {
    setHideNav(showEditRatings)
    return () => setHideNav(false)
  }, [showEditRatings, setHideNav])

  const filtered = collected.filter((c) => {
    if (!c.user_cards) return false
    const name = (c.user_cards.card_name ?? '').toLowerCase()
    const title = (c.user_cards.custom_title ?? '').toLowerCase()
    const q = search.toLowerCase().trim()
    return !q || name.includes(q) || title.includes(q)
  })

  const sentinelRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry?.isIntersecting && hasMore && !loading && !loadingMore) {
        fetchMore()
      }
    },
    [fetchMore, hasMore, loading, loadingMore]
  )
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleIntersect, filtered.length])

  useEffect(() => {
    if (filtered.length > 0 && filtered.length <= 5 && hasMore && !loading && !loadingMore) fetchMore()
  }, [filtered.length, hasMore, loading, loadingMore, fetchMore])

  return (
    <div className="min-h-full bg-[#FAF8F6] px-4 pt-4 pb-24">
      <header className="flex items-center justify-between mb-4">
        <button type="button" className="w-10 h-10 flex items-center justify-center text-[#FF9C8F]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Collect</h1>
        <Link to="/find" className="w-10 h-10 flex items-center justify-center text-[#FF9C8F]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      </header>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search collected cards"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-sm placeholder:text-gray-400"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-gray-500">수집한 명함을 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-[#FFE4E0] flex items-center justify-center mb-4">
            <span className="text-3xl">📇</span>
          </div>
          <p className="text-gray-600 text-center mb-2">수집한 명함이 없어요</p>
          <p className="text-sm text-gray-500 text-center mb-6">Find에서 마음에 드는 명함을 Collect 해보세요</p>
          <Link
            to="/find"
            className="px-6 py-3 bg-[#FF9C8F] text-white font-medium rounded-xl"
          >
            Find로 가기
          </Link>
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          {filtered.map((item) => {
            const card = item.user_cards
            if (!card) return null
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#FFE4E0] flex-shrink-0">
                  <CardImage imageUrl={card.image_url} name={card.card_name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{card.card_name || 'My Card'}</p>
                  <p className="text-sm text-[#FF9C8F] truncate">{card.custom_title || 'Professional'}</p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )
          })}
          <div ref={sentinelRef} className="h-4 flex items-center justify-center py-4">
            {loadingMore && (
              <div className="w-8 h-8 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      )}

      {selectedItem?.user_cards && (
        <>
          <CardDetailModal
            card={selectedItem.user_cards}
            isOpen={true}
            onClose={() => {
              setSelectedItem(null)
              setShowEditRatings(false)
            }}
            onCollect={() => {
              removeCollect(selectedItem.card_id)
              setSelectedItem(null)
            }}
            isCollected={true}
            collectLabelWhenCollected="Remove"
            onMessage={selectedItem.user_cards.user_id !== user?.id ? async (c) => { const convId = await getOrCreateDmConversation(c.user_id); if (convId) navigate(`/chats/${convId}`) } : undefined}
            showShareIconOnly
            myRatings={{
              scores: selectedItem.scores.map((s) => ({ category: s.category, score: s.score })),
              privateNotes: selectedItem.private_notes,
            }}
            onEditRatings={() => { setHideNav(true); setShowEditRatings(true) }}
          />
          {showEditRatings && (
            <RateCollectModal
              key={selectedItem.id}
              isOpen={true}
              onClose={() => { setHideNav(false); setShowEditRatings(false) }}
              card={selectedItem.user_cards}
              initialData={{
                scores: selectedItem.scores.map((s) => ({ category: s.category, score: s.score })),
                privateNotes: selectedItem.private_notes ?? '',
              }}
              onSubmit={async (data) => {
                await updateRatings(selectedItem.id, {
                  privateNotes: data.privateNotes,
                  scores: data.scores.map((s) => ({ category: s.category, score: s.score, isAiSuggested: s.isAiSuggested })),
                })
                setSelectedItem((prev) =>
                  prev
                    ? {
                        ...prev,
                        scores: data.scores.map((s) => ({ category: s.category, score: s.score, is_ai_suggested: s.isAiSuggested })),
                        private_notes: data.privateNotes || null,
                      }
                    : null
                )
                setHideNav(false)
                setShowEditRatings(false)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
