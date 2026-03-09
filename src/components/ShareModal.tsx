import type { UserCard } from '@/hooks/useUserCards'

type Props = {
  card: UserCard
  isOpen: boolean
  onClose: () => void
}

function getShareUrl(cardId: string): string {
  return `${window.location.origin}/?card=${cardId}`
}

function getShareText(card: UserCard): string {
  const parts = [
    card.card_name && `📇 ${card.card_name}`,
    card.custom_title && `직함: ${card.custom_title}`,
    card.description && `\n${card.description}`,
    card.email && `\n이메일: ${card.email}`,
    card.kakao_id && `\n카카오: ${card.kakao_id}`,
    card.phone && `\n연락처: ${card.phone}`,
    card.portfolio_url && `\n포트폴리오: ${card.portfolio_url}`,
  ].filter(Boolean)
  return parts.join('\n') + `\n\n${getShareUrl(card.id)}`
}

export default function ShareModal({ card, isOpen, onClose }: Props) {
  if (!isOpen) return null

  const shareUrl = getShareUrl(card.id)
  const shareText = getShareText(card)

  const handleKakaoShare = () => {
    window.open(
      `https://story.kakao.com/share?url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=600'
    )
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`${card.card_name || '명함'} 카드 공유`)
    const body = encodeURIComponent(shareText)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-6">
        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-4">공유하기</h3>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleKakaoShare}
            className="w-full flex items-center justify-center gap-3 py-4 bg-[#FEE500] text-[#191919] font-medium rounded-xl hover:bg-[#FDD835]"
          >
            <span className="text-2xl">💬</span>
            카카오톡으로 공유
          </button>
          <button
            type="button"
            onClick={handleEmailShare}
            className="w-full flex items-center justify-center gap-3 py-4 bg-gray-100 text-gray-800 font-medium rounded-xl hover:bg-gray-200"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            이메일로 공유
          </button>
        </div>
      </div>
    </div>
  )
}
