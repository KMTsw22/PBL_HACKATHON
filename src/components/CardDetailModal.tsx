import { useState } from 'react'
import type { UserCard } from '@/hooks/useUserCards'
import ShareModal from './ShareModal'

export type MyRatings = {
  scores: { category: string; score: number }[]
  privateNotes: string | null
}

type Props = {
  card: UserCard
  isOpen: boolean
  onClose?: () => void
  onEdit?: (card: UserCard) => void
  onDelete?: (cardId: string) => void
  onCollect?: (cardId: string) => void
  onCollectWithRating?: (card: UserCard) => void
  isCollected?: boolean
  collectLabelWhenCollected?: string
  showShareIconOnly?: boolean
  myRatings?: MyRatings | null
  onEditRatings?: () => void
  onMessage?: (card: UserCard) => void
  /** 연락 초안이 있을 때 '연락 보내기'로 메시지 전송 후 이동 */
  contactDraft?: string
  /** 연락 없이 채팅방으로만 이동 (초안은 입력창에 채움) */
  onNavigateToChat?: (card: UserCard) => void
  variant?: 'modal' | 'inline'
}

export default function CardDetailModal({ card, isOpen, onClose, onEdit, onDelete, onCollect, onCollectWithRating, isCollected, collectLabelWhenCollected, showShareIconOnly, myRatings, onEditRatings, onMessage, contactDraft, onNavigateToChat, variant = 'modal' }: Props) {
  const [showShare, setShowShare] = useState(false)
  if (!isOpen) return null

  const expertise = [card.custom_title, card.custom_content].filter(Boolean) as string[]
  const isInline = variant === 'inline'

  const content = (
    <div className={`relative w-full ${isInline ? '' : 'max-w-md'} bg-white rounded-t-2xl sm:rounded-2xl overflow-y-auto ${isInline ? 'rounded-2xl pb-2' : 'max-h-[90vh] pb-6'}`}>
        <div className="relative">
          <div className="aspect-[4/3] w-full min-h-[220px] bg-[#FFE4E0] overflow-hidden rounded-t-2xl">
            <img src={card.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
              <span className="w-8" />
              <h2 className="text-lg font-bold text-white drop-shadow-lg">Networking Card</h2>
              {!isInline && onClose && (
                <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-[#FF9C8F] hover:bg-white backdrop-blur-sm">
                  ✕
                </button>
              )}
              {isInline && <span className="w-8" />}
            </div>
          </div>
        </div>

        <div className="relative -mt-6 mx-4 mb-1 rounded-2xl bg-white shadow-lg p-6 pt-4 pb-4">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">{card.card_name || 'My Card'}</h3>
            <p className="text-[#FF9C8F] text-sm mt-1">{card.custom_title || 'Professional'}</p>
          </div>

          <div className="flex gap-2.5 items-stretch p-1 rounded-2xl bg-gray-50/80 border border-gray-100">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose?.()
                  onEdit(card)
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#FF9C8F] text-white font-medium rounded-xl shadow-sm hover:opacity-90 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            )}
            {(onCollect || onCollectWithRating) && (
              <button
                type="button"
                onClick={() => {
                  if (isCollected) {
                    onCollect?.(card.id)
                  } else if (onCollectWithRating) {
                    onCollectWithRating(card)
                  } else {
                    onCollect?.(card.id)
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 font-medium rounded-xl transition-opacity ${
                  isCollected
                    ? 'bg-white text-[#FF9C8F] border border-[#FF9C8F]/40 hover:bg-[#FFF5F3]'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-[#FFE4E0] hover:border-[#FF9C8F]/40 hover:text-[#FF9C8F]'
                }`}
              >
                {isCollected ? (
                  <>
                    <span className="text-[#FF9C8F]">✓</span>
                    {collectLabelWhenCollected ?? 'Collected'}
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    Collect
                  </>
                )}
              </button>
            )}
            {onMessage && (
              <>
                <button
                  type="button"
                  onClick={() => { onClose?.(); onMessage(card) }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#FF9C8F] text-white font-medium rounded-xl shadow-sm hover:opacity-90 transition-opacity"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {contactDraft?.trim() ? '연락 보내기' : '연락하기'}
                </button>
                {contactDraft != null && onNavigateToChat && (
                  <button
                    type="button"
                    onClick={() => { onClose?.(); onNavigateToChat(card) }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    채팅으로 이동
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setShowShare(true)}
              className={showShareIconOnly
                ? 'w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#FF9C8F] transition-colors flex-shrink-0'
                : 'flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 hover:text-[#FF9C8F] transition-colors'}
              title="Share"
            >
              <svg width={showShareIconOnly ? 18 : 16} height={showShareIconOnly ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {!showShareIconOnly && <span>Share</span>}
            </button>
          </div>

          {card.description && (
            <div className="mt-6">
              <h4 className="font-bold text-gray-900 mb-2">About</h4>
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">{card.description}</p>
            </div>
          )}

          {expertise.length > 0 && (
            <div className="mt-6">
              <h4 className="font-bold text-gray-900 mb-2">Expertise</h4>
              <div className="flex flex-wrap gap-2">
                {expertise.map((item, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-[#FFE4E0] text-[#FF9C8F] text-sm font-medium rounded-full border border-[#FF9C8F]/30"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(card.portfolio_url || card.email || card.kakao_id || card.phone) && (
            <div className="mt-6 space-y-3">
              {card.portfolio_url && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    </svg>
                    Portfolio
                  </span>
                  <a href={card.portfolio_url.startsWith('http') ? card.portfolio_url : `https://${card.portfolio_url}`} target="_blank" rel="noopener noreferrer" className="text-[#FF9C8F] text-sm hover:underline truncate max-w-[180px]">
                    {card.portfolio_url.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {card.email && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Email
                  </span>
                  <a href={`mailto:${card.email}`} className="text-[#FF9C8F] text-sm hover:underline truncate max-w-[180px]">
                    {card.email}
                  </a>
                </div>
              )}
              {card.kakao_id && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Kakao ID
                  </span>
                  <span className="text-[#FF9C8F] text-sm truncate max-w-[180px]">{card.kakao_id}</span>
                </div>
              )}
              {card.phone && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    Phone
                  </span>
                  <a href={`tel:${card.phone}`} className="text-[#FF9C8F] text-sm hover:underline truncate max-w-[180px]">
                    {card.phone}
                  </a>
                </div>
              )}
            </div>
          )}

          {myRatings && onEditRatings && (
            <div className="mt-6 p-4 bg-[#FFE4E0]/30 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-gray-900">내가 매긴 점수</h4>
                <button
                  type="button"
                  onClick={onEditRatings}
                  className="text-sm text-[#FF9C8F] font-medium hover:underline"
                >
                  {myRatings.scores.length > 0 ? '수정' : '추가'}
                </button>
              </div>
              {myRatings.scores.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {myRatings.scores.map((s) => (
                      <div key={s.category} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{s.category}</span>
                        <span className="font-bold text-[#FF9C8F]">{s.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  {myRatings.privateNotes && (
                    <p className="mt-3 text-sm text-gray-600 border-t border-[#FF9C8F]/20 pt-3">{myRatings.privateNotes}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">점수를 추가해보세요</p>
              )}
            </div>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('이 카드를 삭제하시겠습니까?')) {
                  onDelete(card.id)
                  onClose?.()
                }
              }}
              className="w-full mt-6 py-3 text-red-600 text-sm font-medium border border-red-200 rounded-xl hover:bg-red-50"
            >
              카드 삭제
            </button>
          )}
        </div>
      </div>
  )

  return (
    <>
      {isInline ? (
        <div className="max-w-md mx-auto">{content}</div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
          {content}
        </div>
      )}

      <ShareModal
        card={card}
        isOpen={showShare}
        onClose={() => setShowShare(false)}
      />
    </>
  )
}
