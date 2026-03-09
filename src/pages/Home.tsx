import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useUserCards, type UserCard } from '@/hooks/useUserCards'
import { useCardStats } from '@/hooks/useCardStats'
import AddCardModal, { type AddCardData } from '@/components/AddCardModal'
import CardDetailModal from '@/components/CardDetailModal'

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

  useEffect(() => {
    if (cards.length > 0 && selectedCardIndex >= cards.length) {
      setSelectedCardIndex(0)
    }
  }, [cards.length, selectedCardIndex])

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

  const handleAddTestCard = async () => {
    const testCards = [
      {
        card_name: '테스트 카드 A',
        description: '개발용 테스트 카드입니다. 저장·표시 확인용.',
        custom_title: 'Product Strategist',
        custom_content: 'AI, Networking',
        image_url: 'https://picsum.photos/400/533?random=' + Date.now(),
        portfolio_url: null,
        email: null,
        kakao_id: null,
        phone: null,
      },
      {
        card_name: '테스트 카드 B',
        description: '두 번째 테스트 카드. 여러 카드 전환 테스트용.',
        custom_title: 'Senior AI Architect',
        custom_content: 'Cloud, DevOps',
        image_url: 'https://picsum.photos/400/533?random=' + (Date.now() + 1),
        portfolio_url: null,
        email: null,
        kakao_id: null,
        phone: null,
      },
    ]
    const card = testCards[Math.floor(Math.random() * testCards.length)]!
    await addCard(card)
    refetch()
  }

  const loading = profileLoading || cardsLoading
  if (loading) {
    return (
      <div className="min-h-full bg-[#FAF8F6] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#FAF8F6] px-4 pt-6 pb-8">
      <header className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-white border-2 border-[#FF9C8F]/30 flex items-center justify-center overflow-hidden">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">🤖</span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-800 mt-3">My Networking Agent</h1>
        <p className="text-sm text-gray-500">Your digital twin is active</p>
      </header>

      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[#FF9C8F] uppercase tracking-wider mb-3">
          Personal AI Card
        </h2>
        {cards.length > 0 ? (
          (() => {
            const mainCard = cards[selectedCardIndex]!
            const nextCard = cards[(selectedCardIndex + 1) % cards.length]
            return (
          <div className="relative flex -mx-4 justify-center items-start">
            <div
              className={`cursor-pointer ${nextCard ? 'flex-1 min-w-0 max-w-[280px]' : 'w-full max-w-[280px]'} px-4`}
              onClick={() => setDetailCard(mainCard)}
            >
              <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[3/4] max-h-80 mx-auto">
                <img
                  src={mainCard.image_url}
                  alt={mainCard.card_name || 'AI Card'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white font-bold text-lg">{mainCard.card_name || 'My Card'}</p>
                  <p className="text-white/90 text-sm">{mainCard.custom_title || 'Professional'}</p>
                  <p className="text-white/80 text-xs mt-1">Active • 1.2k scans</p>
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className="text-white drop-shadow">📶</span>
                  <span className="text-white drop-shadow">📱</span>
                </div>
              </div>
            </div>
            {nextCard && (
              <div className="flex-shrink-0 w-14 sm:w-16 -ml-3">
                <button
                  type="button"
                  onClick={() => setSelectedCardIndex((selectedCardIndex + 1) % cards.length)}
                  className="block w-full focus:outline-none focus:ring-2 focus:ring-[#FF9C8F] focus:ring-offset-2 rounded-xl overflow-hidden"
                >
                  <div className="relative overflow-hidden rounded-xl shadow-md aspect-[3/4] border-2 border-white">
                    <img
                      src={nextCard.image_url}
                      alt={nextCard.card_name || 'AI Card'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                </button>
              </div>
            )}
          </div>
            )
          })()
        ) : (
          <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[3/4] max-h-80 max-w-[280px] mx-auto bg-[#FF9C8F] p-6 text-white flex flex-col justify-between">
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
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleAddTestCard}
              className="w-full flex items-center justify-center gap-2 border border-amber-400 text-amber-700 text-sm py-2 rounded-xl hover:bg-amber-50"
            >
              🧪 테스트 카드 추가 (개발용)
            </button>
          )}
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
