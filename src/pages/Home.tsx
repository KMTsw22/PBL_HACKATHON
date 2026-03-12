import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useUserCards, type UserCard } from '@/hooks/useUserCards'
import { useCardStats } from '@/hooks/useCardStats'
import AddCardModal, { type AddCardData } from '@/components/AddCardModal'
import CardDetailModal from '@/components/CardDetailModal'
import { CardImage } from '@/components/CardImage'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { profile, loading: profileLoading } = useProfile(user)
  const { cards, loading: cardsLoading, addCard, updateCard, deleteCard, refetch } = useUserCards(user?.id ?? null)
  const myCardIds = cards.map((c) => c.id)
  const { totalCollectionsCount, getCardCollectedCount, refetch: refetchStats } = useCardStats(user?.id ?? null, myCardIds)
  const [modalOpen, setModalOpen] = useState(false)
  const [editCard, setEditCard] = useState<UserCard | null>(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)
  const [detailCard, setDetailCard] = useState<UserCard | null>(null)
  const [slideOutIndex, setSlideOutIndex] = useState<number | null>(null)

  useEffect(() => {
    if (cards.length > 0 && selectedCardIndex >= cards.length) {
      setSelectedCardIndex(0)
    }
  }, [cards.length, selectedCardIndex])

  const goToNextCard = () => {
    if (cards.length <= 1) return
    const next = (selectedCardIndex + 1) % cards.length
    setSlideOutIndex(selectedCardIndex)
    setSelectedCardIndex(next)
    setTimeout(() => setSlideOutIndex(null), 480)
  }

  useEffect(() => {
    const cardId = searchParams.get('card')
    if (cardId && cards.length > 0) {
      const card = cards.find((c) => c.id === cardId)
      if (card) setDetailCard(card)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, cards, setSearchParams])

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.user_name || '이름을 등록해주세요'
  const displayTitle = profile?.major || profile?.experience || '직함을 등록해주세요'

  const handleSaveCard = async (data: AddCardData) => {
    if (!data.aiGeneratedImageUrl) {
      throw new Error('카드 이미지가 없습니다.')
    }
    const cardData = {
      card_name: data.cardName || null,
      description: data.card_description || null,
      custom_title: data.customTitle || null,
      custom_content: data.customContent || null,
      image_url: data.aiGeneratedImageUrl,
      portfolio_url: data.portfolio_url || null,
      email: data.email || null,
      kakao_id: data.kakao_id || null,
      phone: data.phone || null,
    }
    try {
      if (data.cardId) {
        await updateCard(data.cardId, cardData)
      } else {
        await addCard(cardData)
      }
      refetch()
      refetchStats()
      setEditCard(null)
    } catch (e) {
      console.error('카드 저장 실패:', e)
      throw e
    }
  }

  const loading = profileLoading || cardsLoading
  if (loading) {
    return (
      <div className="min-h-full bg-[#FAF8F6] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })()
  const firstName = displayName.split(/\s/)[0] || displayName

  return (
    <div className="min-h-full bg-[#FAF8F6] px-4 pb-8">
      <header className="pt-6 pb-4">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center gap-3 w-full max-w-sm">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-center">
              <h1 className="text-xl font-bold text-gray-800">My Networking Agent</h1>
              <button type="button" className="p-1 rounded-full hover:bg-[#FFE4E0]/50 text-[#FF9C8F] flex-shrink-0" aria-label="More">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#FFE4E0] border-2 border-[#FF9C8F]/30 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
              <CardImage
                imageUrl={profile?.photo_url ?? ''}
                name={profile?.name || (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string)}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Your digital twin is active</p>
          <div className="mt-4 w-full max-w-sm">
            <p className="text-sm text-gray-700 bg-[#FFE4E0]/60 rounded-2xl px-4 py-3 border border-[#FF9C8F]/20">
              {greeting}, {firstName}! You have 3 new potential matches today. ✨
            </p>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[#FF9C8F] uppercase tracking-wider mb-3">
          Personal AI Card
        </h2>
        {cards.length > 0 ? (
          (() => {
            const nextIndex = (selectedCardIndex + 1) % cards.length
            const hasNext = cards.length > 1
            const mainCard = cards[selectedCardIndex]!
            const isAnimating = slideOutIndex !== null
            const leavingIndex = slideOutIndex ?? selectedCardIndex

            const renderCard = (card: UserCard, animClass: string) => (
              <div
                key={card.id}
                className={`absolute inset-0 cursor-pointer ${animClass}`}
                onClick={() => !isAnimating && setDetailCard(card)}
              >
                <div className="relative w-full h-full rounded-2xl shadow-lg overflow-hidden">
                  <CardImage
                    imageUrl={card.image_url}
                    name={card.card_name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="text-white font-bold text-lg">{card.card_name || 'My Card'}</p>
                    <p className="text-white/90 text-sm">{card.custom_title || 'Professional'}</p>
                    <p className="text-white/80 text-xs mt-1">Active • 1.2k scans</p>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className="text-white drop-shadow">📶</span>
                    <span className="text-white drop-shadow">📱</span>
                  </div>
                </div>
              </div>
            )

            return (
          <div className="relative flex px-4 justify-center items-stretch gap-0">
            <div
              className={`relative z-20 isolate ${hasNext ? 'flex-1 min-w-0 max-w-[340px] pr-0' : 'w-full max-w-[340px]'} flex justify-center`}
            >
              <div className="relative w-full aspect-[3/4] max-h-[420px] min-h-[280px] overflow-hidden rounded-2xl bg-[#FAF8F6]">
                {!isAnimating && renderCard(mainCard, '')}
                {isAnimating && (
                  <>
                    {renderCard(
                      cards[leavingIndex]!,
                      'animate-card-out z-0'
                    )}
                    {renderCard(
                      cards[selectedCardIndex]!,
                      'animate-card-in z-10'
                    )}
                  </>
                )}
              </div>
            </div>
            {hasNext && (
              <div className="w-6 flex-shrink-0 overflow-hidden self-stretch min-h-0 relative -ml-2 z-10">
                <button
                  type="button"
                  onClick={goToNextCard}
                  className="absolute inset-0 focus:outline-none focus:ring-2 focus:ring-[#FF9C8F] focus:ring-offset-2 rounded-r-2xl"
                >
                  <div className="absolute right-0 top-0 h-full aspect-[3/4] overflow-hidden rounded-2xl shadow-md border border-white border-l-0 opacity-60">
                    <CardImage
                      imageUrl={cards[nextIndex]!.image_url}
                      name={cards[nextIndex]!.card_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-white/20" />
                  </div>
                </button>
              </div>
            )}
          </div>
            )
          })()
        ) : (
          <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[3/4] max-h-[420px] min-h-[280px] max-w-[340px] mx-auto bg-[#FF9C8F] p-6 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{displayName}</h3>
                <p className="text-white/90 text-sm">{displayTitle}</p>
                <p className="text-white/80 text-xs mt-1">Active • 1.2k scans</p>
              </div>
              <div className="flex gap-2">
                <span className="text-2xl">📶</span>
                <span className="text-2xl">📱</span>
              </div>
            </div>
            <div className="flex justify-end">
              <span className="text-white/80 text-sm">QR</span>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#FF9C8F] text-white font-medium py-3 rounded-xl"
          >
            <span>+</span> Add New Card
          </button>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-gray-800">Network Statistics</h2>
          <button type="button" className="text-sm text-[#FF9C8F]">View Insights</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center text-[#FF9C8F] mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-xs text-[#FF9C8F] font-semibold uppercase">Connections</p>
            <p className="text-2xl font-bold text-gray-800">{totalCollectionsCount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">내 전체 카드 수집 수</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center text-[#FF9C8F] mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-[#FF9C8F] font-semibold uppercase">Collected</p>
            <p className="text-2xl font-bold text-gray-800">
              {cards.length > 0 ? getCardCollectedCount(cards[selectedCardIndex]!.id).toLocaleString() : '0'}
            </p>
            <p className="text-xs text-gray-500">이 카드 수집 수</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFE4E0] flex items-center justify-center">
              <span className="text-[#FF9C8F]">⭐</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">AI Match Rate</p>
              <p className="text-sm text-gray-500">84% relevant leads</p>
            </div>
          </div>
          <span className="text-lg font-bold text-[#FF9C8F]">High</span>
        </div>
      </section>

      <AddCardModal
        isOpen={modalOpen || !!editCard}
        onClose={() => {
          setModalOpen(false)
          setEditCard(null)
        }}
        profile={profile}
        userId={user?.id}
        initialCard={editCard}
        onSave={handleSaveCard}
      />

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          isOpen={!!detailCard}
          onClose={() => setDetailCard(null)}
          onEdit={(card) => {
            setDetailCard(null)
            setEditCard(card)
          }}
          onDelete={async (cardId) => {
            await deleteCard(cardId)
            setDetailCard(null)
            refetch()
            refetchStats()
          }}
        />
      )}
    </div>
  )
}
