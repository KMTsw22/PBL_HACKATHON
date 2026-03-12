import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDiscoverCards } from '@/hooks/useDiscoverCards'
import { useCollectedCardIds } from '@/hooks/useCollectedCardIds'
import CardDetailModal from '@/components/CardDetailModal'
import RateCollectModal from '@/components/RateCollectModal'
import { getOrCreateDmConversation } from '@/lib/chat'
import type { UserCard } from '@/hooks/useUserCards'
import type { RateCollectData } from '@/components/RateCollectModal'

export default function Find() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addCollect, collectedIds, loading: collectedIdsLoading } = useCollectedCardIds(user?.id ?? null)
  const { cards, loading, fetchMore, hasMore, retry } = useDiscoverCards(user?.id ?? null, collectedIds, {
    collectedReady: !collectedIdsLoading,
  })
  const displayCards = cards.filter((card) => !collectedIds.has(card.id))
  const waitForCollected = collectedIdsLoading
  const [rateCollectCard, setRateCollectCard] = useState<UserCard | null>(null)

  const handleCollectWithRating = useCallback((card: UserCard) => {
    setRateCollectCard(card)
  }, [])

  const handleRateCollectSubmit = useCallback(
    async (data: RateCollectData) => {
      if (!rateCollectCard) return
      await addCollect(rateCollectCard.id, {
        privateNotes: data.privateNotes,
        scores: data.scores.map((s) => ({ category: s.category, score: s.score, isAiSuggested: s.isAiSuggested })),
      })
      setRateCollectCard(null)
    },
    [rateCollectCard, addCollect]
  )
  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry?.isIntersecting && hasMore && !loading) {
        fetchMore()
      }
    },
    [fetchMore, hasMore, loading]
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
  }, [handleIntersect, displayCards.length])

  useEffect(() => {
    if (displayCards.length === 0 && hasMore && !loading) fetchMore()
  }, [displayCards.length, hasMore, loading, fetchMore])

  useEffect(() => {
    if (displayCards.length > 0 && displayCards.length <= 3 && hasMore && !loading) fetchMore()
  }, [displayCards.length, hasMore, loading, fetchMore])

  return (
    <div className="min-h-full bg-[#FAF8F6] px-4 pt-4 pb-8">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-900">Find</h1>
        <p className="text-sm text-gray-500">스크롤하여 더 보기</p>
      </header>

      {waitForCollected || (displayCards.length === 0 && loading) ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-gray-500">{waitForCollected ? '수집 목록 확인 중...' : '명함을 불러오는 중...'}</p>
        </div>
      ) : displayCards.length === 0 && !hasMore ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-[#FFE4E0] flex items-center justify-center mb-4">
            <span className="text-3xl">📇</span>
          </div>
          <p className="text-gray-600 text-center mb-2">
            {cards.length > 0 ? '지금 볼 수 있는 명함은 모두 수집했어요' : '아직 등록된 명함이 없어요'}
          </p>
          <p className="text-sm text-gray-500 text-center mb-6">
            {cards.length > 0 ? 'Collect에서 확인해보세요' : '다른 사용자들이 명함을 만들면 여기서 볼 수 있어요'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 px-6 py-3 bg-[#FF9C8F] text-white font-medium rounded-xl"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          {displayCards.length === 0 && hasMore && (
            <div className="py-12 text-center text-sm text-gray-500">
              수집한 명함을 제외하고 불러오는 중...
            </div>
          )}
          {displayCards.map((card) => (
            <div key={card.id} className="min-h-[68vh]">
              <CardDetailModal
                card={card}
                isOpen={true}
                variant="inline"
                onCollectWithRating={handleCollectWithRating}
                isCollected={false}
                onMessage={card.user_id !== user?.id ? async (c) => { const convId = await getOrCreateDmConversation(c.user_id); if (convId) navigate(`/chats/${convId}`) } : undefined}
                showShareIconOnly
              />
            </div>
          ))}
          <div ref={sentinelRef} className="h-4 flex items-center justify-center">
            {loading && (
              <div className="w-8 h-8 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      )}

      {rateCollectCard && (
        <RateCollectModal
          isOpen={!!rateCollectCard}
          onClose={() => setRateCollectCard(null)}
          card={rateCollectCard}
          onSubmit={handleRateCollectSubmit}
        />
      )}
    </div>
  )
}
